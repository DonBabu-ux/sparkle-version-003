const fs = require('fs');
const file = process.argv[2];
const content = fs.readFileSync(file, 'utf8');

let braces = 0;
let lineNum = 1;
for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') braces++;
    if (content[i] === '}') braces--;
    if (content[i] === '\n') lineNum++;
    
    if (braces < 0) {
        console.log(`Extra closing brace at line ${lineNum}`);
        process.exit(1);
    }
}

if (braces > 0) {
    console.log(`Missing ${braces} closing braces`);
} else {
    console.log('Braces balanced');
}
