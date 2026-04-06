// feed.js - Production Social Feed logic
import { timeAgo } from '../core/utils.js';

let lastSeenPostId = null;
let currentViewerPost = null;
let feedLoading = false;
let feedPage = 1;
let allPostsLoaded = false;
let currentCommentPostId = null;
let currentCommentsData = [];

const FEED_LIMIT = 12;

export function initFeed() {
    const container = document.getElementById('feed');
    // If SSR rendered posts, we don't immediately wipe and refresh (Fixes 3-Phase UI Bug)
    if (container && container.children.length > 0 && (container.querySelector('.post') || container.querySelector('.post-card'))) {
        feedPage = 2; // Next page logic
    } else {
        loadFeedPosts({ refresh: true });
    }
    setupScrollListener();
}

export async function loadFeedPosts(options = {}) {
    const isRefresh = options.refresh || false;
    const container = document.getElementById('feed');
    if (!container || feedLoading || (allPostsLoaded && !isRefresh)) return;

    if (isRefresh) {
        feedPage = 1;
        allPostsLoaded = false;
    }

    feedLoading = true;
    try {
        const response = await window.DashboardAPI.loadFeed({
            limit: FEED_LIMIT,
            page: feedPage,
            render: 'true'
        });

        if (!response) {
            feedLoading = false;
            return;
        }

        const posts = Array.isArray(response) ? response : (response.posts || []);
        const htmls = Array.isArray(response) ? [] : (response.htmls || []);

        if (posts.length < FEED_LIMIT) allPostsLoaded = true;
        if (isRefresh && posts.length > 0) lastSeenPostId = posts[0].post_id || posts[0].id;

        if (isRefresh) container.innerHTML = '';

        if (htmls.length > 0) {
            htmls.forEach(html => {
                const temp = document.createElement('div');
                temp.innerHTML = html.trim();
                const postEl = temp.firstElementChild;
                if (postEl) container.appendChild(postEl);
            });
        } else {
            const fragment = document.createDocumentFragment();
            posts.forEach(post => {
                if (typeof window.createPostElement === 'function') {
                    const el = window.createPostElement(post);
                    fragment.appendChild(el);
                }
            });
            container.appendChild(fragment);
        }

        feedPage++;
    } catch (error) {
        console.error('Failed to load feed:', error);
    } finally {
        feedLoading = false;
    }
}

function setupScrollListener() {
    window.addEventListener('scroll', () => {
        if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 500) {
            loadFeedPosts();
        }
    });
}

// --- TikTok-Style Post View System (PATCH v2) ---

export async function openPost(postId, targetCommentId = null) {
    currentCommentPostId = postId;
    const container = document.getElementById('postViewContainer');
    if (!container) return;

    container.classList.add('active');
    document.body.style.overflow = 'hidden';

    // 1. Fetch post data for the preview
    try {
        const post = await window.DashboardAPI.request(`/posts/${postId}`);
        renderPostPreview(post);
        loadCommentsList(postId, targetCommentId);
    } catch (err) {
        console.error('Failed to load post for view:', err);
    }
}

export function closePostView() {
    const container = document.getElementById('postViewContainer');
    if (!container) return;

    container.classList.remove('active');
    document.body.style.overflow = '';
    currentCommentPostId = null;
    currentCommentsData = [];
    
    // Stop any media
    const preview = document.getElementById('postPreview');
    if (preview) {
        const video = preview.querySelector('video');
        if (video) video.pause();
    }
}

function renderPostPreview(post) {
    const preview = document.getElementById('postPreview');
    if (!preview) return;

    const isVideo = (post.media_url || '').match(/\.(mp4|webm|ogg|mov)$/i);
    const mediaHtml = isVideo 
        ? `<video src="${post.media_url}" autoplay loop muted playsinline></video>`
        : `<img src="${post.media_url || '/uploads/posts/default.png'}" onerror="this.src='/uploads/posts/default.png'">`;

    preview.innerHTML = `
        ${mediaHtml}
        <div class="preview-overlay">
            <div class="preview-title">@${post.username || 'sparkler'}</div>
            <div style="color: rgba(255,255,255,0.8); font-size: 13px;">${post.content || ''}</div>
        </div>
    `;
}

