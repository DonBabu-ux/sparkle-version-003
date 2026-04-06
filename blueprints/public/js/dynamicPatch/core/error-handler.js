// error-handler.js 
// Global listener for image load errors to handle 403 Forbidden or broken links

export function initErrorHandler() {
    window.addEventListener('error', (event) => {
        if (event.target.tagName === 'IMG' || event.target.tagName === 'VIDEO') {
            const el = event.target;
            const src = el.src || (el.querySelector('source') ? el.querySelector('source').src : '');

            // Handle specific CDN failures or 403/404 scenarios
            const isProblematic = src.includes('fbcdn.net') ||
                src.includes('fbsbx.com') ||
                src.includes('cloudinary.com') ||
                src.includes('avatar') ||
                el.classList.contains('avatar') ||
                el.classList.contains('user-avatar') ||
                el.classList.contains('story-media-bg');

            if (isProblematic) {
                if (el.dataset.fallbackApplied) return;
                el.dataset.fallbackApplied = 'true';

                console.warn('⚠️ Media failed to load, applying fallback:', src);

                if (el.tagName === 'IMG') {
                    el.src = '/uploads/avatars/default.png';
                    el.classList.add('fallback-media');
                } else if (el.tagName === 'VIDEO') {
                    // For videos in stories/feed, show an overlay if possible
                    const wrapper = el.closest('.video-wrapper') || el.closest('.story-media-container') || el.closest('.story-view-card');
                    if (wrapper) {
                        const overlay = document.createElement('div');
                        overlay.className = 'media-error-overlay';
                        overlay.style.cssText = `
                            position: absolute; inset: 0; background: rgba(0,0,0,0.8);
                            display: flex; flex-direction: column; align-items: center;
                            justify-content: center; color: white; z-index: 10; font-size: 12px;
                            padding: 10px; text-align: center;
                        `;
                        overlay.innerHTML = `<i class="fas fa-exclamation-triangle" style="color: #FF3D6D; margin-bottom: 5px;"></i> media error`;
                        wrapper.appendChild(overlay);
                    }
                    el.style.display = 'none';
                }
            }
        }
    }, true);
}
