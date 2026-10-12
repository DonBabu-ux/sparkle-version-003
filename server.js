/**
 * Root entry point for hosting platforms (Render, Railway, Heroku, etc.)
 * that run `node server.js` from the repository root.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });
require('dotenv').config();

require('./backend/server.js');
