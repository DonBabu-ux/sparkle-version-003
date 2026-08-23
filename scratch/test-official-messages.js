require('dotenv').config();

function testOfficialMessageExtraction() {
  console.log('\n======================================================');
  console.log('   Sparkle Official & SparklePay Messages Audit');
  console.log('======================================================\n');

  const mockMessages = [
    {
      message_id: 'msg-1',
      type: 'official',
      content: '💖 Welcome to Sparkle\n\nWe\'re excited to have you here.',
    },
    {
      message_id: 'msg-2',
      type: 'system',
      text: 'Security Alert: New login detected from Android Device.',
    },
    {
      message_id: 'msg-3',
      type: 'sparkle_pay',
      sender_username: 'sparklepay',
      payload: {
        title: 'Wallet Top-up Successful',
        subtitle: 'Your wallet has been credited.',
        amount: 'KES 2,500.00',
        referenceId: 'SPK-8A91F2C7',
        balance: 'KES 7,830.00',
      },
    },
    {
      message_id: 'msg-4',
      type: 'sparkle_pay',
      sender_username: 'sparklepay',
      payload: {
        title: 'Subscription Successful',
        subtitle: 'Sparkle Premium has been activated.',
        amount: 'KES 499.00',
        referenceId: 'SPK-1F73B9D4',
      },
    },
    {
      message_id: 'msg-5',
      type: 'sparkle_pay',
      sender_username: 'sparklepay',
      payload: {
        title: 'Payment Completed',
        subtitle: 'Your wallet payment was processed successfully.',
        amount: 'KES 1,250.00',
        referenceId: 'SPK-9D72C4A1',
        status: 'Successful',
      },
    },
    {
      message_id: 'msg-6',
      type: 'sparkle_pay',
      sender_username: 'sparklepay',
      payload: {
        title: 'Refund Processed',
        subtitle: 'The refund has been credited to your wallet.',
        amount: 'KES 850.00',
        referenceId: 'SPK-RF-73214',
      },
    },
  ];

  let passCount = 0;

  mockMessages.forEach((msg, idx) => {
    const textContent =
      msg.content ||
      msg.text ||
      msg.message ||
      msg.body ||
      (typeof msg.payload === 'object'
        ? msg.payload?.body || msg.payload?.content || msg.payload?.text || msg.payload?.message || msg.payload?.subtitle
        : typeof msg.payload === 'string'
        ? msg.payload
        : '') ||
      '';

    const isSparklePay =
      msg.type === 'sparkle_pay' ||
      msg.type === 'wallet' ||
      msg.category === 'wallet' ||
      msg.sender_username === 'sparklepay' ||
      msg.payload?.referenceId ||
      msg.payload?.amount;

    if (isSparklePay) {
      console.log(`[TEST ${idx + 1}] SparklePay Notification: "${msg.payload?.title}" | Amount: ${msg.payload?.amount} | Ref: ${msg.payload?.referenceId} .... PASS`);
      passCount++;
    } else if (textContent) {
      console.log(`[TEST ${idx + 1}] Official Text Message: "${textContent.split('\n')[0]}" .... PASS`);
      passCount++;
    } else {
      console.log(`[TEST ${idx + 1}] FAILED to extract message text`);
    }
  });

  console.log('\n------------------------------------------------------');
  console.log(`Overall Audit Status ...... ${passCount === mockMessages.length ? 'PASS' : 'FAIL'}`);
  console.log('------------------------------------------------------\n');
}

testOfficialMessageExtraction();
