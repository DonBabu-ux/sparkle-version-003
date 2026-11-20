const emailService = require('../services/email.service');

const initializeEmail = () => {
    // Service initializes itself on require
};

const sendEmail = async (options) => {
    return emailService.send(options);
};

// Common templates for centralized management
// APP_URL is trimmed on every use to strip trailing \r from Windows .env line endings.
const getAppUrl = () => (process.env.APP_URL || 'https://sparklewebapp.vercel.app').replace(/[\r\n\s]+$/, '').trim();

const templates = {
    verifyEmail: (name, code) => ({
        templateName: 'verify-email',
        subject: 'Verify your Sparkle account',
        templateData: { name, code, verifyUrl: `${getAppUrl()}/verify-email?code=${code}` }
    }),
    welcomeEmail: (name) => ({
        templateName: 'welcome',
        subject: 'Welcome to Sparkle!',
        templateData: { name, loginUrl: `${getAppUrl()}/login`, dashboardUrl: `${getAppUrl()}/dashboard` }
    }),
    resetPassword: (name, token) => ({
        templateName: 'reset-password',
        subject: 'Reset your Sparkle password',
        templateData: { name, code: token, resetUrl: `${getAppUrl()}/reset-password?token=${token}` }
    }),
    securityAlert: (name, details) => ({
        templateName: 'security-alert',
        subject: 'Security Alert: New login detected',
        templateData: { name, ...details }
    }),
    twoFaOtp: (name, code, purpose) => ({
        templateName: '2fa-otp',
        subject: 'Your Sparkle Login Verification Code',
        templateData: {
            name,
            code,
            purpose: purpose || 'Use the code below to log in to your Sparkle account.'
        }
    })
};

module.exports = {
    initializeEmail,
    sendEmail,
    templates
};

