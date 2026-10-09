import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { MailCheck, Loader2, XCircle, ArrowRight } from 'lucide-react';
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

export default function VerifyEmail() {
    const location = useLocation();
    const { email, code } = parseResetLinkParams(location.hash, location.search);
    const [status, setStatus] = useState<Status>('idle');
    const [message, setMessage] = useState('');

    const hasParams = Boolean(email && code);

    const verify = async () => {
        if (!hasParams || status === 'checking') return;
        setStatus('checking');
        try {
            await api.post('/auth/verify-email', { email, code });
            setStatus('done');
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

    return (
        <div className="min-h-dvh bg-white dark:bg-[#101217] flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white/80 dark:bg-[#121212]/80 backdrop-blur-3xl rounded-[36px] shadow-2xl border border-black/5 dark:border-white/10 p-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <MailCheck className="text-primary" size={30} strokeWidth={2.5} />
                </div>

                <h1 className="text-2xl font-black italic uppercase tracking-tight text-black dark:text-white mb-2">
                    Verify Your Email
                </h1>

                {!hasParams ? (
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
                ) : status === 'done' ? (
                    <>
                        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
                            <span className="font-semibold text-black dark:text-white">{maskEmail(email)}</span>{' '}
                            is verified. You can continue to your account.
                        </p>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-bold text-sm hover:opacity-90 transition-opacity"
                        >
                            Continue to Login <ArrowRight size={16} />
                        </Link>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-black/60 dark:text-white/60 mb-1">
                            Confirm verification for
                        </p>
                        <p className="text-sm font-semibold text-black dark:text-white mb-6 break-all">
                            {maskEmail(email)}
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
                                <><Loader2 size={16} className="animate-spin" /> Verifying…</>
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
                )}
            </div>
        </div>
    );
}
