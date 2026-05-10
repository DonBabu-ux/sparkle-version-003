import { useState, useEffect } from 'react';
import { Database, HardDrive, Trash2, Shield, Activity, RefreshCw } from 'lucide-react';
import api from '../api/api';
import Navbar from '../components/Navbar';

interface StorageStats {
    total_assets: number;
    total_bytes: number;
    categories: { category: string; count: number; bytes: number }[];
    lifecycles: { lifecycle_state: string; count: number }[];
    cleanup: { cleanup_priority: string; count: number }[];
}

export default function StorageIntelligencePanel() {
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [cleaning, setCleaning] = useState(false);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/media/stats');
            setStats(res.data.data);
        } catch (err) {
            console.error('Failed to load stats', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleCleanup = async () => {
        setCleaning(true);
        try {
            await api.post('/admin/media/cleanup');
            await fetchStats();
        } catch (err) {
            console.error('Failed cleanup', err);
        } finally {
            setCleaning(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="flex bg-[#0f0f0f] min-h-screen text-white font-sans">
            <Navbar />
            <main className="flex-1 lg:ml-72 p-6 lg:p-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
                            <Database className="text-primary" /> Storage Intelligence
                        </h1>
                        <p className="text-white/50 text-sm">Centralized view of Cloudinary media lifecycle and optimizations.</p>
                    </div>
                    <button onClick={fetchStats} className="bg-white/10 p-3 rounded-full hover:bg-white/20 transition-all">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {loading && !stats ? (
                    <div className="animate-pulse space-y-4">
                        <div className="h-32 bg-white/5 rounded-2xl w-full" />
                        <div className="grid grid-cols-2 gap-4"><div className="h-48 bg-white/5 rounded-2xl" /><div className="h-48 bg-white/5 rounded-2xl" /></div>
                    </div>
                ) : stats ? (
                    <div className="space-y-6">
                        {/* High Level Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center gap-6">
                                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <HardDrive size={32} className="text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-1">Total Payload</p>
                                    <h2 className="text-4xl font-black">{formatBytes(stats.total_bytes)}</h2>
                                    <p className="text-white/60 text-sm mt-1">{stats.total_assets} Indexed Assets</p>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex items-center gap-6">
                                <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center">
                                    <Trash2 size={32} className="text-rose-500" />
                                </div>
                                <div>
                                    <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-1">Pending Cleanup</p>
                                    <h2 className="text-4xl font-black">
                                        {stats.lifecycles.find(l => l.lifecycle_state === 'pending_cleanup')?.count || 0}
                                    </h2>
                                    <button 
                                        onClick={handleCleanup} 
                                        disabled={cleaning}
                                        className="mt-3 px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-bold active:scale-95 disabled:opacity-50"
                                    >
                                        {cleaning ? 'Cleaning...' : 'Execute Safe Cleanup'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Categories */}
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity size={18} /> Storage by Category</h3>
                                <div className="space-y-4">
                                    {stats.categories.map(cat => (
                                        <div key={cat.category} className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-white capitalize font-medium">{cat.category}</span>
                                                <span className="text-white/40 text-xs">{cat.count} files</span>
                                            </div>
                                            <span className="font-bold">{formatBytes(cat.bytes)}</span>
                                        </div>
                                    ))}
                                    {stats.categories.length === 0 && <p className="text-white/30 text-sm">No data</p>}
                                </div>
                            </div>

                            {/* Lifecycle & Intelligence */}
                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Shield size={18} /> Lifecycle Intelligence</h3>
                                <div className="space-y-4">
                                    {stats.lifecycles.map(life => (
                                        <div key={life.lifecycle_state} className="flex items-center justify-between">
                                            <span className="text-white capitalize font-medium flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${life.lifecycle_state === 'active' ? 'bg-green-500' : life.lifecycle_state === 'reusable' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                                                {life.lifecycle_state.replace('_', ' ')}
                                            </span>
                                            <span className="font-bold text-white/80">{life.count}</span>
                                        </div>
                                    ))}
                                    {stats.lifecycles.length === 0 && <p className="text-white/30 text-sm">No data</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-white/30 py-20">Failed to load intel.</div>
                )}
            </main>
        </div>
    );
}
