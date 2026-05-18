import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getOptimizedMediaUrl } from '../utils/imageUtils';
import { useNetworkStore } from '../store/networkStore';

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  containerClassName?: string;
  imageClassName?: string;
  width?: number; // Target width to optimize Cloudinary delivery
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  containerClassName = '',
  imageClassName = '',
  width,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const { saveDataMode, isOffline } = useNetworkStore();

  // If we are completely offline and haven't loaded anything, just show what we can
  // But wait, if we are offline, the browser's disk cache will serve the image if we requested it before.
  // The URLs MUST match exactly for cache hits.

  // 1. Tiny blurred thumbnail (Loads instantly)
  const thumbnailUrl = getOptimizedMediaUrl(src, 'thumbnail', width ? Math.floor(width / 4) : 100);

  // 2. High-res image (Depending on network, request low or auto quality)
  const hdQuality = saveDataMode ? 'low' : 'auto';
  const hdUrl = getOptimizedMediaUrl(src, hdQuality, width);

  // Reset state if src changes
  useEffect(() => {
    setIsLoaded(false);
    setError(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* 1. Thumbnail / Placeholder Layer */}
      <img
        src={thumbnailUrl}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover filter blur-lg scale-110 transition-opacity duration-500 ${
          isLoaded ? 'opacity-0' : 'opacity-100'
        } ${imageClassName}`}
        aria-hidden="true"
      />

      {/* 2. High-Res Layer */}
      {!error && (
        <img
          {...props}
          src={hdUrl}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${imageClassName}`}
          loading="lazy"
        />
      )}
    </div>
  );
};
