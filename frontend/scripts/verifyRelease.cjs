const fs = require('fs');
const path = require('path');

function verifyReleaseUrl() {
  const envPath = path.resolve(__dirname, '../.env');
  const productionEnvPath = path.resolve(__dirname, '../.env.production');

  const checkFile = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const invalidPatterns = [
      /localhost/i,
      /127\.0\.0\.1/,
      /10\.0\.2\.2/,
      /192\.168\.\d+\.\d+/
    ];

    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('VITE_API_URL') || line.trim().startsWith('API_URL')) {
        for (const pattern of invalidPatterns) {
          if (pattern.test(line)) {
            console.error(`\x1b[31m[BUILD ERROR] Invalid API URL configuration in ${filePath}:\x1b[0m`);
            console.error(`\x1b[31m  > ${line.trim()}\x1b[0m`);
            console.error(`\x1b[31mRelease builds are not permitted to use local/development API endpoints!\x1b[0m`);
            process.exit(1);
          }
        }
      }
    }
  };

  checkFile(envPath);
  checkFile(productionEnvPath);
  console.log('\x1b[32m[BUILD CHECK] API URLs verified successfully for production release.\x1b[0m');
}

verifyReleaseUrl();
