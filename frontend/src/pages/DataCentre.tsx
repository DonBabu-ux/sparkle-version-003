import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Download,
    FileText,
    Shield,
    Clock,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    User,
    MessageSquare,
    Image,
    Layers,
    Sliders,
    ShoppingBag,
    Users,
    FileSpreadsheet,
    Code,
    Check,
    Lock
} from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

interface ExportJob {
    jobId: string;
    categories: string[];
    format: string;
    deliveryEmail: string;
    status: 'REQUESTED' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
    fileSizeBytes?: number;
    downloadToken?: string;
    expiresAt?: string;
    createdAt: string;
    completedAt?: string;
}

const CATEGORIES = [
    { id: 'profile', label: 'Profile Information', desc: 'Display name, bio, campus, affiliation, email, and account timestamps', icon: User },
    { id: 'posts', label: 'Posts & Captions', desc: 'Authored posts, text captions, media URLs, timestamps, spark and comment counts', icon: Image },
    { id: 'comments', label: 'Authored Comments', desc: 'All comments and responses written across posts', icon: MessageSquare },
    { id: 'messages', label: 'Sent Direct Messages', desc: 'Outbox message contents, recipient usernames, and sent dates', icon: MessageSquare },
    { id: 'moments', label: 'Moments & Stories', desc: 'Moments shared, view counts, and ephemeral post archives', icon: Layers },
    { id: 'groups', label: 'Groups & Clubs', desc: 'Group and club memberships, roles, and community activities', icon: Users },
    { id: 'marketplace', label: 'Marketplace History', desc: 'Item listings, prices, categories, and inquiries', icon: ShoppingBag },
    { id: 'consents_settings', label: 'Preferences & Settings', desc: 'Accessibility configurations, notification settings, and consent ledger', icon: Sliders },
];

const FORMATS = [
    { id: 'pdf', label: 'PDF Document', desc: 'Human-readable formatted report with tables and headers', icon: FileText, badge: 'Recommended' },
    { id: 'xlsx', label: 'Excel Workbook (XLSX)', desc: 'Multi-sheet spreadsheet with separate category tabs', icon: FileSpreadsheet },
    { id: 'csv', label: 'CSV Spreadsheets', desc: 'Plain tabular records compatible with data software', icon: FileSpreadsheet },
    { id: 'json', label: 'Structured JSON', desc: 'Machine-readable technical export format', icon: Code },
];

