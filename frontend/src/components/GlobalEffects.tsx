import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function GlobalEffects() {
  const location = useLocation();

  useEffect(() => {
    // 1. Broken Media Fallback
    const handleError = (e: ErrorEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = "true";
        
        if (img.src.includes('avatar')) {
          img.src = '/uploads/avatars/default.png';
        } else {
          img.src = '/uploads/defaults/no-image.png';
        }
      } else if (target.tagName === 'VIDEO') {
        const video = target as HTMLVideoElement;
        if (video.dataset.fallbackApplied) return;
        video.dataset.fallbackApplied = "true";
        
        // Hide broken video and show a styled placeholder div (via parent logic if possible)
        video.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'video-error-placeholder';
        placeholder.innerHTML = 'Media Unavailable';
        video.parentElement?.appendChild(placeholder);
      }
    };

    window.addEventListener('error', handleError, true);
    return () => window.removeEventListener('error', handleError, true);
  }, []);

  useEffect(() => {
    // 2. Seen Posts Tracker Observer
    if (location.pathname !== '/dashboard') return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const postId = (entry.target as HTMLElement).dataset.postId;
          if (postId) {
            const seen = JSON.parse(localStorage.getItem('seenPostIds') || '[]');
            if (!seen.includes(postId)) {
              seen.push(postId);
              if (seen.length > 50) seen.shift();
              localStorage.setItem('seenPostIds', JSON.stringify(seen));
            }
          }
        }
      });
    }, { threshold: 0.5 });

    // Attach to all post cards
    const attachObserver = () => {
      document.querySelectorAll('.post-card').forEach(post => observer.observe(post));
    };

    // Initial attach
    attachObserver();

    // Re-attach since dashboard might fetch more
    const interval = setInterval(attachObserver, 3000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [location.pathname]);

  return null; // Side effect only component
}