export async function loadCommentsList(postId, targetCommentId = null) {
    const container = document.getElementById('commentList');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const comments = await window.DashboardAPI.loadComments(postId);
        currentCommentsData = comments || [];
        
        const countHeader = document.getElementById('commentSheetCount');
        if (countHeader) countHeader.textContent = `${currentCommentsData.length} comments`;

        if (currentCommentsData.length > 0) {
            renderComments(currentCommentsData);
            
            if (targetCommentId) {
                setTimeout(() => {
                    const targetEl = document.querySelector(`[data-comment-id="${targetCommentId}"]`);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetEl.style.background = 'rgba(255, 45, 85, 0.1)';
                        setTimeout(() => targetEl.style.background = '', 2000);
                    }
                }, 500);
            }
        } else {
            container.innerHTML = '<div style="text-align:center; color:#65676b; padding: 40px;">No comments yet.</div>';
        }
    } catch (error) {
        console.error('Failed to load comments:', error);
        container.innerHTML = '<div style="text-align:center; color:red; padding: 40px;">Failed to load comments</div>';
    }
}

function renderComments(comments) {
    const container = document.getElementById('commentList');
    if (!container) return;

    container.innerHTML = comments.map(c => renderCommentItem(c)).join('');
}

function getVerifiedBadge(userId) {
    const verifiedUsers = ["175a02d1-4707-44cd-a559-13a99cd5c8fe"];
    if (verifiedUsers.includes(userId)) {
        return `
            <span class="verified-badge" title="Verified Account">
                <i class="fas fa-check"></i>
            </span>
        `;
    }
    return '';
}

