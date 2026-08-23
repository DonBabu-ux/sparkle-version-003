const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceCandidates = [
  path.join(projectRoot, 'sparkle docs', 'sparkle docs'),
  path.join(projectRoot, 'sparkle docs')
];

const targetDir = path.join(projectRoot, 'frontend', 'public', 'docs');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

let foundDir = null;
for (const cand of sourceCandidates) {
  if (fs.existsSync(cand)) {
    const files = fs.readdirSync(cand).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (files.length > 0) {
      foundDir = cand;
      break;
    }
  }
}

if (!foundDir) {
  console.error('❌ Could not find any PDF files in sparkle docs folders');
  process.exit(1);
}

console.log(`📁 Source directory: ${foundDir}`);
console.log(`📂 Target directory: ${targetDir}`);

const pdfFiles = fs.readdirSync(foundDir).filter(f => f.toLowerCase().endsWith('.pdf'));

let copied = 0;
pdfFiles.forEach(file => {
  const srcFile = path.join(foundDir, file);
  const destFile = path.join(targetDir, file);
  fs.copyFileSync(srcFile, destFile);
  console.log(`✅ Copied: ${file}`);
  copied++;
});

console.log(`✨ Successfully synced ${copied} legal PDF document(s) to frontend/public/docs/`);
