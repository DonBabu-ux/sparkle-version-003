const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const logger = require('../utils/logger');

let transporter;

const initializeEmail = () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        logger.warn('Email service not configured: EMAIL_USER and EMAIL_PASS env vars missing');
        return;
    }

    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    transporter.verify((error) => {
        if (error) {
            logger.error('Email service connection failed:', error);
        } else {
            logger.info('Email service ready to send messages');
        }
    });
};

const sendEmail = async ({ to, subject, templateName, templateData }) => {
    if (!transporter && process.env.NODE_ENV === 'production') {
        logger.warn('Email service not initialized, skipping email to:', to);
        return null;
    }

    try {
        const templatePath = path.join(__dirname, '../views/emails', `${templateName}.ejs`);
        const html = await ejs.renderFile(templatePath, templateData);

        const mailOptions = {
            from: `"Sparkle" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            // Simple text fallback
            text: `Please view this email in an HTML compatible client. URL: ${templateData.verifyUrl || templateData.resetUrl || ''}`
        };

        if (!transporter) {
            logger.info(`[SIMULATED EMAIL] To: ${to}, Subject: ${subject}. Template: ${templateName}`);
            return { messageId: 'simulated-id' };
        }

        const info = await transporter.sendMail(mailOptions);
        logger.info(`Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error('Send email error:', error);
        throw error;
    }
};

module.exports = {
    initializeEmail,
    sendEmail
};
