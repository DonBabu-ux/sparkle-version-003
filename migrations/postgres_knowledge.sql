-- PostgreSQL Knowledge Engine DDL Schema Migration (AlwaData)
-- Sparkly Knowledge Storage Tables

-- Categories
CREATE TABLE IF NOT EXISTS sparkly_knowledge_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Documents
CREATE TABLE IF NOT EXISTS sparkly_knowledge_documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category_id INT REFERENCES sparkly_knowledge_categories(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    source VARCHAR(255) DEFAULT 'manual',
    status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    version INT DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document Chunks for granular search
CREATE TABLE IF NOT EXISTS sparkly_knowledge_chunks (
    id SERIAL PRIMARY KEY,
    document_id INT NOT NULL REFERENCES sparkly_knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Sources
CREATE TABLE IF NOT EXISTS sparkly_knowledge_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'raw_text',
    uri VARCHAR(255),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance & full-text search
CREATE INDEX IF NOT EXISTS idx_sparkly_docs_status ON sparkly_knowledge_documents(status);
CREATE INDEX IF NOT EXISTS idx_sparkly_chunks_doc_id ON sparkly_knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_sparkly_chunks_fts ON sparkly_knowledge_chunks USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_sparkly_docs_fts ON sparkly_knowledge_documents USING gin(to_tsvector('english', title || ' ' || content));
