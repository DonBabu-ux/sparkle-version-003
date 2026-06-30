const crypto = require('crypto');

class SecureLogger {
  constructor() {
    // Only log traces in development or when DEBUG_LOGS=true
    this.enabled = process.env.NODE_ENV !== 'production' || process.env.DEBUG_LOGS === 'true';
  }

  // Hash IDs to keep them unique but not identifiable
  hashId(id) {
    if (!id) return 'unknown';
    return crypto.createHash('sha256')
      .update(id + (process.env.LOG_SALT || 'sparkle-salt'))
      .digest('hex')
      .substring(0, 8);
  }

  // Safe message trace - keeps only what's needed for debugging
  messageTrace(messageId, stage, options = {}) {
    if (!this.enabled) return;
    const shortId = typeof messageId === 'string' ? messageId.substring(0, 8) : messageId;
    console.log(`[MESSAGE_TRACE] ${shortId} | Stage: ${stage} | Chat: ${this.hashId(options.chatId)} | Users: ${this.hashId(options.senderId)}→${this.hashId(options.recipientId)}`);
  }

  // Safe read trace
  readTrace(chatId, userId, stage) {
    if (!this.enabled) return;
    console.log(`[READ_TRACE] Chat:${this.hashId(chatId)} | User:${this.hashId(userId)} | Stage:${stage}`);
  }

  // Safe read emit
  readEmit(chatId, userId, stage) {
    if (!this.enabled) return;
    console.log(`[READ_EMIT] Chat:${this.hashId(chatId)} | User:${this.hashId(userId)} | Stage:${stage}`);
  }

  // Safe delivered emit
  deliveredEmit(chatId, userId, stage) {
    if (!this.enabled) return;
    console.log(`[DELIVERED_EMIT] Chat:${this.hashId(chatId)} | User:${this.hashId(userId)} | Stage:${stage}`);
  }

  // Safe delete trace
  deleteTrace(messageId, chatId, userId) {
    if (!this.enabled) return;
    const shortMsg = typeof messageId === 'string' ? messageId.substring(0, 8) : messageId;
    console.log(`[DELETE_TRACE] Msg:${shortMsg} | Chat:${this.hashId(chatId)} | User:${this.hashId(userId)}`);
  }

  // Safe chat update
  chatUpdate(chatId, userId, action) {
    if (!this.enabled) return;
    console.log(`[CHAT_UPDATE] Chat:${this.hashId(chatId)} | User:${this.hashId(userId)} | Action:${action}`);
  }

  // Generic safe log for other events
  safeLog(event, data = {}) {
    if (!this.enabled) return;
    const safeData = {};
    const sensitiveFields = ['userId', 'chatId', 'messageId', 'senderId', 'recipientId', 'id'];
    Object.keys(data).forEach(key => {
      if (sensitiveFields.includes(key) && data[key]) {
        safeData[key] = this.hashId(data[key]);
      } else {
        safeData[key] = data[key];
      }
    });
    console.log(`[${event}]`, safeData);
  }
}

module.exports = new SecureLogger();
