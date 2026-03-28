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

        if (!response) return;

        const posts = response.posts || [];
        const htmls = response.htmls || [];

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
            // Fallback to client-side creation if somehow htmls are missing
            const fragment = document.createDocumentFragment();
            posts.forEach(post => {
                const el = createPostElement(post);
                fragment.appendChild(el);
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

export async function likeComment(commentId) {
    try {
        // Assume API exists
        const result = await window.DashboardAPI.likeComment(commentId);
        // Update UI - find the comment and toggle like
        const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (commentEl) {
            const likeBtn = commentEl.querySelector('.like-comment-btn');
            if (likeBtn) {
                likeBtn.classList.toggle('liked');
                // Update count if available
            }
        }
    } catch (error) {
        console.error('Error liking comment:', error);
    }
}

export async function replyToComment(commentId) {
    // Find the comment element
    const commentEl = document.querySelector(`[data-comment-id="${commentId}"]`);
    if (!commentEl) return;

    // Check if reply input already exists
    let replyInput = commentEl.querySelector('.reply-input');
    if (replyInput) {
        replyInput.remove();
        return;
    }

    // Create reply input
    replyInput = document.createElement('div');
    replyInput.className = 'reply-input';
    replyInput.style = 'display: flex; gap: 10px; margin-top: 10px; margin-left: 42px;';
    replyInput.innerHTML = `
        <img src="<%= typeof user !== 'undefined' ? (user.avatar_url || '/uploads/avatars/default.png') : '/uploads/avatars/default.png' %>" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
        <input type="text" class="reply-input-field" placeholder="Write a reply..." style="flex: 1; padding: 6px 12px; border: 1px solid #ddd; border-radius: 20px; font-size: 14px;">
    `;

    commentEl.appendChild(replyInput);

    const input = replyInput.querySelector('.reply-input-field');
    input.focus();

    input.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            try {
                await window.DashboardAPI.replyToComment(commentId, e.target.value);
                replyInput.remove();
                // Reload comments
                const postId = commentEl.closest('.post-card').dataset.postId;
                if (postId) {
                    loadComments(postId);
                }
            } catch (error) {
                console.error('Error posting reply:', error);
            }
        }
    });

    // Remove on blur if empty
    input.addEventListener('blur', () => {
        if (!input.value.trim()) {
            replyInput.remove();
        }
    });
}

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
                                <span onclick="window.likeComment('${c.id}')" style="cursor:pointer; font-weight:700;">Like</span>
                                <span onclick="window.replyToComment('${c.id}')" style="cursor:pointer; font-weight:700;">Reply</span>
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

export function openComments(postId) {
    currentCommentPostId = postId;
    const overlay = document.getElementById('commentOverlay');
    const sheet = document.getElementById('commentSheet');
    if (!overlay || !sheet) return;

    overlay.style.display = 'block';
    // Force reflow
    void sheet.offsetWidth;
    sheet.classList.add('active');
    document.body.style.overflow = 'hidden';

    loadCommentsList(postId);
}

export function closeComments() {
    const overlay = document.getElementById('commentOverlay');
    const sheet = document.getElementById('commentSheet');
    if (!overlay || !sheet) return;

    sheet.classList.remove('active');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}

async function loadCommentsList(postId) {
    const container = document.getElementById('commentList');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const comments = await window.DashboardAPI.loadComments(postId);
        if (comments && comments.length > 0) {
            container.innerHTML = comments.map(c => `
                <div class="comment-item">
                    <img src="${c.avatar || '/uploads/avatars/default.png'}" class="comment-avatar">
                    <div class="comment-body">
                        <div class="comment-user">@${c.username}</div>
                        <div class="comment-text">${c.content}</div>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div style="text-align:center; color:#65676b; padding: 40px;">No comments yet. Be the first to spark a conversation!</div>';
        }
    } catch (error) {
        console.error('Failed to load comments:', error);
        container.innerHTML = '<div style="text-align:center; color:red; padding: 40px;">Failed to load comments</div>';
    }
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
