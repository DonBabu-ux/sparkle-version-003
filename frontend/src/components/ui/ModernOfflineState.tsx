import React from 'react';
import { motion } from 'framer-motion';
import { WifiOff, RotateCw, Home, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ModernOfflineStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  type?: 'offline' | 'empty' | 'error';
}

const ModernOfflineState: React.FC<ModernOfflineStateProps> = ({
  title,
  message,
  onRetry,
  type = 'offline'
}) => {
  const navigate = useNavigate();

  const getIcon = () => {
    switch (type) {
      case 'empty': return <Sparkles className="text-primary w-12 h-12" />;
      case 'error': return <RotateCw className="text-amber-500 w-12 h-12" />;
      default: return <WifiOff className="text-primary w-12 h-12" />;
    }
  };

  const defaultTitle = type === 'empty' ? "All caught up!" : (type === 'error' ? "Something's not right" : "Connection Lost");
  const defaultMessage = type === 'empty' 
    ? "You've seen all the latest moments. Check back soon for more sparkle!" 
    : "We're having trouble reaching the Sparkle feed. Check your connection or try again.";

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative mb-8"
      >
        {/* Animated Background Glow */}
        <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
        
        {/* Icon Container with Glassmorphism */}
        <div className="relative w-24 h-24 bg-white/40 backdrop-blur-xl border border-white/40 rounded-[32px] flex items-center justify-center shadow-2xl overflow-hidden group">
          <motion.div
            animate={{ 
              y: [0, -4, 0],
              rotate: type === 'offline' ? [0, -5, 5, 0] : 0 
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 3, 
              ease: "easeInOut" 
            }}
          >
            {getIcon()}
          </motion.div>
          
          {/* Subtle Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </div>
      </motion.div>

      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-black text-gray-900 mb-3 tracking-tight italic uppercase"
      >
        {title || defaultTitle}
      </motion.h2>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-gray-500 max-w-[280px] mb-10 leading-relaxed font-medium"
      >
        {message || defaultMessage}
      </motion.p>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col sm:flex-row gap-4 w-full max-w-xs"
      >
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex-1 px-8 py-4 bg-primary text-white font-black rounded-2xl italic uppercase tracking-widest shadow-lg shadow-primary/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <RotateCw size={18} />
            Try Again
          </button>
        )}
        
        <button
          onClick={() => navigate('/dashboard')}
          className="flex-1 px-8 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl uppercase tracking-widest hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Home size={18} />
          Go Home
        </button>
      </motion.div>

      {/* Decorative Elements */}
      <div className="fixed bottom-20 left-10 w-2 h-2 bg-primary/20 rounded-full blur-sm animate-bounce" style={{ animationDelay: '0.5s' }} />
      <div className="fixed top-40 right-10 w-3 h-3 bg-secondary/20 rounded-full blur-sm animate-bounce" style={{ animationDelay: '1.2s' }} />
    </div>
  );
};

export default ModernOfflineState;
