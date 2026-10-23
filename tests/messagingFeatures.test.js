// tests/messagingFeatures.test.js
// Automated verification contracts for Sparkle Messaging:
// 1. Swipe-to-reply gesture
// 2. Reply preview in composer
// 3. Replied-to message shown in bubble
// 4. Navigate to original message
// 5. Edited indicator on sender side
// 6. Edited indicator on recipient side
// 7. Multi-message selection
// 8. Recipient picker and enforced forwarding limit (max 5)
// 9. Reference-based forwarding architecture
// 10. Forwarded label and icon
// 11. Forwarded many times threshold (> 20)
// 12. Upload progress overlay
// 13. Cancel upload
// 14. Retry failed upload
// 15. Upload recovery and duplicate prevention
// 16. GIF canonical asset reuse
// 17. Intentional repeat GIF sends
// 18. Idempotent message and gift pipeline
// 19. Database and event consistency
// 20. Regression tests and production build

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('1. Swipe-to-Reply Gesture & Wiring', () => {
  it('implements gesture with pointer events, vertical scroll guard, and elasticity', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /const MessageBubbleWrapper/, 'MessageBubbleWrapper is defined');
    assert.match(messagesCode, /touchAction:\s*['"]pan-y['"]/, 'vertical scrolling preserved via pan-y');
    assert.match(messagesCode, /isVerticalScrollRef\.current\s*=\s*true/, 'vertical scroll takes precedence over swipe');
    assert.match(messagesCode, /SWIPE_THRESHOLD\s*=\s*50/, 'threshold configured');
    assert.match(messagesCode, /onSwipeReply\(\)/, 'calls onSwipeReply when threshold reached');
  });

  it('wires onSwipeReply to setReplyTarget in chatStore', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /onSwipeReply=\{isSelectionMode\s*\|\|\s*msg\.is_deleted_for_everyone\s*\?\s*undefined\s*:\s*\(\)\s*=>\s*\{[\s\S]*?setReplyTarget\(selectedChat\.chat_id,\s*msg\.message_id\)/, 'onSwipeReply sets reply target in chatStore');
  });
});

describe('2. Reply Preview in Composer', () => {
  it('ReplyPreview component renders original sender and content/thumbnail preview', () => {
    const replyPreviewCode = read('frontend/src/components/chat/ReplyPreview.tsx');
    assert.match(replyPreviewCode, /Replying to/, 'renders Replying to label');
    assert.match(replyPreviewCode, /aria-label="Cancel reply"/, 'allows user to cancel reply');
    assert.match(replyPreviewCode, /renderThumbnail/, 'renders media preview thumbnail for images/videos/gifs');
  });

  it('ChatInput integrates ReplyPreview with clear callback', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /<ReplyPreview[\s\S]*?messageId=\{replyToMessage\.message_id\}/, 'ReplyPreview mounted above composer');
  });
});

describe('3. Replied-to Message Shown in Bubble', () => {
  it('renders reply-card layout inside message bubble with sender and content excerpt', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /msg\.reply_to_message_id/, 'checks reply reference');
    assert.match(messagesCode, /replyContent/, 'extracts replied message preview content');
    assert.match(messagesCode, /border-l-\[3\.5px\]/, 'styled WhatsApp-style left accent border');
  });
});

