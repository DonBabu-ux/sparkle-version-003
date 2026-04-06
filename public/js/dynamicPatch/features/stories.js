// stories.js
import { getCurrentUser } from '../core/utils.js';

let viewedStories = JSON.parse(localStorage.getItem('viewedStories') || '{}');
let storyTimer = null;

export function initStories() {
    // Initial load
    if (window.loadAfterglowStories) window.loadAfterglowStories();

    // Set timer for cleanup - remove expired stories from local UI if any
    window.afterglowTimerInterval = setInterval(() => {
        const container = document.getElementById('afterglowStories');
        if (!container) return;
        const items = container.querySelectorAll('.story-view-card');
        items.forEach(item => {
            let seconds = parseInt(item.dataset.secondsLeft);
            if (!isNaN(seconds) && seconds > 0) {
                seconds -= 60;
                item.dataset.secondsLeft = seconds;
                const timeEl = item.querySelector('.story-time');
                if (timeEl) {
                    const h = Math.floor(seconds / 3600);
                    const m = Math.floor((seconds % 3600) / 60);
                    if (h > 0) timeEl.textContent = `${h}h ${m}m`;
                    else timeEl.textContent = `${m}m`;
                }
            } else {
                // If we're on the dashboard, we usually want to refresh from API rather than just removing
                // item.remove();
            }
        });
    }, 60000);
}

export async function loadAfterglowStories(options = {}) {
    const container = document.getElementById('afterglowStories');
    if (!container) return;

    try {
        let groups = await window.DashboardAPI.loadStories();

        // Group client-side if the API returns a flat list
        if (groups && groups.length && !groups[0].stories) {
            const map = {};
            groups.forEach(s => {
                const uid = s.user_id;
                if (!map[uid]) {
                    map[uid] = { ...s, stories: [] };
                }
                map[uid].stories.push(s);
            });
            groups = Object.values(map);
        }

        const fragment = document.createDocumentFragment();

        // 1. Add Create Story card (Sync with Premium dashboard.ejs)
        const currentUserData = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
        const createCard = document.createElement('div');
        createCard.className = 'story-card story-add';
        createCard.onclick = () => typeof window.openAfterglowModal === 'function' ? window.openAfterglowModal() : uploadAfterglowMedia();
        createCard.innerHTML = `
            <div class="story-add-bg">
                <img src="${currentUserData.avatar_url || currentUserData.avatar || '/uploads/avatars/default.png'}" class="story-media" style="filter: blur(5px) brightness(0.7);" onerror="this.src='/uploads/avatars/default.png'">
            </div>
            <div class="plus-circle"><i class="fas fa-plus"></i></div>
            <div class="story-add-text">Afterglow</div>
        `;
        fragment.appendChild(createCard);

        // 2. Add Story Groups
        if (groups && groups.length > 0) {
            groups.forEach((group) => {
                const storyEl = document.createElement('div');
                storyEl.className = 'fb-story-card';
                storyEl.dataset.userId = group.user_id;

                // Use the first story's data for the thumbnail
                const firstStory = group.stories[0];
                storyEl.dataset.secondsLeft = firstStory?.secondsLeft || 0;

                storyEl.innerHTML = `
                    <img src="${firstStory?.media_url || group.avatar_url || '/uploads/avatars/default.png'}" 
                         class="fb-story-media" style="background:#eee;" onerror="this.onerror=null; this.src='/uploads/avatars/default.png';">
                    <div class="fb-story-overlay"></div>
                    ${group.stories.length > 1 ? `<div class="story-multi-badge-fb">${group.stories.length}</div>` : ''}
                    <img src="${group.avatar_url || '/uploads/avatars/default.png'}" class="fb-story-avatar" style="background:#eee;" onerror="this.onerror=null; this.src='/uploads/avatars/default.png'">
                    <div class="fb-story-name">${group.username || 'Sparkler'}</div>
                `;

                storyEl.onclick = () => {
                    window.activeStoryGroup = group;
                    window.activeStories = group.stories;
                    window.currentStoryIndex = 0;
                    showAfterglowViewer(group.stories[0]);
                };
                fragment.appendChild(storyEl);
            });
        }

        container.innerHTML = '';
        container.appendChild(fragment);

    } catch (error) {
        console.error('Failed to load stories:', error);
    }
}

