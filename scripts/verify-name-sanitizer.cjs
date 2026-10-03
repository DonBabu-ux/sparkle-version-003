const { sanitizePartnerName } = require('../frontend/src/utils/nameSanitizer.ts');

console.log('Testing sanitizePartnerName...');
console.log('Naty Babu00 ->', sanitizePartnerName('Naty Babu00'));
console.log('Naty Babu0000 ->', sanitizePartnerName('Naty Babu0000'));
console.log('User00 ->', sanitizePartnerName('User00'));
console.log('User0000 ->', sanitizePartnerName('User0000'));
console.log('John 00 ->', sanitizePartnerName('John 00'));
console.log('John 0000 ->', sanitizePartnerName('John 0000'));
console.log('Test Passed!');

