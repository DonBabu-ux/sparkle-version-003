const renderHome = (req, res) => res.render('index', { title: 'Welcome to Sparkle' });
const renderLogin = (req, res) => res.render('auth/login', { title: 'Login' });
const renderSignup = (req, res) => res.render('auth/signup', { title: 'Sign Up' });
const renderAbout = (req, res) => res.render('about', { title: 'About' });
const renderCacheBuster = (req, res) => res.render('cache-buster', { title: 'Cache Buster' });

module.exports = { renderHome, renderLogin, renderSignup, renderAbout, renderCacheBuster };
