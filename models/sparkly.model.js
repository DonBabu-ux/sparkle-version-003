const pool = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

let tablesInitialized = false;

class SparklyModel {
    /**
     * Auto-ensure database tables exist for Sparkly AI session management
     */
    static async ensureTablesExist() {
        if (tablesInitialized) return;
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS sparkly_conversations (
                    id CHAR(36) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    title VARCHAR(255) DEFAULT 'New Chat',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_sparkly_conv_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS sparkly_messages (
                    id CHAR(36) PRIMARY KEY,
                    conversation_id CHAR(36) NOT NULL,
                    user_id VARCHAR(64) NOT NULL,
                    role ENUM('user', 'assistant', 'system') NOT NULL,
                    content TEXT NOT NULL,
                    structured_data JSON DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_sparkly_msg_conv (conversation_id),
                    INDEX idx_sparkly_msg_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS sparkly_user_memories (
                    id CHAR(36) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    memory_type VARCHAR(50) NOT NULL DEFAULT 'preference',
                    memory_key VARCHAR(100) NOT NULL,
                    memory_value TEXT NOT NULL,
                    confidence FLOAT DEFAULT 1.0,
                    source VARCHAR(100) DEFAULT 'chat',
                    is_active TINYINT(1) DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    last_used_at TIMESTAMP NULL DEFAULT NULL,
                    INDEX idx_sparkly_mem_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS sparkly_message_feedback (
                    id CHAR(36) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    message_id VARCHAR(64) NOT NULL,
                    feedback_type ENUM('like', 'dislike') NOT NULL,
                    dislike_category VARCHAR(100) DEFAULT NULL,
                    dislike_reason TEXT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY idx_sparkly_fb_user_msg (user_id, message_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);

            tablesInitialized = true;
        } catch (e) {
            logger.warn('[SparklyModel] Auto-table initialization warning:', e.message);
        }
    }

    /**
     * Create a new conversation session
     */
    static async createConversation(userId, title = 'New Chat') {
        await SparklyModel.ensureTablesExist();
        const id = uuidv4();
        try {
            await pool.query(
                'INSERT INTO sparkly_conversations (id, user_id, title) VALUES (?, ?, ?)',
                [id, userId, title]
            );
            return { id, user_id: userId, title, created_at: new Date() };
        } catch (error) {
            logger.error('Error in createConversation:', error);
            throw error;
        }
    }

    /**
     * Fetch user conversations
     */
    static async getUserConversations(userId, limit = 50) {
        await SparklyModel.ensureTablesExist();
        try {
            const [rows] = await pool.query(
                `SELECT c.*, 
                        (SELECT content FROM sparkly_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
                 FROM sparkly_conversations c
                 WHERE c.user_id = ?
                 ORDER BY c.updated_at DESC
                 LIMIT ?`,
                [userId, parseInt(limit)]
            );
            return rows;
        } catch (error) {
            logger.error('Error in getUserConversations:', error);
            return [];
        }
    }

    /**
     * Fetch single conversation by ID (scoped to user)
     */
    static async getConversation(conversationId, userId) {
        await SparklyModel.ensureTablesExist();
        try {
            const [rows] = await pool.query(
                'SELECT * FROM sparkly_conversations WHERE id = ? AND user_id = ?',
                [conversationId, userId]
            );
            return rows[0] || null;
        } catch (error) {
            logger.error('Error in getConversation:', error);
            return null;
        }
    }

    /**
     * Delete conversation
     */
    static async deleteConversation(conversationId, userId) {
        await SparklyModel.ensureTablesExist();
        try {
            await pool.query('DELETE FROM sparkly_messages WHERE conversation_id = ? AND user_id = ?', [conversationId, userId]);
            const [result] = await pool.query('DELETE FROM sparkly_conversations WHERE id = ? AND user_id = ?', [conversationId, userId]);
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('Error in deleteConversation:', error);
            throw error;
        }
    }

    /**
     * Branch conversation up to target message ID
     */
    static async branchConversation(userId, conversationId, messageId) {
        await SparklyModel.ensureTablesExist();
        try {
            const origConv = await SparklyModel.getConversation(conversationId, userId);
            if (!origConv) throw new Error('Original conversation not found');

            const allMsgs = await SparklyModel.getConversationMessages(conversationId, userId, 100);
            const targetIdx = allMsgs.findIndex(m => m.id === messageId);
            const msgsToCopy = targetIdx !== -1 ? allMsgs.slice(0, targetIdx + 1) : allMsgs;

            const newConvTitle = `Branch: ${origConv.title}`;
            const newConv = await SparklyModel.createConversation(userId, newConvTitle);

            for (const msg of msgsToCopy) {
                await SparklyModel.saveMessage(newConv.id, userId, msg.role, msg.content, msg.structured_data);
            }

            return newConv;
        } catch (error) {
            logger.error('Error in branchConversation:', error);
            throw error;
        }
    }

    /**
     * Save message to conversation
     */
    static async saveMessage(conversationId, userId, role, content, structuredData = null) {
        await SparklyModel.ensureTablesExist();
        const id = uuidv4();
        const jsonStr = structuredData ? JSON.stringify(structuredData) : null;
        try {
            await pool.query(
                'INSERT INTO sparkly_messages (id, conversation_id, user_id, role, content, structured_data) VALUES (?, ?, ?, ?, ?, ?)',
                [id, conversationId, userId, role, content, jsonStr]
            );
            await pool.query('UPDATE sparkly_conversations SET updated_at = NOW() WHERE id = ?', [conversationId]);
            return {
                id,
                conversation_id: conversationId,
                user_id: userId,
                role,
                content,
                structured_data: structuredData,
                created_at: new Date()
            };
        } catch (error) {
            logger.error('Error in saveMessage:', error);
            throw error;
        }
    }

    /**
     * Get messages for conversation (includes feedback_type join)
     */
    static async getConversationMessages(conversationId, userId, limit = 50) {
        try {
            const [rows] = await pool.query(
                `SELECT m.*, f.feedback_type 
                 FROM sparkly_messages m
                 JOIN sparkly_conversations c ON m.conversation_id = c.id
                 LEFT JOIN sparkly_message_feedback f ON f.message_id = m.id AND f.user_id = m.user_id
                 WHERE m.conversation_id = ? AND c.user_id = ?
                 ORDER BY m.created_at ASC
                 LIMIT ?`,
                [conversationId, userId, parseInt(limit)]
            );
            return rows.map(r => ({
                ...r,
                structured_data: typeof r.structured_data === 'string' ? JSON.parse(r.structured_data) : r.structured_data,
                feedback_type: r.feedback_type || null
            }));
        } catch (error) {
            logger.error('Error in getConversationMessages:', error);
            return [];
        }
    }

    /**
     * Save message feedback (like / dislike)
     */
    static async saveMessageFeedback(userId, messageId, feedbackType, { dislikeCategory = null, dislikeReason = null } = {}) {
        await SparklyModel.ensureTablesExist();
        const id = uuidv4();
        try {
            await pool.query(
                `INSERT INTO sparkly_message_feedback (id, user_id, message_id, feedback_type, dislike_category, dislike_reason)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE feedback_type = VALUES(feedback_type), dislike_category = VALUES(dislike_category), dislike_reason = VALUES(dislike_reason), created_at = NOW()`,
                [id, userId, messageId, feedbackType, dislikeCategory, dislikeReason]
            );
            return true;
        } catch (error) {
            logger.error('Error saving message feedback:', error);
            return false;
        }
    }

    /**
     * Remove feedback for a message
     */
    static async removeMessageFeedback(userId, messageId) {
        try {
            const [result] = await pool.query(
                'DELETE FROM sparkly_message_feedback WHERE user_id = ? AND message_id = ?',
                [userId, messageId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('Error removing message feedback:', error);
            return false;
        }
    }

    /**
     * Search user conversations by title and message content
     */
    static async searchConversations(userId, query, limit = 20) {
        await SparklyModel.ensureTablesExist();
        try {
            const searchTerm = `%${query}%`;
            const [rows] = await pool.query(
                `SELECT DISTINCT c.*,
                    (SELECT content FROM sparkly_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
                 FROM sparkly_conversations c
                 LEFT JOIN sparkly_messages m ON m.conversation_id = c.id
                 WHERE c.user_id = ? AND (c.title LIKE ? OR m.content LIKE ?)
                 ORDER BY c.updated_at DESC
                 LIMIT ?`,
                [userId, searchTerm, searchTerm, parseInt(limit)]
            );
            return rows;
        } catch (error) {
            logger.error('Error in searchConversations:', error);
            return [];
        }
    }

    /**
     * Update conversation title
     */
    static async updateConversationTitle(conversationId, userId, title) {
        try {
            await pool.query(
                'UPDATE sparkly_conversations SET title = ? WHERE id = ? AND user_id = ?',
                [title.substring(0, 250), conversationId, userId]
            );
        } catch (error) {
            logger.warn('Error updating conversation title:', error);
        }
    }

    // ── User Memory Methods ───────────────────────────────────────────────────

    /**
     * Get active user memories
     */
    static async getUserMemories(userId) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM sparkly_user_memories WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC',
                [userId]
            );
            return rows;
        } catch (error) {
            logger.error('Error in getUserMemories:', error);
            return [];
        }
    }

    /**
     * Save / Upsert memory preference
     */
    static async saveMemory(userId, memoryKey, memoryValue, memoryType = 'preference', confidence = 1.0) {
        const id = uuidv4();
        try {
            await pool.query(
                `INSERT INTO sparkly_user_memories (id, user_id, memory_type, memory_key, memory_value, confidence)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                 memory_value = VALUES(memory_value),
                 confidence = VALUES(confidence),
                 is_active = 1,
                 updated_at = NOW(),
                 last_used_at = NOW()`,
                [id, userId, memoryType, memoryKey, String(memoryValue), confidence]
            );
            return true;
        } catch (error) {
            logger.error('Error in saveMemory:', error);
            return false;
        }
    }

    /**
     * Delete / deactivate memory
     */
    static async deleteMemory(userId, memoryId) {
        try {
            const [result] = await pool.query(
                'DELETE FROM sparkly_user_memories WHERE id = ? AND user_id = ?',
                [memoryId, userId]
            );
            return result.affectedRows > 0;
        } catch (error) {
            logger.error('Error in deleteMemory:', error);
            throw error;
        }
    }

    /**
     * Clear all user memories
     */
    static async clearAllUserMemories(userId) {
        try {
            await pool.query('DELETE FROM sparkly_user_memories WHERE user_id = ?', [userId]);
            return true;
        } catch (error) {
            logger.error('Error in clearAllUserMemories:', error);
            return false;
        }
    }
}

module.exports = SparklyModel;
