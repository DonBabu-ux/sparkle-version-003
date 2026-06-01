// generate_codebase.js
// This script generates a project file tree limited to the frontend and backend directories only,
// and includes a summary of file counts for those sections. It excludes .git, node_modules,
// and any other files outside the frontend/backend hierarchy.

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const EXCLUDE_DIRS = new Set(['.git', 'node_modules']);

let frontendCount = 0;
let backendCount = 0;
let rootCount = 0; // files directly under project root (should be none after filtering)
let totalCount = 0;

function shouldInclude(filePath) {
  const rel = path.relative(ROOT, filePath);
  // Exclude if any segment matches excluded dirs
  const segments = rel.split(path.sep);
  if (segments.some(seg => EXCLUDE_DIRS.has(seg))) return false;
  // Include only if path contains frontend or backend directory
  return segments.includes('frontend') || segments.includes('backend');
}

function walk(dir, prefix) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => !EXCLUDE_DIRS.has(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const lines = [];
  const lastIdx = entries.length - 1;
  entries.forEach((entry, idx) => {
    const isLast = idx === lastIdx;
    const connector = isLast ? '└──' : '├──';
    const linePrefix = prefix + connector + ' ' + entry.name + (entry.isDirectory() ? '/' : '');
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldInclude(fullPath)) {
        lines.push(linePrefix);
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        lines.push(...walk(fullPath, childPrefix));
      }
    } else {
      if (shouldInclude(fullPath)) {
        lines.push(linePrefix);
        // Count files for summary
        totalCount++;
        if (fullPath.includes(path.sep + 'frontend' + path.sep)) frontendCount++;
        else if (fullPath.includes(path.sep + 'backend' + path.sep)) backendCount++;
        else rootCount++;
      }
    }
  });
  return lines;
}

const treeLines = [];
// Start from root, but only include top‑level frontend and backend directories
const topEntries = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter(e => !EXCLUDE_DIRS.has(e.name))
  .filter(e => e.isDirectory() && (e.name === 'frontend' || e.name === 'backend'))
  .sort((a, b) => a.name.localeCompare(b.name));

topEntries.forEach((entry, idx) => {
  const isLast = idx === topEntries.length - 1;
  const connector = isLast ? '└──' : '├──';
  const line = connector + ' ' + entry.name + '/';
  treeLines.push(line);
  const childPrefix = isLast ? '    ' : '│   ';
  treeLines.push(...walk(path.join(ROOT, entry.name), childPrefix));
});

const summary = `---\n\n## PROJECT SUMMARY\n\nFrontend Files: ${frontendCount}\nBackend Files: ${backendCount}\nRoot Files: ${rootCount}\nTotal Files: ${totalCount}`;

fs.writeFileSync(path.join(ROOT, 'codebase.txt'), treeLines.join('\n') + '\n' + summary, 'utf8');
