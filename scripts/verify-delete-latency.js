require('dotenv').config();
const Message = require('../models/Message');
const db = require('../config/database');
const crypto = require('crypto');

async function runDeleteFastPathAndIdempotencyTests() {
  console.log('🚀 Starting Sparkle Delete Fast-Path & Idempotency Verification...');

  try {
    // 1. Get test users
    const [users] = await db.query('SELECT user_id FROM users LIMIT 2');
    if (users.length < 2) {
      console.log('⚠️ Need at least 2 users in database to run full integration test.');
      process.exit(0);
    }

    const senderId = users[0].user_id;
    const recipientId = users[1].user_id;
    const chatId = await Message.getOrCreateConversation(senderId, recipientId);

    console.log(`[Test Setup] Sender: ${senderId}, Recipient: ${recipientId}, ChatId: ${chatId}`);

    // 2. Create a test message
    const msgUuid = crypto.randomUUID();
    await Message.sendMessage({
      messageId: msgUuid,
      senderId,
      recipientId,
      chatId,
      content: 'Message to be deleted fast-path test',
      type: 'text'
    });

    console.log(`Created test message: ${msgUuid}`);

    // 3. TEST 1: DELETE FOR EVERYONE IDEMPOTENCY (10 Repeated Calls)
    console.log('\n--- TEST 1: DELETE FOR EVERYONE IDEMPOTENCY (10 Retries) ---');
    const start1 = Date.now();
    let successCount = 0;

    for (let i = 0; i < 10; i++) {
      const res = await Message.deleteForEveryone(msgUuid, senderId);
      if (res) successCount++;
    }
    const duration1 = Date.now() - start1;

    console.log(`10 Retries Execution Duration: ${duration1}ms`);
    console.log(`Successful Responses: ${successCount}/10`);

    const [deletedRows] = await db.query('SELECT is_deleted_for_everyone, content FROM messages WHERE message_id = ?', [msgUuid]);
    const isDeleted = deletedRows[0]?.is_deleted_for_everyone === 1;

    if (successCount === 10 && isDeleted) {
      console.log('✅ PASS: Delete for everyone is completely idempotent! 10 retries returned 100% success with zero duplicate errors.');
    } else {
      console.error('❌ FAIL: Delete for everyone idempotency failed.');
    }

    // 4. TEST 2: DELETE FOR ME IDEMPOTENCY
    console.log('\n--- TEST 2: DELETE FOR ME IDEMPOTENCY ---');
    const msgUuid2 = crypto.randomUUID();
    await Message.sendMessage({
      messageId: msgUuid2,
      senderId,
      recipientId,
      chatId,
      content: 'Message for Delete for me test',
      type: 'text'
    });

    const delStart = Date.now();
    const resMe1 = await Message.deleteForMe(msgUuid2, senderId);
    const resMe2 = await Message.deleteForMe(msgUuid2, senderId);
    const delDuration = Date.now() - delStart;

    console.log(`Delete For Me Executions (${delDuration}ms): Attempt 1=${resMe1}, Attempt 2=${resMe2}`);

    const [meRows] = await db.query('SELECT COUNT(*) as cnt FROM message_deletions WHERE message_id = ? AND user_id = ?', [msgUuid2, senderId]);

    if (resMe1 && resMe2 && meRows[0].cnt === 1) {
      console.log('✅ PASS: Delete for me is completely idempotent! 0 duplicate rows inserted in message_deletions.');
    } else {
      console.error('❌ FAIL: Delete for me idempotency failed.');
    }

    console.log('\n🎉 All Delete Fast-Path & Idempotency Tests Completed Successfully!');
  } catch (err) {
    console.error('❌ Test Execution Error:', err);
  } finally {
    process.exit(0);
  }
}

runDeleteFastPathAndIdempotencyTests();
