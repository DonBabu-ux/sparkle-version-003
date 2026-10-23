-- Extend messages.type so every attachment type the client actually sends
-- (documents, audio files, location pins, contact cards, generic attachments)
-- can be persisted. Previously the ENUM rejected 'document'/'audio', which
-- made document and audio delivery fail at INSERT time.
ALTER TABLE messages
    MODIFY COLUMN type ENUM(
        'text',
        'image',
        'video',
        'voice_note',
        'audio',
        'document',
        'location',
        'contact',
        'attachment',
        'post_share',
        'system',
        'call',
        'marketplace_listing',
        'story_reply'
    ) DEFAULT 'text';
