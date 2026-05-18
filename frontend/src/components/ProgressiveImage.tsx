import React, { useState, useEffect, useRef } from 'react';
import { getOptimizedMediaUrl } from '../utils/imageUtils';
import { useNetworkStore } from '../store/networkStore';

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  containerClassName?: string;
  imageClassName?: string;
  width?: number; // Target width to optimize CDN delivery
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  containerClassName = '',
  imageClassName = '',
  width,
  style,
  ...props
}) => {
  const { saveDataMode, quality } = useNetworkStore();
  
  // Decide target quality for the initial load
  const isWeakConnection = saveDataMode || quality === 'weak' || quality === 'unstable';
  const initialQuality = isWeakConnection ? 'low' : 'medium';
  
  const initialUrl = getOptimizedMediaUrl(src, initialQuality, width);
  
  const [currentSrc, setCurrentSrc] = useState(initialUrl);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHdLoaded, setIsHdLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Keep track of preloading image to prevent memory leaks if component unmounts
  const preloadRef = useRef<HTMLImageElement | null>(null);

  // Reset state if original src changes
  useEffect(() => {
    const freshInitialQuality = saveDataMode || quality === 'weak' || quality === 'unstable' ? 'low' : 'medium';
    const freshInitialUrl = getOptimizedMediaUrl(src, freshInitialQuality, width);
    
    setCurrentSrc(freshInitialUrl);
    setIsLoaded(false);
    setIsHdLoaded(false);
    setError(false);
    
    if (preloadRef.current) {
      preloadRef.current.onload = null;
      preloadRef.current = null;
    }
  }, [src, saveDataMode, quality, width]);

  // Clean up preloader on unmount
  useEffect(() => {
    return () => {
      if (preloadRef.current) {
        preloadRef.current.onload = null;
      }
    };
  }, []);

  const handleImageLoad = () => {
    setIsLoaded(true);
    
    // Only upgrade to HD silently if:
    // 1. Connection is strong (not in weak/unstable/save-data mode)
    // 2. We haven't already loaded the HD version
    if (!isWeakConnection && !isHdLoaded) {
      const hdUrl = getOptimizedMediaUrl(src, 'hd', width);
      
      const img = new Image();
      img.src = hdUrl;
      preloadRef.current = img;
      
      img.onload = () => {
        // Silently swap to HD source once cached!
        setCurrentSrc(hdUrl);
        setIsHdLoaded(true);
      };
    }
  };

  const handleRetry = () => {
    setError(false);
    setRetryCount(prev => prev + 1);
    setIsLoaded(false);
    setIsHdLoaded(false);
    
    const freshInitialQuality = saveDataMode || quality === 'weak' || quality === 'unstable' ? 'low' : 'medium';
    setCurrentSrc(getOptimizedMediaUrl(src, freshInitialQuality, width));
  };

  return (
    <div 
      className={`relative overflow-hidden bg-black/[0.03] dark:bg-white/[0.03] transition-colors duration-300 ${containerClassName}`}
      style={{ 
        width: '100%', 
        ...style 
      }}
    >
      {/* 1. Subtle, clean Shimmer/Skeleton loader before image loads (No heavy blur, ultra-premium vibe) */}
      {!isLoaded && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="w-full h-full bg-gradient-to-r from-transparent via-black/[0.04] to-transparent dark:via-white/[0.04] animate-shimmer" 
               style={{
                 backgroundSize: '200% 100%',
                 animation: 'shimmer 1.4s infinite linear'
               }}
          />
        </div>
      )}

      {/* 2. Optimized Image (Loads compressed medium first, then silent HD swap on success) */}
      {!error && (
        <img
          {...props}
          src={`${currentSrc}${retryCount > 0 ? `?retry=${retryCount}` : ''}`}
          alt={alt}
          onLoad={handleImageLoad}
          onError={() => setError(true)}
          className={`w-full h-auto block transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${imageClassName}`}
          style={{ 
            maxHeight: 'inherit',
            ...props.style
          }}
          loading="lazy"
        />
      )}

      {/* 3. Error Fallback State */}
      {error && (
        <div className="w-full min-h-[220px] flex flex-col items-center justify-center p-6 bg-black/5 dark:bg-white/5 text-center gap-3">
          <span className="text-[11px] font-black text-black/30 dark:text-white/30 uppercase tracking-widest">Failed to load media</span>
          <button 
            type="button" 
            onClick={handleRetry}
            className="px-4 py-1.5 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md"
          >
            Retry
          </button>
        </div>
      )}

      {/* Local Shimmer Keyframes */}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        .animate-shimmer {
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.08) 20%,
            rgba(255, 255, 255, 0.15) 60%,
            rgba(255, 255, 255, 0) 100%
          );
        }
        .dark .animate-shimmer {
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.02) 20%,
            rgba(255, 255, 255, 0.05) 60%,
            rgba(255, 255, 255, 0) 100%
          );
        }
      `}</style>
    </div>
  );
};

export default ProgressiveImage;
