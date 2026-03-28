// feed.js
import { timeAgo } from '../core/utils.js';

let lastSeenPostId = null;
let currentViewerPost = null;
let feedLoading = false;
let feedPage = 1;
let allPostsLoaded = false;
let suggestionsDisplayed = false;
const FEED_LIMIT = 12;

export function initFeed() {
    loadFeedPosts({ refresh: true });
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
            render: 'true' // Request pre-rendered HTML partials
        });

        if (!response) {
            feedLoading = false;
            return;
        }

        // Handle both object { posts, htmls } and array [posts] formats
        const posts = Array.isArray(response) ? response : (response.posts || []);
        const htmls = Array.isArray(response) ? [] : (response.htmls || []);

        if (posts.length < FEED_LIMIT) allPostsLoaded = true;
        if (isRefresh && posts.length > 0) lastSeenPostId = posts[0].post_id || posts[0].id;

        if (isRefresh) container.innerHTML = '';

        if (htmls.length > 0) {
            // Use server-rendered HTML for perfect styling consistency
            htmls.forEach(html => {
                const temp = document.createElement('div');
                temp.innerHTML = html.trim();
                const postEl = temp.firstElementChild;
                if (postEl) container.appendChild(postEl);
            });
        } else {
            // Fallback to client-side creation via script.js global
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

export async function toggleSpark(postId, button) {
    try {
        const result = await window.DashboardAPI.sparkPost(postId);
        const icon = button.querySelector('i');
        const countSpan = document.querySelector(`[data-post-id="${postId}"] .spark-count`);

        if (result.action === 'sparked') {
            button.classList.add('active');
            if (icon) icon.className = 'fas fa-heart';
            
            // Add spark animation
            button.style.transform = 'scale(1.2)';
            setTimeout(() => button.style.transform = 'scale(1)', 200);
        } else {
            button.classList.remove('active');
            if (icon) icon.className = 'far fa-heart';
        }

        if (countSpan && typeof result.newCount !== 'undefined') {
            countSpan.textContent = result.newCount + ' sparks';
        }
    } catch (error) {
        console.error('Spark error:', error);
    }
}

export function expandCaption(postId, fullText) {
    const captionText = document.getElementById('caption-' + postId);
    if (!captionText) return;

    // Replace the truncated text + "..." with the full text
    // The "See more" button was clicked, so we can reveal everything
    captionText.textContent = fullText;
    
    // Hide the "See more" button
    const container = captionText.closest('.caption');
    const seeMore = container.querySelector('.see-more');
    if (seeMore) seeMore.remove();
}

export async function sharePost(postId) {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Sparkle Post',
                url: window.location.origin + '/post/' + postId
            });
        } catch (err) {
            console.log('Share cancelled or failed');
        }
    } else {
        // Fallback: Copy to clipboard
        const url = window.location.origin + '/post/' + postId;
        navigator.clipboard.writeText(url).then(() => {
            alert('Link copied to clipboard!');
        });
    }
}

export async function savePost(postId, button) {
    try {
        const result = await window.DashboardAPI.savePost(postId);
        const icon = button.querySelector('i');
        if (result.action === 'saved') {
            button.classList.add('active');
            if (icon) icon.className = 'fas fa-bookmark';
        } else {
            button.classList.remove('active');
            if (icon) icon.className = 'far fa-bookmark';
        }
    } catch (error) {
        console.error('Save error:', error);
    }
}

// Consolidated Comment Actions moved to bottom system section

export function closePostViewer() {
    const viewer = document.getElementById('postViewerModal');
    if (viewer) {
        viewer.style.display = 'none';
        document.body.style.overflow = '';
        currentViewerPost = null;
    }
}

