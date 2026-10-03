// scripts/ingest-knowledge.js - Idempotent Knowledge Ingestion Pipeline for PostgreSQL & Fallback Engine
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { pgQuery, isPostgresConfigured, closePgPool, checkPgHealth, ensurePostgresTablesExist } = require('../config/postgres');
const SparklyKnowledgeService = require('../services/knowledge.service');
const logger = require('../utils/logger');

async function runIngestion() {
    logger.info('===================================================');
    logger.info('🚀 STARTING SPARKLY IDEMPOTENT KNOWLEDGE INGESTION');
    logger.info('===================================================');

    const pgStatus = await checkPgHealth();
    logger.info(`[PostgreSQL Status]: ${pgStatus.status}`);

    if (isPostgresConfigured() && pgStatus.status === 'connected') {
        await ensurePostgresTablesExist();
    }

    const knowledgeDirs = [
        path.join(__dirname, '..', 'data', 'sparkly-knowledge'),
        path.join(__dirname, '..', 'sparkly-knowledge')
    ];

    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalChunks = 0;

    for (const dirPath of knowledgeDirs) {
        if (!fs.existsSync(dirPath)) continue;

        const files = getAllMarkdownFiles(dirPath);
        logger.info(`📁 Scanning directory "${path.basename(dirPath)}": found ${files.length} document file(s).`);

        for (const filePath of files) {
            try {
                const rawContent = fs.readFileSync(filePath, 'utf8');
                const relativePath = path.relative(path.join(__dirname, '..'), filePath);

                // Extract Title & Category
                const titleMatch = rawContent.match(/^#\s+(.+)$/m) || rawContent.match(/^Title:\s*(.+)$/im);
                const title = titleMatch ? titleMatch[1].trim() : path.basename(filePath, path.extname(filePath));

                const categoryMatch = rawContent.match(/^Category:\s*(.+)$/im);
                const categoryName = categoryMatch ? categoryMatch[1].trim() : 'General';
                const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

                if (isPostgresConfigured() && pgStatus.status === 'connected') {
                    // 1. Upsert Category
                    const catRes = await pgQuery(
                        `INSERT INTO sparkly_knowledge_categories (name, slug)
                         VALUES ($1, $2)
                         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                         RETURNING id`,
                        [categoryName, slug]
                    );
                    const categoryId = catRes.rows[0].id;

                    // 2. Check if Document exists by title/slug
                    const existingDocRes = await pgQuery(
                        'SELECT id, content FROM sparkly_knowledge_documents WHERE title = $1',
                        [title]
                    );

                    let docId;
                    const chunks = SparklyKnowledgeService.chunkText(rawContent);

                    if (existingDocRes.rows.length > 0) {
                        docId = existingDocRes.rows[0].id;
                        if (existingDocRes.rows[0].content === rawContent) {
                            totalSkipped++;
                            continue;
                        }
                        // Update Document
                        await pgQuery(
                            `UPDATE sparkly_knowledge_documents
                             SET content = $1, category_id = $2, source = $3, status = 'published', updated_at = CURRENT_TIMESTAMP, version = version + 1
                             WHERE id = $4`,
                            [rawContent, categoryId, relativePath, docId]
                        );
                        // Re-chunk
                        await pgQuery('DELETE FROM sparkly_knowledge_chunks WHERE document_id = $1', [docId]);
                        totalUpdated++;
                    } else {
                        // Insert Document
                        const newDocRes = await pgQuery(
                            `INSERT INTO sparkly_knowledge_documents (title, category_id, content, source, status)
                             VALUES ($1, $2, $3, $4, 'published')
                             RETURNING id`,
                            [title, categoryId, rawContent, relativePath]
                        );
                        docId = newDocRes.rows[0].id;
                        totalInserted++;
                    }

                    // Insert Chunks
                    for (let i = 0; i < chunks.length; i++) {
                        await pgQuery(
                            `INSERT INTO sparkly_knowledge_chunks (document_id, chunk_index, content)
                             VALUES ($1, $2, $3)`,
                            [docId, i, chunks[i]]
                        );
                        totalChunks++;
                    }

                    // Record Source
                    await pgQuery(
                        `INSERT INTO sparkly_knowledge_sources (name, type, uri, last_synced_at)
                         VALUES ($1, 'markdown_file', $2, CURRENT_TIMESTAMP)`,
                        [title, relativePath]
                    );

                } else {
                    // Fallback Ingestion to Memory Store
                    await SparklyKnowledgeService.createDocument({
                        title,
                        category: categoryName,
                        content: rawContent,
                        source: relativePath,
                        status: 'published'
                    });
                    totalInserted++;
                }
            } catch (err) {
                logger.error(`❌ Failed to ingest file "${filePath}":`, err.message);
            }
        }
    }

    logger.info('===================================================');
    logger.info(`✅ INGESTION SUMMARY: ${totalInserted} Inserted | ${totalUpdated} Updated | ${totalSkipped} Skipped | ${totalChunks} Chunks Created`);
    logger.info('===================================================');

    await closePgPool();
}

function getAllMarkdownFiles(dirPath) {
    let results = [];
    const list = fs.readdirSync(dirPath);
    list.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getAllMarkdownFiles(filePath));
        } else if (file.endsWith('.md') || file.endsWith('.txt')) {
            results.push(filePath);
        }
    });
    return results;
}

if (require.main === module) {
    runIngestion();
}

module.exports = { runIngestion };
