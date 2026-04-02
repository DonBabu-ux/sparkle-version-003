const fs = require('fs');

const content = fs.readFileSync('views/settings.ejs', 'utf8');
const scripts = content.match(/<script>([\s\S]*?)<\/script>/g);

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
            // Let's try to pinpoint the line
            const lines = jsOnly.split('\n');
            for(let i=1; i<=lines.length; i++) {
                try {
                    new Function(lines.slice(0, i).join('\n') + '\n}'); 
                } catch(err) {
                    // This is naive but might help
                }
            }
        }
    });
}
