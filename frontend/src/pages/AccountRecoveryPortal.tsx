import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShieldAlert,
    RotateCcw,
    FileText,
    Search,
    AlertCircle,
    CheckCircle2,
    Lock,
    KeyRound,
    Download
} from 'lucide-react';
import api from '../api/api';

type TabType = 'cancel-deletion' | 'appeal' | 'export' | 'status';

export default function AccountRecoveryPortal() {
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<TabType>('cancel-deletion');
    const [contact, setContact] = useState<string>('');
    const [challengeCode, setChallengeCode] = useState<string>('');
    const [requestId, setRequestId] = useState<string | null>(null);
    const [verifiedToken, setVerifiedToken] = useState<string | null>(null);

    // Form inputs
    const [reasonCategory, setReasonCategory] = useState<string>('Account Ban / Terms Misunderstanding');
    const [explanation, setExplanation] = useState<string>('');
    const [appealRef, setAppealRef] = useState<string>('');

    // States
    const [loading, setLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [statusResult, setStatusResult] = useState<any>(null);

    // Step 1: Send OTP Challenge
    const handleRequestChallenge = async () => {
        setMessage(null);
        if (!contact.trim()) {
            setMessage({ type: 'error', text: 'Please provide your account email or phone number.' });
            return;
        }

        try {
            setLoading(true);
            const actionTypeMap: Record<TabType, string> = {
                'cancel-deletion': 'CANCEL_DELETION',
                'appeal': 'APPEAL_TERMINATION',
                'export': 'DATA_EXPORT',
                'status': 'STATUS_CHECK'
            };

            const res = await api.post('/api/recovery/challenge', {
                contact,
                actionType: actionTypeMap[activeTab]
            });

            if (res.data?.success) {
                setRequestId(res.data.requestId || null);
                setMessage({
                    type: 'success',
                    text: res.data.message || 'Verification challenge sent to your verified contact.'
                });
            } else if (res.data?.code) {
                setMessage({ type: 'error', text: res.data.message });
            }
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || err.message || 'Failed to initiate recovery challenge.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify Code
    const handleVerifyChallenge = async () => {
        setMessage(null);
        if (!requestId || !challengeCode.trim()) {
            setMessage({ type: 'error', text: 'Please enter the 6-digit verification code.' });
            return;
        }

        try {
            setLoading(true);
            const res = await api.post('/api/recovery/verify', {
                requestId,
                code: challengeCode
            });

            if (res.data?.success && res.data?.verifiedToken) {
                setVerifiedToken(res.data.verifiedToken);
                setMessage({
                    type: 'success',
                    text: 'Identity verified. You may now complete your action.'
                });
            }
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || err.message || 'Invalid or expired verification code.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Step 3A: Cancel Deletion
    const handleExecuteCancelDeletion = async () => {
        if (!verifiedToken) return;
        try {
            setLoading(true);
            const res = await api.post('/api/recovery/cancel-deletion', { verifiedToken });
            if (res.data?.success) {
                setMessage({
                    type: 'success',
                    text: res.data.message || 'Account deletion has been cancelled. Your account is active.'
                });
                setVerifiedToken(null);
                setRequestId(null);
            }
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || err.message || 'Cancellation could not be completed.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Step 3B: Submit Appeal
    const handleExecuteSubmitAppeal = async () => {
        if (!verifiedToken) return;
        try {
            setLoading(true);
            const res = await api.post('/api/recovery/appeal', {
                verifiedToken,
                reasonCategory,
                explanation
            });
            if (res.data?.success) {
                setMessage({
                    type: 'success',
                    text: res.data.message
                });
                setVerifiedToken(null);
                setRequestId(null);
            }
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || err.message || 'Failed to submit appeal.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Step 3C: Emergency Export
    const handleExecuteEmergencyExport = async () => {
        if (!verifiedToken) return;
        try {
            setLoading(true);
            const res = await api.post('/api/recovery/emergency-export', {
                verifiedToken,
                format: 'pdf',
                categories: ['profile', 'posts', 'messages', 'moments']
            });
            if (res.data?.success) {
                setMessage({
                    type: 'success',
                    text: 'Emergency archive requested. A download link will be emailed to your verified address.'
                });
                setVerifiedToken(null);
                setRequestId(null);
            }
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || err.message || 'Export could not be generated.'
            });
        } finally {
            setLoading(false);
        }
    };

    // Step 4: Status Check
    const handleCheckStatus = async () => {
        setMessage(null);
        setStatusResult(null);
        if (!appealRef.trim() || !contact.trim()) {
            setMessage({ type: 'error', text: 'Please provide both your Case Reference # and Email address.' });
            return;
        }

        try {
            setLoading(true);
            const res = await api.get(`/api/recovery/appeal/status?ref=${encodeURIComponent(appealRef)}&contact=${encodeURIComponent(contact)}`);
            if (res.data) {
                setStatusResult(res.data);
            }
        } catch (err: any) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || err.message || 'No appeal record found matching those details.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4">
            <div className="max-w-xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Account Recovery Portal</h1>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Manage eligible account resolutions, appeals, and data preservation independently without active session credentials.
                    </p>
                </div>

                {/* Workflow Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl">
                    <button
                        onClick={() => { setActiveTab('cancel-deletion'); setRequestId(null); setVerifiedToken(null); setMessage(null); }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            activeTab === 'cancel-deletion' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Cancel Deletion
                    </button>
                    <button
                        onClick={() => { setActiveTab('appeal'); setRequestId(null); setVerifiedToken(null); setMessage(null); }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            activeTab === 'appeal' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        Appeal Ban
                    </button>
                    <button
                        onClick={() => { setActiveTab('export'); setRequestId(null); setVerifiedToken(null); setMessage(null); }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            activeTab === 'export' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Download className="w-3.5 h-3.5" />
                        Data Archive
                    </button>
                    <button
                        onClick={() => { setActiveTab('status'); setRequestId(null); setVerifiedToken(null); setMessage(null); }}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            activeTab === 'status' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Search className="w-3.5 h-3.5" />
                        Check Status
                    </button>
                </div>

                {/* Notifications & Status Banner */}
                {message && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 border text-xs leading-relaxed ${
                        message.type === 'success'
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                            : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                    }`}>
                        {message.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        )}
                        <span>{message.text}</span>
                    </div>
                )}

                {/* Body Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
                    {/* Mode A: Check Status */}
                    {activeTab === 'status' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Case Reference Number
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. SPK-APL-123456"
                                    value={appealRef}
                                    onChange={(e) => setAppealRef(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Associated Account Email
                                </label>
                                <input
                                    type="email"
                                    placeholder="your-email@example.com"
                                    value={contact}
                                    onChange={(e) => setContact(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500"
                                />
                            </div>

                            <button
                                onClick={handleCheckStatus}
                                disabled={loading}
                                className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2"
                            >
                                <Search className="w-4 h-4" />
                                Inquire Status
                            </button>

                            {statusResult && (
                                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-300">Case Ref: {statusResult.referenceNumber}</span>
                                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
                                            {statusResult.status}
                                        </span>
                                    </div>
                                    <p className="text-slate-400">Category: {statusResult.category}</p>
                                    <p className="text-slate-500 text-[10px]">Submitted: {new Date(statusResult.submittedAt).toLocaleString()}</p>
                                    {statusResult.decisionOutcome && (
                                        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-semibold text-sky-300">
                                            Decision: {statusResult.decisionOutcome}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : !verifiedToken ? (
                        /* Step 1 & 2: Verification Challenge Flow */
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Account Contact (Email or Phone)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Enter verified account email or phone"
                                    value={contact}
                                    onChange={(e) => setContact(e.target.value)}
                                    disabled={!!requestId}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500 disabled:opacity-50"
                                />
                            </div>

                            {!requestId ? (
                                <button
                                    onClick={handleRequestChallenge}
                                    disabled={loading || !contact.trim()}
                                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-slate-950 font-bold text-xs shadow-lg transition flex items-center justify-center gap-2"
                                >
                                    <KeyRound className="w-4 h-4" />
                                    Send Verification Code
                                </button>
                            ) : (
                                <div className="space-y-3 pt-2">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                            6-Digit Verification Code
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={6}
                                            placeholder="123456"
                                            value={challengeCode}
                                            onChange={(e) => setChallengeCode(e.target.value)}
                                            className="w-full tracking-widest text-center text-lg font-mono font-bold px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                                        />
                                    </div>

                                    <button
                                        onClick={handleVerifyChallenge}
                                        disabled={loading || challengeCode.length < 6}
                                        className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Verify Identity
                                    </button>

                                    <button
                                        onClick={() => { setRequestId(null); setChallengeCode(''); }}
                                        className="w-full text-center text-slate-500 hover:text-slate-400 text-xs py-1"
                                    >
                                        Use a different contact method
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Step 3: Verified Action Execution */
                        <div className="space-y-4">
                            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 font-semibold">
                                <Lock className="w-4 h-4" />
                                Identity Verified: Authorized Action Token Active
                            </div>

                            {activeTab === 'cancel-deletion' && (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Clicking below will authoritatively cancel your pending deletion, clear your scheduled
                                        erasure timestamp, and restore your account status to <strong>Active</strong>.
                                    </p>
                                    <button
                                        onClick={handleExecuteCancelDeletion}
                                        disabled={loading}
                                        className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                                    >
                                        Confirm & Cancel Account Deletion
                                    </button>
                                </div>
                            )}

                            {activeTab === 'appeal' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                            Appeal Category
                                        </label>
                                        <select
                                            value={reasonCategory}
                                            onChange={(e) => setReasonCategory(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-sky-500"
                                        >
                                            <option>Account Ban / Terms Misunderstanding</option>
                                            <option>Account Compromise / Unauthorized Takeover</option>
                                            <option>False Positive Moderation Flag</option>
                                            <option>Identity Verification Dispute</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                            Detailed Explanation
                                        </label>
                                        <textarea
                                            rows={4}
                                            placeholder="Explain why your termination should be reviewed and reversed..."
                                            value={explanation}
                                            onChange={(e) => setExplanation(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-sky-500"
                                        />
                                    </div>
                                    <button
                                        onClick={handleExecuteSubmitAppeal}
                                        disabled={loading || explanation.length < 20}
                                        className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition"
                                    >
                                        Submit Formal Appeal
                                    </button>
                                </div>
                            )}

                            {activeTab === 'export' && (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        You are entitled to retrieve a full copy of your personal data before permanent account loss.
                                        We will generate a verified PDF report and email a secure 48-hour download link.
                                    </p>
                                    <button
                                        onClick={handleExecuteEmergencyExport}
                                        disabled={loading}
                                        className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition"
                                    >
                                        Dispatch Emergency Data Archive
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Help */}
                <div className="text-center">
                    <button
                        onClick={() => navigate('/login')}
                        className="text-xs font-semibold text-slate-400 hover:text-white transition"
                    >
                        Return to Sparkle Sign In →
                    </button>
                </div>
            </div>
        </div>
    );
}
