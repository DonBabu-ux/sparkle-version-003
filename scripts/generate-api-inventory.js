const fs = require("fs");
const path = require("path");

const ROUTES_DIR = path.resolve("routes");
const OUT_TXT = path.resolve("api-inventory.txt");
const OUT_JSON = path.resolve("api-inventory.json");

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options", "use"];
const results = [];

function walk(dir) {
    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...walk(full));
        } else if (/\.(js|cjs|mjs|ts|tsx)$/.test(entry.name)) {
            files.push(full);
        }
    }

    return files;
}

function cleanRoute(route) {
    return route
        .replace(/['"`]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

const files = walk(ROUTES_DIR);

for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        for (const method of METHODS) {
            const regex = new RegExp(
                `\\b(?:router|app)\\.${method}\\s*\\(\\s*(['"\`])([^'"\`]+)\\1`,
                "i"
            );

            const match = trimmed.match(regex);

            if (match) {
                results.push({
                    method: method.toUpperCase(),
                    path: cleanRoute(match[2]),
                    file: path.relative(process.cwd(), file),
                    line: index + 1
                });
            }
        }
    });
}

results.sort((a, b) =>
    a.file.localeCompare(b.file) ||
    a.line - b.line ||
    a.method.localeCompare(b.method)
);

const grouped = {};

for (const item of results) {
    if (!grouped[item.file]) grouped[item.file] = [];
    grouped[item.file].push(item);
}

let txt = "";
txt += "========================================\n";
txt += "        SPARKLE API INVENTORY\n";
txt += "========================================\n\n";
txt += `Generated: ${new Date().toISOString()}\n`;
txt += `Routes directory: ${ROUTES_DIR}\n`;
txt += `Route files scanned: ${files.length}\n`;
txt += `Endpoints detected: ${results.length}\n\n`;

for (const [file, endpoints] of Object.entries(grouped)) {
    txt += `\n--- ${file} ---\n`;

    for (const endpoint of endpoints) {
        txt += `${endpoint.method.padEnd(8)} ${endpoint.path.padEnd(45)} line ${endpoint.line}\n`;
    }
}

txt += "\n========================================\n";
txt += "LOAD-TEST SAFETY NOTES\n";
txt += "========================================\n";
txt += "GET/HEAD/OPTIONS routes are generally safer candidates for automated load testing.\n";
txt += "POST/PUT/PATCH/DELETE routes may create, modify, send, delete, charge, or trigger data.\n";
txt += "Review write endpoints before adding them to a load test.\n";
txt += "Never blindly stress password reset, OTP/SMS, payment, account deletion, or media-upload endpoints.\n";

fs.writeFileSync(OUT_TXT, txt, "utf8");

fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            routesDirectory: ROUTES_DIR,
            filesScanned: files.length,
            endpointCount: results.length,
            endpoints: results
        },
        null,
        2
    ),
    "utf8"
);

console.log("");
console.log("========================================");
console.log("       SPARKLE API SCAN COMPLETE");
console.log("========================================");
console.log(`Route files scanned : ${files.length}`);
console.log(`Endpoints detected  : ${results.length}`);
console.log("");
console.log(`TXT inventory : ${OUT_TXT}`);
console.log(`JSON inventory: ${OUT_JSON}`);
console.log("");
