#!/usr/bin/env node
/**
 * Single-connection SQL dump importer.
 *
 * Usage:
 *   node tools/import-dump.js <dump.sql> [--database <name>] [--stop-on-error]
 *
 * Uses EXACTLY ONE MySQL connection (createConnection — never a pool),
 * so importing can never exhaust the shared 40-connection cap.
 *
 * Env (from .env): DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function parseArgs(argv) {
    const args = { file: null, database: process.env.DB_NAME, stopOnError: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--database' || a === '-d') args.database = argv[++i];
        else if (a === '--stop-on-error') args.stopOnError = true;
        else if (!args.file) args.file = a;
    }
    return args;
}

/**
 * Split a SQL script into statements without a parser library.
 * Handles: 'single' "double" `backtick` strings (with \ escapes and '' doubling),
 * -- line comments, # line comments, /* ... *\/ block comments,
 * and /*! ... *\/ executable comments (kept as statement content so the server executes them).
 */
function splitStatements(sql) {
    const statements = [];
    let buf = '';
    let i = 0;
    const n = sql.length;

    while (i < n) {
        const c = sql[i];
        const next = i + 1 < n ? sql[i + 1] : '';

        // --- strings / identifiers ---
        if (c === "'" || c === '"') {
            const quote = c;
            buf += c; i++;
            while (i < n) {
                const ch = sql[i];
                if (ch === '\\' && quote !== '`' && i + 1 < n) { buf += ch + sql[i + 1]; i += 2; continue; }
                buf += ch; i++;
                if (ch === quote) {
                    if (sql[i] === quote) { buf += sql[i]; i++; continue; } // doubled quote
                    break;
                }
            }
            continue;
        }
        if (c === '`') {
            buf += c; i++;
            while (i < n) {
                const ch = sql[i];
                buf += ch; i++;
                if (ch === '`') {
                    if (sql[i] === '`') { buf += sql[i]; i++; continue; }
                    break;
                }
            }
            continue;
        }

        // --- comments ---
        if (c === '#') { // line comment — keep, but never split on ; inside it
            while (i < n && sql[i] !== '\n') { buf += sql[i]; i++; }
            continue;
        }
        if (c === '-' && next === '-') {
            while (i < n && sql[i] !== '\n') { buf += sql[i]; i++; }
            continue;
        }
        if (c === '/' && next === '*') {
            const executable = i + 2 < n && sql[i + 2] === '!';
            let j = i + 2;
            while (j < n && !(sql[j] === '*' && sql[j + 1] === '/')) j++;
            const end = Math.min(j + 2, n);
            const chunk = sql.slice(i, end);
            if (executable) buf += chunk; // /*! ... */ must reach the server to be executed
            i = end;
            continue;
        }

        // --- statement terminator ---
        if (c === ';') {
            const stmt = buf.trim();
            if (stmt) statements.push(stmt);
            buf = '';
            i++;
            continue;
        }

        buf += c;
        i++;
    }
    const tail = buf.trim();
    if (tail) statements.push(tail);
    return statements;
}

async function main() {
    const args = parseArgs(process.argv);
    if (!args.file) {
        console.error('Usage: node tools/import-dump.js <dump.sql> [--database <name>] [--stop-on-error]');
        process.exit(2);
    }
    const file = path.resolve(args.file);
    if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        process.exit(2);
    }

    console.log(`Reading ${file} ...`);
    const sql = fs.readFileSync(file, 'utf8');
    const statements = splitStatements(sql);
    console.log(`${statements.length} statements. Opening ONE connection to ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${args.database} ...`);

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: args.database,
        port: process.env.DB_PORT || 3306,
        charset: 'utf8mb4',
        timezone: 'Z',
        connectTimeout: 15000
    });

    const started = Date.now();
    let ok = 0;
    const failures = [];

    for (let idx = 0; idx < statements.length; idx++) {
        const stmt = statements[idx];
        try {
            await conn.query(stmt);
            ok++;
        } catch (err) {
            failures.push({ idx, err: err.message, head: stmt.slice(0, 140).replace(/\s+/g, ' ') });
            if (args.stopOnError) {
                console.error(`\nSTOP at statement ${idx + 1}: ${err.message}`);
                console.error(`  ${statements[idx].slice(0, 200)}`);
                break;
            }
        }
        if ((idx + 1) % 500 === 0) {
            console.log(`  ... ${idx + 1}/${statements.length} (${ok} ok, ${failures.length} failed)`);
        }
    }

    try { await conn.end(); } catch (_) { /* ignore */ }

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\nDone in ${secs}s: ${ok}/${statements.length} statements ok, ${failures.length} failed.`);
    if (failures.length) {
        console.log('\nFailures (first 20):');
        for (const f of failures.slice(0, 20)) {
            console.log(`  #${f.idx + 1}: ${f.err}`);
            console.log(`      ${f.head}`);
        }
        if (failures.length > 20) console.log(`  ... and ${failures.length - 20} more`);
        process.exit(1);
    }
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
