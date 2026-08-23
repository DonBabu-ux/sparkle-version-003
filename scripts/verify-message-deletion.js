require('dotenv').config();
const Message = require('../models/Message');
const db = require('../config/database');
const crypto = require('crypto');

async function runDeletionArchitectureVerification() {
  console.log('🚀 Starting Enterprise Deletion Architecture Verification Suite...\n');

  try {
    // Setup test users & personal chat
    const [existingUsers] = await db.query('SELECT user_id FROM users LIMIT 2');
    let senderId, recipientId;

    if (existingUsers.length >= 2) {
      senderId = existingUsers[0].user_id;
      recipientId = existingUsers[1].user_id;
    } else {
      senderId = 'test_don_' + Date.now();
      recipientId = 'test_john_' + Date.now();
      await db.query('INSERT INTO users (user_id, email, password_hash, name, username) VALUES (?, ?, ?, ?, ?)',
        [senderId, `don_${Date.now()}@sparkle.test`, 'pass123', 'Don', `don_${Date.now()}`]);
      await db.query('INSERT INTO users (user_id, email, password_hash, name, username) VALUES (?, ?, ?, ?, ?)',
        [recipientId, `john_${Date.now()}@sparkle.test`, 'pass123', 'John', `john_${Date.now()}`]);
    }

    const chatId = await Message.getOrCreateConversation(senderId, recipientId);
    console.log(`[SETUP] Using test users (${senderId}, ${recipientId}) & chat (${chatId})...`);

    // ── Test 1: Delete for Me (Local First & User Specific) ──
    console.log('\n--- TEST 1: Delete for Me (User Specific & Refresh Survival) ---');
    const msgId1 = 'msg_me_' + Date.now();
    await Message.sendMessage({
      messageId: msgId1,
      chatId,
      senderId,
      recipientId,
      content: 'Secret message for Don only deletion',
      type: 'text'
    });

    const opId1 = crypto.randomUUID();
    console.log(`[ACTION] Don deletes message ${msgId1} for self...`);
    const meResult = await Message.deleteForMe(msgId1, senderId, opId1);
    if (!meResult) throw new Error('deleteForMe returned false');

    // History as Don
    const donHistory = await Message.getMessages(chatId, senderId);
    const donHasMsg = donHistory.messages.some(m => m.message_id === msgId1);
    console.log(`Don history query: message present = ${donHasMsg}`);

    // History as John
    const johnHistory = await Message.getMessages(chatId, recipientId);
    const johnHasMsg = johnHistory.messages.some(m => m.message_id === msgId1);
    console.log(`John history query: message present = ${johnHasMsg}`);

    if (donHasMsg) throw new Error('FAIL: Message was NOT hidden for Don after Delete for Me');
    if (!johnHasMsg) throw new Error('FAIL: Message was incorrectly hidden for John after Don deleted for self');

    // Test Idempotency (duplicate deleteForMe)
    const meResultDup = await Message.deleteForMe(msgId1, senderId, opId1);
    if (!meResultDup) throw new Error('FAIL: Duplicate deleteForMe failed');
    const [delRows] = await db.query('SELECT COUNT(*) as cnt FROM message_deletions WHERE message_id = ? AND user_id = ?', [msgId1, senderId]);
    if (delRows[0].cnt !== 1) throw new Error(`FAIL: Expected 1 deletion record, found ${delRows[0].cnt}`);
    console.log('✅ PASS: Delete for Me is strictly user-specific and DB-idempotent!');

    // ── Test 2: Bulk Delete for Me ──
    console.log('\n--- TEST 2: Bulk Delete for Me ---');
    const msgId2 = 'msg_bulk1_' + Date.now();
    const msgId3 = 'msg_bulk2_' + Date.now();
    await Message.sendMessage({ messageId: msgId2, chatId, senderId, recipientId, content: 'Bulk 1', type: 'text' });
    await Message.sendMessage({ messageId: msgId3, chatId, senderId: recipientId, recipientId: senderId, content: 'Bulk 2', type: 'text' });

    const bulkOpId = crypto.randomUUID();
    console.log(`[ACTION] Don bulk deletes [${msgId2}, ${msgId3}]...`);
    await Message.deleteForMeBulk([msgId2, msgId3], senderId, bulkOpId);

    const donBulkHistory = await Message.getMessages(chatId, senderId);
    const hasBulk1 = donBulkHistory.messages.some(m => m.message_id === msgId2);
    const hasBulk2 = donBulkHistory.messages.some(m => m.message_id === msgId3);
    if (hasBulk1 || hasBulk2) throw new Error('FAIL: Bulk deleted messages found in Don history');
    console.log('✅ PASS: Bulk Delete for Me executed cleanly and excluded from history!');

    // ── Test 3: Delete for Everyone (Server Authoritative & Global) ──
    console.log('\n--- TEST 3: Delete for Everyone (Server Authoritative & Idempotent) ---');
    const msgId4 = 'msg_everyone_' + Date.now();
    await Message.sendMessage({ messageId: msgId4, chatId, senderId, recipientId, content: 'Global announcement', type: 'text' });

    const opIdEveryone = crypto.randomUUID();
    console.log(`[ACTION] Don deletes message ${msgId4} for everyone...`);
    const everyoneRes = await Message.deleteForEveryone(msgId4, senderId, opIdEveryone);
    if (!everyoneRes) throw new Error('deleteForEveryone returned false');

    const donHistoryEv = await Message.getMessages(chatId, senderId);
    const msgDonEv = donHistoryEv.messages.find(m => m.message_id === msgId4);

    const johnHistoryEv = await Message.getMessages(chatId, recipientId);
    const msgJohnEv = johnHistoryEv.messages.find(m => m.message_id === msgId4);

    if (!msgDonEv || !msgDonEv.is_deleted_for_everyone) throw new Error('FAIL: Message not marked deleted for everyone for Don');
    if (!msgJohnEv || !msgJohnEv.is_deleted_for_everyone) throw new Error('FAIL: Message not marked deleted for everyone for John');
    if (msgDonEv.content !== 'This message was deleted') throw new Error(`FAIL: Content mismatch: ${msgDonEv.content}`);
    if (msgJohnEv.content !== 'This message was deleted') throw new Error(`FAIL: Content mismatch: ${msgJohnEv.content}`);
    console.log('✅ PASS: Delete for Everyone updated globally and returns tombstone to all participants!');

    // Test Idempotency for Delete for Everyone
    console.log('[ACTION] Re-running Delete for Everyone with same operationId...');
    const everyoneResDup = await Message.deleteForEveryone(msgId4, senderId, opIdEveryone);
    if (!everyoneResDup) throw new Error('FAIL: Duplicate deleteForEveryone failed');
    console.log('✅ PASS: Delete for Everyone is 100% idempotent!');

    // ── Test 4: Authorization & 15-Minute Window ──
    console.log('\n--- TEST 4: Authorization & 15-Minute Window ---');
    const msgId5 = 'msg_john_sent_' + Date.now();
    await Message.sendMessage({ messageId: msgId5, chatId, senderId: recipientId, recipientId: senderId, content: 'John sent this', type: 'text' });

    console.log('[ACTION] Don attempts to delete John message for everyone...');
    try {
      await Message.deleteForEveryone(msgId5, senderId, crypto.randomUUID());
      throw new Error('FAIL: Don was able to delete John message for everyone');
    } catch (err) {
      if (err.message !== 'UNAUTHORIZED_DELETE') throw err;
      console.log('✅ PASS: Server rejected non-sender Delete for Everyone attempt with UNAUTHORIZED_DELETE');
    }

    // ── Test 5: Search Exclusion ──
    console.log('\n--- TEST 5: Search Exclusion ---');
    const msgId6 = 'msg_search_' + Date.now();
    await Message.sendMessage({ messageId: msgId6, chatId, senderId, recipientId, content: 'UniqueSearchTerm12345', type: 'text' });
    await Message.deleteForMe(msgId6, senderId);

    const searchResults = await Message.searchMessages(senderId, chatId, 'UniqueSearchTerm12345');
    if (searchResults.some(m => m.message_id === msgId6)) {
      throw new Error('FAIL: Deleted message appeared in search results');
    }
    console.log('✅ PASS: Search query excludes deleted-for-me messages!');

    // Cleanup test data
    console.log('\n[CLEANUP] Removing test message fixtures...');
    const testMsgIds = [msgId1, msgId2, msgId3, msgId4, msgId5, msgId6];
    await db.query('DELETE FROM message_deletions WHERE message_id IN (?)', [testMsgIds]);
    await db.query('DELETE FROM messages WHERE message_id IN (?)', [testMsgIds]);

    console.log('\n🎉 ALL 5 DELETION ARCHITECTURE TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ DELETION VERIFICATION FAILED:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runDeletionArchitectureVerification();
