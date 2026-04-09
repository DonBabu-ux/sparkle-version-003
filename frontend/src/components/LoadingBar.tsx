import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function LoadingBar() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start loading on route change
    setLoading(true);
    setProgress(20);

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
            clearInterval(timer);
            return 90;
        }
        return prev + 10;
      });
    }, 100);

    const complete = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 200);
    }, 400);

    return () => {
      clearInterval(timer);
      clearTimeout(complete);
    };
  }, [location.pathname]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 w-full z-[99999] pointer-events-none">
      <div 
        className="h-1 bg-gradient-to-r from-[#FF3D6D] to-[#FF8E53] shadow-[0_0_10px_rgba(255,61,109,0.5)] transition-all duration-300 ease-out" 
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
