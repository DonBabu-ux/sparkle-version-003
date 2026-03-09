const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter;

const initializeEmail = () => {
    // Only initialize if email credentials are configured
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

    // Verify connection configuration
    transporter.verify((error, success) => {
        if (error) {
            logger.error('Email service connection failed:', error);
        } else {
            logger.info('Email service ready to send messages');
        }
    });
};

// Send email
const sendEmail = async ({ to, subject, html, text }) => {
    if (!transporter) {
        logger.warn('Email service not initialized, skipping email to:', to);
        return null;
    }

    try {
        const mailOptions = {
            from: `"Sparkle" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(`Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error('Send email error:', error);
        throw error;
    }
};

// Generate email templates
const templates = {
    verifyEmail: (name, code) => ({
        subject: 'Verify Your Email - Sparkle',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #FF3D6D, #833AB4); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">✨ Sparkle</h1>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333; margin-top: 0;">Welcome, ${name}!</h2>
                    <p style="color: #555; line-height: 1.6;">Please verify your email address to start using your account.</p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${process.env.API_URL || 'http://localhost:3000'}/verify-email?code=${code}" 
                           style="background: linear-gradient(135deg, #FF3D6D, #833AB4); color: white; padding: 14px 35px; 
                                  text-decoration: none; border-radius: 25px; display: inline-block; font-weight: 600; font-size: 16px;">
                            Verify Email
                        </a>
                    </div>
                    <p style="color: #555;">Or use this verification code: <strong style="font-size: 24px; color: #FF3D6D; letter-spacing: 3px;">${code}</strong></p>
                    <p style="color: #999; font-size: 13px;">This code will expire in 24 hours.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">
                        If you didn't create an account on Sparkle, please ignore this email.
                    </p>
                </div>
            </div>
        `,
        text: `Welcome to Sparkle, ${name}!\n\nVerification code: ${code}\n\nOr click: ${process.env.API_URL || 'http://localhost:3000'}/verify-email?code=${code}\n\nThis code will expire in 24 hours.`
    }),

    resetPassword: (name, token) => ({
        subject: 'Reset Your Password - Sparkle',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #FF3D6D, #833AB4); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">✨ Sparkle</h1>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333; margin-top: 0;">Password Reset Request</h2>
                    <p style="color: #555; line-height: 1.6;">Hi ${name}, we received a request to reset your password.</p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${process.env.API_URL || 'http://localhost:3000'}/reset-password?token=${token}" 
                           style="background: linear-gradient(135deg, #FF3D6D, #833AB4); color: white; padding: 14px 35px; 
                                  text-decoration: none; border-radius: 25px; display: inline-block; font-weight: 600; font-size: 16px;">
                            Reset Password
                        </a>
                    </div>
                    <p style="color: #999; font-size: 13px;">This link will expire in 1 hour.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">
                        If you didn't request this, please ignore this email.
                    </p>
                </div>
            </div>
        `,
        text: `Password Reset Request\n\nHi ${name},\n\nClick: ${process.env.API_URL || 'http://localhost:3000'}/reset-password?token=${token}\n\nThis link will expire in 1 hour.`
    }),

    welcomeEmail: (name) => ({
        subject: 'Welcome to Sparkle! 🎉',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #FF3D6D, #833AB4); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">✨ Welcome to Sparkle!</h1>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333; margin-top: 0;">You're all set, ${name}! 🎉</h2>
                    <p style="color: #555; line-height: 1.6;">We're excited to have you join our campus community!</p>
                    <div style="margin: 20px 0; background: #f8f9fa; border-radius: 10px; padding: 20px;">
                        <h3 style="color: #333; margin-top: 0;">Get Started:</h3>
                        <p style="margin: 8px 0;">✨ Complete your profile</p>
                        <p style="margin: 8px 0;">📸 Share your first moment</p>
                        <p style="margin: 8px 0;">👥 Connect with classmates</p>
                        <p style="margin: 8px 0;">🏷️ Explore the marketplace</p>
                    </div>
                    <div style="text-align: center; margin-top: 20px;">
                        <a href="${process.env.API_URL || 'http://localhost:3000'}/dashboard" 
                           style="background: linear-gradient(135deg, #FF3D6D, #833AB4); color: white; padding: 14px 35px; 
                                  text-decoration: none; border-radius: 25px; display: inline-block; font-weight: 600;">
                            Go to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        `,
        text: `Welcome to Sparkle, ${name}! 🎉\n\nGet Started:\n- Complete your profile\n- Share your first moment\n- Connect with classmates\n- Explore the marketplace`
    })
};

module.exports = {
    initializeEmail,
    sendEmail,
    templates
};
