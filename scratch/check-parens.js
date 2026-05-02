const fs = require('fs');
const file = process.argv[2];
const content = fs.readFileSync(file, 'utf8');

let parens = 0;
let lineNum = 1;
for (let i = 0; i < content.length; i++) {
    if (content[i] === '(') parens++;
    if (content[i] === ')') parens--;
    if (content[i] === '\n') lineNum++;
    
    if (parens < 0) {
        console.log(`Extra closing paren at line ${lineNum}`);
        process.exit(1);
    }
}

if (parens > 0) {
    console.log(`Missing ${parens} closing parens`);
} else {
    console.log('Parens balanced');
}