export async function openPostViewer(postId) {
    const modal = document.getElementById('postViewerModal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Show loading state
    const viewerBody = modal.querySelector('.viewer-body');
    if (viewerBody) viewerBody.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const post = await window.DashboardAPI.request(`/posts/${postId}`);
        if (!post) throw new Error('Post not found');

        // Layout matches Dashboard-Modals.ejs IDs
        const mediaImg = document.getElementById('viewerMedia');
        const mediaVideo = document.getElementById('viewerVideo');
        const mediaContainer = document.getElementById('viewerMediaContainer');

        if (post.media_url) {
            mediaContainer.style.display = 'flex';
            const isVideo = post.media_url.match(/\.(mp4|webm|ogg|mov)$/i);
            if (isVideo) {
                mediaImg.style.display = 'none';
                mediaVideo.style.display = 'block';
                mediaVideo.src = post.media_url;
            } else {
                mediaVideo.style.display = 'none';
                mediaImg.style.display = 'block';
                mediaImg.src = post.media_url;
            }
        } else {
            mediaContainer.style.display = 'none';
        }

        if (document.getElementById('viewerAvatar')) document.getElementById('viewerAvatar').src = post.avatar_url || '/uploads/avatars/default.png';
        if (document.getElementById('viewerUsername')) document.getElementById('viewerUsername').textContent = post.username || 'Sparkler';
        if (document.getElementById('viewerTime')) document.getElementById('viewerTime').textContent = timeAgo(post.created_at);
        if (document.getElementById('viewerCaptionText')) document.getElementById('viewerCaptionText').textContent = post.content || '';
        if (document.getElementById('viewerLikesCount')) document.getElementById('viewerLikesCount').textContent = post.spark_count || 0;
        if (document.getElementById('viewerCommentsCount')) document.getElementById('viewerCommentsCount').textContent = post.comment_count || 0;

        currentViewerPost = post;

        // Load comments into viewer
        const commentsList = document.getElementById('viewerComments');
        if (commentsList) {
            commentsList.innerHTML = '<div style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i></div>';
            
            const comments = await window.DashboardAPI.loadComments(postId);
            if (comments && comments.length > 0) {
                commentsList.innerHTML = comments.map(c => `
                    <div class="comment-item" style="display:flex; gap:10px; margin-bottom:12px;">
                        <img src="${c.avatar_url || '/uploads/avatars/default.png'}" style="width:32px; height:32px; border-radius:50%;">
                        <div style="flex:1;">
                            <div style="background:#f0f2f5; padding:8px 12px; border-radius:12px;">
                                <div style="font-weight:700; font-size:13px;">${c.username}</div>
                                <div style="font-size:13px; line-height:1.4;">${c.content}</div>
                            </div>
                            <div style="display:flex; gap:12px; padding-left:12px; font-size:12px; color:#65676b; margin-top:4px;">
                                <span onclick="window.likeComment('${c.id}', this)" style="cursor:pointer; font-weight:700;">Like</span>
                                <span onclick="window.replyToComment('${c.id}', '@${c.username} ')" style="cursor:pointer; font-weight:700;">Reply</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                commentsList.innerHTML = '<div style="text-align:center; color:#65676b; padding: 20px;">No comments yet.</div>';
            }
        }

    } catch (error) {
        console.error('Post Viewer Error:', error);
        if (viewerBody) viewerBody.innerHTML = '<div style="text-align:center; color:red; padding:40px;">Failed to load post</div>';
    }
}

// Global closer
window.closePostViewer = function() {
    const modal = document.getElementById('postViewerModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        currentViewerPost = null;
        // Stop video if playing
        const video = document.getElementById('viewerVideo');
        if (video) { video.pause(); video.src = ''; }
    }
};

export async function toggleViewerLike() {
    if (!currentViewerPost) return;
    const btn = document.getElementById('viewerLikeBtn');
    await toggleSpark(currentViewerPost.id || currentViewerPost.post_id, btn);
    // Update viewer count
    const result = await window.DashboardAPI.request(`/posts/${currentViewerPost.id || currentViewerPost.post_id}`);
    if (result && document.getElementById('viewerLikesCount')) {
        document.getElementById('viewerLikesCount').textContent = result.spark_count || 0;
    }
}

export async function postViewerComment() {
    if (!currentViewerPost) return;
    const input = document.getElementById('viewerCommentInput');
    const text = input.value.trim();
    if (!text) return;

    try {
        await window.DashboardAPI.postComment(currentViewerPost.id || currentViewerPost.post_id, text);
        input.value = '';
        // Reload comments in viewer
        const commentsList = document.getElementById('viewerComments');
        const comments = await window.DashboardAPI.loadComments(currentViewerPost.id || currentViewerPost.post_id);
        if (commentsList && comments) {
            commentsList.innerHTML = comments.map(c => `
                <div class="comment-item" style="display:flex; gap:10px; margin-bottom:12px;">
                    <img src="${c.avatar_url || '/uploads/avatars/default.png'}" style="width:32px; height:32px; border-radius:50%;">
                    <div style="flex:1;">
                        <div style="background:#f0f2f5; padding:8px 12px; border-radius:12px;">
                            <div style="font-weight:700; font-size:13px;">${c.username}</div>
                            <div style="font-size:13px; line-height:1.4;">${c.content}</div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        // Update count
        const result = await window.DashboardAPI.request(`/posts/${currentViewerPost.id || currentViewerPost.post_id}`);
        if (result && document.getElementById('viewerCommentsCount')) {
            document.getElementById('viewerCommentsCount').textContent = result.comment_count || 0;
        }
    } catch (err) {
        console.error('Viewer comment error:', err);
    }
}

export function sharePostFromViewer() {
    if (currentViewerPost) sharePost(currentViewerPost.id || currentViewerPost.post_id);
}

export function savePostFromViewer() {
    if (currentViewerPost) savePost(currentViewerPost.id || currentViewerPost.post_id, document.querySelector('.viewer-options-menu button'));
}

export function notInterestedFromViewer() {
    alert('We will show you fewer posts like this.');
    window.closePostViewer();
}

export function reportPostFromViewer() {
    alert('Post reported. Thank you for keeping Sparkle safe.');
    window.closePostViewer();
}

export function copyLinkFromViewer() {
    if (!currentViewerPost) return;
    const url = window.location.origin + '/post/' + (currentViewerPost.id || currentViewerPost.post_id);
    navigator.clipboard.writeText(url).then(() => {
        alert('Link copied to clipboard!');
    });
}

export async function loadMorePosts() {
    const btn = document.getElementById('load-more-btn');
    if (!btn) return;

    btn.textContent = 'Loading...';
    btn.disabled = true;

    try {
        // Get current post count
        const currentPosts = document.querySelectorAll('.post-card').length;
        const campus = 'all'; // or get from user
        const posts = await window.DashboardAPI.loadFeed(campus, currentPosts);

        if (posts && posts.length > 0) {
            const feedContainer = document.getElementById('feed');
            posts.forEach(post => {
                const postEl = window.createPostElement(post);
                feedContainer.appendChild(postEl);
            });
        } else {
            // No more posts
            document.getElementById('load-more-container').style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading more posts:', error);
    } finally {
        btn.textContent = 'Load More Posts';
        btn.disabled = false;
    }
}

// --- NEW COMMENT BOTTOM SHEET SYSTEM ---
let currentCommentPostId = null;
let currentCommentsData = [];

export function openComments(postId, targetCommentId = null) {
    currentCommentPostId = postId;
    const overlay = document.getElementById('commentOverlay');
    const sheet = document.getElementById('commentSheet');
    if (!overlay || !sheet) return;

    overlay.style.display = 'block';
    void sheet.offsetWidth;
    sheet.classList.add('active');
    document.body.style.overflow = 'hidden';

    loadCommentsList(postId, targetCommentId);
}

export function closeComments() {
    const overlay = document.getElementById('commentOverlay');
    const sheet = document.getElementById('commentSheet');
    if (!overlay || !sheet) return;

    sheet.classList.remove('active');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        currentCommentPostId = null;
        currentCommentsData = [];
    }, 300);
}

export async function loadCommentsList(postId, targetCommentId = null) {
    const container = document.getElementById('commentList');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const comments = await window.DashboardAPI.loadComments(postId);
        currentCommentsData = comments || [];
        
        // Update header count
        const countHeader = document.getElementById('commentSheetCount');
        if (countHeader) countHeader.textContent = `${currentCommentsData.length} comments`;

        if (currentCommentsData.length > 0) {
            renderComments(currentCommentsData);
            
            // Handle notification redirect scroll
            if (targetCommentId) {
                setTimeout(() => {
                    const targetEl = document.querySelector(`[data-comment-id="${targetCommentId}"]`);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetEl.style.background = 'rgba(233, 30, 99, 0.1)';
                        setTimeout(() => targetEl.style.background = '', 2000);
                    }
                }, 500);
            }
        } else {
            container.innerHTML = '<div style="text-align:center; color:#65676b; padding: 40px;">No comments yet. Be the first to spark a conversation!</div>';
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

function renderCommentItem(c) {
    const isLiked = c.is_liked || false;
    return `
        <div class="comment-item" data-comment-id="${c.id}">
            <img src="${c.avatar || '/uploads/avatars/default.png'}" class="comment-avatar">
            <div class="comment-body">
                <div class="comment-bubble">
                    <div class="comment-user">@${c.username}</div>
                    <div class="comment-text">${c.content}</div>
                </div>
                <div class="comment-meta">
                    <span class="time">${timeAgo(c.created_at)}</span>
                    <span class="like-btn ${isLiked ? 'liked' : ''}" onclick="window.likeComment('${c.id}', this)">
                        ${c.like_count || 0} Likes
                    </span>
                    <span class="reply-trigger" onclick="window.replyToComment('${c.id}', '@${c.username} ')">Reply</span>
                </div>
                ${c.replies && c.replies.length > 0 ? `
                    <div class="replies-container">
                        ${c.replies.map(r => renderReplyItem(r)).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderReplyItem(r) {
    return `
        <div class="comment-item reply-item" data-comment-id="${r.id}" style="margin-top: 12px; transform: scale(0.95); transform-origin: left;">
            <img src="${r.avatar || '/uploads/avatars/default.png'}" class="comment-avatar" style="width: 32px; height: 32px;">
            <div class="comment-body">
                <div class="comment-bubble">
                    <div class="comment-user">@${r.username}</div>
                    <div class="comment-text">${r.content}</div>
                </div>
                <div class="comment-meta">
                    <span class="time">${timeAgo(r.created_at)}</span>
                    <span class="like-btn" onclick="window.likeComment('${r.id}', this)">Like</span>
                </div>
            </div>
        </div>
    `;
}

export function filterComments(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
        renderComments(currentCommentsData);
        return;
    }
    const filtered = currentCommentsData.filter(c => 
        c.content.toLowerCase().includes(q) || 
        c.username.toLowerCase().includes(q)
    );
    renderComments(filtered);
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
        
        // Update count on post card
        const countSpan = document.querySelector(`[data-post-id="${currentCommentPostId}"] .comment-count`);
        if (countSpan) {
            const currentCount = parseInt(countSpan.textContent) || 0;
            countSpan.textContent = (currentCount + 1) + ' comments';
        }
    } catch (error) {
        console.warn('Comment post error:', error);
    } finally {
        if (btn) btn.disabled = false;
    }
}

export async function likeComment(commentId, el) {
    try {
        const result = await window.DashboardAPI.likeComment(commentId);
        
        // Handle UI update based on where it was clicked (Post Viewer or Sheet)
        if (el) {
            if (result.action === 'liked') {
                el.classList.add('liked');
                if (el.tagName === 'SPAN' && !el.classList.contains('like-btn')) {
                    el.style.color = 'var(--accent-pink)';
                }
            } else {
                el.classList.remove('liked');
                if (el.tagName === 'SPAN' && !el.classList.contains('like-btn')) {
                    el.style.color = '';
                }
            }
            if (typeof result.newCount !== 'undefined' && el.classList.contains('like-btn')) {
                el.textContent = `${result.newCount} Likes`;
            }
        }
    } catch (err) {
        console.error('Comment like error:', err);
    }
}

export function replyToComment(commentId, mention) {
    const input = document.getElementById('commentInputField');
    if (input) {
        // If sheet is open or we are in the sheet flow
        input.value = mention || '';
        input.focus();
    } else {
        // Post Viewer fallback
        const viewerInput = document.getElementById('viewerCommentInput');
        if (viewerInput) {
            viewerInput.value = mention || '';
            viewerInput.focus();
        }
    }
}
