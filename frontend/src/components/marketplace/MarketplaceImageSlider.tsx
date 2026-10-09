import { useState, type TouchEvent, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';

interface MediaItem {
  media_url?: string;
  url?: string;
  media_type?: string;
}

interface MarketplaceImageSliderProps {
  media?: (MediaItem | string)[];
  imageUrls?: string[];
  fallbackUrl?: string;
  alt?: string;
  aspectRatio?: string;
  className?: string;
  onClick?: () => void;
  showBadge?: boolean;
}

export default function MarketplaceImageSlider({
  media,
  imageUrls,
  fallbackUrl,
  alt = 'Marketplace item',
  aspectRatio = 'aspect-[4/5]',
  className,
  onClick,
  showBadge = true,
}: MarketplaceImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Extract clean image URLs
  const urls: string[] = [];

  if (imageUrls && imageUrls.length > 0) {
    urls.push(...imageUrls.filter(Boolean));
  } else if (media && media.length > 0) {
    media.forEach((item) => {
      if (typeof item === 'string' && item) {
        urls.push(item);
      } else if (item && typeof item === 'object') {
        const url = item.media_url || item.url;
        if (url) urls.push(url);
      }
    });
  }

  if (urls.length === 0 && fallbackUrl) {
    urls.push(fallbackUrl);
  }

  const finalUrls = urls.length > 0 ? urls : ['/uploads/defaults/no-image.png'];
  const hasMultiple = finalUrls.length > 1;

  const handleNext = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev + 1) % finalUrls.length);
  };

  const handlePrev = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex((prev) => (prev - 1 + finalUrls.length) % finalUrls.length);
  };

  const handleDotClick = (e: MouseEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    setCurrentIndex(index);
  };

  const handleTouchStart = (e: TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swiped left -> Next
        setCurrentIndex((prev) => (prev + 1) % finalUrls.length);
      } else {
        // Swiped right -> Prev
        setCurrentIndex((prev) => (prev - 1 + finalUrls.length) % finalUrls.length);
      }
    }
    setTouchStartX(null);
  };

  return (
    <div
      onClick={onClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={clsx(
        'relative bg-marketplace-bg overflow-hidden group select-none',
        aspectRatio,
        className
      )}
    >
      <img
        src={finalUrls[currentIndex]}
        alt={alt}
        className="w-full h-full object-cover transition-opacity duration-300"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/uploads/defaults/no-image.png';
        }}
      />

      {/* Slide Badge (Top-Right) */}
      {hasMultiple && showBadge && (
        <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold tracking-wider flex items-center gap-1">
          <ImageIcon size={10} />
          <span>
            {currentIndex + 1}/{finalUrls.length}
          </span>
        </div>
      )}

      {/* Navigation Arrows (Visible on hover on desktop, always visible on mobile if multiple) */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous Image"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-all opacity-80 group-hover:opacity-100 active:scale-90"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next Image"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-all opacity-80 group-hover:opacity-100 active:scale-90"
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>

          {/* Dots Indicator (Bottom Center) */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-black/30 backdrop-blur-xs">
            {finalUrls.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => handleDotClick(e, idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={clsx(
                  'rounded-full transition-all duration-300',
                  idx === currentIndex
                    ? 'w-3 h-1.5 bg-white'
                    : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
