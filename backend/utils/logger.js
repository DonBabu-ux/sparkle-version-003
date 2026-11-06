const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { resolveLogDir } = require('./logDir');

// Detect if we're in a serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = !!(
    process.env.VERCEL || 
    process.env.AWS_LAMBDA_FUNCTION_NAME || 
    process.env.FUNCTION_NAME ||
    process.env.NOW_REGION
);

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Determine log directory. In development this resolves outside backend/, whose
// directory is watched by `node --watch`, so writing a log would otherwise
// restart the server. Production keeps backend/.logs. See utils/logDir.js.
const logsDir = resolveLogDir();

// Create logs directory if it doesn't exist and we're allowed to write files
let canWriteFiles = false;
if (process.env.NODE_ENV === 'production' && !isServerless) {
    try {
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        canWriteFiles = true;
    } catch (error) {
        // If we can't create the directory, just log to console
        console.warn('Unable to create logs directory, file logging disabled:', error.message);
        canWriteFiles = false;
    }
}

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'sparkle-api' },
    transports: [
        // Write all logs to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
                })
            )
        }),
        // Only log to files in production if we can write files (not in serverless)
        ...(canWriteFiles ? [
            new winston.transports.File({
                filename: path.join(logsDir, 'error.log'),
                level: 'error'
            }),
            new winston.transports.File({
                filename: path.join(logsDir, 'combined.log')
            })
        ] : [])
    ]
});

module.exports = logger;
