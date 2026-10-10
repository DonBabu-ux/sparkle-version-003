const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const ROUTES_DIR = path.join(ROOT, "routes", "api");
const INDEX_FILE = path.join(ROUTES_DIR, "index.js");

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

const EXTERNAL_PATTERNS = [
    /otp/i,
    /sms/i,
    /email\/request/i,
    /verify-email/i,
    /verify-sms/i,
    /password/i,
    /2fa/i,
    /recovery/i,
    /paystack/i,
    /wallet/i,
    /payment/i,
    /deposit/i,
    /withdraw/i,
    /webhook/i,
    /upload/i,
    /media/i,
    /deploy-ota/i,
    /fcm/i,
    /push/i,
    /google\/sync/i,
    /support/i
];

const DESTRUCTIVE_PATTERNS = [
    /\/delete/i,
    /\/terminate/i,
    /\/remove/i,
    /\/ban/i,
    /\/kick/i,
    /\/leave/i,
    /\/logout/i,
    /\/clear/i,
    /\/reset/i,
    /\/disable/i,
    /\/reject/i,
    /\/cancel/i
];

const CONTROLLED_WRITE_PATTERNS = [
    /\/like/i,
    /\/spark/i,
    /\/save/i,
    /\/view/i,
    /\/share/i,
    /\/read/i,
    /\/unread/i,
    /\/favorite/i,
    /\/star/i,
    /\/pin/i,
    /\/follow/i,
    /\/mute/i,
    /\/archive/i,
    /\/history/i,
    /\/react/i,
    /\/engagement/i,
    /\/action/i
];

function walk(dir) {
    if (!fs.existsSync(dir)) return [];

    const output = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            output.push(...walk(full));
        } else if (/\.(js|cjs|mjs|ts|tsx)$/.test(entry.name)) {
            output.push(full);
        }
    }

    return output;
}

