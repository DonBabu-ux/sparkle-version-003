'use strict';

// Plain-JS email templates — replacements for the removed views/emails/*.ejs (EJS removed).
// esc() mirrors EJS escapeXML exactly (& < > " ' → entities); null/undefined → ''.

const esc = (v) => (v == null ? '' : String(v))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&#34;')
    .replace(/'/g, '&#39;');

const renderers = {
    'verify-email': (d) => `<meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - Sparkle</title>
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            background-color: #f4f7f9;
        }

        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
        }

        .header {
            background: linear-gradient(135deg, #FF3D6D 0%, #833AB4 100%);
            padding: 40px 20px;
            text-align: center;
        }

        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -1px;
        }

        .content {
            padding: 40px;
            text-align: center;
        }

        .content h2 {
            margin-top: 0;
            color: #333;
            font-size: 24px;
        }

        .content p {
            color: #666;
            font-size: 16px;
            margin-bottom: 30px;
        }

        .code-box {
            background-color: #f8f9fb;
            border: 2px dashed #e1e4e8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }

        .verification-code {
            font-size: 42px;
            font-weight: 800;
            color: #FF3D6D;
            letter-spacing: 10px;
            margin: 0;
        }

        .btn {
            display: inline-block;
            padding: 16px 36px;
            background: linear-gradient(135deg, #FF3D6D 0%, #833AB4 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 700;
            font-size: 16px;
            transition: transform 0.2s;
            box-shadow: 0 4px 15px rgba(255, 61, 109, 0.3);
        }

        .footer {
            padding: 20px;
            text-align: center;
            background-color: #f8f9fb;
            color: #999;
            font-size: 12px;
        }

        .expiry {
            color: #e74c3c;
            font-weight: 600;
            margin-top: 20px;
            font-size: 14px;
        }
    </style>

    <div class="container">
        <div class="header">
            <h1>✨ Sparkle</h1>
        </div>
        <div class="content">
            <h2>Welcome to the Community!</h2>
            <p>Hey ${esc(d.name)}, we're thrilled to have you! Please verify your email to unlock all the magic on Sparkle.
            </p>

            <div class="code-box">
                <p style="margin-top:0; font-size: 14px; color: #999; text-transform: uppercase; letter-spacing: 1px;">
                    Your Verification Code</p>
                <div class="verification-code">
                    ${esc(d.code)}
                </div>
            </div>

            <p>Or click the button below to verify instantly:</p>
            <a href="${esc(d.verifyUrl)}" class="btn">Verify My Account</a>

            <p class="expiry">This code expires in 24 hours.</p>
        </div>
        <div class="footer">
            <p>If you didn't create an account on Sparkle, you can safely ignore this email.</p>
            <p>&copy; 2026 Sparkle Campus. All rights reserved.</p>
        </div>
    </div>
</body>

</html>`,

    'welcome': (d) => `<meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Sparkle! 🎉</title>
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            background-color: #f4f7f9;
        }

        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
        }

        .header {
            background: linear-gradient(135deg, #FF3D6D 0%, #833AB4 100%);
            padding: 60px 20px;
            text-align: center;
        }

        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 42px;
            font-weight: 800;
            letter-spacing: -2px;
        }

        .content {
            padding: 40px;
        }

        .content h2 {
            margin-top: 0;
            color: #333;
            font-size: 28px;
            text-align: center;
        }

        .content p {
            color: #666;
            font-size: 17px;
            margin-bottom: 25px;
            line-height: 1.8;
        }

        .steps {
            background-color: #f8f9fb;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
        }

        .step {
            margin-bottom: 20px;
            display: flex;
            align-items: flex-start;
        }

        .step-icon {
            font-size: 24px;
            margin-right: 15px;
        }

        .step-text h4 {
            margin: 0 0 5px 0;
            color: #333;
            font-size: 18px;
        }

        .step-text p {
            margin: 0;
            font-size: 14px;
            color: #777;
        }

        .footer-btn {
            text-align: center;
            margin-top: 40px;
        }

        .btn {
            display: inline-block;
            padding: 18px 45px;
            background: linear-gradient(135deg, #FF3D6D 0%, #833AB4 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 700;
            font-size: 18px;
            transition: transform 0.2s;
            box-shadow: 0 6px 20px rgba(255, 61, 109, 0.4);
        }

        .footer {
            padding: 30px;
            text-align: center;
            background-color: #f8f9fb;
            color: #999;
            font-size: 13px;
        }
    </style>

    <div class="container">
        <div class="header">
            <div style="font-size: 60px; margin-bottom: 10px;">✨</div>
            <h1>Sparkle</h1>
        </div>
        <div class="content">
            <h2>Welcome Home, ${esc(d.name)}! 🎉</h2>
            <p>We're so excited to have you join Sparkle. This is your space to connect, share moments, and explore
                everything your campus has to offer.</p>

            <div class="steps">
                <div class="step">
                    <div class="step-icon">👤</div>
                    <div class="step-text">
                        <h4>Complete Your Profile</h4>
                        <p>Add a bio and profile picture so people can get to know you.</p>
                    </div>
                </div>
                <div class="step">
                    <div class="step-icon">📸</div>
                    <div class="step-text">
                        <h4>Post Your First Moment</h4>
                        <p>Share what's happening on campus right now.</p>
                    </div>
                </div>
                <div class="step">
                    <div class="step-icon">🛍️</div>
                    <div class="step-text">
                        <h4>Explore Marketplace</h4>
                        <p>Buy or sell items with other students on campus.</p>
                    </div>
                </div>
            </div>

            <div class="footer-btn">
                <a href="${esc(d.dashboardUrl || d.loginUrl)}" class="btn">Start Sparkling</a>
            </div>
        </div>
        <div class="footer">
            <p>You're receiving this because you're a verified member of Sparkle.</p>
            <p>&copy; 2026 Sparkle Campus. All rights reserved.</p>
        </div>
    </div>
</body>

</html>`,

    'reset-password': (d) => `<meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - Sparkle</title>
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            margin: 0;
            padding: 0;
            background-color: #f4f7f9;
        }

        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
        }

        .header {
            background: linear-gradient(135deg, #FF3D6D 0%, #833AB4 100%);
            padding: 40px 20px;
            text-align: center;
        }

        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -1px;
        }

        .content {
            padding: 40px;
            text-align: center;
        }

        .content h2 {
            margin-top: 0;
            color: #333;
            font-size: 24px;
        }

        .content p {
            color: #666;
            font-size: 16px;
            margin-bottom: 30px;
        }

        .btn {
            display: inline-block;
            padding: 16px 36px;
            background: linear-gradient(135deg, #FF3D6D 0%, #833AB4 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 700;
            font-size: 16px;
            transition: transform 0.2s;
            box-shadow: 0 4px 15px rgba(255, 61, 109, 0.3);
        }

        .footer {
            padding: 20px;
            text-align: center;
            background-color: #f8f9fb;
            color: #999;
            font-size: 12px;
        }

        .expiry {
            color: #e74c3c;
            font-weight: 600;
            margin-top: 20px;
            font-size: 14px;
        }

        .token-info {
            font-size: 12px;
            color: #999;
            margin-top: 30px;
            word-break: break-all;
        }
        .code-container {
            background-color: #f0f2f5;
            border-radius: 12px;
            padding: 20px;
            margin: 25px 0;
            letter-spacing: 8px;
            font-size: 32px;
            font-weight: 800;
            color: #1a1a1a;
            border: 2px dashed #FF3D6D;
        }
    </style>

    <div class="container">
        <div class="header">
            <h1>✨ Sparkle</h1>
        </div>
        <div class="content">
            <h2>Forgot your password?</h2>
            <p>Hi ${esc(d.name)}, we received a request to reset your password. No worries, it happens to the best of us!
            </p>

            <div class="code-container">
                ${esc(d.code)}
            </div>

            <a href="${esc(d.resetUrl)}" class="btn">Reset My Password</a>

            <p class="expiry">This link and code will expire in 1 hour.</p>

            <p class="token-info">Alternatively, you can copy and paste this link into your browser:<br>
                ${esc(d.resetUrl)}
            </p>
        </div>
        <div class="footer">
            <p>If you didn't request a password reset, you can safely ignore this email.</p>
            <p>&copy; 2026 Sparkle Campus. All rights reserved.</p>
        </div>
    </div>
</body>

</html>`,

    'security-alert': (d) => `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Security Alert - Sparkle</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; mx-auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
        .header { text-align: center; margin-bottom: 30px; }
        .alert { background-color: #fff5f5; border-left: 5px solid #fc8181; padding: 15px; margin-bottom: 20px; }
        .details { background-color: #f7fafc; padding: 15px; border-radius: 5px; font-family: monospace; }
        .footer { margin-top: 30px; font-size: 12px; color: #718096; text-align: center; }
        .button { display: inline-block; padding: 10px 20px; background-color: #e53e3e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #e53e3e;">Security Alert</h1>
        </div>
        <p>Hi ${esc(d.name)},</p>
        <div class="alert">
            <p><strong>A new login was detected on your Sparkle account.</strong></p>
        </div>
        <p>If this was you, you can safely ignore this email. If you don't recognize this activity, please secure your account immediately.</p>
        
        <div class="details">
            <p><strong>Time:</strong> ${esc(d.time)}</p>
            <p><strong>IP Address:</strong> ${esc(d.ipAddress)}</p>
            <p><strong>Device:</strong> ${esc(d.userAgent)}</p>
        </div>

        <p style="text-align: center; margin-top: 30px;">
            <a href="${esc(process.env.APP_URL)}/settings/security" class="button">Secure My Account</a>
        </p>

        <div class="footer">
            <p>&copy; 2026 Sparkle. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`
};

function renderTemplate(name, data) {
    const fn = renderers[name];
    if (!fn) throw new Error('Unknown email template: ' + name);
    return fn(data || {});
}

module.exports = { renderTemplate, renderers, esc };
