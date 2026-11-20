import { useState, useEffect, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { MailCheck, XCircle, ArrowRight, RefreshCw, Mail } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import api from '../api/api';
import { parseResetLinkParams } from '../utils/resetLink';
import { showError, showSuccess } from '../utils/toast';
import { logger } from '../utils/logger';

type Status = 'idle' | 'checking' | 'done' | 'error';

function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const head = local.slice(0, 2);
    return `${head}${'•'.repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

function getStoredToken(): string | null {
    try {
        // Check common storage keys used by Sparkle's userStore
        return localStorage.getItem('token') || localStorage.getItem('sparkle_token') || null;
    } catch {
        return null;
    }
}

function getStoredEmail(): string | null {
    try {
        const raw = localStorage.getItem('user') || localStorage.getItem('sparkle_user');
        if (raw) {
            const parsed = JSON.parse(raw);
            return parsed?.email || parsed?.state?.user?.email || null;
        }
        return null;
    } catch {
        return null;
    }
}

export default function VerifyEmail() {
    const location = useLocation();
    const navigate = useNavigate();
    const { email: urlEmail, code: urlCode } = parseResetLinkParams(location.hash, location.search);

    const isLoggedIn = Boolean(getStoredToken());
    const storedEmail = getStoredEmail();

    // If logged in and no URL code → OTP input mode
    const otpMode = isLoggedIn && !urlCode;

    const [status, setStatus] = useState<Status>('idle');
    const [message, setMessage] = useState('');
    const [reward, setReward] = useState<{ awarded: boolean; points?: number } | null>(null);

    // OTP mode state
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendLoading, setResendLoading] = useState(false);
    const [showChangeEmail, setShowChangeEmail] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [changeEmailStatus, setChangeEmailStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [changeEmailMsg, setChangeEmailMsg] = useState('');
    const [currentEmail, setCurrentEmail] = useState(storedEmail || urlEmail || '');

    // Countdown timer for resend
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const hasParams = Boolean(urlEmail && urlCode);

    // ── Link-based verification ──────────────────────────────────────────────
    const verify = async () => {
        if (!hasParams || status === 'checking') return;
        setStatus('checking');
        try {
            const res = await api.post('/auth/verify-email', { email: urlEmail, code: urlCode });
            setStatus('done');
            const r = res.data?.reward;
            if (r?.awarded) setReward(r);
            showSuccess('Email verified — you can log in now.');
        } catch (err: any) {
            setStatus('error');
            const msg = err?.response?.data?.message
                || 'Verification failed. The code may be expired — request a new one from Sign Up.';
            setMessage(msg);
            showError(msg);
            logger.error('Email verify failed:', err);
        }
    };

    // ── OTP mode: digit input ────────────────────────────────────────────────
    const handleOtpChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const newDigits = [...otpDigits];
        newDigits[index] = digit;
        setOtpDigits(newDigits);
        if (digit && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Enter') handleOtpVerify();
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setOtpDigits(pasted.split(''));
            otpRefs.current[5]?.focus();
        }
    };

    const otpCode = otpDigits.join('');

    const handleOtpVerify = async () => {
        if (otpCode.length !== 6 || status === 'checking') return;
        setStatus('checking');
        try {
            const res = await api.post('/auth/verify-email', { email: currentEmail, code: otpCode });
            setStatus('done');
            const r = res.data?.reward;
            if (r?.awarded) setReward(r);
            showSuccess('Email verified!');
        } catch (err: any) {
            setStatus('error');
            const msg = err?.response?.data?.message || 'Invalid or expired code.';
            setMessage(msg);
            showError(msg);
            logger.error('OTP verify failed:', err);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0 || resendLoading) return;
        setResendLoading(true);
        try {
            await api.post('/auth/resend-verification', { email: currentEmail });
            showSuccess('Verification code resent!');
            setResendCooldown(60);
        } catch (err: any) {
            showError(err?.response?.data?.message || 'Failed to resend code.');
        } finally {
            setResendLoading(false);
        }
    };

    const handleChangeEmail = async () => {
        if (!newEmail.includes('@')) {
            setChangeEmailMsg('Please enter a valid email address.');
            setChangeEmailStatus('error');
            return;
        }
        setChangeEmailStatus('loading');
        try {
            const token = getStoredToken();
            await api.post('/auth/change-pending-email', { newEmail }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setCurrentEmail(newEmail);
            setChangeEmailStatus('done');
            setChangeEmailMsg(`Code sent to ${newEmail}. Enter it below.`);
            setShowChangeEmail(false);
            setOtpDigits(['', '', '', '', '', '']);
            setResendCooldown(60);
        } catch (err: any) {
            setChangeEmailStatus('error');
            setChangeEmailMsg(err?.response?.data?.message || 'Failed to change email.');
        }
    };

    // ── Render helpers ───────────────────────────────────────────────────────
    const renderSuccess = () => (
        <>
            {reward?.awarded && (
                <div style={{
                    background: 'linear-gradient(135deg, #ff1493 0%, #ff69b4 100%)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '18px',
                }}>
                    🎉 +{reward.points || 25} Sparkle Points earned!
                </div>
            )}
            <p className="text-sm text-black/60 dark:text-white/60 mb-6">
                {currentEmail ? (
                    <><span className="font-semibold text-[#18181b] dark:text-white">{maskEmail(currentEmail)}</span>{' '}
                    is verified. You can continue to your account.</>
                ) : 'Your email is verified. You can continue to your account.'}
            </p>
            <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity"
            >
                Continue to Sparkle <ArrowRight size={16} />
            </button>
        </>
    );

    return (
        <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-800 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white/80 dark:bg-zinc-800/80 backdrop-blur-3xl rounded-[36px] shadow-2xl border border-black/5 dark:border-white/10 p-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <MailCheck className="text-primary" size={30} strokeWidth={2.5} />
                </div>

                <h1 className="text-2xl font-black italic uppercase tracking-tight text-[#18181b] dark:text-white mb-2">
                    Verify Your Email
                </h1>

                {/* ── OTP mode (logged-in, no URL code) ── */}
                {otpMode ? (
                    status === 'done' ? renderSuccess() : (
                        <>
                            <p className="text-sm text-black/60 dark:text-white/60 mb-1">Enter the 6-digit code sent to</p>
                            <p className="text-sm font-semibold text-[#18181b] dark:text-white mb-5 break-all">
                                {currentEmail ? maskEmail(currentEmail) : 'your email'}
                            </p>

                            {/* OTP digit inputs */}
                            <div className="flex justify-center gap-2 mb-5" onPaste={handleOtpPaste}>
                                {otpDigits.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={el => { otpRefs.current[i] = el; }}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKeyDown(i, e)}
                                        className="w-11 h-14 text-center text-xl font-bold border-2 border-black/10 dark:border-white/20 rounded-xl bg-white dark:bg-zinc-700 text-[#18181b] dark:text-white focus:border-primary outline-none transition-colors"
                                    />
                                ))}
                            </div>

                            {status === 'error' && message && (
                                <div role="alert" className="flex items-start gap-2 text-left text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 mb-4">
                                    <XCircle size={16} className="mt-0.5 shrink-0" />
                                    <span>{message}</span>
                                </div>
                            )}

                            {changeEmailMsg && (
                                <div className={`text-sm mb-3 ${changeEmailStatus === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                                    {changeEmailMsg}
                                </div>
                            )}

                            <button
                                onClick={handleOtpVerify}
                                disabled={otpCode.length !== 6 || status === 'checking'}
                                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-primary text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition-opacity mb-3"
                            >
                                {status === 'checking' ? (
                                    <><Spinner size="small" /> Verifying…</>
                                ) : (
                                    <>Verify Email <ArrowRight size={16} /></>
                                )}
                            </button>

                            {/* Resend button */}
                            <button
                                onClick={handleResend}
                                disabled={resendCooldown > 0 || resendLoading}
                                className="flex items-center justify-center gap-1.5 w-full text-sm text-black/50 dark:text-white/50 hover:text-primary disabled:opacity-50 transition-colors mb-2"
                            >
                                {resendLoading ? <Spinner size="small" /> : <RefreshCw size={14} />}
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                            </button>

                            {/* Change email link */}
                            {!showChangeEmail ? (
                                <button
                                    onClick={() => setShowChangeEmail(true)}
                                    className="flex items-center justify-center gap-1.5 w-full text-sm text-black/40 dark:text-white/40 hover:text-primary transition-colors"
                                >
                                    <Mail size={14} /> Wrong email? Change it
                                </button>
                            ) : (
                                <div className="mt-3 text-left">
                                    <p className="text-xs text-black/50 dark:text-white/50 mb-2">Enter your new email address:</p>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        placeholder="new@email.com"
                                        className="w-full border border-black/10 dark:border-white/20 rounded-xl px-3 py-2 text-sm bg-white dark:bg-zinc-700 text-[#18181b] dark:text-white mb-2 outline-none focus:border-primary transition-colors"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleChangeEmail}
                                            disabled={changeEmailStatus === 'loading'}
                                            className="flex-1 py-2 rounded-full bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                                        >
                                            {changeEmailStatus === 'loading' ? 'Saving…' : 'Update email'}
                                        </button>
                                        <button
                                            onClick={() => { setShowChangeEmail(false); setChangeEmailMsg(''); }}
                                            className="flex-1 py-2 rounded-full border border-black/10 dark:border-white/20 text-sm text-black/60 dark:text-white/60"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )
                ) : (
                    /* ── Link-based mode ── */
                    !hasParams ? (
                        <>
                            <p className="text-sm text-black/50 dark:text-white/50 mb-6">
                                This verification link is incomplete. Open the latest "Verify Your Email"
                                message and use its button, or request a new code from Sign Up.
                            </p>
                            <Link
                                to="/signup"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity"
                            >
                                Go to Sign Up <ArrowRight size={16} />
                            </Link>
                        </>
                    ) : status === 'done' ? renderSuccess() : (
                        <>
                            <p className="text-sm text-black/60 dark:text-white/60 mb-1">
                                Confirm verification for
                            </p>
                            <p className="text-sm font-semibold text-[#18181b] dark:text-white mb-6 break-all">
                                {maskEmail(urlEmail)}
                            </p>

                            {status === 'error' && message && (
                                <div role="alert" className="flex items-start gap-2 text-left text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 mb-4">
                                    <XCircle size={16} className="mt-0.5 shrink-0" />
                                    <span>{message}</span>
                                </div>
                            )}

                            <button
                                onClick={verify}
                                disabled={status === 'checking'}
                                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-primary text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition-opacity"
                            >
                                {status === 'checking' ? (
                                    <><Spinner size="small" /> Verifying…</>
                                ) : (
                                    <>Verify Email <ArrowRight size={16} /></>
                                )}
                            </button>

                            <Link
                                to="/login"
                                className="block mt-4 text-xs text-black/40 dark:text-white/40 hover:underline"
                            >
                                Back to login
                            </Link>
                        </>
                    )
                )}
            </div>
        </div>
    );
}