export function showAfterglowViewer(story) {
    const stories = window.activeStories || [story];
    let currentIndex = window.currentStoryIndex || 0;
    const currentUserData = window.currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');

    let currentProgress = 0;
    let isPaused = false;
    let progressRaf = null;
    let storyStartTime = null;
    const STORY_DURATION = 5000; // 5 seconds for images

    const modal = document.createElement('div');
    modal.className = 'afterglow-viewer-modal';
    modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(0,0,0,0.95); 
        z-index: 100000; display: flex; align-items: center; 
        justify-content: center; backdrop-filter: blur(10px);
    `;

    function renderStory(index) {
        if (progressRaf) cancelAnimationFrame(progressRaf);
        isPaused = false;
        currentProgress = 0;

        const currentUser = getCurrentUser();
        const cur = stories[index];
        if (!cur) {
            modal.remove();
            return;
        }

        currentIndex = index;
        window.currentStoryIndex = index;

        const storyId = cur.story_id || cur.id;
        viewedStories[storyId] = true;
        localStorage.setItem('viewedStories', JSON.stringify(viewedStories));

        const isVideo = cur.media_url?.match(/\.(mp4|webm|mov)$/i) || cur.media_type === 'video';

        const isOwner = cur.user_id === currentUser.user_id || cur.user_id === currentUser.userId;

        modal.innerHTML = `
            <div id="storyViewerContent" style="width: 100%; max-width: 450px; height: 100%; max-height: 850px; position: relative; background: #000; border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.5); user-select: none;">
                <!-- Progress Bars -->
                <div style="position: absolute; top: 12px; left: 12px; right: 12px; display: flex; gap: 4px; z-index: 20;">
                    ${stories.map((_, i) => `
                        <div style="flex: 1; height: 2px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden;">
                            <div id="progress-${i}" style="width: ${i < index ? '100' : '0'}%; height: 100%; background: #fff;"></div>
                        </div>
                    `).join('')}
                </div>

                <!-- Header -->
                <div style="position: absolute; top: 25px; left: 15px; right: 15px; display: flex; align-items: center; gap: 12px; z-index: 20;">
                    <img src="${cur.avatar || cur.avatar_url || '/uploads/avatars/default.png'}" style="width: 38px; height: 38px; border-radius: 50%; border: 2px solid white; object-fit: cover;">
                    <div style="flex: 1;">
                        <div style="color: white; font-weight: 700; font-size: 14px; text-shadow: 0 1px 4px rgba(0,0,0,0.5);">${cur.username || 'Sparkler'}</div>
                        <div style="color: rgba(255,255,255,0.7); font-size: 11px;">${cur.timestamp || 'Recently'}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        ${isOwner ? `
                            <button class="delete-story-btn" style="background: rgba(255,59,109,0.2); border: none; color: #ff3b6d; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;"><i class="fas fa-trash-alt"></i></button>
                        ` : ''}
                        <button class="close-viewer-btn" style="background: rgba(255,255,255,0.1); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;"><i class="fas fa-times"></i></button>
                    </div>
                </div>

                <!-- Navigation Areas -->
                <div id="prevStory" style="position: absolute; left: 0; top: 0; bottom: 0; width: 30%; z-index: 15; cursor: pointer;"></div>
                <div id="nextStory" style="position: absolute; right: 0; top: 0; bottom: 0; width: 70%; z-index: 15; cursor: pointer;"></div>
                
                <!-- Media -->
                <div id="storyMediaContainer" style="flex: 1; display: flex; align-items: center; justify-content: center; background: #000; position: relative;">
                    ${isVideo ? `
                        <video id="storyVideo" src="${cur.media_url}" style="width: 100%; max-height: 100%;" autoplay playsinline></video>
                    ` : `
                        <img id="storyImage" src="${cur.media_url}" style="width: 100%; max-height: 100%; object-fit: contain;">
                    `}
                    <div id="mediaLoading" style="position: absolute; display: none;"><i class="fas fa-circle-notch fa-spin" style="color: white; font-size: 30px;"></i></div>
                </div>

                <!-- Footer / Reply -->
                <div style="padding: 20px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); position: relative; z-index: 20;">
                    ${cur.caption ? `<div style="color: white; font-size: 14px; margin-bottom: 15px; text-align: center;">${cur.caption}</div>` : ''}
                        <div style="flex: 1; position: relative; display: flex; align-items: center; gap: 8px;">
                            <input type="text" id="storyReplyInput" placeholder="Reply to ${cur.username}..." style="flex: 1; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); border-radius: 25px; padding: 12px 20px; color: white; outline: none; font-size: 14px; backdrop-filter: blur(5px);">
                            <button id="storySendReplyBtn" style="background: var(--primary-gradient); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s;">
                                <i class="fas fa-paper-plane" style="font-size: 16px;"></i>
                            </button>
                        </div>
                        <button id="storyLikeBtn" style="background: rgba(255,255,255,0.1); border: none; color: ${cur.isLiked ? '#ff3b6d' : 'white'}; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                            <i class="${cur.isLiked ? 'fas' : 'far'} fa-heart" style="font-size: 18px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const video = modal.querySelector('#storyVideo');
        const progressBar = modal.querySelector(`#progress-${index}`);
        const viewerContent = modal.querySelector('#storyViewerContent');

        // Progress Animation Logic
        function animateProgress() {
            if (isPaused) {
                progressRaf = requestAnimationFrame(animateProgress);
                return;
            }

            if (isVideo) {
                if (video && video.duration) {
                    currentProgress = (video.currentTime / video.duration) * 100;
                    if (video.ended) {
                        nextStory();
                        return;
                    }
                }
            } else {
                currentProgress += (100 / (STORY_DURATION / 16.67)); // ~60fps
                if (currentProgress >= 100) {
                    nextStory();
                    return;
                }
            }

            if (progressBar) progressBar.style.width = `${currentProgress}%`;
            progressRaf = requestAnimationFrame(animateProgress);
        }

        function cleanup() {
            if (progressRaf) cancelAnimationFrame(progressRaf);
            if (video) {
                video.pause();
                video.src = "";
                video.load();
                video.remove();
            }
            modal.remove();
        }

        function nextStory() {
            if (index < stories.length - 1) renderStory(index + 1);
            else cleanup();
        }

        function prevStory() {
            if (index > 0) renderStory(index - 1);
            else cleanup();
        }

        // Action Handlers
        const closeBtn = modal.querySelector('.close-viewer-btn');
        closeBtn.onclick = cleanup;

        const deleteBtn = modal.querySelector('.delete-story-btn');
        if (deleteBtn) {
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!confirm('Are you sure you want to delete this story?')) return;

                isPaused = true;
                if (video) video.pause();

                try {
                    await window.DashboardAPI.deleteStory(storyId);
                    if (window.showNotification) window.showNotification('Story deleted', 'success');

                    // Remove from activeStories or just close and refresh
                    modal.remove();
                    if (progressRaf) cancelAnimationFrame(progressRaf);
                    loadAfterglowStories();
                } catch (err) {
                    console.error('Failed to delete story:', err);
                    isPaused = false;
                    if (video && video.readyState >= 2) video.play();
                }
            };
        }

        const prevArea = modal.querySelector('#prevStory');
        const nextArea = modal.querySelector('#nextStory');

        // Hold to Pause Logic
        const startPause = (e) => {
            // Don't pause if clicking buttons or input
            if (e.target.closest('button') || e.target.closest('input')) return;
            isPaused = true;
            if (video) video.pause();
        };

        const endPause = () => {
            isPaused = false;
            if (video && video.readyState >= 2) video.play();
        };

        viewerContent.addEventListener('mousedown', startPause);
        viewerContent.addEventListener('touchstart', startPause);
        window.addEventListener('mouseup', endPause);
        window.addEventListener('touchend', endPause);

        prevArea.onclick = (e) => {
            e.stopPropagation();
            prevStory();
        };

        nextArea.onclick = (e) => {
            e.stopPropagation();
            nextStory();
        };

        const likeBtn = modal.querySelector('#storyLikeBtn');
        likeBtn.onclick = async () => {
            try {
                const result = await window.DashboardAPI.likeStory(storyId);
                const isLiked = result.liked || result.action === 'liked';
                likeBtn.style.color = isLiked ? '#ff3b6d' : 'white';
                likeBtn.querySelector('i').className = isLiked ? 'fas fa-heart' : 'far fa-heart';
                if (window.showNotification) window.showNotification(isLiked ? 'Loved it! 💖' : 'Removed like', 'success');
            } catch (err) {
                console.error('Failed to like:', err);
            }
        };

        const sendReplyBtn = modal.querySelector('#storySendReplyBtn');
        const replyInput = modal.querySelector('#storyReplyInput');

        async function handleReply() {
            const content = replyInput.value.trim();
            if (!content) return;
            try {
                await window.DashboardAPI.sendMessage({
                    recipient_id: cur.user_id,
                    content: `Replying to your glow: "${content}"`,
                    type: 'story_reply',
                    story_id: storyId
                });
                replyInput.value = '';
                if (window.showNotification) window.showNotification('Reply sent! 💬', 'success');
                if (progressRaf) cancelAnimationFrame(progressRaf);
                modal.remove();
            } catch (err) {
                console.error('Failed to reply:', err);
            }
        }

        replyInput.onfocus = () => { isPaused = true; if (video) video.pause(); };
        replyInput.onblur = () => { isPaused = false; if (video && video.readyState >= 2) video.play(); };
        replyInput.onkeypress = (e) => { if (e.key === 'Enter') handleReply(); };
        sendReplyBtn.onclick = () => handleReply();

        if (isVideo) {
            video.oncanplay = () => progressRaf = requestAnimationFrame(animateProgress);
        } else {
            progressRaf = requestAnimationFrame(animateProgress);
        }
    }

    renderStory(currentIndex);
    document.body.appendChild(modal);
}

