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
        const countSpan = button.parentElement.parentElement.querySelector('.spark-count-val');

        if (result.action === 'sparked') {
            button.classList.add('active');
            if (icon) icon.className = 'fas fa-bolt';
        } else {
            button.classList.remove('active');
            if (icon) icon.className = 'far fa-bolt';
        }

        // Update count if span exists
        if (countSpan && typeof result.newCount !== 'undefined') {
            countSpan.textContent = result.newCount;
        }
    } catch (error) {
        console.error('Spark error:', error);
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
            <div class="comment-item" style="display:flex; gap:10px; margin-bottom:12px; animation: fadeIn 0.3s ease-out;">
                <img src="${comment.avatar_url || '/uploads/avatars/default.png'}" style="width:32px; height:32px; border-radius:10px; flex-shrink:0;">
                <div style="flex:1; background:rgba(0,0,0,0.03); padding:8px 12px; border-radius:12px;">
                    <div style="font-weight:700; font-size:13px; color:#0f172a;">@${comment.username}</div>
                    <div style="font-size:13px; color:#334155; line-height:1.4;">${comment.content || comment.comment_text}</div>
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

        // Refresh comments section if open
        const commentsContainer = document.getElementById(`comments-${postId}`);
        if (commentsContainer && commentsContainer.style.display !== 'none') {
            // Assuming loadComments function exists elsewhere or will be added
            // loadComments(postId); 
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
