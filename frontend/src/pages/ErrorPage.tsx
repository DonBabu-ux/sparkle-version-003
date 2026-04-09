import { Link } from 'react-router-dom';
import { Sparkles, Bug, Home } from 'lucide-react';

interface ErrorPageProps {
  error?: string;
}

export default function ErrorPage({ error }: ErrorPageProps) {
  return (
    <>
      <div className="mesh-bg fixed top-0 left-0 w-full h-full -z-10" />
      <div className="error-container h-screen flex items-center justify-center p-5">
        <div className="error-card bg-white/70 backdrop-blur-xl border border-white/20 rounded-[32px] p-10 md:p-[60px_40px] max-w-[500px] w-full text-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] animate-[cardFloat_1s_ease-out]">
          <div className="error-icon text-[80px] mb-[30px] inline-block animate-[pulse_2s_infinite]">
            <Sparkles size={80} className="text-[#FF3D6D] drop-shadow-lg" />
          </div>
          <h1 className="font-['Outfit'] text-[32px] font-bold mb-[15px] text-[#2D3436] leading-tight">
            Oops! Something Sparkled... Differently.
          </h1>
          <p className="text-[#636E72] text-[18px] leading-[1.6] mb-[35px]">
            Our magical servers encountered a little hiccup. Don't worry, even the brightest stars flicker sometimes.
          </p>

          {error && (
            <div className="error-details bg-black/5 p-[15px] rounded-xl font-mono text-[14px] mb-[30px] break-all text-[#d63031] flex flex-col items-start gap-2 text-left">
              <div className="flex items-center gap-2 font-bold uppercase"><Bug size={14} /> Error Payload</div>
              <span className="opacity-80">{error}</span>
            </div>
          )}

          <Link to="/dashboard" className="btn-premium inline-flex items-center justify-center gap-2.5 p-[16px_32px] bg-gradient-to-br from-[#FF3D6D] to-[#FF8E53] color-white text-white rounded-2xl font-semibold text-[16px] shadow-[0_10px_20px_rgba(255,61,109,0.2)] transition-all hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_15px_30px_rgba(255,61,109,0.3)] active:translate-y-0">
            <Home size={18} /> Back to Dashboard
          </Link>
        </div>
      </div>

      <style>{`
        .mesh-bg {
          background:
            radial-gradient(circle at 20% 20%, rgba(255, 61, 109, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(255, 142, 83, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 50% 50%, rgba(108, 92, 231, 0.1) 0%, transparent 50%);
          filter: blur(80px);
        }

        @keyframes cardFloat {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
