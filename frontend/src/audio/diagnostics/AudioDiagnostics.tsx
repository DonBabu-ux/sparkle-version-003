import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Volume2, ShieldAlert, CheckCircle, Play, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AudioSessionManager from '../managers/AudioSessionManager';
import type { SoundKey } from '../managers/SoundManager';

export const AudioDiagnostics: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Keep stats updated every 500ms
    const interval = setInterval(() => {
      setStats(AudioSessionManager.getDiagnostics());
    }, 500);
    return () => clearInterval(interval);
  }, [refreshKey]);

  if (!stats) {
    return (
      <div className="min-h-dvh bg-slate-950 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  const handleTestSound = (key: SoundKey) => {
    AudioSessionManager.playSound(key);
  };

  const handleReset = () => {
    AudioSessionManager.resetSettings();
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-[#1e1026] text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-white/5 rounded-xl transition-all active:scale-95 text-slate-400 hover:text-white"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-pink-500 to-rose-400 bg-clip-text text-transparent italic uppercase tracking-wider">
                Audio Diagnostics
              </h1>
              <p className="text-xs text-slate-400">Sparkle Experience Audio Engine v3 Metrics</p>
            </div>
          </div>
          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="p-2 hover:bg-white/5 rounded-xl transition-all text-slate-400 hover:text-white"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Top Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">AudioContext</span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${stats.ctxState === 'running' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
              <p className="text-lg font-bold capitalize">{stats.ctxState}</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Active Nodes</span>
            <p className="text-2xl font-black mt-1 text-pink-400">{stats.activeInstances}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Average Latency</span>
            <p className="text-2xl font-black mt-1 text-rose-400">{stats.latency}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Memory Cached</span>
            <p className="text-2xl font-black mt-1 text-purple-400">{stats.cachedSize}</p>
          </div>
        </div>

        {/* Details & Asset Checks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Engine Parameters */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 md:col-span-1 space-y-4 backdrop-blur-md">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-white/5 pb-2">
              Parameters
            </h2>
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Theme</span>
                <p className="text-sm font-bold text-pink-400">{stats.currentTheme}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Decoded Failures</span>
                <p className="text-sm font-bold text-rose-400">{stats.failures}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Initialization Time</span>
                <p className="text-sm font-bold text-slate-200">{(stats.startupTimeMs || 0).toFixed(1)} ms</p>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleReset}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2"
                >
                  <Settings size={14} /> Reset Audio Settings
                </button>
              </div>
            </div>
          </div>

          {/* Asset Quality Warnings */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 md:col-span-2 space-y-4 backdrop-blur-md">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-white/5 pb-2">
              Asset Validation & Logs
            </h2>
            {stats.warnings && stats.warnings.length > 0 ? (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                {stats.warnings.map((w: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-xs text-rose-300">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-500" />
                    <div>
                      <p className="font-bold">{w.file} ({w.type})</p>
                      <p className="opacity-80 mt-0.5">{w.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400 text-xs">
                <CheckCircle size={32} className="text-green-500 mb-2 animate-bounce" />
                <p>All assets passed validation checks.</p>
                <p className="opacity-60 text-[10px] mt-0.5">Checked formats, sample rates, duplicates & file sizes.</p>
              </div>
            )}
          </div>
        </div>

        {/* Test Sounds Preview */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-white/5 pb-2">
            Per-Sound Preview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Send', key: 'send' },
              { label: 'Receive', key: 'receive' },
              { label: 'Like', key: 'like' },
              { label: 'Comment', key: 'comment' },
              { label: 'Follow', key: 'follow' },
              { label: 'Notification', key: 'outchat' },
            ].map((sound) => (
              <button
                key={sound.key}
                onClick={() => handleTestSound(sound.key as SoundKey)}
                className="py-2 px-3 bg-white/5 hover:bg-pink-600/20 hover:border-pink-500/50 border border-white/10 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 text-xs font-bold"
              >
                <Play size={10} fill="currentColor" /> {sound.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sound Pools Utilization Monitor */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 border-b border-white/5 pb-2">
            Sound Pools Utilization
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-h-72 overflow-y-auto pr-2 no-scrollbar">
            {Object.entries(stats.poolUsage || {}).map(([key, usage]: [string, any]) => {
              const percentage = (usage.active / usage.total) * 100;
              return (
                <div key={key} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-200 capitalize">{key}</span>
                    <span className="font-semibold text-slate-400">{usage.active} / {usage.total}</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${percentage > 70 ? 'bg-rose-500' : percentage > 30 ? 'bg-pink-500' : 'bg-green-500'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default AudioDiagnostics;
