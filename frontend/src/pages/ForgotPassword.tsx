import { showError } from '../utils/toast';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import api from '../api/api';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=640&q=80&auto=format';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    setEmail(cleanEmail);
    if (!cleanEmail) {
      showError('Please enter your email address.');
      return;
    }
    setLoading(true);
    
    try {
      await api.post('/auth/forgot-password', { email: cleanEmail });
      setSent(true);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      showError(e.response?.data?.message || 'Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#f8e7ed] p-6 font-sans dark:bg-zinc-900">

      <div className={`relative z-10 grid w-full max-w-[1000px] grid-cols-1 items-center gap-8 transition-all duration-700 ease-out lg:grid-cols-[1fr_400px] lg:gap-16 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>

        {/* LEFT */}
        <div className="hidden flex-col gap-7 lg:flex">
          <div className="relative overflow-hidden rounded-3xl border border-[#e6d8e1] shadow-sm dark:border-zinc-700">
            <img src={HERO_IMAGE} alt="Secure account recovery" className="h-64 w-full object-cover" />
            <div className="absolute inset-0 bg-[#18181b]/60 dark:bg-zinc-900/70" />
            <div className="absolute bottom-0 left-0 flex flex-col gap-2 p-6">
              <div className="flex w-fit items-center gap-2 rounded-full bg-[#18181b] px-3 py-1 text-xs font-semibold text-white">
                <Sparkles size={14} strokeWidth={2.5} className="text-[#ff1493]" />
                Account Recovery
              </div>
              <h2 className="text-2xl font-bold leading-tight text-white">We'll get you<br />back in.</h2>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-[#18181b] dark:text-zinc-100">Sparkle</h1>
            <p className="max-w-[420px] text-base leading-relaxed text-slate-600 dark:text-zinc-300">
              Lost your password? No worries. We'll send a secure one-time code to your email.
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex justify-center lg:justify-end">
          <div className="w-full max-w-[400px] rounded-3xl border border-[#e6d8e1] bg-[#fdf8fa] p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-800">

            {!sent ? (
              <>
                <div className="mb-6">
                  <h3 className="mb-1 text-2xl font-bold text-[#18181b] dark:text-zinc-100">Reset password</h3>
                  <p className="text-sm text-slate-600 dark:text-zinc-300">Enter the email linked to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="fp-email" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      <Mail size={14} strokeWidth={2.5} className="text-[#ff1493]" />
                      Email address
                    </label>
                    <input
                      id="fp-email"
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value);  }}
                      className="h-11 w-full rounded-xl border border-[#e6d8e1] bg-[#f6eef3] px-4 text-sm text-[#18181b] outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff1493] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-300"
                      placeholder="you@university.edu"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus
                    />
                  </div>

                  <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff1493] text-sm font-bold text-white transition-colors hover:bg-[#ff2d87] disabled:cursor-not-allowed disabled:opacity-60">
                    {loading ? <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><span>Send recovery code</span><ArrowRight size={18} strokeWidth={2.5} /></>}
                  </button>

                  <Link to="/login" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 transition-colors hover:text-[#18181b] dark:text-zinc-300 dark:hover:text-zinc-100">
                    <ArrowLeft size={15} strokeWidth={2.5} />
                    Back to login
                  </Link>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <Mail size={36} strokeWidth={1.5} className="text-[#ff1493]" />
                <h3 className="text-2xl font-bold text-[#18181b] dark:text-zinc-100">Check your inbox</h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                  If an account exists for this email, we've sent password reset instructions.
                </p>

                <Link
                  to={`/reset-password?email=${encodeURIComponent(email)}&mode=otp`}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#ff1493] text-sm font-bold text-white transition-colors hover:bg-[#ff2d87]"
                >
                  Enter code
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Link>

                <button onClick={() => setSent(false)} className="text-xs font-semibold text-slate-600 transition-colors hover:text-[#18181b] dark:text-zinc-300 dark:hover:text-zinc-100" type="button">
                  Try a different email
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}



