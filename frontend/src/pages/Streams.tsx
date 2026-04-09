import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Streams() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Mock streams to match EJS
  const mockStreams = [
    {
      id: 1,
      title: 'Late Night Study Session 📚',
      streamer_name: 'Tech_Ninja',
      viewer_count: 342,
      category: 'Study',
      thumbnail_url: 'https://images.unsplash.com/photo-1541339907198-e08756ebafe3?w=800',
      avatar_url: '/uploads/avatars/default.png'
    },
    {
      id: 2,
      title: 'Campus DJ Set LIVE 🎧',
      streamer_name: 'DJ_Sparkle',
      viewer_count: 1205,
      category: 'Music',
      thumbnail_url: 'https://images.unsplash.com/photo-1516280440502-a2fe018c6426?w=800',
      avatar_url: '/uploads/avatars/default.png'
    },
    {
      id: 3,
      title: 'Hackathon Prep & Coding',
      streamer_name: 'DevSquad',
      viewer_count: 89,
      category: 'Tech',
      thumbnail_url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800',
      avatar_url: '/uploads/avatars/default.png'
    }
  ];

  useEffect(() => {
    // Simulate loading to match the suspense
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors">
            <i className="fas fa-chevron-left"></i>
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none mb-1" style={{fontFamily: 'Outfit'}}>Live Streams</h1>
            <div className="flex items-center gap-2 text-xs font-bold text-rose-500 uppercase tracking-widest">
              <i className="fas fa-circle animate-pulse"></i>
              <span>On Air</span>
            </div>
          </div>
        </div>
        
        {/* Hidden on Phase 1 per EJS spec */}
        <button className="premium-btn hidden md:flex" style={{ borderRadius: '12px' }}>
          <i className="fas fa-video"></i>
          <span>Go Live</span>
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-rose-500">
             <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-[10px] font-black uppercase tracking-widest">Tuning Frequencies...</p>
          </div>
        ) : mockStreams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockStreams.map(stream => (
              <div key={stream.id} className="premium-card group hover:-translate-y-1 transition-all duration-300 border-white bg-white/80 overflow-hidden p-0 flex flex-col cursor-not-allowed" title="Stream Viewer Coming Soon">
                
                {/* Thumbnail Area */}
                <div className="relative h-48 overflow-hidden bg-slate-900 group-hover:brightness-110 transition-all">
                  <img src={stream.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={stream.title} />
                  
                  {/* Tags */}
                  <div className="absolute top-3 left-3 bg-rose-500 text-white px-2 py-1 rounded text-[10px] font-black tracking-widest uppercase shadow-lg">LIVE</div>
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-bold tracking-widest flex items-center gap-1.5">
                    <i className="fas fa-eye text-rose-400"></i> {stream.viewer_count.toLocaleString()}
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-80"></div>
                </div>

                {/* Content Area */}
                <div className="p-5 flex-1 flex flex-col pt-0 transform -translate-y-6">
                  <div className="flex items-end gap-3 mb-4">
                    <img src={stream.avatar_url} className="w-14 h-14 rounded-xl border-4 border-white shadow-lg object-cover bg-white" alt="streamer" />
                    <div className="pb-1">
                      <h3 className="font-black text-slate-800 text-lg leading-tight line-clamp-1 group-hover:text-rose-500 transition-colors">{stream.title}</h3>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-tight">{stream.streamer_name}</div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded uppercase tracking-widest">
                      {stream.category}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      Preview Only <i className="fas fa-lock opacity-50"></i>
                    </div>
                  </div>
                </div>

              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center glass-card border-dashed">
             <i className="fas fa-satellite-dish text-5xl text-slate-300 mb-6"></i>
             <h4 className="text-xl font-black text-slate-800 mb-2">No active streams</h4>
             <p className="text-slate-500 font-medium max-w-sm">No one is broadcasting right now. Be the first to start a stream and share your campus moments!</p>
          </div>
        )}
      </div>

    </div>
  );
}
