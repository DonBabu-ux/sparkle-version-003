-- migrations/20261109_create_legal_inquiries.sql
CREATE TABLE IF NOT EXISTS legal_inquiries (
  inquiry_id VARCHAR(36) PRIMARY KEY,
  reference_number VARCHAR(30) UNIQUE NOT NULL,
  user_id VARCHAR(36) NULL,
  document_id VARCHAR(50) NOT NULL,
  document_version VARCHAR(20) NOT NULL,
  section_reference VARCHAR(100) NULL,
  concern_category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  contact_email VARCHAR(150) NULL,
  contact_name VARCHAR(150) NULL,
  attachment_url VARCHAR(500) NULL,
  status VARCHAR(40) DEFAULT 'Submitted',
  admin_response TEXT NULL,
  admin_id VARCHAR(36) NULL,
  responded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_legal_inq_ref (reference_number),
  INDEX idx_legal_inq_user (user_id),
  INDEX idx_legal_inq_doc (document_id),
  INDEX idx_legal_inq_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

