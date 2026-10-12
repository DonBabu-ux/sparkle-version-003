/**
 * Root entry point for hosting platforms (Render, Railway, Heroku, etc.)
 * that run `node server.js` from the repository root.
 */
const path = require('path');

// Render (and most PaaS) have no IPv6 route — force IPv4-first DNS so
// outbound SMTP (nodemailer) doesn't pick an unreachable AAAA address.
require('dns').setDefaultResultOrder('ipv4first');

// backend/server.js only binds its port when it is the main module; running
// it through this root entry would skip server.listen() entirely (observed:
// "Port scan timeout reached" on Render). Flag it explicitly.
process.env.SPARKLE_ROOT_ENTRY = '1';

require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });
require('dotenv').config({ path: path.join(__dirname, 'backend/.env.production') });
require('dotenv').config();

require('./backend/server.js');
