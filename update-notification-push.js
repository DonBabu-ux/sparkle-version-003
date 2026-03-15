const fs = require('fs');
const file = 'controllers/notification.controller.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Add webpush imports and config
const header = `const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const webpush = require('web-push');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:sparkle@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}`;
code = code.replace(/const pool = require\('\.\.\/config\/database'\);\s*const \{ v4: uuidv4 \} = require\('uuid'\);/, header);

// 2. Add subscribePush method to controller object
const subscribeMethod = `subscribePush: async (req, res) => {
        try {
            const userId = req.user.userId || req.user.user_id;
            const subscription = req.body;
            
            if (!subscription || !subscription.endpoint) {
                return res.status(400).json({ error: 'Invalid subscription object' });
            }
            
            // Check if exists
            const [existing] = await pool.query('SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [userId, subscription.endpoint]);
            if (existing.length === 0) {
                await pool.query('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)', [
                    userId,
                    subscription.endpoint,
                    subscription.keys.p256dh,
                    subscription.keys.auth
                ]);
            }
            res.status(201).json({ message: 'Subscribed' });
        } catch (error) {
            console.error('Push subscribe error:', error);
            res.status(500).json({ error: 'Failed' });
        }
    },
    
    // Get user's notifications`;

code = code.replace(/\/\/ Get user's notifications/, subscribeMethod);

// 3. Add push notification dispatching inside createNotification
const pushDispatch = `// Emit real-time socket notification
            const emitter = getEmitter();
            if (emitter) {
                emitter(data.user_id, {
                    notification_id: notificationId,
                    id: notificationId,
                    type: data.type,
                    title: data.title,
                    content: data.content,
                    action_url: data.action_url || null,
                    actor_id: data.actor_id || null,
                    ...actorInfo,
                    is_read: false,
                    created_at: new Date().toISOString()
                });
            }
            
            // Send web push notification
            try {
                if (process.env.VAPID_PUBLIC_KEY) {
                    const [subs] = await connection.query('SELECT * FROM push_subscriptions WHERE user_id = ?', [data.user_id]);
                    const payload = JSON.stringify({
                        title: data.title || 'Sparkle Notification',
                        body: data.content,
                        icon: actorInfo.actor_avatar || '/images/logo.png',
                        url: data.action_url || '/'
                    });
                    
                    for (const sub of subs) {
                        try {
                            await webpush.sendNotification({
                                endpoint: sub.endpoint,
                                keys: { p256dh: sub.p256dh, auth: sub.auth }
                            }, payload);
                        } catch (err) {
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                await connection.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                            } else {
                                console.error('webpush error', err);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Push notification system failed:', err);
            }`;

code = code.replace(/\/\/ Emit real-time socket notification[\s\S]*?\}\s*return notificationId;/, pushDispatch + '\n            return notificationId;');

fs.writeFileSync(file, code);
console.log('Done!');
