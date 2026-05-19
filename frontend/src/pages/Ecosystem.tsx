import { useState } from 'react';
import { 
  Sparkles, 
  Smartphone, 
  Code, 
  BookOpen, 
  Download, 
  ExternalLink, 
  Terminal, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  CheckCircle,
  Copy,
  ChevronRight
} from 'lucide-react';
import Navbar from '../components/Navbar';

interface AppItem {
  name: string;
  desc: string;
  icon: any;
  status: 'active' | 'beta' | 'planned';
  version: string;
  badge?: string;
}

const APPS: AppItem[] = [
  { name: 'Sparkle Social Core', desc: 'The main dashboard, feed, stories, and social connection hub for students.', icon: Sparkles, status: 'active', version: 'v3.0.2' },
  { name: 'Sparkle Chat', desc: 'Realtime desktop & mobile instant messaging app with visual safety scanning.', icon: Layers, status: 'active', version: 'v2.1.0', badge: '100k+ Active' },
  { name: 'Sparkle Marketplace', desc: 'Campus community classifieds to buy, sell, or trade textbooks, housing, and goods safely.', icon: Smartphone, status: 'active', version: 'v1.5.2' },
  { name: 'Sparkle Skill Market', desc: 'Student freelancer hub to hire or offer services including tutoring, design, and code.', icon: Cpu, status: 'active', version: 'v1.2.0', badge: 'Popular' },
  { name: 'Sparkle Developer Hub', desc: 'Comprehensive API keys, webhooks, and sandboxed simulation playgrounds.', icon: Terminal, status: 'beta', version: 'v0.9.0' }
];

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
  console.log('🚨 Live Campus Alert Received:', data.message);
});`
};

export default function Ecosystem() {
  const [activeTab, setActiveTab] = useState<'apps' | 'apk' | 'api' | 'about'>('apps');
  const [apiCategory, setApiCategory] = useState<'auth' | 'posts' | 'realtime'>('auth');
  const [copied, setCopied] = useState(false);

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="eco-content">
        <main className="eco-container">
          
          {/* Header Hero */}
          <div className="eco-hero">
            <div className="eco-hero-icon">
              <Sparkles size={36} className="animate-pulse" />
            </div>
            <div>
              <h1>Sparkle Ecosystem</h1>
              <p>Explore official applications, download client APKs, and build integrations with modern campus developer tools.</p>
            </div>
          </div>

          {/* Quick Subnavigation */}
          <div className="flex border-b border-gray-200 dark:border-white/10 mb-8 gap-4 overflow-x-auto pb-1">
            <button 
              onClick={() => setActiveTab('apps')} 
              className={`pb-4 px-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'apps' ? 'border-b-2 border-[#FF3D6D] text-[#FF3D6D]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <div className="flex items-center gap-2">
                <Layers size={18} />
                <span>Our Suite of Apps</span>
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('apk')} 
              className={`pb-4 px-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'apk' ? 'border-b-2 border-[#FF3D6D] text-[#FF3D6D]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <div className="flex items-center gap-2">
                <Smartphone size={18} />
                <span>Download APKs</span>
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('api')} 
              className={`pb-4 px-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'api' ? 'border-b-2 border-[#FF3D6D] text-[#FF3D6D]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <div className="flex items-center gap-2">
                <Code size={18} />
                <span>Developer APIs</span>
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('about')} 
              className={`pb-4 px-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'about' ? 'border-b-2 border-[#FF3D6D] text-[#FF3D6D]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <div className="flex items-center gap-2">
                <BookOpen size={18} />
                <span>About & Docs</span>
              </div>
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'apps' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {APPS.map((app) => (
                <div key={app.name} className="eco-card group">
                  <div className="flex items-start justify-between">
                    <div className="eco-app-icon" style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)' }}>
                      <app.icon size={24} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`eco-status-pill eco-status-${app.status}`}>
                        {app.status}
                      </span>
                      {app.badge && (
                        <span className="bg-[#ebf5ff] text-[#0066cc] dark:bg-[#002b4d] dark:text-[#66b2ff] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                          {app.badge}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mt-4 group-hover:text-[#FF3D6D] transition-colors">
                    {app.name}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 leading-relaxed">
                    {app.desc}
                  </p>
                  
                  <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/5 mt-6 pt-4 text-xs font-semibold text-gray-400">
                    <span>Version {app.version}</span>
                    <button className="flex items-center gap-1 text-[#FF3D6D] hover:underline font-bold">
                      <span>Launch App</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'apk' && (
            <div className="flex flex-col gap-6">
              <div className="bg-gradient-to-r from-purple-500 to-[#FF3D6D] text-white p-8 rounded-[32px] shadow-xl">
                <h3 className="text-2xl font-black mb-2">Download Sparkle for Mobile</h3>
                <p className="text-white/80 text-sm max-w-lg mb-6">Experience fluid 120Hz scrolling, native push notifications, edge-to-edge camera integrations, and offline caching systems.</p>
                <div className="flex flex-wrap gap-4">
                  <button className="flex items-center gap-3 bg-white text-gray-900 px-6 py-3 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-transform">
                    <Download size={20} className="text-[#FF3D6D]" />
                    <div className="text-left">
                      <div className="text-[10px] uppercase font-black text-gray-400 leading-none">Download APK</div>
                      <div className="text-sm font-black">Android Native v3.0.2</div>
                    </div>
                  </button>
                  <button className="flex items-center gap-3 bg-white text-gray-900 px-6 py-3 rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-transform">
                    <Smartphone size={20} className="text-[#FF3D6D]" />
                    <div className="text-left">
                      <div className="text-[10px] uppercase font-black text-gray-400 leading-none">Get iOS App</div>
                      <div className="text-sm font-black">iOS Dev Sandbox Build</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 mb-4">
                    <ShieldCheck size={24} />
                  </div>
                  <h4 className="font-black text-lg text-gray-900 dark:text-white">Android System Requirements</h4>
                  <ul className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex flex-col gap-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      <span>Android OS version 10.0 (API 29) or higher</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      <span>Min 3GB RAM / 100MB free storage space</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      <span>Google Play Services enabled (for cloud messaging)</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 mb-4">
                    <CheckCircle size={24} />
                  </div>
                  <h4 className="font-black text-lg text-gray-900 dark:text-white">iOS System Requirements</h4>
                  <ul className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex flex-col gap-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-blue-500 shrink-0" />
                      <span>iOS 15.0 or later on compatible iPhone model</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-blue-500 shrink-0" />
                      <span>Requires installation via TestFlight sandbox</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-blue-500 shrink-0" />
                      <span>Supports iPadOS 15.0+ landscape mode</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="flex flex-col gap-6">
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-[28px] border border-gray-100 dark:border-white/5 shadow-sm">
                <h3 className="text-xl font-black text-gray-900 dark:text-white">Campus Open API Access</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Build custom campus bots, retrieve real-time announcements, or query public skill directories directly from your terminal.</p>
                
                <div className="flex gap-2 mt-6 border-b border-gray-100 dark:border-white/5 pb-3">
                  {(['auth', 'posts', 'realtime'] as const).map((cat) => (
                    <button 
                      key={cat} 
                      onClick={() => setApiCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${apiCategory === cat ? 'bg-[#FF3D6D] text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200'}`}
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
                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? <CheckCircle size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="flex flex-col gap-6">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm leading-relaxed text-gray-600 dark:text-gray-300">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-4">About the Platform</h3>
                <p className="mb-4">Sparkle is a hyper-local campus collaboration network built from the ground up for students. It unifies high-performance micro-blogging, a verified student-to-student peer marketplace, student freelancer skill acquisition hubs, and structured college societies directories into a fast, beautiful mobile & desktop experience.</p>
                <p className="mb-4">Our systems are fully federated across distinct university nodes, utilizing a robust Postgres, Redis, and high-frequency Node.js WebSocket engine backend, with CDN image optimization networks providing seamless high-fidelity static media deliveries.</p>
                
                <h4 className="font-black text-lg text-gray-900 dark:text-white mt-8 mb-4">Platform Infrastructure Overview</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl text-center">
                    <div className="text-[#FF3D6D] font-black text-2xl">99.9%</div>
                    <div className="text-xs text-gray-400 uppercase font-bold mt-1">Uptime SLA</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl text-center">
                    <div className="text-[#FF3D6D] font-black text-2xl">&lt;45ms</div>
                    <div className="text-xs text-gray-400 uppercase font-bold mt-1">WS Latency</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl text-center">
                    <div className="text-[#FF3D6D] font-black text-2xl">AES-256</div>
                    <div className="text-xs text-gray-400 uppercase font-bold mt-1">Encryption</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl text-center">
                    <div className="text-[#FF3D6D] font-black text-2xl">PWA</div>
                    <div className="text-xs text-gray-400 uppercase font-bold mt-1">Offline Ready</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main, #f0f2f5); min-height: 100vh; }
        .eco-content { flex: 1; overflow-y: auto; }
        .eco-container { max-width: 820px; margin: 0 auto; padding: 30px 24px 100px; }

        .eco-hero { display: flex; align-items: center; gap: 20px; background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; padding: 40px; border-radius: 32px; margin-bottom: 28px; box-shadow: 0 16px 40px rgba(255,61,109,0.2); }
        .eco-hero-icon { width: 70px; height: 70px; background: rgba(255,255,255,0.2); border-radius: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .eco-hero h1 { font-size: 2.2rem; font-weight: 900; margin: 0 0 6px; letter-spacing: -1px; }
        .eco-hero p { margin: 0; opacity: 0.9; font-size: 1.1rem; }

        .eco-card { background: white; border: 1px solid rgba(0,0,0,0.04); border-radius: 28px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.03); transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .eco-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(255,61,109,0.08); border-color: rgba(255,61,109,0.2); }
        .dark .eco-card { background: #18181b; border-color: rgba(255,255,255,0.05); }

        .eco-app-icon { width: 48px; height: 48px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        
        .eco-status-pill { text-transform: uppercase; font-size: 10px; font-weight: 900; letter-spacing: 0.05em; padding: 2px 8px; rounded-full: 9999px; border-radius: 9999px; }
        .eco-status-active { background: #dcfce7; color: #15803d; }
        .dark .eco-status-active { background: #064e3b; color: #4ade80; }
        .eco-status-beta { background: #fef3c7; color: #b45309; }
        .dark .eco-status-beta { background: #78350f; color: #fbbf24; }
        .eco-status-planned { background: #f1f5f9; color: #475569; }
        .dark .eco-status-planned { background: #334155; color: #94a3b8; }
      `}</style>
    </div>
  );
}
