import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, ArrowLeft, Copy, CheckCircle, Key, Webhook, Flag } from 'lucide-react';

const API_SAMPLES = {
  auth: `// Authentication POST Request
fetch('https://api.sparkle.campus/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'sparkle_student',
    password: 'secure_password_here'
  })
})
.then(res => res.json())
.then(data => console.log('Successfully Authenticated!', data.token));`,
  posts: `// Fetch Active Campus Feed
fetch('https://api.sparkle.campus/v1/posts?limit=10', {
  headers: {
    'Authorization': 'Bearer YOUR_API_TOKEN_HERE'
  }
})
.then(res => res.json())
.then(feed => console.log('Current Feed:', feed.results));`,
  realtime: `// Subscribe to Realtime WebSocket Updates
import { io } from 'socket.io-client';

const socket = io('wss://api.sparkle.campus/realtime');
socket.on('connect', () => {
  socket.emit('subscribe', { channel: 'campus:alerts' });
});

socket.on('alert', (data) => {
    console.log('Live Campus Alert Received:', data.message);
});`
};

const DEV_TOOLS = [
  { name: 'API Keys', desc: 'Generate scoped keys per app. Keys are hashed at rest and can be revoked instantly.', icon: Key },
  { name: 'Webhooks', desc: 'Signed event deliveries for new posts, messages, listings and marketplace orders.', icon: Webhook },
  { name: 'Sandbox Playgrounds', desc: 'Simulate flows against seeded campus data before touching production traffic.', icon: Flag },
];

export default function Developer() {
  const navigate = useNavigate();
  const [apiCategory, setApiCategory] = useState<'auth' | 'posts' | 'realtime'>('auth');
  const [copied, setCopied] = useState(false);

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page-wrapper">
      <div className="eco-content">
        <main className="eco-container">

          <button onClick={() => navigate('/settings')} className="eco-back-link">
            <ArrowLeft size={14} strokeWidth={3} />
            back to settings
          </button>

          <div className="eco-hero">
            <div className="eco-hero-icon">
              <Terminal size={36} />
            </div>
            <div>
              <h1>Developer Hub</h1>
              <p>Build campus bots, fetch announcements, or browse public skill listings from your own tools.</p>
            </div>
          </div>

          <h2 className="eco-section-title">tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DEV_TOOLS.map((tool) => (
              <div key={tool.name} className="eco-card">
                <div className="eco-tile-icon" style={{ width: 44, height: 44, borderRadius: 14 }}>
                  <tool.icon size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-base font-black text-[#18181b] dark:text-zinc-100 mt-4">{tool.name}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 leading-relaxed">{tool.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="eco-section-title">api access</h2>
          <div className="eco-card">
            <h3 className="text-xl font-black text-gray-900 dark:text-white">Campus API Access</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Keys are provisioned per developer. Request access from the support desk and you will be provisioned a sandbox workspace within 24 hours.</p>

            <div className="flex gap-2 mt-6 border-b border-gray-100 dark:border-white/5 pb-3">
              {(['auth', 'posts', 'realtime'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setApiCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${apiCategory === cat ? 'bg-[#ff1493] text-white' : 'bg-[#f0e5ec] dark:bg-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-[#e7dae3] dark:hover:bg-zinc-600'}`}
                >
                  {cat === 'auth' ? 'POST Auth' : cat === 'posts' ? 'GET Feed' : 'WebSocket connection'}
                </button>
              ))}
            </div>

            <div className="relative mt-4">
              <pre className="bg-gray-950 text-emerald-400 p-5 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed shadow-inner">
                {API_SAMPLES[apiCategory]}
              </pre>
              <button
                onClick={() => copyCode(API_SAMPLES[apiCategory])}
                className="absolute top-4 right-4 bg-white/10 dark:bg-zinc-900/40 hover:bg-white/20 text-white p-2 rounded-xl transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <CheckCircle size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <h2 className="eco-section-title">infrastructure</h2>
          <div className="eco-card">
            <h4 className="font-black text-lg text-gray-900 dark:text-white mb-4">Platform Infrastructure Overview</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
              <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl text-center">
                <div className="text-[#ff1493] font-black text-2xl">99.9%</div>
                <div className="text-xs text-gray-400 uppercase font-bold mt-1">Uptime</div>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl text-center">
                <div className="text-[#ff1493] font-black text-2xl">&lt;45ms</div>
                <div className="text-xs text-gray-400 uppercase font-bold mt-1">Realtime Speed</div>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl text-center">
                <div className="text-[#ff1493] font-black text-2xl">AES-256</div>
                <div className="text-xs text-gray-400 uppercase font-bold mt-1">Encryption</div>
              </div>
              <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl text-center">
                <div className="text-[#ff1493] font-black text-2xl">PWA</div>
                <div className="text-xs text-gray-400 uppercase font-bold mt-1">Offline Ready</div>
              </div>
            </div>
          </div>

        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main); min-height: 100dvh; }
        .eco-content { flex: 1; overflow-y: auto; }
        .eco-container { max-width: 820px; margin: 0 auto; padding: 30px 24px 100px; }

        .eco-back-link { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 20px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; font-style: italic; color: rgba(0,0,0,0.4); transition: all 0.2s ease; }
        .eco-back-link:hover { color: #ff1493; gap: 12px; }
        .dark .eco-back-link { color: rgba(255,255,255,0.4); }
        .dark .eco-back-link:hover { color: #ff1493; }

        .eco-hero { display: flex; align-items: center; gap: 20px; background: #fdf8fa; color: #18181b; padding: 32px; border-radius: 32px; margin-bottom: 28px; border: 1px solid #e6d8e1; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .eco-hero-icon { color: #ff1493; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .eco-hero h1 { font-size: 2rem; font-weight: 900; margin: 0 0 6px; letter-spacing: -1px; color: #18181b; }
        .eco-hero p { margin: 0; color: #475569; font-size: 1.05rem; }
        .dark .eco-hero { background: #27272a; border-color: #3f3f46; box-shadow: none; }
        .dark .eco-hero h1 { color: #f4f4f5; }
        .dark .eco-hero p { color: #a1a1aa; }

        .eco-section-title { font-size: 0.7rem; font-weight: 900; letter-spacing: 0.4em; text-transform: uppercase; font-style: italic; color: rgba(0,0,0,0.25); margin: 40px 0 16px; }
        .dark .eco-section-title { color: rgba(255,255,255,0.3); }

        .eco-card { background: #fdf8fa; border: 1px solid #e6d8e1; border-radius: 28px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.03); transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .eco-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(255,20,147,0.08); border-color: rgba(255,20,147,0.3); }
        .dark .eco-card { background: #27272a; border-color: #3f3f46; }

        .eco-tile-icon { width: 48px; height: 48px; border-radius: 16px; background: rgba(0,0,0,0.05); color: #18181b; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .eco-card:hover .eco-tile-icon { background: #18181b; color: #fff; }
        .dark .eco-tile-icon { background: rgba(255,255,255,0.05); color: #f4f4f5; }
        .dark .eco-card:hover .eco-tile-icon { background: #f4f4f5; color: #18181b; }
      `}</style>
    </div>
  );
}
