// config/supabase.js
// Simple Supabase client wrapper using the public anon key (for client‑side use).
// For privileged RPC calls (push notifications) we use the service‑role key in
// `controllers/supabase.controller.js`. The anon key is sufficient for any other
// Supabase features you may need (e.g., auth, realtime queries).

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env – client not initialized');
    module.exports = null;
} else {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    module.exports = supabase;
}