export async function openStoryViewer(userId) {
    try {
        if (window.showNotification) window.showNotification('Opening story...', 'info', 1000);
        const groups = await window.DashboardAPI.loadStories();
        const group = groups.find(g => g.user_id === userId || g.userId === userId);
        if (group && group.stories && group.stories.length > 0) {
            window.activeStoryGroup = group;
            window.activeStories = group.stories;
            window.currentStoryIndex = 0;
            showAfterglowViewer(group.stories[0]);
        } else {
            if (window.showNotification) window.showNotification('No active stories found', 'warning');
        }
    } catch (err) {
        console.error('Failed to open story viewer:', err);
    }
}

export async function uploadAfterglowMedia() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Size check (max 20MB)
        if (file.size > 20 * 1024 * 1024) {
            if (window.showNotification) window.showNotification('File is too large (Max 20MB)', 'error');
            return;
        }

        if (window.showNotification) window.showNotification('Sharing your glow... ✨', 'spark', 5000);

        try {
            await window.DashboardAPI.createStory({ media: file, caption: '' });
            if (window.showNotification) window.showNotification('Glow shared successfully! 🔥', 'success');
            loadAfterglowStories();
        } catch (error) {
            if (window.showNotification) window.showNotification('Failed to share story. Try again.', 'error');
        }
    };
    input.click();
}