function normalize(value) {
    return value
        .replace(/['"`]/g, "")
        .replace(/\/+/g, "/")
        .replace(/\/$/, "") || "/";
}

function routeFileKey(file) {
    return path.basename(file)
        .replace(/\.(js|cjs|mjs|ts|tsx)$/, "")
        .replace(/\.routes?$/i, "")
        .toLowerCase();
}

/*
 * Read index.js and attempt to discover:
 *
 * const postsRoutes = require('./posts.routes');
 * router.use('/posts', postsRoutes);
 *
 * or:
 *
 * import postsRoutes from './posts.routes.js';
 * router.use('/posts', postsRoutes);
 */
function discoverMounts() {
    const mounts = [];
    if (!fs.existsSync(INDEX_FILE)) return mounts;

    const source = fs.readFileSync(INDEX_FILE, "utf8");

    const imports = {};

    let match;

    const requireRegex =
        /(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    while ((match = requireRegex.exec(source))) {
        imports[match[1]] = path.basename(match[2])
            .replace(/\.(js|cjs|mjs|ts|tsx)$/, "");
    }

    const importRegex =
        /import\s+(\w+)(?:\s*,[\s\S]*?)?\s+from\s+['"]([^'"]+)['"]/g;

    while ((match = importRegex.exec(source))) {
        imports[match[1]] = path.basename(match[2])
            .replace(/\.(js|cjs|mjs|ts|tsx)$/, "");
    }

    const useRegex =
        /(?:router|app)\.use\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/g;

    while ((match = useRegex.exec(source))) {
        const prefix = normalize(match[1]);
        const variable = match[2];
        const importedFile = imports[variable];

        if (importedFile) {
            mounts.push({
                prefix,
                variable,
                fileKey: importedFile.toLowerCase()
            });
        }
    }

    return mounts;
}

function inferPrefix(file) {
    const key = routeFileKey(file);

    const mounts = discoverMounts();

    const exact = mounts.find(m =>
        m.fileKey === key ||
        m.fileKey.replace(/\.routes?$/i, "") === key
    );

    if (exact) return exact.prefix;

    const aliases = {
        "auth": "/auth",
        "user": "/users",
        "users": "/users",
        "message": "/messages",
        "messages": "/messages",
        "groupchat": "/groupChat",
        "groups": "/groups",
        "rooms": "/rooms",
        "posts": "/posts",
        "stories": "/stories",
        "moments": "/moments",
        "notifications": "/notifications",
        "onboarding": "/onboarding",
        "discover": "/discover",
        "location": "/location",
        "ai": "/ai",
        "sparkly": "/sparkly",
        "marketplace": "/marketplace",
        "confession": "/confessions",
        "confessions": "/confessions",
        "skill-market": "/skill-market",
        "search": "/search",
        "realtime": "/realtime",
        "support": "/support",
        "link-preview": "/link-preview",
        "clubs": "/clubs",
        "lost-found": "/lost-found",
        "analytics": "/analytics",
        "highlights": "/highlights",
        "stickers": "/stickers",
        "giphy": "/giphy",
        "music": "/music",
        "audio": "/audio",
        "moderation": "/moderation",
        "media-admin": "/admin/media",
        "ota": "/ota",
        "wallet": "/wallet",
        "boost": "/boost",
        "media": "/media",
        "security": "/security",
        "upload": "/upload"
    };

    return aliases[key] || "/";
}

function classify(method, fullPath) {
    const upperMethod = method.toUpperCase();

    if (fullPath === "/health" || fullPath === "/api/health") {
        return "SAFE_READ";
    }

    if (EXTERNAL_PATTERNS.some(pattern => pattern.test(fullPath))) {
        return "EXTERNAL_SIDE_EFFECT";
    }

    if (DESTRUCTIVE_PATTERNS.some(pattern => pattern.test(fullPath))) {
        return "DESTRUCTIVE";
    }

    if (upperMethod === "GET" ||
        upperMethod === "HEAD" ||
        upperMethod === "OPTIONS") {

        return "SAFE_READ";
    }

    if (
        upperMethod === "POST" ||
        upperMethod === "PUT" ||
        upperMethod === "PATCH"
    ) {
        if (CONTROLLED_WRITE_PATTERNS.some(pattern => pattern.test(fullPath))) {
            return "CONTROLLED_WRITE";
        }

        return "WRITE_REQUIRES_REVIEW";
    }

    if (upperMethod === "DELETE") {
        return "DESTRUCTIVE";
    }

    return "UNKNOWN";
}

const files = walk(ROUTES_DIR);
const mounts = discoverMounts();
const endpoints = [];

for (const file of files) {
    if (path.basename(file) === "index.js") continue;

    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    const prefix = inferPrefix(file);

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        for (const method of METHODS) {
            const regex = new RegExp(
                `\\b(?:router|app)\\.${method}\\s*\\(\\s*(['"\`])([^'"\`]+)\\1`,
                "i"
            );

            const match = trimmed.match(regex);

            if (!match) continue;

            const route = normalize(match[2]);

            let fullPath;

            if (prefix === "/") {
                fullPath = route;
            } else if (route === "/") {
                fullPath = prefix;
            } else {
                fullPath = `${prefix}${route}`;
            }

            fullPath = normalize(`/api${fullPath}`);

            endpoints.push({
                method: method.toUpperCase(),
                path: fullPath,
                routePath: route,
                prefix,
                file: path.relative(ROOT, file),
                line: index + 1,
                classification: classify(method, fullPath)
            });
        }
    });
}

endpoints.sort((a, b) =>
    a.path.localeCompare(b.path) ||
    a.method.localeCompare(b.method) ||
    a.file.localeCompare(b.file)
);

const groups = {
    SAFE_READ: [],
    AUTH_READ: [],
    CONTROLLED_WRITE: [],
    WRITE_REQUIRES_REVIEW: [],
    EXTERNAL_SIDE_EFFECT: [],
    DESTRUCTIVE: [],
    UNKNOWN: []
};

for (const endpoint of endpoints) {
    groups[endpoint.classification].push(endpoint);
}

/*
 * Authenticated reads are still GETs, but we identify likely
 * private/user-specific APIs separately for k6.
 */
const PRIVATE_PREFIXES = [
    "/api/users",
    "/api/messages",
    "/api/notifications",
    "/api/security",
    "/api/marketplace",
    "/api/groups",
    "/api/groupChat",
    "/api/rooms",
    "/api/realtime",
    "/api/onboarding",
    "/api/wallet",
    "/api/boost",
    "/api/analytics"
];

const safeRead = [];
const authRead = [];

for (const endpoint of groups.SAFE_READ) {
    if (
        endpoint.method === "GET" &&
        PRIVATE_PREFIXES.some(prefix =>
            endpoint.path.toLowerCase().startsWith(prefix.toLowerCase())
        )
    ) {
        authRead.push(endpoint);
    } else {
        safeRead.push(endpoint);
    }
}

function writeJson(filename, data) {
    fs.writeFileSync(
        path.join(ROOT, filename),
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                count: data.length,
                endpoints: data
            },
            null,
            2
        ),
        "utf8"
    );
}

writeJson("sparkle-api-inventory.json", endpoints);
writeJson("sparkle-load-test-safe.json", safeRead);
writeJson("sparkle-load-test-auth-read.json", authRead);
writeJson("sparkle-load-test-controlled-write.json", groups.CONTROLLED_WRITE);
writeJson(
    "sparkle-load-test-excluded.json",
    [
        ...groups.WRITE_REQUIRES_REVIEW,
        ...groups.EXTERNAL_SIDE_EFFECT,
        ...groups.DESTRUCTIVE,
        ...groups.UNKNOWN
    ]
);

