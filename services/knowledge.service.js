// services/knowledge.service.js - Sparkly Knowledge Engine Service
const { pgQuery, isPostgresConfigured } = require('../config/postgres');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// In-Memory Fallback Knowledge Store (for zero-downtime when Postgres credentials aren't valid/present yet)
const inMemoryKnowledgeStore = new Map();
let inMemoryIdCounter = 1;

class SparklyKnowledgeService {
    /**
     * Helper: Ensure category exists or return ID
     */
    static async getOrCreateCategory(categoryName, categorySlug = null) {
        const slug = categorySlug || categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        if (!isPostgresConfigured()) {
            return { id: 1, name: categoryName, slug };
        }

        try {
            let res = await pgQuery('SELECT id FROM sparkly_knowledge_categories WHERE slug = $1', [slug]);
            if (res && res.rows.length > 0) {
                return res.rows[0];
            }
            res = await pgQuery(
                'INSERT INTO sparkly_knowledge_categories (name, slug) VALUES ($1, $2) RETURNING id',
                [categoryName, slug]
            );
            return res.rows[0];
        } catch (err) {
            logger.warn('[KnowledgeService] Category lookup in PostgreSQL failed, using fallback:', err.message);
            return { id: 1, name: categoryName, slug };
        }
    }

    /**
     * Chunk large document content into smaller searchable passages
     */
    static chunkText(text, chunkSize = 400, overlap = 50) {
        if (!text) return [];
        const paragraphs = text.split(/\n\n+/);
        const chunks = [];
        let currentChunk = '';

        for (const p of paragraphs) {
            if ((currentChunk + '\n\n' + p).length <= chunkSize) {
                currentChunk = currentChunk ? currentChunk + '\n\n' + p : p;
            } else {
                if (currentChunk) chunks.push(currentChunk.trim());
                currentChunk = p;
            }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks;
    }

    /**
     * Helper to store document in memory
     */
    static storeInMemory({ title, category, content, source, status, metadata }) {
        const docId = inMemoryIdCounter++;
        const chunks = this.chunkText(content);
        const doc = {
            id: docId,
            title,
            category_id: 1,
            category_name: category,
            content,
            source,
            status,
            version: 1,
            metadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            chunks
        };
        inMemoryKnowledgeStore.set(docId, doc);
        logger.info(`[KnowledgeService] Created document ID ${docId} in memory store`);
        return doc;
    }

    /**
     * Create a new Knowledge Document
     */
    static async createDocument({ title, category = 'General', content, source = 'manual', status = 'published', metadata = {} }) {
        if (!title || !content) {
            throw new Error('Title and content are required to create a knowledge document');
        }

        if (!isPostgresConfigured()) {
            return this.storeInMemory({ title, category, content, source, status, metadata });
        }

        try {
            const cat = await this.getOrCreateCategory(category);
            const chunks = this.chunkText(content);

            const docRes = await pgQuery(
                `INSERT INTO sparkly_knowledge_documents (title, category_id, content, source, status, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [title, cat.id, content, source, status, JSON.stringify(metadata)]
            );

            const doc = docRes.rows[0];

            for (let i = 0; i < chunks.length; i++) {
                await pgQuery(
                    `INSERT INTO sparkly_knowledge_chunks (document_id, chunk_index, content, metadata)
                     VALUES ($1, $2, $3, $4)`,
                    [doc.id, i, chunks[i], JSON.stringify(metadata)]
                );
            }

            logger.info(`[KnowledgeService] Created PostgreSQL document ID ${doc.id} with ${chunks.length} chunks`);
            return doc;
        } catch (err) {
            logger.warn('[KnowledgeService] PostgreSQL createDocument failed (falling back to memory store):', err.message);
            return this.storeInMemory({ title, category, content, source, status, metadata });
        }
    }

    /**
     * Update an existing Knowledge Document
     */
    static async updateDocument(id, updates = {}) {
        const { title, content, category, status, metadata } = updates;

        const numId = parseInt(id, 10);
        const inMemDoc = inMemoryKnowledgeStore.get(numId);

        if (inMemDoc || !isPostgresConfigured()) {
            if (!inMemDoc) return null;
            if (title) inMemDoc.title = title;
            if (content) {
                inMemDoc.content = content;
                inMemDoc.chunks = this.chunkText(content);
            }
            if (category) inMemDoc.category_name = category;
            if (status) inMemDoc.status = status;
            if (metadata) inMemDoc.metadata = metadata;
            inMemDoc.updated_at = new Date().toISOString();
            inMemDoc.version += 1;
            inMemoryKnowledgeStore.set(inMemDoc.id, inMemDoc);
            return inMemDoc;
        }

        try {
            const fields = [];
            const values = [];
            let index = 1;

            if (title) { fields.push(`title = $${index++}`); values.push(title); }
            if (content) { fields.push(`content = $${index++}`); values.push(content); }
            if (status) { fields.push(`status = $${index++}`); values.push(status); }
            if (metadata) { fields.push(`metadata = $${index++}`); values.push(JSON.stringify(metadata)); }
            fields.push(`version = version + 1`);
            fields.push(`updated_at = CURRENT_TIMESTAMP`);

            values.push(id);
            const sql = `UPDATE sparkly_knowledge_documents SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`;
            const res = await pgQuery(sql, values);

            if (content && res.rows[0]) {
                await pgQuery('DELETE FROM sparkly_knowledge_chunks WHERE document_id = $1', [id]);
                const chunks = this.chunkText(content);
                for (let i = 0; i < chunks.length; i++) {
                    await pgQuery(
                        `INSERT INTO sparkly_knowledge_chunks (document_id, chunk_index, content) VALUES ($1, $2, $3)`,
                        [id, i, chunks[i]]
                    );
                }
            }

            return res.rows[0] || null;
        } catch (err) {
            logger.warn('[KnowledgeService] updateDocument Error:', err.message);
            if (inMemDoc) {
                if (title) inMemDoc.title = title;
                if (content) inMemDoc.content = content;
                return inMemDoc;
            }
            return null;
        }
    }

    /**
     * Publish document
     */
    static async publishDocument(id) {
        return this.updateDocument(id, { status: 'published' });
    }

    /**
     * Unpublish document
     */
    static async unpublishDocument(id) {
        return this.updateDocument(id, { status: 'draft' });
    }

    /**
     * Delete document
     */
    static async deleteDocument(id) {
        const numId = parseInt(id, 10);
        if (inMemoryKnowledgeStore.has(numId) || !isPostgresConfigured()) {
            return inMemoryKnowledgeStore.delete(numId);
        }
        try {
            const res = await pgQuery('DELETE FROM sparkly_knowledge_documents WHERE id = $1 RETURNING id', [id]);
            return res.rows.length > 0;
        } catch (err) {
            logger.warn('[KnowledgeService] deleteDocument Error:', err.message);
            return inMemoryKnowledgeStore.delete(numId);
        }
    }

    /**
     * Get document by ID
     */
    static async getDocument(id) {
        const numId = parseInt(id, 10);
        if (inMemoryKnowledgeStore.has(numId)) {
            return inMemoryKnowledgeStore.get(numId);
        }
        if (!isPostgresConfigured()) return null;

        try {
            const res = await pgQuery(
                `SELECT d.*, c.name as category_name
                 FROM sparkly_knowledge_documents d
                 LEFT JOIN sparkly_knowledge_categories c ON d.category_id = c.id
                 WHERE d.id = $1`,
                [id]
            );
            return res.rows[0] || null;
        } catch (err) {
            logger.warn('[KnowledgeService] getDocument Error:', err.message);
            return inMemoryKnowledgeStore.get(numId) || null;
        }
    }

    /**
     * Search memory store
     */
    static searchInMemory(cleanQuery, limit) {
        const results = [];
        const qLower = cleanQuery.toLowerCase();
        for (const doc of inMemoryKnowledgeStore.values()) {
            if (doc.status !== 'published') continue;
            if (doc.title.toLowerCase().includes(qLower) || doc.content.toLowerCase().includes(qLower)) {
                results.push({
                    id: doc.id,
                    title: doc.title,
                    category_name: doc.category_name,
                    content: doc.content,
                    snippet: doc.content.substring(0, 300) + '...',
                    source: doc.source,
                    score: doc.title.toLowerCase().includes(qLower) ? 2 : 1
                });
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    /**
     * Search published knowledge using PostgreSQL full-text search & ILIKE with fallback
     */
    static async searchKnowledge(query, { category = null, limit = 5 } = {}) {
        if (!query || !query.trim()) return [];
        const cleanQuery = query.trim();

        if (!isPostgresConfigured()) {
            return this.searchInMemory(cleanQuery, limit);
        }

        try {
            const terms = cleanQuery.replace(/[^\w\s]/gi, '').split(/\s+/).filter(Boolean);
            const tsQueryString = terms.map(t => `${t}:*`).join(' & ');

            let sql = `
                SELECT DISTINCT ON (d.id)
                    d.id,
                    d.title,
                    d.content,
                    c.name as category_name,
                    d.source,
                    ts_rank(to_tsvector('english', d.title || ' ' || d.content), to_tsquery('english', $1)) as score
                FROM sparkly_knowledge_documents d
                LEFT JOIN sparkly_knowledge_categories c ON d.category_id = c.id
                WHERE d.status = 'published'
                  AND to_tsvector('english', d.title || ' ' || d.content) @@ to_tsquery('english', $1)
                ORDER BY d.id, score DESC
                LIMIT $2
            `;

            let res = await pgQuery(sql, [tsQueryString, limit]);

            if (!res || res.rows.length === 0) {
                const ilikePattern = `%${cleanQuery}%`;
                sql = `
                    SELECT 
                        d.id,
                        d.title,
                        d.content,
                        c.name as category_name,
                        d.source,
                        1.0 as score
                    FROM sparkly_knowledge_documents d
                    LEFT JOIN sparkly_knowledge_categories c ON d.category_id = c.id
                    WHERE d.status = 'published'
                      AND (d.title ILIKE $1 OR d.content ILIKE $1)
                    ORDER BY d.id DESC
                    LIMIT $2
                `;
                res = await pgQuery(sql, [ilikePattern, limit]);
            }

            const dbResults = (res?.rows || []).map(r => ({
                id: r.id,
                title: r.title,
                category_name: r.category_name,
                content: r.content,
                snippet: r.content.length > 300 ? r.content.substring(0, 300) + '...' : r.content,
                source: r.source,
                score: r.score
            }));

            if (dbResults.length > 0) return dbResults;
            return this.searchInMemory(cleanQuery, limit);
        } catch (err) {
            logger.warn('[KnowledgeService] PostgreSQL search error (falling back to memory store):', err.message);
            return this.searchInMemory(cleanQuery, limit);
        }
    }

    /**
     * Ingest markdown files from a local directory into PostgreSQL / Knowledge base
     */
    static async ingestFolder(dirPath) {
        if (!fs.existsSync(dirPath)) {
            logger.warn(`[KnowledgeService] Folder ingestion path does not exist: ${dirPath}`);
            return { ingested: 0, skipped: 0 };
        }

        const files = fs.readdirSync(dirPath);
        let ingested = 0;

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                const subRes = await this.ingestFolder(filePath);
                ingested += subRes.ingested;
            } else if (file.endsWith('.md') || file.endsWith('.txt')) {
                const rawContent = fs.readFileSync(filePath, 'utf8');
                const titleMatch = rawContent.match(/^#\s+(.+)$/m) || rawContent.match(/^Title:\s*(.+)$/im);
                const title = titleMatch ? titleMatch[1].trim() : file.replace(/\.(md|txt)$/, '');
                
                const categoryMatch = rawContent.match(/^Category:\s*(.+)$/im);
                const category = categoryMatch ? categoryMatch[1].trim() : path.basename(dirPath);

                await this.createDocument({
                    title,
                    category,
                    content: rawContent,
                    source: file,
                    status: 'published'
                });
                ingested++;
            }
        }

        return { ingested };
    }
}

module.exports = SparklyKnowledgeService;