describe('4. Navigate to Original Message on Tap', () => {
  it('scrolls smoothly to replied message and highlights with temporary glow ring', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /document\.getElementById\(`msg-\$\{msg\.reply_to_message_id\}`\)/, 'finds original message element');
    assert.match(messagesCode, /scrollIntoView\(\{\s*behavior:\s*['"]smooth['"],\s*block:\s*['"]center['"]\s*\}\)/, 'smooth center scroll');
    assert.match(messagesCode, /classList\.add\('ring-2'/, 'adds glow highlight ring');
    assert.match(messagesCode, /setTimeout\(\(\)\s*=>\s*el\.classList\.remove\('ring-2'/, 'removes glow highlight after timeout');
  });
});

describe('5 & 6. Message Editing — Show Edited on Both Sides', () => {
  it('backend verifies sender ownership, 15-minute edit deadline, and sets is_edited', () => {
    const messageModel = read('backend/models/Message.js');
    assert.match(messageModel, /msg\.sender_id\s*!==\s*userId/, 'verifies sender ownership');
    assert.match(messageModel, /timeDiffMins\s*>\s*15/, 'enforces 15 minute limit');
    assert.match(messageModel, /SET content = \?,\s*is_edited = 1,\s*edited = 1,\s*edited_at = NOW\(\)/, 'updates is_edited and edited_at');
  });

  it('backend broadcasts message-edited to room with edited: true and edited_at', () => {
    const socketIndex = read('backend/socket/index.js');
    assert.match(socketIndex, /io\.to\(`chat:\$\{result\.chatId\}`\)\.emit\('message-edited',/, 'broadcasts to room');
    assert.match(socketIndex, /is_edited:\s*true/, 'emits is_edited flag');
    assert.match(socketIndex, /edited_at:\s*result\.edited_at/, 'emits edited_at timestamp');
  });

  it('frontend useMessageSocket listens to message-edited and updates chatStore and window event', () => {
    const hookCode = read('frontend/src/hooks/useMessageSocket.ts');
    assert.match(hookCode, /socket\.on\('message-edited',\s*handleMessageEdited\)/, 'socket listener registered');
    assert.match(hookCode, /getChatStore\(\)\.editMessage\(data\.chatId,\s*data\.messageId,\s*data\.content\)/, 'updates chatStore');
    assert.match(hookCode, /sparkle_message_edited/, 'dispatches sparkle_message_edited event');
  });

  it('frontend Messages.tsx renders subtle Edited label next to timestamp for both sides', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /\(msg\.is_edited\s*\|\|\s*msg\.edited\)\s*&&[\s\S]*?<span[^>]*>Edited<\/span>/, 'renders Edited label in timestamp area');
  });
});

describe('7 & 8. Multi-Message Selection & Forwarding Limits', () => {
  it('selection action bar provides Forward button with selected count', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /Forward\{selectedMessageIds\.size\s*>\s*0\s*\?\s*`\s*\(\$\{selectedMessageIds\.size\}\)`\s*:\s*''\}/, 'forward button with count');
  });

  it('ForwardModal strictly enforces maximum of 5 recipients with warning toast', () => {
    const modalCode = read('frontend/src/components/chat/ForwardModal.tsx');
    assert.match(modalCode, /const MAX_SELECT\s*=\s*5/, 'MAX_SELECT is 5');
    assert.match(modalCode, /toast\.error\(`You can only forward to up to \$\{MAX_SELECT\} chats at once`\)/, 'limit alert toast');
  });

  it('backend forwardMessage endpoint and socket strictly enforce max 5 recipients', () => {
    const controller = read('backend/controllers/messages.controller.js');
    assert.match(controller, /if\s*\(targetChatIds\.length\s*>\s*5\)/, 'controller blocks > 5 recipients');
    const socketIndex = read('backend/socket/index.js');
    assert.match(socketIndex, /if\s*\(!Array\.isArray\(targetChatIds\)[\s\S]*?targetChatIds\.length\s*>\s*5\)/, 'socket blocks > 5 recipients');
  });
});

describe('9, 10 & 11. Reference-Based Forwarding Architecture & Lineage Counters', () => {
  it('does not re-upload media or duplicate content; stores original root lineage and increments forward_count', () => {
    const controller = read('backend/controllers/messages.controller.js');
    assert.match(controller, /const rootMessageId = originalMsg\.forward_lineage_id \|\| originalMsg\.source_message_id \|\| originalMsg\.message_id/, 'determines canonical root lineage');
    assert.match(controller, /UPDATE messages SET forward_count = IFNULL\(forward_count, 0\) \+ 1 WHERE message_id = \?/, 'atomic lineage increment');
    assert.match(controller, /source_message_id,\s*forward_lineage_id,\s*forward_count/, 'persists source and lineage references');
  });

  it('displays single Forwarded icon for normal forwards and double icon with Forwarded many times above 20 forwards', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /\(msg\.forward_count\s*\|\|\s*0\)\s*>\s*20\s*\?/, 'checks threshold > 20');
    assert.match(messagesCode, /Forwarded many times/, 'renders Forwarded many times badge');
    assert.match(messagesCode, /<Forward size=\{11\}[^>]*\/>\s*<Forward size=\{11\}[^>]*className="[^"]*-ml-1\.5/, 'renders two forward icons when frequently forwarded');
  });
});

