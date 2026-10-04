const nodemailer = require('nodemailer');
const { renderTemplate } = require('./email-templates');
const logger = require('../utils/logger');

/**
 * Production-ready Email Service
 * Supports multiple providers and robust error handling.
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.initialize();
    }

    initialize() {
        const provider = process.env.EMAIL_PROVIDER || 'smtp'; // 'smtp', 'sendgrid', 'mailgun'
        
        if (provider === 'sendgrid') {
            this.transporter = nodemailer.createTransport({
                host: 'smtp.sendgrid.net',
                port: 587,
                auth: {
                    user: 'apikey',
                    pass: process.env.SENDGRID_API_KEY
                }
            });
        } else {
            // Default SMTP (Gmail or other)
            this.transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: process.env.EMAIL_PORT || 587,
                secure: process.env.EMAIL_SECURE === 'true',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
        }

        if (this.transporter) {
            this.transporter.verify((error) => {
                if (error) {
                    logger.error('Email Service: Connection failed:', error);
                } else {
                    logger.info(`Email Service: Ready using ${provider}`);
                }
            });
        }
    }

    async send({ to, subject, templateName, templateData }) {
        if (!this.transporter && process.env.NODE_ENV === 'production') {
            logger.error('Email Service: Not initialized. Cannot send email to:', to);
            return null;
        }

        try {
            const html = renderTemplate(templateName, templateData);

            const logoPath = path.join(__dirname, '../public/images/logo.png');
            const fs = require('fs');
            const attachments = [];
            if (fs.existsSync(logoPath)) {
                attachments.push({
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'sparklelogo'
                });
            }

            const mailOptions = {
                from: `"Sparkle" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to,
                subject,
                html,
                attachments,
                text: `Please view this email in an HTML client. ${templateData.actionUrl || ''}`
            };

            if (!this.transporter) {
                logger.info(`[SIMULATED EMAIL] To: ${to}, Subject: ${subject}`);
                return { messageId: 'simulated' };
            }

            const info = await this.transporter.sendMail(mailOptions);
            logger.info(`Email sent successfully: ${info.messageId}`);
            return info;
        } catch (error) {
            logger.error('Email Service: Send error:', error);
            // In a real production app, you might want to queue this for retry
            throw error;
        }
    }
}

module.exports = new EmailService();
