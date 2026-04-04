const fs = require('fs');

const content = fs.readFileSync('views/marketplace.ejs', 'utf8');
// Clean out EJS tags first since they break new Function()
const cleanJS = content.replace(/<%[\s\S]*?%>/g, '');
const scripts = cleanJS.match(/<script>([\s\S]*?)<\/script>/g);

if (!scripts) {
    console.log('No <script> tags found');
} else {
    scripts.forEach((script, index) => {
        const jsOnly = script.replace('<script>', '').replace('</script>', '');
        try {
            new Function(jsOnly);
            console.log(`Script ${index + 1} is valid.`);
        } catch (e) {
            console.error(`Script ${index + 1} has a syntax error: ${e.message}`);
            // Let's try to pinpoint the line roughly
            const lines = jsOnly.split('\n');
            let accumulated = '';
            for(let i=0; i<lines.length; i++) {
                accumulated += lines[i] + '\n';
                try {
                    // This is still naive but can give more context
                    // We add enough braces to try and close open functions
                    new Function(accumulated + '\n' + '}'.repeat(10)); 
                } catch(err) {
                    if (!err.message.includes('Unexpected end of input')) {
                        console.log(`Potentially around line ${i + 1}: ${err.message}`);
                    }
                }
            }
        }
    });
}
