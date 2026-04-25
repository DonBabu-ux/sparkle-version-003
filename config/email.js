const emailService = require('../services/email.service');

const initializeEmail = () => {
    // Service initializes itself on require
};

const sendEmail = async (options) => {
    return emailService.send(options);
};

// Common templates for centralized management
const templates = {
    verifyEmail: (name, code) => ({
        templateName: 'verify-email',
        subject: 'Verify your Sparkle account',
        templateData: { name, code }
    }),
    welcomeEmail: (name) => ({
        templateName: 'welcome',
        subject: 'Welcome to Sparkle!',
        templateData: { name }
    }),
    resetPassword: (name, token) => ({
        templateName: 'reset-password',
        subject: 'Reset your Sparkle password',
        templateData: { name, token }
    }),
    securityAlert: (name, details) => ({
        templateName: 'security-alert',
        subject: 'Security Alert: New login detected',
        templateData: { name, ...details }
    })
};

module.exports = {
    initializeEmail,
    sendEmail,
    templates
};

