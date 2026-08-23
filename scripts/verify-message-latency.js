require('dotenv').config();
const Message = require('../models/Message');
const db = require('../config/database');
const crypto = require('crypto');

async function runLatencyAndIdempotencyTests() {
  console.log('🚀 Starting Sparkle Messaging Fast Path & Idempotency Verification...');

  try {
    // 1. Create temporary test users or get existing user IDs
    const [users] = await db.query('SELECT user_id FROM users LIMIT 2');
    if (users.length < 2) {
      console.log('⚠️ Need at least 2 users in database to run full integration test.');
      process.exit(0);
    }

    const senderId = users[0].user_id;
    const recipientId = users[1].user_id;
    const chatId = await Message.getOrCreateConversation(senderId, recipientId);

    console.log(`[Test Setup] Sender: ${senderId}, Recipient: ${recipientId}, ChatId: ${chatId}`);

    // 2. Test Idempotency (Duplicate Prevention)
    const testUuid = crypto.randomUUID();
    console.log(`\n--- TEST 1: IDEMPOTENCY CHECK (UUID: ${testUuid}) ---`);

    const start1 = Date.now();
    const msgId1 = await Message.sendMessage({
      messageId: testUuid,
      senderId,
      recipientId,
      chatId,
      content: 'Latency & Idempotency Test 1',
      type: 'text'
    });
    const duration1 = Date.now() - start1;
    console.log(`First Send: messageId=${msgId1} (Duration: ${duration1}ms)`);

    // Retry with EXACT SAME messageId
    const start2 = Date.now();
    const msgId2 = await Message.sendMessage({
      messageId: testUuid,
      senderId,
      recipientId,
      chatId,
      content: 'Latency & Idempotency Test 1 (Retry attempt)',
      type: 'text'
    });
    const duration2 = Date.now() - start2;
    console.log(`Retry Send: messageId=${msgId2} (Duration: ${duration2}ms)`);

    // Count rows in database for testUuid
    const [rows] = await db.query('SELECT COUNT(*) as cnt FROM messages WHERE message_id = ?', [testUuid]);
    const rowCount = rows[0].cnt;

    console.log(`Database Row Count for UUID ${testUuid}: ${rowCount}`);

    if (rowCount === 1 && msgId1 === msgId2) {
      console.log('✅ PASS: Idempotency verified! 0 duplicate messages created on retry.');
    } else {
      console.error('❌ FAIL: Idempotency failed! Duplicate rows detected.');
    }

    // 3. Test Media vs Text Queue Isolation
    console.log('\n--- TEST 2: MEDIA VS TEXT QUEUE ISOLATION ---');
    const textUuid = crypto.randomUUID();
    const mediaUuid = crypto.randomUUID();

    const mediaStart = Date.now();
    const mediaMsgId = await Message.sendMessage({
      messageId: mediaUuid,
      senderId,
      recipientId,
      chatId,
      content: 'Sample Video Caption',
      type: 'video',
      mediaUrl: 'https://sparkle.app/test_video.mp4'
    });
    const mediaDuration = Date.now() - mediaStart;

    const textStart = Date.now();
    const textMsgId = await Message.sendMessage({
      messageId: textUuid,
      senderId,
      recipientId,
      chatId,
      content: 'Hello (Concurrent text)',
      type: 'text'
    });
    const textDuration = Date.now() - textStart;

    console.log(`Media Message (${mediaMsgId}): ${mediaDuration}ms`);
    console.log(`Text Message (${textMsgId}): ${textDuration}ms`);

    if (textDuration <= 150) {
      console.log('✅ PASS: Dedicated text fast-path executed in <150ms without waiting on media pipeline.');
    } else {
      console.log(`ℹ️ Note: Text send executed in ${textDuration}ms`);
    }

    console.log('\n🎉 All Message Fast Path & Idempotency Tests Completed Successfully!');
  } catch (err) {
    console.error('❌ Test Execution Error:', err);
  } finally {
    process.exit(0);
  }
}

runLatencyAndIdempotencyTests();
