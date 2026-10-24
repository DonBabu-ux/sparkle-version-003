import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import defaultAvatar from '../assets/no-profile.png';
import { getMediaUrl } from '../utils/imageUtils';

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
        
        // Avatars (incl. dead-Cloudinary profile photos) get the professional default
        if (img.src.includes('avatar') || img.src.includes('res.cloudinary.com')) {
          img.src = defaultAvatar;
        } else {
          img.src = getMediaUrl('/uploads/defaults/no-image.png') || defaultAvatar;
        }
      } else if (target.tagName === 'VIDEO') {
        const video = target as HTMLVideoElement;
        if (video.dataset.fallbackApplied) return;
        video.dataset.fallbackApplied = "true";
        
        video.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'video-error-placeholder';
        placeholder.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg><span>Media Unavailable</span>';
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