function renderCommentItem(c) {
    if (!c) return '';
    const isLiked = c.is_liked || false;
    const avatar = c.userId?.profilePic || c.profilePic || c.avatar || '/uploads/avatars/default.png';
    const repliesCount = c.replies ? c.replies.length : 0;
    const userId = c.user_id || (c.userId && (c.userId.id || c.userId));
    
    return `
        <div class="comment-item" data-comment-id="${c.id}">
            <img src="${avatar}" class="comment-avatar" onerror="this.src='/uploads/avatars/default.png'">
            <div class="comment-content">
                <div class="comment-user" style="display: flex; align-items: center; gap: 4px;">
                    @${c.username || (c.userId && c.userId.username) || 'sparkler'}
                    ${getVerifiedBadge(userId)}
                </div>
                <div class="comment-text">${c.content || c.text}</div>
                <div class="comment-meta">
                    <span>${timeAgo(c.created_at)}</span>
                    <span style="cursor:pointer; color:var(--accent-pink); font-weight:600;" 
                          onclick="window.replyToComment('${c.id}', '@${c.username || (c.userId && c.userId.username) || 'sparkler'} ')">Reply</span>
                </div>
                
                <!-- SPEC v5: BRANCHING TREE UI -->
                ${repliesCount > 0 ? `
                    <div class="replies-wrapper">
                        <div class="view-replies-btn" onclick="this.nextElementSibling.classList.toggle('hidden');">
                            ── View ${repliesCount} replies
                        </div>
                        <div class="replies-container hidden" style="margin-left: 10px; border-left: 2px solid #f0f2f5; padding-left: 10px;">
                            ${c.replies.map(r => renderReplyItem(r)).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            <button class="comment-like-btn ${isLiked ? 'liked' : ''}" onclick="window.handleCommentLike(this, '${c.id}')">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                <span class="count">${c.like_count || c.likes || 0}</span>
            </button>
        </div>
    `;
}

function renderReplyItem(r) {
    if (!r) return '';
    const avatar = r.userId?.profilePic || r.profilePic || r.avatar || '/uploads/avatars/default.png';
    const isLiked = r.is_liked || false;
    const userId = r.user_id || (r.userId && (r.userId.id || r.userId));

    return `
        <div class="comment-item reply-item" data-comment-id="${r.id}" style="padding: 5px 0 5px 10px;">
            <img src="${avatar}" class="comment-avatar" style="width: 24px; height: 24px;" onerror="this.src='/uploads/avatars/default.png'">
            <div class="comment-content">
                <div class="comment-user" style="font-size: 12px; display: flex; align-items: center; gap: 4px;">
                    @${r.username || (r.userId && r.userId.username) || 'user'}
                    ${getVerifiedBadge(userId)}
                </div>
                <div class="comment-text" style="font-size: 12px;">${r.content || r.text}</div>
                <div class="comment-meta" style="font-size: 11px;">
                    <span>${timeAgo(r.created_at)}</span>
                    <span style="cursor:pointer; color:var(--accent-pink);" 
                          onclick="window.replyToComment('${r.parentCommentId || ''}', '@${r.username} ')">Reply</span>
                </div>
            </div>
            <button class="comment-like-btn ${isLiked ? 'liked' : ''}" style="width: 20px; height: 20px; font-size: 10px;" onclick="window.handleCommentLike(this, '${r.id}')">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                <span class="count">${r.like_count || r.likes || 0}</span>
            </button>
        </div>
    `;
}

export async function submitComment() {
    if (!currentCommentPostId) return;
    const input = document.getElementById('commentInputField');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const btn = document.querySelector('.send-comment-btn');
    if (btn) btn.disabled = true;

    try {
        await window.DashboardAPI.postComment(currentCommentPostId, text);
        input.value = '';
        loadCommentsList(currentCommentPostId);
    } catch (error) {
        console.warn('Comment post error:', error);
    } finally {
        if (btn) btn.disabled = false;
    }
}

export async function handleCommentLike(btn, commentId) {
    try {
        if (!window.DashboardAPI?.likeComment) {
            console.error('likeComment API not available');
            return;
        }

        const result = await window.DashboardAPI.likeComment(commentId);
        const icon = btn.querySelector('i');
        const count = btn.querySelector('.count');

        if (result.action === 'liked') {
            btn.classList.add('liked');
            if (icon) icon.className = 'fas fa-heart';
        } else {
            btn.classList.remove('liked');
            if (icon) icon.className = 'far fa-heart';
        }

        if (count && typeof result.newCount !== 'undefined') {
            count.textContent = result.newCount;
        }
    } catch (err) {
        console.error('Comment like error:', err);
    }
}

export function replyToComment(commentId, mention) {
    const input = document.getElementById('commentInputField');
    if (!input) return;
    input.value = mention;
    input.focus();
}

// Support legacy calls
export function openComments(postId, targetId) { openPost(postId, targetId); }
export function closeComments() { closePostView(); }

// Actions
export async function toggleSpark(postId, button) {
    try {
        const result = await window.DashboardAPI.sparkPost(postId);
        const icon = button.querySelector('i');
        if (result.action === 'sparked') {
            button.classList.add('active');
            if (icon) icon.className = 'fas fa-heart';
        } else {
            button.classList.remove('active');
            if (icon) icon.className = 'far fa-heart';
        }
    } catch (err) { console.error('Spark error:', err); }
}

export async function savePost(postId, button) {
    try {
        const result = await window.DashboardAPI.savePost(postId);
        if (result.action === 'saved') button.classList.add('active');
        else button.classList.remove('active');
    } catch (err) { console.error('Save error:', err); }
}

export async function sharePost(postId) {
    const url = window.location.origin + '/post/' + postId;
    if (navigator.share) await navigator.share({ title: 'Sparkle', url });
    else { navigator.clipboard.writeText(url); alert('Link copied!'); }
}
