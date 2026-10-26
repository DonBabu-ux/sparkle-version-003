CREATE TABLE IF NOT EXISTS messages (
  seq              INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id       TEXT NOT NULL UNIQUE,
  conversation_id  TEXT NOT NULL,
  sender_id        TEXT NOT NULL,
  body             TEXT,
  media_url        TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages(conversation_id, seq);

CREATE TABLE IF NOT EXISTS conversations (
  conversation_id TEXT PRIMARY KEY,
  is_group        INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_state (
  conversation_id  TEXT PRIMARY KEY,
  last_seq         INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS share_recipients (
  share_id  INTEGER NOT NULL,
  user_id   TEXT NOT NULL,
  PRIMARY KEY (share_id, user_id)
);
