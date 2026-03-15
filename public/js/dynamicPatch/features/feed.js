// feed.js
import { timeAgo } from '../core/utils.js';

let lastSeenPostId = null;
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
        const countSpan = document.querySelector(`[data-post-id="${postId}"] .spark-count-val`);

        if (result.action === 'sparked') {
            button.classList.add('active');
            if (icon) icon.className = 'fas fa-heart pink-yellow-spark';
            
            // Add spark animation
            button.style.transform = 'scale(1.2)';
            setTimeout(() => button.style.transform = 'scale(1)', 200);
        } else {
            button.classList.remove('active');
            if (icon) icon.className = 'far fa-heart';
        }

        if (countSpan && typeof result.newCount !== 'undefined') {
            countSpan.textContent = result.newCount;
        }
    } catch (error) {
        console.error('Spark error:', error);
    }
}

export function toggleCaption(postId) {
    const caption = document.getElementById('caption-' + postId);
    const btn = document.getElementById('toggle-' + postId);
    if (!caption || !btn) return;

    if (caption.classList.contains('collapsed')) {
        caption.classList.remove('collapsed');
        btn.textContent = 'See less';
    } else {
        caption.classList.add('collapsed');
        btn.textContent = 'Read more';
    }
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

export async function openPostViewer(postId) {
    // Placeholder for post viewer modal
    console.log('Open post viewer for:', postId);
    // TODO: Implement post viewer modal
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

export async function scrollToComments(postId) {
    const container = document.getElementById(`comments-${postId}`);
    if (!container) return;

    // Show comments if hidden
    if (container.style.display === 'none') {
        container.style.display = 'block';
        loadComments(postId);
    }

    // Scroll to the comments section
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Focus the comment input
    const input = document.getElementById(`comment-input-${postId}`);
    if (input) {
        setTimeout(() => input.focus(), 300);
    }
}

export async function toggleComments(postId) {
    const container = document.getElementById(`comments-${postId}`);
    if (!container) return;

    if (container.style.display === 'none') {
        container.style.display = 'block';
        loadComments(postId);
    } else {
        container.style.display = 'none';
    }
}

export async function loadComments(postId) {
    const container = document.getElementById(`comments-${postId}`);
    if (!container) return;

    container.innerHTML = '<div class="comments-loading" style="text-align: center; padding: 10px;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const comments = await window.DashboardAPI.loadComments(postId);

        if (!comments || comments.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:13px; padding: 10px;">Be the first to comment!</div>';
            return;
        }

        container.innerHTML = comments.map(comment => `
            <div class="comment-item" data-comment-id="${comment.comment_id || comment.id}" style="display:flex; gap:10px; margin-bottom:12px; animation: fadeIn 0.3s ease-out;">
                <img src="${comment.avatar_url || '/uploads/avatars/default.png'}" style="width:32px; height:32px; border-radius:10px; flex-shrink:0;">
                <div style="flex:1;">
                    <div style="background:rgba(0,0,0,0.03); padding:8px 12px; border-radius:12px; margin-bottom:4px;">
                        <div style="font-weight:700; font-size:13px; color:#0f172a;">@${comment.username}</div>
                        <div style="font-size:13px; color:#334155; line-height:1.4;">${comment.content || comment.comment_text}</div>
                    </div>
                    <div class="comment-actions" style="display:flex; gap:12px; padding-left:12px; font-size:12px; color:#64748b;">
                        <button onclick="likeComment('${comment.comment_id || comment.id}')" class="like-comment-btn" style="background:none; border:none; color:inherit; cursor:pointer;">Like</button>
                        <button onclick="replyToComment('${comment.comment_id || comment.id}')" style="background:none; border:none; color:inherit; cursor:pointer;">Reply</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading comments:', error);
        container.innerHTML = '<div style="text-align:center; color:var(--danger); font-size:12px;">Failed to load comments</div>';
    }
}

export async function addComment(postId, input) {
    const text = input.value.trim();
    if (!text) return;

    try {
        const result = await window.DashboardAPI.postComment(postId, text);
        input.value = '';

        // Refresh comments section
        const commentsContainer = document.getElementById(`comments-${postId}`);
        if (commentsContainer) {
            commentsContainer.style.display = 'block';
            loadComments(postId);
        }

        // Update count
        const countSpan = document.querySelector(`[data-post-id="${postId}"] .comment-count-val`);
        if (countSpan) {
            countSpan.textContent = parseInt(countSpan.textContent) + 1;
        }
    } catch (err) {
        console.error('Comment error:', err);
    }
}
