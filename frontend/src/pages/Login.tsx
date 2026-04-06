import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { authApi } from '../api/api';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await authApi.login(credentials);
      if (response.data.status === 'success') {
        const userData = response.data.user;
        setUser(userData);
        // Token is handled by httpOnly cookie automatically
        navigate('/dashboard');
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a] relative overflow-hidden">
      {/* Decorative ambient blurred blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-pink-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-[420px] bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-[1.25rem] flex items-center justify-center mb-6 shadow-xl shadow-pink-500/20 overflow-hidden border border-white/10 group-hover:scale-105 transition-transform">
            <img src="/logo.png" alt="Sparkle Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Welcome Back</h1>
          <p className="text-white/50 text-sm">Log in to your account.</p>
        </div>
        
        {error && (
          <div className="w-full p-3.5 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium text-center flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="w-full space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2 ml-1">Username or Email</label>
            <input 
              name="username"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3.5 text-sm focus:border-primary focus:bg-white/10 focus:ring-4 focus:ring-primary/20 transition-all outline-none" 
              type="text" 
              placeholder="e.g. nwaithira74@gmail.com" 
              value={credentials.username}
              onChange={handleChange}
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2 ml-1">Password</label>
            <input 
              name="password"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-3.5 text-sm focus:border-primary focus:bg-white/10 focus:ring-4 focus:ring-primary/20 transition-all outline-none" 
              type="password" 
              placeholder="••••••••" 
              value={credentials.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/20 group-hover:border-primary/50 transition-colors">
                <input type="checkbox" className="peer w-full h-full opacity-0 cursor-pointer absolute" />
                <svg className="w-3.5 h-3.5 text-primary opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-medium text-white/60 group-hover:text-white transition-colors">Remember me</span>
            </label>
            
            <a href="#" className="text-sm font-semibold text-primary hover:text-pink-400 transition-colors">Forgot password?</a>
          </div>
          
          <button 
            type="submit"
            className="w-full relative overflow-hidden group py-3.5 rounded-xl bg-gradient-to-r from-primary to-pink-500 text-white font-bold shadow-lg shadow-primary/25 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 mt-2" 
            disabled={loading}
          >
            <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[0%] transition-transform duration-300"></div>
            <span className="relative z-10 block w-full">{loading ? 'Authenticating...' : 'Log In'}</span>
          </button>
        </form>
        
        <div className="my-6 flex items-center justify-center gap-4">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
          <span className="text-xs font-semibold tracking-wider text-white/40 uppercase">OR</span>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
        </div>

        <button 
          type="button"
          onClick={() => alert('Google auth integration pending')}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 active:scale-[0.98] transition-all"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Log in with Google
        </button>
        
        <p className="mt-8 text-center text-sm text-white/50">
          Don't have an account? 
          <span className="text-primary hover:text-pink-400 font-semibold ml-1.5 cursor-pointer transition-colors" onClick={() => navigate('/signup')}>
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}

