require('dotenv').config({ path: __dirname + '/../.env' });
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;
const AUTH = 'Basic ' + Buffer.from(`${KEY}:${SECRET}`).toString('base64');

(async () => {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/usage`, {
        headers: { Authorization: AUTH },
        signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.error('USAGE HTTP', res.status, (await res.text()).slice(0, 200)); process.exit(1); }
    const u = await res.json();
    const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
    const pct = (v) => v === null || v === undefined ? 'n/a' : (v * 100).toFixed(1) + '%';
    console.log('plan:', u.plan, '| next_reset:', u.next_reset_at ? new Date(u.next_reset_at).toISOString().slice(0, 16) : 'n/a');
    console.log('credits used:', u.credits?.usage?.toLocaleString(), '/', u.credits?.limit?.toLocaleString(), '=', (u.credits?.used_percent ?? 0) + '%');
    console.log('objects:', u.objects?.usage, '/', u.objects?.limit);
    console.log('storage:', mb(u.storage?.usage || 0), `(${u.storage?.credits_usage ?? '?'} credits)`);
    console.log('bandwidth:', mb(u.bandwidth?.usage || 0), `(${u.bandwidth?.credits_usage ?? '?'} credits)`);
    console.log('transformations:', u.transformations?.usage, `(${u.transformations?.credits_usage ?? '?'} credits)`, JSON.stringify(u.transformations?.breakdown || {}));
    console.log('requests:', u.requests?.usage, '/', u.requests?.limit);
    console.log('transformations:', u.transformations?.usage, '/', u.transformations?.limit);
    console.log('derived:', u.derived_resources?.usage, '/', u.derived_resources?.limit);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });