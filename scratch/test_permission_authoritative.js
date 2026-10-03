// scratch/test_permission_authoritative.js
'use strict';

require('dotenv').config();
const PermissionEngine = require('../services/PermissionEngine');
const assert = require('assert');

function testPermissionEngine() {
  console.log('🧪 Testing PermissionEngine authoritative calculations...');

  const mockMsg = {
    message_id: 'msg_100',
    sender_id: 'user_A',
    content: 'Hello World',
    sent_at: new Date().toISOString()
  };

  // Case 1: Default privacy settings (allow_copy=1, allow_forward=1)
  const p1 = PermissionEngine.computePermissions({
    message: mockMsg,
    senderPrivacy: { allow_copy: 1, allow_forward: 1 },
    viewerUserId: 'user_B',
    isGroup: false
  });

  assert.strictEqual(p1.canCopy, true, 'Default canCopy should be true');
  assert.strictEqual(p1.canForward, true, 'Default canForward should be true');
  assert.strictEqual(p1.canReply, true, 'Default canReply should be true');
  assert.strictEqual(p1.canReact, true, 'Default canReact should be true');
  console.log('  └─ Case 1 Passed: Default permissions computed correctly');

  // Case 2: Forwarding disabled by sender privacy
  const p2 = PermissionEngine.computePermissions({
    message: mockMsg,
    senderPrivacy: { allow_copy: 1, allow_forward: 0 },
    viewerUserId: 'user_B',
    isGroup: false
  });

  assert.strictEqual(p2.canCopy, true, 'canCopy should be true');
  assert.strictEqual(p2.canForward, false, 'canForward should be FALSE when allow_forward=0');
  assert.strictEqual(p2.ui.showForward, false, 'showForward should be FALSE');
  console.log('  └─ Case 2 Passed: Forwarding restriction enforced by PermissionEngine');

  // Case 3: Copy disabled by sender privacy
  const p3 = PermissionEngine.computePermissions({
    message: mockMsg,
    senderPrivacy: { allow_copy: 0, allow_forward: 1 },
    viewerUserId: 'user_B',
    isGroup: false
  });

  assert.strictEqual(p3.canCopy, false, 'canCopy should be FALSE when allow_copy=0');
  assert.strictEqual(p3.canForward, true, 'canForward should be true');
  assert.strictEqual(p3.ui.showCopy, false, 'showCopy should be FALSE');
  console.log('  └─ Case 3 Passed: Copy restriction enforced by PermissionEngine');

  // Case 4: Blocked conversation status
  const p4 = PermissionEngine.computePermissions({
    message: mockMsg,
    senderPrivacy: { allow_copy: 1, allow_forward: 1 },
    viewerUserId: 'user_B',
    isGroup: false,
    isBlocked: true
  });

  assert.strictEqual(p4.canReply, false, 'canReply should be FALSE when blocked');
  assert.strictEqual(p4.canReact, false, 'canReact should be FALSE when blocked');
  assert.strictEqual(p4.canForward, false, 'canForward should be FALSE when blocked');
  console.log('  └─ Case 4 Passed: Blocked state restrictions enforced by PermissionEngine');

  console.log('✅ All PermissionEngine unit tests PASSED!');
}

testPermissionEngine();
