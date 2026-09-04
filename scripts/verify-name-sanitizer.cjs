const { sanitizePartnerName } = require('../frontend/src/utils/nameSanitizer.ts');

console.log('Testing sanitizePartnerName...');
console.log('Naty Babu00 ->', sanitizePartnerName('Naty Babu00'));
console.log('User00 (user00) ->', sanitizePartnerName('User00', 'user00'));
console.log('John 00 ->', sanitizePartnerName('John 00'));
console.log('Test Passed!');