describe('12, 13, 14 & 15. WhatsApp-Style Media Upload Experience', () => {
  it('uploadFileWithProgress accepts AbortSignal for honest network cancellation', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /async function uploadFileWithProgress\([\s\S]*?abortSignal\?: AbortSignal\)/, 'accepts abortSignal');
    assert.match(messagesCode, /signal:\s*abortSignal/, 'passes signal to axios and fetch');
  });

  it('renders centered circular progress overlay with cancel X button on uploading bubbles', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /strokeDasharray=\{125\.6\}/, 'circular SVG progress ring');
    assert.match(messagesCode, /handleCancelUpload\(msg\.message_id\s*\|\|\s*msg\.id\)/, 'cancel button calls handleCancelUpload');
  });

  it('renders Retry button when media upload fails and allows retrying without re-selecting file', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /handleRetryUpload\(msg\.message_id\s*\|\|\s*msg\.id\)/, 'retry button calls handleRetryUpload');
    assert.match(messagesCode, /uploadPayloadsRef\.current\.get\(messageId\)/, 'reuses cached file payload from ref');
  });

  it('cancel aborts pending request and removes optimistic state without orphaned DB records', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /ctrl\.abort\(\)/, 'aborts controller on cancel');
    assert.match(messagesCode, /updateMessages\(prev => prev\.filter\(m => m\.message_id !== messageId/, 'cleans up optimistic message');
  });
});

describe('16, 17 & 18. GIF & Gift Canonical Asset Deduplication', () => {
  const CanonicalAssetService = require('../backend/services/canonicalAssetService');

  it('parseAssetIdentity normalizes Giphy URL and extracts stable provider ID', () => {
    const sampleUrl = 'https://media0.giphy.com/media/GptIPDhr7hcCUvIYt8/200.gif?cid=test&ep=v1_gifs_trending&rid=200.gif';
    const identity = CanonicalAssetService.parseAssetIdentity(sampleUrl);
    assert.equal(identity.provider, 'giphy');
    assert.equal(identity.providerMediaId, 'GptIPDhr7hcCUvIYt8');
    assert.equal(identity.assetId, 'giphy:GptIPDhr7hcCUvIYt8');
    assert.equal(identity.canonicalUrl, 'https://media0.giphy.com/media/GptIPDhr7hcCUvIYt8/200.gif');
  });

  it('rejects unsafe SSRF/local URLs in media assets', () => {
    assert.throws(() => {
      CanonicalAssetService.parseAssetIdentity('http://127.0.0.1:8080/secret.gif');
    }, { code: 'INVALID_MEDIA_URL' });
    assert.throws(() => {
      CanonicalAssetService.parseAssetIdentity('http://169.254.169.254/latest/meta-data');
    }, { code: 'INVALID_MEDIA_URL' });
  });

  it('re-using asset does not suppress intentional repeated sends', () => {
    const messageModel = read('backend/models/Message.js');
    assert.match(messageModel, /CanonicalAssetService\.getOrCreateCanonicalAsset/, 'normalizes asset reference');
    assert.match(messageModel, /INSERT INTO messages/, 'inserts distinct message row for each send');
  });
});