export default function DataCentre() {
    const navigate = useNavigate();
    const { user } = useUserStore();

    const [selectedCategories, setSelectedCategories] = useState<string[]>(CATEGORIES.map(c => c.id));
    const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
    const [deliveryMode, setDeliveryMode] = useState<'primary' | 'alternate'>('primary');
    const [alternateEmail, setAlternateEmail] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [history, setHistory] = useState<ExportJob[]>([]);
    const [historyLoading, setHistoryLoading] = useState<boolean>(true);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const res = await api.get('/users/data-centre/history');
            if (res.data?.history) {
                setHistory(res.data.history);
            }
        } catch (e: any) {
            console.error('Failed to load export history', e);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 10000); // Polling status every 10s
        return () => clearInterval(interval);
    }, []);

    const toggleCategory = (id: string) => {
        if (selectedCategories.includes(id)) {
            if (selectedCategories.length === 1) return; // Must keep at least one
            setSelectedCategories(selectedCategories.filter(c => c !== id));
        } else {
            setSelectedCategories([...selectedCategories, id]);
        }
    };

    const handleSelectAll = () => {
        if (selectedCategories.length === CATEGORIES.length) {
            setSelectedCategories([CATEGORIES[0].id]);
        } else {
            setSelectedCategories(CATEGORIES.map(c => c.id));
        }
    };

    const handleRequestExport = async () => {
        setStatusMessage(null);
        if (deliveryMode === 'alternate' && !alternateEmail.includes('@')) {
            setStatusMessage({ type: 'error', text: 'Please provide a valid alternate email address.' });
            return;
        }

        try {
            setLoading(true);
            const payload = {
                categories: selectedCategories,
                format: selectedFormat,
                deliveryEmail: deliveryMode === 'alternate' ? alternateEmail : user?.email,
                isAlternate: deliveryMode === 'alternate'
            };

            const res = await api.post('/users/data-centre/export', payload);
            if (res.data?.success) {
                setStatusMessage({
                    type: 'success',
                    text: res.data.message || 'Export job queued successfully. We will email you once your file is ready.'
                });
                await fetchHistory();
            }
        } catch (err: any) {
            setStatusMessage({
                type: 'error',
                text: err.response?.data?.error || err.message || 'Failed to request export.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            aria-label="Back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-white flex items-center gap-2">
                                <Shield className="w-5 h-5 text-sky-400" />
                                Personal Data Export Centre
                            </h1>
                            <p className="text-xs text-slate-400">Download a verified personal archive under GDPR & CCPA</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchHistory}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-semibold"
                        title="Refresh Status"
                    >
                        <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin text-sky-400' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* Privacy & Security Disclosure Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40 border border-sky-800/40 flex items-start gap-3.5 shadow-lg">
                    <Lock className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs leading-relaxed text-slate-300">
                        <p className="font-semibold text-sky-200">Protected & Sanitized Personal Archive</p>
                        <p>
                            Exports contain strictly your personal data. Password hashes, session tokens, OTP secrets,
                            administrative risk scoring, and other users' private profiles are excluded.
                            Download links are single-account bound and automatically self-destruct after 48 hours.
                        </p>
                    </div>
                </div>

                {/* Status Alert */}
                {statusMessage && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 border ${
                        statusMessage.type === 'success'
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                            : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    }`}>
                        {statusMessage.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        )}
                        <span className="text-sm">{statusMessage.text}</span>
                    </div>
                )}

                {/* Step 1: Select Categories */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 text-xs font-black flex items-center justify-center">1</span>
                                Select Personal Data Categories
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">Choose which activity segments to include in your archive</p>
                        </div>
                        <button
                            onClick={handleSelectAll}
                            className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition"
                        >
                            {selectedCategories.length === CATEGORIES.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {CATEGORIES.map(cat => {
                            const Icon = cat.icon;
                            const isSelected = selectedCategories.includes(cat.id);
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => toggleCategory(cat.id)}
                                    className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3.5 ${
                                        isSelected
                                            ? 'bg-sky-950/20 border-sky-500/50 text-white shadow-sm ring-1 ring-sky-500/30'
                                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                                        isSelected ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-500'
                                    }`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-200">{cat.label}</span>
                                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                                                isSelected ? 'bg-sky-500 border-sky-500 text-slate-950' : 'border-slate-700'
                                            }`}>
                                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-tight">{cat.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Step 2: Select Format */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 text-xs font-black flex items-center justify-center">2</span>
                            Select Archive Format
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">Formats are formatted and sanitized against formula injection</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {FORMATS.map(fmt => {
                            const Icon = fmt.icon;
                            const isSelected = selectedFormat === fmt.id;
                            return (
                                <button
                                    key={fmt.id}
                                    type="button"
                                    onClick={() => setSelectedFormat(fmt.id)}
                                    className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3.5 ${
                                        isSelected
                                            ? 'bg-sky-950/20 border-sky-500/50 text-white shadow-sm ring-1 ring-sky-500/30'
                                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                                        isSelected ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-500'
                                    }`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-200">{fmt.label}</span>
                                            {fmt.badge && (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                                    {fmt.badge}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1 leading-tight">{fmt.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Step 3: Destination & Confirmation */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 text-xs font-black flex items-center justify-center">3</span>
                            Delivery Destination & Confirmation
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">Where would you like us to notify you with your download link?</p>
                    </div>

                    <div className="space-y-3 pt-2">
                        <label className={`p-3.5 rounded-2xl border flex items-center gap-3 cursor-pointer transition ${
                            deliveryMode === 'primary' ? 'bg-sky-950/20 border-sky-500/50' : 'bg-slate-900/60 border-slate-800'
                        }`}>
                            <input
                                type="radio"
                                name="deliveryMode"
                                checked={deliveryMode === 'primary'}
                                onChange={() => setDeliveryMode('primary')}
                                className="w-4 h-4 text-sky-500 focus:ring-0"
                            />
                            <div className="flex-1 text-xs">
                                <span className="font-bold text-slate-200">Verified Primary Email</span>
                                <span className="block text-slate-400 mt-0.5">{user?.email || 'Your account email'}</span>
                            </div>
                        </label>

                        <label className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition ${
                            deliveryMode === 'alternate' ? 'bg-sky-950/20 border-sky-500/50' : 'bg-slate-900/60 border-slate-800'
                        }`}>
                            <input
                                type="radio"
                                name="deliveryMode"
                                checked={deliveryMode === 'alternate'}
                                onChange={() => setDeliveryMode('alternate')}
                                className="w-4 h-4 text-sky-500 focus:ring-0 mt-1"
                            />
                            <div className="flex-1 text-xs space-y-2">
                                <span className="font-bold text-slate-200">Alternative Destination</span>
                                {deliveryMode === 'alternate' && (
                                    <input
                                        type="email"
                                        placeholder="Enter alternative email address"
                                        value={alternateEmail}
                                        onChange={(e) => setAlternateEmail(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500"
                                    />
                                )}
                            </div>
                        </label>
                    </div>

                    <button
                        onClick={handleRequestExport}
                        disabled={loading || selectedCategories.length === 0}
                        className="w-full mt-4 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-slate-950 font-bold text-sm shadow-lg shadow-sky-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Processing Request...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Request Personal Data Export
                            </>
                        )}
                    </button>
                </div>

                {/* Export Job History */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4 text-sky-400" />
                        Recent Export Archives & Status
                    </h2>

                    {historyLoading && history.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                            Loading archive history...
                        </div>
                    ) : history.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400 border border-dashed border-slate-800 rounded-2xl">
                            No export requests found for this account.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map(job => {
                                const isReady = job.status === 'READY' && job.downloadToken;
                                const isExpired = job.status === 'EXPIRED' || (job.expiresAt && new Date(job.expiresAt) <= new Date());
                                const appUrl = window.location.origin;

                                return (
                                    <div
                                        key={job.jobId}
                                        className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-200 uppercase">{job.format} Archive</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                    job.status === 'READY' && !isExpired
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                        : job.status === 'PROCESSING' || job.status === 'QUEUED'
                                                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 animate-pulse'
                                                        : job.status === 'FAILED'
                                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                        : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {isExpired ? 'EXPIRED' : job.status}
                                                </span>
                                            </div>
                                            <p className="text-slate-400 text-[11px]">
                                                Requested on {new Date(job.createdAt).toLocaleString()} • Delivered to {job.deliveryEmail}
                                            </p>
                                            {job.fileSizeBytes && (
                                                <p className="text-slate-500 dark:text-zinc-400 text-[10px]">
                                                    Size: {(job.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB • {job.categories?.length || 0} Categories
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {isReady && !isExpired ? (
                                                <a
                                                    href={`${appUrl}/api/users/data-centre/download/${job.downloadToken}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1.5 transition shadow"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    Download
                                                </a>
                                            ) : job.status === 'PROCESSING' || job.status === 'QUEUED' ? (
                                                <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                                                    Compiling...
                                                </span>
                                            ) : (
                                                <span className="text-slate-500 dark:text-zinc-400 text-[11px]">Archive unavailable</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}



