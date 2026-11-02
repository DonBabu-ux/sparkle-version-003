require('dotenv').config();
const pool = require('../config/database');
const fs = require('fs');

(async () => {
  console.log('Fetching tables...');
  const [tables] = await pool.query(`
    SELECT TABLE_NAME, TABLE_COLLATION, TABLE_COMMENT, ENGINE, TABLE_ROWS
      FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME
  `);
  console.log('  ' + tables.length + ' tables');

  console.log('Fetching all columns...');
  const [cols] = await pool.query(`
    SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE, IS_NULLABLE,
           COLUMN_DEFAULT, EXTRA, COLLATION_NAME, COLUMN_KEY, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  console.log('  ' + cols.length + ' columns');

  console.log('Fetching indexes...');
  const [idx] = await pool.query(`
    SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
  `);
  console.log('  ' + idx.length + ' index rows');

  console.log('Fetching constraints...');
  const [cons] = await pool.query(`
    SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
     ORDER BY TABLE_NAME, CONSTRAINT_NAME
  `);
  console.log('  ' + cons.length + ' constraints');

  console.log('Fetching foreign keys...');
  const [fks] = await pool.query(`
    SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME,
           REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY TABLE_NAME, CONSTRAINT_NAME
  `);
  console.log('  ' + fks.length + ' foreign keys');

  // ── assemble offline ──────────────────────────────────────────────
  const byTable = {};
  const push = (row) => { (byTable[row.TABLE_NAME] = byTable[row.TABLE_NAME] || []).push(row); };
  cols.forEach(push); const colIdx = {};
  cols.forEach((c) => { (colIdx[c.TABLE_NAME] = colIdx[c.TABLE_NAME] || []).push(c); });

  const idxBy = {};
  idx.forEach((i) => { (idxBy[i.TABLE_NAME] = idxBy[i.TABLE_NAME] || []).push(i); });
  const consBy = {};
  cons.forEach((c) => { (consBy[c.TABLE_NAME] = consBy[c.TABLE_NAME] || []).push(c); });
  const fkBy = {};
  fks.forEach((f) => { (fkBy[f.TABLE_NAME] = fkBy[f.TABLE_NAME] || []).push(f); });

  const group = (arr, key) => {
    const m = {};
    arr.forEach((r) => { (m[r[key]] = m[r[key]] || []).push(r); });
    return m;
  };
  const idxGrouped = group(idx, 'TABLE_NAME');      // then per-table group by INDEX_NAME

  const out = [];
  out.push('# Sparkle API — full schema structure');
  out.push('');
  out.push('Extracted directly from `INFORMATION_SCHEMA` for the live `lilbee_sparkle`');
  out.push('database. **Structure only — no table data.**');
  out.push('');
  out.push('- Tables: ' + tables.length);
  out.push('- Columns: ' + cols.length);
  out.push('- Constraints: ' + cons.length + ' (of which foreign keys: ' + fks.length + ')');
  out.push('');
  out.push('Anything not on the common `utf8mb4_general_ci` collation is **bolded** —');
  out.push('those were the migration targets that broke cross-table comparisons.');
  out.push('');
  out.push('| # | Table | Collation | Rows | Columns | FKs |');
  out.push('|---|-------|-----------|------|---------|-----|');
  tables.forEach((t, i) => {
    const cCount = (colIdx[t.TABLE_NAME] || []).length;
    const fCount = (fkBy[t.TABLE_NAME] || []).length;
    const tc = t.TABLE_COLLATION !== 'utf8mb4_general_ci'
      ? '**`' + t.TABLE_COLLATION + '`**' : '`' + t.TABLE_COLLATION + '`';
    out.push('| ' + (i + 1) + ' | `' + t.TABLE_NAME + '` | ' + tc + ' | ' +
             (t.TABLE_ROWS || 0) + ' | ' + cCount + ' | ' + fCount + ' |');
  });
  out.push('');
  out.push('---');
  out.push('');

  for (const t of tables) {
    const tCols = colIdx[t.TABLE_NAME] || [];
    const odd = t.TABLE_COLLATION !== 'utf8mb4_general_ci';
    out.push('## `' + t.TABLE_NAME + '`');
    out.push('');
    out.push('Engine `' + t.ENGINE + '` · collation ' +
             (odd ? '**' + t.TABLE_COLLATION + '**' : t.TABLE_COLLATION) +
             (t.TABLE_COMMENT ? ' · _' + t.TABLE_COMMENT + '_' : ''));
    out.push('');
    out.push('| # | Column | Type | Null | Default | Key | Extra | Collation |');
    out.push('|---|--------|------|------|---------|-----|-------|-----------|');
    tCols.forEach((c) => {
      const Nullable = c.IS_NULLABLE === 'YES' ? 'YES' : 'NO';
      const Default = c.COLUMN_DEFAULT === null
        ? '—'
        : (c.COLUMN_DEFAULT === 'NULL' ? "**'NULL' ← string!**" : '`' + String(c.COLUMN_DEFAULT) + '`');
      const colOdd = c.COLLATION_NAME && c.COLLATION_NAME !== 'utf8mb4_general_ci';
      const Coll = c.COLLATION_NAME
        ? (colOdd ? '**`' + c.COLLATION_NAME + '`**' : '`' + c.COLLATION_NAME + '`') : '—';
      out.push('| ' + c.ORDINAL_POSITION + ' | `' + c.COLUMN_NAME + '` | `' + c.COLUMN_TYPE + '` | ' +
               Nullable + ' | ' + Default + ' | ' + (c.COLUMN_KEY || '—') + ' | ' +
               (c.EXTRA || '—') + ' | ' + Coll + ' |');
    });
    out.push('');

    const tIdx = idxBy[t.TABLE_NAME] || [];
    if (tIdx.length) {
      const byName = {};
      tIdx.forEach((r) => { (byName[r.INDEX_NAME] = byName[r.INDEX_NAME] || []).push(r.COLUMN_NAME); });
      out.push('**Indexes**');
      Object.keys(byName).forEach((n) => out.push('- `' + n + '` (' + byName[n].join(', ') + ')'));
      out.push('');
    }
    const tFk = fkBy[t.TABLE_NAME] || [];
    if (tFk.length) {
      out.push('**Foreign keys**');
      tFk.forEach((f) => out.push('- `' + f.CONSTRAINT_NAME + '`: (' + f.COLUMN_NAME + ') → `' +
                                      f.REFERENCED_TABLE_NAME + '`.' + f.REFERENCED_COLUMN_NAME));
      out.push('');
    }
    const tCon = (consBy[t.TABLE_NAME] || []).filter(
      (c) => !tFk.some((f) => f.CONSTRAINT_NAME === c.CONSTRAINT_NAME));
    if (tCon.length) {
      out.push('**Constraints**: ' + tCon.map((c) => '`' + c.CONSTRAINT_NAME + '` (' + c.CONSTRAINT_TYPE + ')').join(', '));
      out.push('');
    }
    out.push('---');
    out.push('');
  }

  fs.writeFileSync('SCHEMA_STRUCTURE.md', out.join('\n'));
  const bytes = fs.statSync('SCHEMA_STRUCTURE.md').size;
  console.log('\nWRITTEN: SCHEMA_STRUCTURE.md  ' + (bytes / 1024).toFixed(1) + ' KB');
  process.exit(0);
})().catch((e) => { console.log('FAILED: ' + (e.code || '') + ' ' + e.message); process.exit(1); });