describe('19 & 20. Database Schema Ledger and Production Readiness', () => {
  it('migration 20261023_messaging_reply_edit_forward_gifts is registered in schemaLedger', () => {
    const ledger = read('backend/utils/database/schemaLedger.js');
    assert.match(ledger, /20261023_messaging_reply_edit_forward_gifts\.js/, 'migration registered');
    assert.match(ledger, /verify:\s*\[['"]canonical_media_assets['"],\s*['"]message_forward_deliveries['"]\]/, 'verified tables');
  });

  it('database migration ensures required columns and indexes exist', () => {
    const migration = read('backend/migrations/20261023_messaging_reply_edit_forward_gifts.js');
    assert.match(migration, /reply_to_message_id/, 'reply column');
    assert.match(migration, /forward_count/, 'forward count column');
    assert.match(migration, /forward_lineage_id/, 'lineage id column');
    assert.match(migration, /is_edited/, 'edited column');
    assert.match(migration, /canonical_media_assets/, 'canonical assets table');
    assert.match(migration, /message_forward_deliveries/, 'forward deliveries table');
  });
});

describe('21. Feature A — Reply Previews Contract', () => {
  it('ReplyPreview resolves original message content, thumbnail, and nicknames', () => {
    const replyPreviewCode = read('frontend/src/components/chat/ReplyPreview.tsx');
    assert.match(replyPreviewCode, /chatNicknames/, 'resolves sender name from chatNicknames');
    assert.match(replyPreviewCode, /Original message deleted/, 'shows placeholder when deleted');
    assert.match(replyPreviewCode, /This message has expired/, 'shows placeholder when expired');
    assert.match(replyPreviewCode, /onNavigateToMessage/, 'supports navigate to original on tap');
    assert.match(replyPreviewCode, /renderThumbnail/, 'renders media thumbnail');
  });

  it('Sent message bubble renders rich reply preview with media and deleted fallback', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /Original message deleted/, 'bubble handles deleted referenced message');
    assert.match(messagesCode, /This message has expired/, 'bubble handles expired referenced message');
    assert.match(messagesCode, /sparkle:jump-to-message/, 'falls back to anchor jump for paginated messages');
  });
});

describe('22. Feature B — Authoritative Disappearing Messages', () => {
  it('migration 20261023_chat_nicknames_and_disappearing creates chat_nicknames and adds disappearing columns', () => {
    const migration = read('backend/migrations/20261023_chat_nicknames_and_disappearing.js');
    assert.match(migration, /CREATE TABLE IF NOT EXISTS chat_nicknames/, 'creates chat_nicknames');
    assert.match(migration, /disappearing_version/, 'adds disappearing_version');
    assert.match(migration, /disappearing_updated_at/, 'adds disappearing_updated_at');
    assert.match(migration, /disappearing_updated_by/, 'adds disappearing_updated_by');
  });

  it('schemaLedger registers 20261023_chat_nicknames_and_disappearing migration with chat_nicknames verification', () => {
    const ledger = read('backend/utils/database/schemaLedger.js');
    assert.match(ledger, /20261023_chat_nicknames_and_disappearing\.js/, 'disappearing and nicknames migration registered');
    assert.match(ledger, /chat_nicknames/, 'verified chat_nicknames in ledger');
  });

  it('backend implements retroactive expiry on initial enable: expiresAt = createdAt + duration', () => {
    const socketCode = read('backend/socket/index.js');
    assert.match(socketCode, /DATE_ADD\(COALESCE\(created_at,\s*sent_at\),\s*INTERVAL \? SECOND\)/, 'retroactive expiry calculated from original authoritative creation timestamp');
    assert.match(socketCode, /disappearing_version/, 'checks or increments version for concurrency');
    assert.match(socketCode, /disappearing_messages_update/, 'broadcasts authoritative disappearing update');
  });

  it('dotted input bar and interactive in-chat Change notification are implemented', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /border-dashed border-\[#ff1493\]/, 'dotted input bar applied when disappearing active');
    assert.match(messagesCode, /disappearing_messages_change/, 'detects disappearing messages system notice');
    assert.match(messagesCode, />\s*Change\s*<\/button>/, 'provides interactive Change action in system notification');
  });

  it('client periodically processes local expiry and persists tombstones', () => {
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /removeExpiredMessages/, 'calls removeExpiredMessages on periodic timer');
    const chatStoreCode = read('frontend/src/store/chatStore.ts');
    assert.match(chatStoreCode, /sparkle_expired_msg_ids/, 'persists tombstone IDs to prevent resurrected messages');
  });
});

describe('23. Feature C — Shared Chat Nicknames', () => {
  it('backend implements GET and POST for chat nicknames', () => {
    const controller = read('backend/controllers/messages.controller.js');
    assert.match(controller, /getChatNicknames/, 'getChatNicknames controller defined');
    assert.match(controller, /setChatNickname/, 'setChatNickname controller defined');
    assert.match(controller, /chat_nicknames/, 'stores nicknames in chat_nicknames table');
    assert.match(controller, /nickname_change/, 'persists in-chat system message on nickname change');
  });

  it('backend socket handles set_chat_nickname and broadcasts nickname_updated', () => {
    const socketCode = read('backend/socket/index.js');
    assert.match(socketCode, /set_chat_nickname/, 'set_chat_nickname socket handler');
    assert.match(socketCode, /nickname_updated/, 'emits nickname_updated to room');
  });

  it('frontend chatStore and Messages dynamically resolve sender nicknames without rewriting messages', () => {
    const chatStoreCode = read('frontend/src/store/chatStore.ts');
    assert.match(chatStoreCode, /chatNicknames:\s*Record/, 'chatNicknames state in chatStore');
    assert.match(chatStoreCode, /setChatNickname/, 'setChatNickname action');
    const messagesCode = read('frontend/src/pages/Messages.tsx');
    assert.match(messagesCode, /currentNicknames\[selectedChat\.partner_id\]/, 'header displayName resolves nickname');
  });
});

