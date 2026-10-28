/* scratch: diagnose why /auth/login fetch fails from a script */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
(async () => {
    const t0 = Date.now();
    try {
        const r = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'definitely-not-a-user@example.com', password: 'Wrong-Passw0rd!' })
        });
        const txt = await r.text();
        console.log('STATUS', r.status, 'in', Date.now() - t0, 'ms');
        console.log('BODY', txt.slice(0, 300));
    } catch (e) {
        console.log('FETCH ERR after', Date.now() - t0, 'ms:', e.message);
        console.log('CAUSE:', e.cause ? (e.cause.code || e.cause.message) : 'none');
        if (e.cause) console.log('CAUSE FULL:', JSON.stringify(e.cause, Object.getOwnPropertyNames(e.cause)).slice(0, 400));
    }
    process.exit(0);
})();