let report = "";

report += "===============================================\n";
report += "              SPARKLE API INVENTORY\n";
report += "===============================================\n\n";

report += `Generated: ${new Date().toISOString()}\n`;
report += `Route files scanned: ${files.length - 1}\n`;
report += `Mounts discovered: ${mounts.length}\n`;
report += `Endpoints detected: ${endpoints.length}\n\n`;

report += "-----------------------------------------------\n";
report += "CLASSIFICATION SUMMARY\n";
report += "-----------------------------------------------\n";
report += `SAFE_READ                 : ${safeRead.length}\n`;
report += `AUTH_READ                 : ${authRead.length}\n`;
report += `CONTROLLED_WRITE          : ${groups.CONTROLLED_WRITE.length}\n`;
report += `WRITE_REQUIRES_REVIEW     : ${groups.WRITE_REQUIRES_REVIEW.length}\n`;
report += `EXTERNAL_SIDE_EFFECT      : ${groups.EXTERNAL_SIDE_EFFECT.length}\n`;
report += `DESTRUCTIVE               : ${groups.DESTRUCTIVE.length}\n`;
report += `UNKNOWN                   : ${groups.UNKNOWN.length}\n\n`;

report += "-----------------------------------------------\n";
report += "DISCOVERED ROUTE MOUNTS\n";
report += "-----------------------------------------------\n";

for (const mount of mounts) {
    report += `${mount.prefix.padEnd(25)} ${mount.fileKey}\n`;
}

function addSection(title, list) {
    report += `\n-----------------------------------------------\n`;
    report += `${title}\n`;
    report += `-----------------------------------------------\n`;

    for (const endpoint of list) {
        report += `${endpoint.method.padEnd(8)} ${endpoint.path.padEnd(60)} ${endpoint.file}:${endpoint.line}\n`;
    }
}

addSection("SAFE READ ENDPOINTS", safeRead);
addSection("AUTHENTICATED READ ENDPOINTS", authRead);
addSection("CONTROLLED WRITE ENDPOINTS", groups.CONTROLLED_WRITE);
addSection("WRITE ENDPOINTS REQUIRING REVIEW", groups.WRITE_REQUIRES_REVIEW);
addSection("EXTERNAL SIDE-EFFECT ENDPOINTS", groups.EXTERNAL_SIDE_EFFECT);
addSection("DESTRUCTIVE ENDPOINTS", groups.DESTRUCTIVE);
addSection("UNKNOWN ENDPOINTS", groups.UNKNOWN);

report += "\n===============================================\n";
report += "LOAD TEST RULES\n";
report += "===============================================\n";
report += "1. Start with SAFE_READ.\n";
report += "2. Add AUTH_READ using dedicated test accounts.\n";
report += "3. Add CONTROLLED_WRITE gradually with cleanup.\n";
report += "4. Do not mass-fire EXTERNAL_SIDE_EFFECT routes.\n";
report += "5. Do not mass-fire DESTRUCTIVE routes.\n";
report += "6. Keep payment, OTP/SMS, password and account-deletion routes excluded.\n";
report += "7. Test staging/test infrastructure before production.\n";

fs.writeFileSync(
    path.join(ROOT, "sparkle-api-inventory.txt"),
    report,
    "utf8"
);

console.log("");
console.log("===============================================");
console.log("       SPARKLE API INVENTORY COMPLETE");
console.log("===============================================");
console.log("");
console.log(`Route files scanned : ${files.length - 1}`);
console.log(`Mounts discovered   : ${mounts.length}`);
console.log(`Endpoints detected  : ${endpoints.length}`);
console.log("");
console.log(`SAFE_READ           : ${safeRead.length}`);
console.log(`AUTH_READ           : ${authRead.length}`);
console.log(`CONTROLLED_WRITE    : ${groups.CONTROLLED_WRITE.length}`);
console.log(`REQUIRES_REVIEW     : ${groups.WRITE_REQUIRES_REVIEW.length}`);
console.log(`EXTERNAL            : ${groups.EXTERNAL_SIDE_EFFECT.length}`);
console.log(`DESTRUCTIVE         : ${groups.DESTRUCTIVE.length}`);
console.log(`UNKNOWN             : ${groups.UNKNOWN.length}`);
console.log("");
console.log("Generated:");
console.log("  sparkle-api-inventory.txt");
console.log("  sparkle-api-inventory.json");
console.log("  sparkle-load-test-safe.json");
console.log("  sparkle-load-test-auth-read.json");
console.log("  sparkle-load-test-controlled-write.json");
console.log("  sparkle-load-test-excluded.json");
console.log("");
