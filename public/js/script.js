// ENHANCED DATA INITIALIZATION (Mocks Removed house 5.0)

// Shim mockData if undefined (Legacy Support)
if (typeof mockData === 'undefined') {
    window.mockData = {
        users: [],
        posts: [],
        polls: [],
        confessions: [],
        groups: [],
        lostFound: { lost: [], found: [] },
        skillMarket: { tutoring: [], services: [] },
        marketplace: { secondhand: [] },
        notifications: [],
        events: []
    };
    // Basic polls to prevent crash
    window.mockData.polls = [];
    window.mockData.confessions = [];
}

window.appState = {
    currentPage: 'home',
    isAnonymousMode: false,
    isDarkMode: false,
    currentUser: null, // To be filled by dataManager house 5.0
    likedPosts: [],
    savedPosts: [],
    sparkAnimations: new Set(),
    activeChat: null,
    activeGroup: null,
    isEditingProfile: false,
    groupMessages: {},
    hamburgerOpen: false,
    activeMarketplaceTab: 'student_market',
    activeLostFoundTab: 'lost',
    activeSkillMarketTab: 'tutoring',
    activePoll: null,
    userPosts: [],
    postComments: {},
    momentLikes: new Set(),
    sparkAnimationQueue: []
};
const appState = window.appState; // Maintain local reference for script.js

// Sync with dataManager or localStorage immediately to prevent 'undefined' in other scripts
if (typeof dataManager !== 'undefined') {
    appState.currentUser = dataManager.getCurrentUser();
    console.log("👤 Initialized appState.currentUser from dataManager:", appState.currentUser?.username);
} else {
    try {
        const savedUser = localStorage.getItem('sparkleUser');
        if (savedUser) {
            appState.currentUser = JSON.parse(savedUser);
            console.log("👤 Initialized appState.currentUser from localStorage:", appState.currentUser?.username);
        }
    } catch (e) {
        console.warn("Failed to load user during init:", e);
    }
}


// ================================
// CORE PAGE FUNCTIONS
// ================================

// Global error handler for broken images (e.g. 403 Forbidden external links)
window.addEventListener('error', function (e) {
    if (e.target.tagName === 'IMG') {
        const src = e.target.src;
        if (src.includes('avatar')) {
            e.target.src = '/uploads/avatars/default.png';
        } else {
            e.target.src = 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1000'; // Default campus vibe image
        }
    }
}, true);
function switchPage(page) {
    console.log("🔄 Switching to page:", page);

    const pageElement = document.getElementById(page + 'Page');
    if (!pageElement) {
        console.warn(`Page element #${page}Page not found. Staying on current page.`);
        return;
    }

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
    });

    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected page
    // pageElement is already found above
    pageElement.classList.remove('hidden');
    pageElement.classList.add('active');

    // Update nav active state
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');

    // Update app state
    appState.currentPage = page;

    // Load content for the page
    switch (page) {
        case 'home':
            loadAfterglowStories();
            loadFeedPosts();
            break;
        case 'connect':
            loadConnectUsers();
            break;
        case 'moments':
            loadMoments();
            break;
        case 'groups':
            loadGroups();
            break;
        case 'messages':
            loadMessages('direct');
            break;
        case 'profile':
            loadProfile();
            break;
    }
}

// ================================
// MODAL FUNCTIONS
// ================================
function showModal(modalId) {
    const modal = document.getElementById(modalId + 'Modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Load content for specific modals
        if (modalId === 'notifications') {
            loadNotifications();
        } else if (modalId === 'confessions') {
            loadEnhancedConfessions();
        } else if (modalId === 'marketplace') {
            loadMarketplaceContent('blackmarket');
        } else if (modalId === 'lostFound') {
            loadLostFoundContent('lost');
        } else if (modalId === 'skillMarket') {
            loadSkillMarketContent('tutoring');
        } else if (modalId === 'polls') {
            loadPolls();
        } else if (modalId === 'groupManagement') {
            loadGroupManagement();
        } else if (modalId === 'groupFeed') {
            loadGroupFeed();
        }
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId + 'Modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// ================================
// HAMBURGER MENU FUNCTIONS
// ================================
function toggleHamburger() {
    const menu = document.getElementById('hamburgerMenu');
    const overlay = document.getElementById('hamburgerOverlay');

    appState.hamburgerOpen = !appState.hamburgerOpen;

    if (appState.hamburgerOpen) {
        menu.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        updateBadgeCounts(); // Update badges when opening
    } else {
        menu.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function hideHamburger() {
    const menu = document.getElementById('hamburgerMenu');
    const overlay = document.getElementById('hamburgerOverlay');

    menu.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = 'auto';
    appState.hamburgerOpen = false;
}

// ================================
// LOAD FUNCTIONS FOR EACH PAGE
// ================================

// HOME PAGE - AfterGlow Stories
let activeStories = []; // Store the current list of stories for navigation
let currentStoryIndex = -1;
let isSubmittingAfterglow = false;

async function loadAfterglowStories() {
    const container = document.getElementById('afterglowStories');
    if (!container) return;

    // Skip if SSR content already exists
    if (container.querySelector('.story')) {
        console.log('✅ Stories already rendered via SSR');
        return;
    }

    try {
        container.innerHTML = '<div class="loading-shimmer" style="width: 100%; height: 80px;"></div>';
        const stories = await DashboardAPI.loadStories();
        activeStories = stories || []; // Store globally
        container.innerHTML = '';

        if (!stories || stories.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; width: 100%;">
                    <div style="color: #999; font-size: 13px; margin-bottom: 10px;">No active glows</div>
                    <button class="action-btn" onclick="window.showCreateOptions()" style="background: linear-gradient(135deg, #9c27b0, #e91e63); color: white; border: none; padding: 6px 15px; border-radius: 20px; cursor: pointer; font-weight: 600;">
                        <i class="fas fa-plus"></i> Create AfterGlow
                    </button>
                </div>
            `;
            return;
        }

        stories.forEach(story => {
            const storyEl = document.createElement('div');
            storyEl.className = 'story-view-card'; // Changed from 'story' to match CSS
            storyEl.innerHTML = `
                <div class="story-view-inner">
                    <div class="story-avatar-container">
                        <div class="story-avatar-ring ${story.is_viewed ? 'viewed' : ''}"></div> <!-- Changed from story-ring -->
                        <img src="${story.avatar || story.avatar_url || '/uploads/avatars/default.png'}" 
                             alt="${story.username}" 
                             class="story-avatar ${story.is_viewed ? 'viewed' : ''}">
                    </div>
                    <div class="story-username">${story.username}</div>
                </div>
            `;

            storyEl.addEventListener('click', () => {
                currentStoryIndex = activeStories.indexOf(story);
                showAfterglowViewer(story);
            });

            container.appendChild(storyEl);
        });
    } catch (error) {
        console.error('❌ Failed to load stories:', error);
        container.innerHTML = '<div style="padding: 10px; color: var(--danger); font-size: 12px;">Failed to load</div>';
    }
}

// HOME PAGE - Feed Posts
async function loadFeedPosts() {
    const container = document.getElementById('feed');
    if (!container) return;

    // Skip if SSR content already exists and we're not forcing a refresh
    if (container.querySelector('.post-card') && !window.forceFeedRefresh) {
        console.log('✅ Feed already rendered via SSR');
        return;
    }

    if (window.forceFeedRefresh) {
        window.forceFeedRefresh = false;
    }

    try {
        container.innerHTML = `
            <div class="post-card loading-shimmer" style="height: 200px; margin-bottom: 15px;"></div>
            <div class="post-card loading-shimmer" style="height: 300px;"></div>
        `;

        const posts = await DashboardAPI.loadFeed();
        container.innerHTML = '';

        if (!posts || posts.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <i class="fas fa-newspaper" style="font-size: 40px; margin-bottom: 15px; opacity: 0.5;"></i>
                    <p>No posts yet. Be the first to spark something!</p>
                    <button onclick="window.showCreateOptions()" style="margin-top: 20px; background: linear-gradient(135deg, #9c27b0, #e91e63); color: white; border: none; padding: 10px 25px; border-radius: 25px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 15px rgba(233, 30, 99, 0.3);">
                        <i class="fas fa-bolt"></i> Create AfterGlow
                    </button>
                </div>
            `;
            return;
        }

        posts.forEach(post => {
            const postEl = window.createPostElement(post);
            container.appendChild(postEl);
        });
    } catch (error) {
        console.error('❌ Failed to load feed:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">Failed to load feed. Please refresh.</div>';
    }
}

// Global function to create a post element (used by dynamicPatch.js)
// Global function to create a post element (used by dynamicPatch.js) house 5.0
window.createPostElement = function (post) {
    const isLiked = post.is_liked || post.isLiked || false;
    const isSaved = post.is_saved || post.isSaved || false;
    const postId = post.post_id || post.id;

    // Robust timestamp handling: Don't format if already a string like "5m ago"
    let displayTime = post.timestamp;
    if (post.timestamp_raw) {
        displayTime = DashboardAPI.formatTimestamp(post.timestamp_raw);
    } else if (post.timestamp && !isNaN(new Date(post.timestamp).getTime())) {
        displayTime = DashboardAPI.formatTimestamp(post.timestamp);
    }

    // Robust tags handling: Handle both "tag1, tag2" string and ["tag1", "tag2"] array
    let tagsHTML = '';
    if (post.tags) {
        const tagsArray = Array.isArray(post.tags) ? post.tags : post.tags.split(',');
        tagsHTML = tagsArray
            .map(tag => tag && tag.trim() ? `<span class="post-tag">#${tag.trim().replace(/^#/, '')}</span>` : '')
            .join('');
    }

    const postEl = document.createElement('div');
    postEl.className = 'post-card';
    postEl.setAttribute('data-post-id', postId);

    postEl.innerHTML = `
        <div class="post-header">
            <div class="post-avatar-wrapper">
                <img src="${post.avatar || post.avatar_url || '/uploads/avatars/default.png'}" alt="${post.username}" class="post-avatar">
            </div>
            <div class="post-user-info">
                <div class="post-username">${post.user_name || post.username || post.name || 'Sparkler'}</div>
                <div class="post-campus">
                    <i class="fas fa-graduation-cap"></i>
                    ${post.campus || 'Generic Campus'}
                </div>
            </div>
            <div class="post-time">${displayTime || 'Just now'}</div>
        </div>
        
        <div class="post-content-area">
            <div class="post-caption">
                ${(post.content || post.caption || '').length > 350 ? `
                    <span class="content-short">${(post.content || post.caption || '').substring(0, 300)}...</span>
                    <span class="content-full" style="display:none;">${post.content || post.caption || ''}</span>
                    <button class="see-more-btn" onclick="toggleSeeMore(this)" style="color: #0095F6; background: none; border: none; padding: 0; font-weight: 600; cursor: pointer; margin-left: 5px; font-size: 14px;">See More</button>
                ` : (post.content || post.caption || '')}
            </div>
            <div class="post-tags">
                ${tagsHTML}
            </div>
        </div>

        ${(post.media_url || post.media) ? `
        <div class="post-media-container">
            <img src="${post.media_url || post.media}" alt="Post" class="post-media">
        </div>` : ''}

        <div class="post-actions">
            <div class="post-action-left">
                <button class="action-btn spark-btn ${isLiked ? 'active' : ''}" onclick="toggleSpark('${postId}', this)">
                    <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                    <span class="spark-count">${post.sparks || 0}</span>
                </button>
                <button class="action-btn comment-btn" onclick="showComments('${postId}')">
                    <i class="far fa-comment"></i>
                    <span class="comment-count">${post.comments || 0}</span>
                </button>
                <button class="action-btn share-btn" onclick="sharePost('${postId}')">
                    <i class="far fa-paper-plane"></i>
                </button>
            </div>
            <button class="action-btn save-btn ${isSaved ? 'saved' : ''}" onclick="toggleSavePost('${postId}')" style="margin-left: auto;">
                <i class="${isSaved ? 'fas' : 'far'} fa-bookmark"></i>
            </button>
        </div>
    `;
    return postEl;
}

// Global function to toggle 'See More' on long posts
window.toggleSeeMore = function (btn) {
    const parent = btn.parentElement;
    const shortText = parent.querySelector('.content-short');
    const fullText = parent.querySelector('.content-full');

    if (fullText.style.display === 'none') {
        fullText.style.display = 'inline';
        shortText.style.display = 'none';
        btn.textContent = 'Show Less';
    } else {
        fullText.style.display = 'none';
        shortText.style.display = 'inline';
        btn.textContent = 'See More';
    }
};

// CONNECT PAGE - Load Users
async function loadConnectUsers() {
    const container = document.getElementById('connectContainer');
    if (!container) return;

    // Skip if SSR content already exists and we are just initializing
    if (container.querySelector('.connect-card') && !container.dataset.filtered) {
        console.log('✅ Connect users already rendered via SSR');
        return;
    }

    try {
        if (!container.dataset.filtered) {
            container.innerHTML = '<div class="loading-shimmer" style="width: 100%; height: 300px;"></div>';
        }
        const users = await DashboardAPI.searchUsers('', 'all');
        container.innerHTML = '';

        if (!users || users.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #999;">
                    <i class="fas fa-users" style="font-size: 50px; margin-bottom: 15px;"></i>
                    <h3>No users to connect with</h3>
                    <p>Check back later!</p>
                </div>
            `;
            return;
        }

        users.forEach(user => {
            const userCard = window.createUserCard(user);
            container.appendChild(userCard);
        });
    } catch (error) {
        console.error('❌ Failed to load users:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">Failed to load students.</div>';
    }
}

// Global function to create a user card (used by dynamicPatch.js) house 5.0
window.createUserCard = function (user) {
    const isFollowed = user.is_followed || false;
    const userCard = document.createElement('div');
    userCard.className = 'connect-card';

    // Use the new Instagram-style styling found in connect.ejs
    userCard.style = 'background: white; border-radius: 8px; padding: 25px 20px; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(0,0,0,0.05); position: relative; display: flex; flex-direction: column; align-items: center; min-width: 0;';

    userCard.innerHTML = `
        <button style="position: absolute; top: 10px; right: 10px; border: none; background: none; color: #ccc; cursor: pointer; padding: 5px;" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>

        <div style="position: relative; margin-bottom: 15px;">
            <img src="${user.avatar || user.avatar_url || '/uploads/avatars/default.png'}" 
                 alt="${user.username}" 
                 style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 1px solid #dbdbdb;">
            ${user.is_online ? `
                <div class="chat-status-online" 
                     style="width: 16px; height: 16px; border: 3px solid white; right: 0; bottom: 0;">
                </div>
            ` : ''}
        </div>

        <div style="font-weight: 600; font-size: 14px; color: var(--text-color); margin-bottom: 4px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${user.username}
        </div>
        <div style="font-size: 12px; color: #8e8e8e; margin-bottom: 20px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${user.name}
        </div>

        <button class="btn btn-sm ${isFollowed ? 'btn-secondary' : 'btn-primary'} connect-btn" 
                onclick="connectUser('${user.user_id || user.id}', this)" 
                style="width: 100%; border-radius: 4px; font-size: 13px; font-weight: 600; padding: 8px 0; margin-top: auto;">
            ${isFollowed ? 'Following' : 'Follow'}
        </button>
    `;
    return userCard;
}

// MOMENTS PAGE
async function loadMoments() {
    const container = document.getElementById('momentVideoContainer');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading-shimmer" style="width: 100%; height: 100%;"></div>';
        const moments = await DashboardAPI.loadMoments();
        container.innerHTML = '';

        if (!moments || moments.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <i class="fas fa-play-circle" style="font-size: 50px; margin-bottom: 15px;"></i>
                    <h3>No moments found</h3>
                    <p>Be the first to share a moment!</p>
                </div>
            `;
            return;
        }

        moments.forEach(moment => {
            const momentEl = document.createElement('div');
            momentEl.className = 'moment-video';
            momentEl.setAttribute('data-moment-id', moment.id);

            momentEl.innerHTML = `
                <video class="moment-video-player" autoplay muted loop playsinline>
                    <source src="${moment.video}" type="video/mp4">
                </video>
                <div class="moment-overlay">
                    <div class="moment-user">
                        <img src="${moment.avatar || moment.avatar_url || '/uploads/avatars/default.png'}" alt="${moment.username}" class="moment-avatar">
                        <div class="moment-user-info">
                            <div class="moment-username">${moment.name || moment.username}</div>
                            <div class="moment-campus">${moment.campus || 'Campus'}</div>
                        </div>
                    </div>
                    <div class="moment-caption">${moment.caption || ''}</div>
                    <div class="moment-stats">
                        <span><i class="fas fa-heart"></i> ${moment.likes || 0}</span>
                        <span><i class="fas fa-comment"></i> ${moment.comments || 0}</span>
                        <span><i class="fas fa-share"></i> Share</span>
                    </div>
                </div>
            `;

            momentEl.addEventListener('dblclick', (e) => {
                handleMomentDoubleClick(moment.id, e);
            });

            container.appendChild(momentEl);
        });
    } catch (error) {
        console.error('❌ Failed to load moments:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">Failed to load moments.</div>';
    }
}

// GROUPS PAGE
async function loadGroups() {
    const container = document.getElementById('groupsContainer');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading-shimmer" style="width: 100%; height: 200px;"></div>';
        const groups = await DashboardAPI.loadGroups();
        container.innerHTML = '';

        if (!groups || groups.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999;">
                    <i class="fas fa-users" style="font-size: 50px; margin-bottom: 15px;"></i>
                    <h3>No groups found</h3>
                    <p>Create or join a group to see it here!</p>
                </div>
            `;
            return;
        }

        groups.forEach(group => {
            const groupEl = document.createElement('div');
            groupEl.className = 'group-card';

            groupEl.innerHTML = `
                <div style="padding: 15px;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <div style="width: 50px; height: 50px; border-radius: 10px; background: linear-gradient(45deg, var(--primary), var(--secondary)); 
                                    display: flex; align-items: center; justify-content: center; margin-right: 15px; color: white; font-size: 20px; overflow: hidden;">
                            ${group.icon_url ?
                    `<img src="${group.icon_url}" style="width: 100%; height: 100%; object-fit: cover;">` :
                    `<i class="${group.icon || 'fas fa-users'}"></i>`
                }
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 16px; margin-bottom: 2px;">${group.name}</div>
                            <div style="font-size: 13px; color: #666;">
                                <i class="fas fa-users"></i> ${group.member_count || 0} members
                            </div>
                        </div>
                        ${group.is_joined ?
                    '<span style="background: var(--success); color: white; padding: 3px 10px; border-radius: 12px; font-size: 11px;">Joined</span>' :
                    `<button class="btn btn-primary" style="font-size: 12px;" onclick="joinGroup('${group.id}')">Join</button>`
                }
                    </div>
                    <div style="font-size: 13px; color: #555; margin-bottom: 10px; line-height: 1.4;">
                        ${group.description || 'No description provided.'}
                    </div>
                    <div style="font-size: 12px; color: var(--campus-blue);">
                        <i class="fas fa-graduation-cap"></i> ${group.campus || 'Campus'}
                    </div>
                </div>
            `;

            container.appendChild(groupEl);
        });
    } catch (error) {
        console.error('❌ Failed to load groups:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">Failed to load groups.</div>';
    }
}

// MESSAGES PAGE
async function loadMessages(type) {
    const container = document.getElementById('messagesList');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading-shimmer" style="width: 100%; height: 60px; margin-bottom: 10px;"></div>';
        const chats = await DashboardAPI.loadChats();
        container.innerHTML = '';

        // Filter chats based on type if needed
        let filteredChats = chats;
        if (type === 'direct') filteredChats = chats.filter(c => !c.is_group && !c.is_anonymous);
        else if (type === 'groups') filteredChats = chats.filter(c => c.is_group);
        else if (type === 'anonymous') filteredChats = chats.filter(c => c.is_anonymous);

        if (!filteredChats || filteredChats.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">No messages here yet.</div>';
            return;
        }

        filteredChats.forEach(msg => {
            const msgEl = document.createElement('div');
            msgEl.className = 'message-item';

            msgEl.innerHTML = `
                <div style="display: flex; align-items: center; padding: 15px;">
                    <div style="position: relative; margin-right: 15px;">
                        ${msg.is_group ?
                    `<div style="width: 50px; height: 50px; border-radius: 10px; background: var(--primary); 
                                      display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
                                <i class="fas fa-users"></i>
                             </div>` :
                    `<img src="${msg.avatar || msg.avatar_url || '/uploads/avatars/default.png'}" alt="${msg.name}" 
                                  style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">`
                }
                        ${msg.is_online ?
                    '<div style="position: absolute; bottom: 0; right: 0; width: 14px; height: 14px; background: #4CAF50; border: 2px solid white; border-radius: 50%;"></div>' : ''}
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <div style="font-weight: 600;">${msg.name || msg.username}</div>
                            <div style="font-size: 12px; color: #999;">${DashboardAPI.formatTimestamp(msg.last_message_time)}</div>
                        </div>
                        <div style="font-size: 13px; color: #666; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">
                            ${msg.last_message || 'Start a conversation'}
                        </div>
                    </div>
                </div>
            `;

            msgEl.addEventListener('click', () => {
                if (msg.is_group) openGroupChat(msg);
                else startChatWithUser(msg.user_id || msg.id);
            });

            container.appendChild(msgEl);
        });
    } catch (error) {
        console.error('❌ Failed to load messages:', error);
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">Failed to load chats.</div>';
    }
}

// PROFILE PAGE
async function loadProfile() {
    try {
        // Fetch real user data for profile
        const user = await DashboardAPI.loadUserProfile('me'); // 'me' route or current user ID

        // Update profile info
        const profileElements = {
            'profileName': user.name,
            'profileCampus': `${user.campus || 'Campus'} • ${user.major || 'Major'}`,
            'profileBio': user.bio || 'New Sparkler!',
            'profileAvatar': user.avatar_url || '/uploads/avatars/default.png'
        };

        Object.entries(profileElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (id.includes('Avatar')) {
                    element.src = value;
                } else {
                    element.textContent = value;
                }
            }
        });

        // Update stats from real data
        if (document.getElementById('profilePosts')) {
            const posts = await DashboardAPI.loadUserPosts(user.user_id);
            document.getElementById('profilePosts').textContent = posts.length;
            document.getElementById('profileSparks').textContent = posts.reduce((sum, post) => sum + (post.sparks || 0), 0);
        }
    } catch (error) {
        console.error('❌ Failed to load profile:', error);
    }
}

// ================================
// CONNECT PAGE FUNCTIONS
// ================================
function viewUserProfile(userId) {
    const user = mockData.users.find(u => u.id === userId);
    if (!user) return;

    // Create profile modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header">
                <div class="modal-title">${user.name}'s Profile</div>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${user.avatar}" alt="${user.name}" 
                         style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; margin-bottom: 15px; border: 4px solid var(--primary);">
                    <h3>${user.name}</h3>
                    <p style="color: var(--campus-blue);">
                        <i class="fas fa-graduation-cap"></i> ${user.campus}
                    </p>
                    <p>${user.major} • ${user.year}</p>
                    <p style="color: ${user.isOnline ? 'var(--success)' : '#999'};">
                        <i class="fas fa-circle" style="font-size: 10px;"></i>
                        ${user.isOnline ? 'Online now' : 'Offline'}
                    </p>
                </div>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                    <h4 style="margin-bottom: 10px;">Bio</h4>
                    <p>${user.bio}</p>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; margin-bottom: 20px;">
                    <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
                        <div style="font-weight: bold; color: var(--primary);">${user.mutualConnections}</div>
                        <div style="font-size: 12px;">Connections</div>
                    </div>
                    <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
                        <div style="font-weight: bold; color: var(--primary);">${Math.floor(Math.random() * 50)}</div>
                        <div style="font-size: 12px;">Posts</div>
                    </div>
                    <div style="background: white; padding: 10px; border-radius: 8px; border: 1px solid var(--border);">
                        <div style="font-weight: bold; color: var(--primary);">${user.isOnline ? 'Online' : 'Offline'}</div>
                        <div style="font-size: 12px;">Status</div>
                    </div>
                </div>
                
                ${user.isNew ? `
                    <div style="background: var(--success-light); color: var(--success); padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
                        <i class="fas fa-user-plus"></i> New to Sparkle!
                    </div>
                ` : ''}
                
                <div style="display: flex; gap: 10px;">
                    <button class="btn ${user.isConnected ? 'btn-primary' : ''}" style="flex: 2;" id="modalConnectBtn">
                        <i class="fas ${user.isConnected ? 'fa-check' : 'fa-user-plus'}"></i>
                        ${user.isConnected ? 'Connected' : 'Connect'}
                    </button>
                    <button class="btn btn-primary" style="flex: 1;" id="modalMessageBtn">
                        <i class="fas fa-paper-plane"></i> Message
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Connect button
    const connectBtn = modal.querySelector('#modalConnectBtn');
    connectBtn.addEventListener('click', function () {
        connectWithUser(user.id, this);
    });

    // Message button
    const messageBtn = modal.querySelector('#modalMessageBtn');
    messageBtn.addEventListener('click', function () {
        document.body.removeChild(modal);
        startChatWithUser(user.id);
    });

    // Close modal
    modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.classList.contains('close-modal')) {
            document.body.removeChild(modal);
        }
    });
}

function connectWithUser(userId, button) {
    const user = mockData.users.find(u => u.id === userId);
    if (!user) return;

    const newState = !user.isConnected;
    user.isConnected = newState;
    user.mutualConnections += newState ? 1 : -1;

    if (newState) {
        // Connect
        if (button) {
            button.innerHTML = '<i class="fas fa-check"></i> Connected';
            button.classList.add('btn-primary');
        }
        showNotification(`Connected with ${user.name}!`);

        // Add to messages
        mockData.messages.direct.unshift({
            id: mockData.messages.direct.length + 1,
            userId: user.id,
            username: user.username,
            name: user.name,
            avatar: user.avatar,
            lastMessage: "Hi! Just connected with you",
            timestamp: "Just now",
            unread: 0,
            isOnline: user.isOnline,
            lastActive: "Now"
        });
    } else {
        // Disconnect
        if (button) {
            button.innerHTML = '<i class="fas fa-user-plus"></i> Connect';
            button.classList.remove('btn-primary');
        }
        showNotification(`Disconnected from ${user.name}`);
    }

    // Update connect page if open
    if (appState.currentPage === 'connect') {
        loadConnectUsers();
    }
}

function startChatWithUser(userId) {
    const user = mockData.users.find(u => u.id === userId);
    if (!user) return;

    // Create chat modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; max-height: 80vh; display: flex; flex-direction: column;">
            <div class="modal-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${user.avatar}" alt="${user.name}" style="width: 30px; height: 30px; border-radius: 50%;">
                    <div>
                        <div style="font-weight: 600;">${user.name}</div>
                        <div style="font-size: 11px; color: ${user.isOnline ? 'var(--success)' : '#999'}">
                            ${user.isOnline ? 'Online now' : 'Last seen 2h ago'}
                        </div>
                    </div>
                </div>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 15px; background: #f9f9f9;">
                <div style="text-align: center; padding: 20px; color: #999; font-size: 14px;">
                    Start a conversation with ${user.name}!
                </div>
            </div>
            <div style="padding: 15px; border-top: 1px solid var(--border);">
                <div style="display: flex; gap: 10px;">
                    <input type="text" class="form-control" id="chatMessageInput" placeholder="Type a message...">
                    <button class="btn btn-primary" onclick="sendMessageToUser(${userId})">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add enter key support
    const input = modal.querySelector('#chatMessageInput');
    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessageToUser(userId);
        }
    });

    // Close modal
    modal.addEventListener('click', function (e) {
        if (e.target === modal || e.target.classList.contains('close-modal')) {
            document.body.removeChild(modal);
        }
    });

    input.focus();
}

function sendMessageToUser(userId) {
    const input = document.querySelector('#chatMessageInput');
    const message = input?.value.trim();

    if (!message) return;

    const user = mockData.users.find(u => u.id === userId);
    if (!user) return;

    showNotification(`Message sent to ${user.name}`);
    if (input) input.value = '';
}

// ================================
// POST INTERACTION FUNCTIONS
// ================================
async function toggleSpark(postId, button) {
    try {
        const result = await DashboardAPI.sparkPost(postId);
        const sparkCount = button.querySelector('.spark-count');
        let count = parseInt(sparkCount.textContent) || 0;

        if (result.action === 'sparked') {
            button.classList.add('active');
            sparkCount.textContent = count + 1;
            createSparkAnimation(event.clientX || 100, event.clientY || 100);
            showNotification('Post sparked! ✨');
        } else {
            button.classList.remove('active');
            sparkCount.textContent = Math.max(0, count - 1);
        }
    } catch (error) {
        console.error('Spark error:', error);
        showNotification('Failed to spark post.');
    }
}

async function showComments(postId) {
    try {
        const comments = await DashboardAPI.loadComments(postId);

        // Create comments modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.id = `commentsModal-${postId}`;

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; max-height: 80vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <div class="modal-title">Comments (${comments.length})</div>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 15px;">
                    ${comments.length === 0 ? '<p style="text-align: center; color: #999;">No comments yet.</p>' :
                comments.map(comment => `
                        <div style="display: flex; gap: 10px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid var(--border);">
                            <img src="${comment.avatar_url || '/uploads/avatars/default.png'}" style="width: 40px; height: 40px; border-radius: 50%;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
                                    <span style="font-weight: 600;">${comment.user_name || comment.username}</span>
                                    <span style="font-size: 11px; color: #999;">${DashboardAPI.formatTimestamp(comment.created_at)}</span>
                                </div>
                                <div style="margin-bottom: 5px;">${comment.content}</div>
                                <div style="display: flex; align-items: center; gap: 15px; font-size: 12px;">
                                    <button class="btn" style="padding: 0; background: none; color: #666; font-size: 11px;">
                                        <i class="far fa-heart"></i> ${comment.spark_count || 0}
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="padding: 15px; border-top: 1px solid var(--border);">
                    <div class="comment-input-container">
                        <input type="text" class="comment-input" id="commentInput-${postId}" placeholder="Add a comment...">
                        <button class="comment-send-btn" id="sendCommentBtn-${postId}">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const input = document.getElementById(`commentInput-${postId}`);
        const sendBtn = document.getElementById(`sendCommentBtn-${postId}`);

        const performAdd = () => addComment(postId);

        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') performAdd(); });
        sendBtn.addEventListener('click', performAdd);

        // Close modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('close-modal')) {
                document.body.removeChild(modal);
            }
        });

        input.focus();
    } catch (error) {
        console.error('Load comments error:', error);
        showNotification('Failed to load comments.');
    }
}

async function addComment(postId) {
    const input = document.getElementById(`commentInput-${postId}`);
    const content = input?.value.trim();

    if (!content) return;

    try {
        await DashboardAPI.addComment(postId, content);

        // Update comment count in feed UI
        const commentCount = document.querySelector(`[data-post-id="${postId}"] .comment-count`);
        if (commentCount) {
            commentCount.textContent = (parseInt(commentCount.textContent) || 0) + 1;
        }

        // Refresh comments modal
        const oldModal = document.getElementById(`commentsModal-${postId}`);
        if (oldModal) {
            document.body.removeChild(oldModal);
            showComments(postId);
        }

        showNotification('Comment added! ✨');
    } catch (error) {
        console.error('Comment error:', error);
        showNotification('Failed to add comment.');
    }
}

async function toggleSavePost(postId) {
    try {
        const result = await DashboardAPI.savePost(postId);
        const saveBtn = document.querySelector(`[data-post-id="${postId}"] .save-btn`);

        if (result.action === 'saved') {
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-bookmark"></i>';
                saveBtn.classList.add('saved');
            }
            showNotification('Post saved! 🔖');
        } else {
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="far fa-bookmark"></i>';
                saveBtn.classList.remove('saved');
            }
            showNotification('Post removed from saved');
        }
    } catch (error) {
        console.error('Save error:', error);
        showNotification('Failed to save post.');
    }
}

async function sharePost(postId) {
    try {
        await DashboardAPI.sharePost(postId);
        showNotification('Link copied & post shared! 📤');
        // Copy link to clipboard (mock)
        const url = window.location.origin + '/post/' + postId;
        navigator.clipboard.writeText(url).catch(() => { });
    } catch (error) {
        console.error('Share error:', error);
        showNotification('Failed to share post.');
    }
}

// ================================
// MOMENTS FUNCTIONS
// ================================
function handleMomentDoubleClick(momentId, event) {
    // Create spark animation
    createSparkAnimation(event.clientX, event.clientY);

    // Like the moment
    const moment = mockData.moments.find(m => m.id === momentId);
    if (moment && !appState.momentLikes.has(momentId)) {
        moment.likes++;
        appState.momentLikes.add(momentId);

        // Update like count
        const likeElement = document.querySelector(`[data-moment-id="${momentId}"] .fa-heart`).parentElement;
        if (likeElement) {
            likeElement.innerHTML = `<i class="fas fa-heart"></i> ${moment.likes}`;
        }

        showNotification('Liked the moment! ✨');
    }
}

// ================================
// SPARK ANIMATION
// ================================
function createSparkAnimation(x, y) {
    const colors = ['#FF4081', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0'];
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '10000';
    container.style.left = `${x}px`;
    container.style.top = `${y}px`;

    for (let i = 0; i < 12; i++) {
        const spark = document.createElement('div');
        spark.style.position = 'absolute';
        spark.style.width = '8px';
        spark.style.height = '8px';
        spark.style.background = colors[Math.floor(Math.random() * colors.length)];
        spark.style.borderRadius = '50%';
        spark.style.opacity = '0';

        const angle = (i * 30) * (Math.PI / 180);
        const distance = 50 + Math.random() * 50;

        spark.animate([
            {
                opacity: 1,
                transform: `translate(0, 0) scale(1)`,
                offset: 0
            },
            {
                opacity: 0.8,
                transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(1.2)`,
                offset: 0.5
            },
            {
                opacity: 0,
                transform: `translate(${Math.cos(angle) * distance * 1.5}px, ${Math.sin(angle) * distance * 1.5}px) scale(0.5)`,
                offset: 1
            }
        ], {
            duration: 800 + Math.random() * 400,
            easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        });

        container.appendChild(spark);
    }

    document.body.appendChild(container);

    setTimeout(() => {
        if (container.parentNode) {
            document.body.removeChild(container);
        }
    }, 1200);
}

// ================================
// NOTIFICATIONS SYSTEM
// ================================
function loadNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    const unreadCount = mockData.notifications.filter(n => !n.read).length;
    const badge = document.getElementById('notificationCount');
    if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    container.innerHTML = '';

    if (mockData.notifications.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #999;">
                <i class="far fa-bell" style="font-size: 50px; margin-bottom: 15px;"></i>
                <h3>No notifications</h3>
                <p>You're all caught up!</p>
            </div>
        `;
        return;
    }

    mockData.notifications.forEach(notification => {
        const notifEl = document.createElement('div');
        notifEl.className = 'notification-item';
        if (!notification.read) {
            notifEl.classList.add('unread');
        }

        notifEl.innerHTML = `
            <div class="notification-icon" style="background: ${notification.color};">
                <i class="${notification.icon}"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 5px;">${notification.message}</div>
                <div style="font-size: 12px; color: #999;">${notification.timestamp}</div>
            </div>
            ${!notification.read ? '<div style="width: 8px; height: 8px; background: var(--primary); border-radius: 50%;"></div>' : ''}
        `;

        notifEl.addEventListener('click', () => {
            notification.read = true;
            loadNotifications();
            showNotification('Notification marked as read');
        });

        container.appendChild(notifEl);
    });
}

function showNotificationsModal() {
    loadNotifications();
    showModal('notifications');
}

// ================================
// NEW FEATURE FUNCTIONS
// ================================

// MARKETPLACE
function showMarketplace(type) {
    appState.activeMarketplaceTab = type;
    showModal('marketplace');
    loadMarketplaceContent(type);
}

function loadMarketplaceContent(type) {
    const container = document.getElementById('marketplaceContent');
    if (!container) return;

    const items = mockData.marketplace[type] || [];

    // Update tabs
    document.querySelectorAll('[data-market]').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-market') === type) {
            tab.classList.add('active');
        }
    });

    if (items.length === 0) {
        container.innerHTML = `
            < div style = "text-align: center; padding: 40px 20px; color: #999;" >
                <i class="fas fa-store" style="font-size: 50px; margin-bottom: 15px;"></i>
                <h3>No items found</h3>
                <p>Be the first to post in this category!</p>
            </div >
            `;
        return;
    }

    container.innerHTML = '';

    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.padding = '15px';
        itemEl.style.borderBottom = '1px solid var(--border)';
        itemEl.style.display = 'flex';
        itemEl.style.justifyContent = 'space-between';
        itemEl.style.alignItems = 'center';

        itemEl.innerHTML = `
            < div >
                <div style="font-weight: 600; margin-bottom: 5px;">${item.title}</div>
                <div style="font-size: 14px; color: var(--primary); margin-bottom: 5px;">${item.price}</div>
                <div style="font-size: 12px; color: #666;">
                    <i class="fas fa-user"></i> ${item.seller || item.provider}
                    <span style="margin-left: 10px;"><i class="fas fa-graduation-cap"></i> ${item.campus}</span>
                </div>
            </div >
            <div style="text-align: right;">
                <div style="font-size: 12px; color: #999; margin-bottom: 5px;">${item.timestamp}</div>
                <button class="btn btn-primary" style="padding: 5px 15px; font-size: 12px;">
                    <i class="fas fa-shopping-cart"></i> Buy
                </button>
            </div>
        `;

        container.appendChild(itemEl);
    });
}

// LOST & FOUND
function showLostFound(type) {
    appState.activeLostFoundTab = type;
    showModal('lostFound');
    loadLostFoundContent(type);
}

function loadLostFoundContent(type) {
    const container = document.getElementById('lostFoundItems');
    if (!container) return;

    const items = mockData.lostFound[type] || [];

    container.innerHTML = '';

    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.style.padding = '15px';
        itemEl.style.borderBottom = '1px solid var(--border)';
        itemEl.style.marginBottom = '10px';
        itemEl.style.background = '#f9f9f9';
        itemEl.style.borderRadius = '8px';

        const isLost = type === 'lost';

        itemEl.innerHTML = `
            < div style = "display: flex; align-items: center; margin-bottom: 10px;" >
                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${isLost ? 'var(--danger-light)' : 'var(--success-light)'}; 
                            display: flex; align-items: center; justify-content: center; margin-right: 10px;">
                    <i class="fas ${isLost ? 'fa-exclamation-triangle' : 'fa-check-circle'}" 
                       style="color: ${isLost ? 'var(--danger)' : 'var(--success)'};"></i>
                </div>
                <div>
                    <div style="font-weight: 600;">${item.item}</div>
                    <div style="font-size: 12px; color: #666;">
                        <i class="fas fa-map-marker-alt"></i> ${item.location}
                    </div>
                </div>
            </div >
            <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                <i class="fas fa-clock"></i> ${item.timestamp}
                ${item.reward ? `<span style="color: var(--warning); margin-left: 10px;"><i class="fas fa-gift"></i> Reward: ${item.reward}</span>` : ''}
            </div>
            <div style="font-size: 12px;">
                <strong>Contact:</strong> ${item.contact}
            </div>
        `;

        container.appendChild(itemEl);
    });
}

function reportLostItem() {
    showNotification('Report lost item feature coming soon!');
}

// SKILL MARKETPLACE
function showSkillMarket(type) {
    appState.activeSkillMarketTab = type;
    showModal('skillMarket');
    loadSkillMarketContent(type);
}

function loadSkillMarketContent(type) {
    const container = document.getElementById('availableSkills');
    if (!container) return;

    const skills = mockData.skillMarket[type] || [];

    container.innerHTML = '';

    if (skills.length === 0) {
        container.innerHTML = `
            < div style = "text-align: center; padding: 40px 20px; color: #999;" >
                <i class="fas fa-graduation-cap" style="font-size: 50px; margin-bottom: 15px;"></i>
                <h3>No skills available</h3>
                <p>Be the first to offer your skills!</p>
            </div >
            `;
        return;
    }

    skills.forEach(skill => {
        const skillEl = document.createElement('div');
        skillEl.style.padding = '15px';
        skillEl.style.borderBottom = '1px solid var(--border)';
        skillEl.style.marginBottom = '10px';
        skillEl.style.background = 'white';
        skillEl.style.borderRadius = '8px';
        skillEl.style.border = '1px solid var(--border)';

        skillEl.innerHTML = `
            < div style = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;" >
                <div style="font-weight: 600; font-size: 16px;">${skill.skill}</div>
                <div style="font-size: 18px; color: var(--primary); font-weight: bold;">${skill.rate}</div>
            </div >
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 5px;">
                    <i class="fas fa-user" style="color: #666;"></i>
                    <span style="font-size: 14px;">${skill.provider}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <i class="fas fa-star" style="color: #FF9800;"></i>
                    <span style="font-size: 14px;">${skill.rating}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <i class="fas fa-graduation-cap" style="color: #666;"></i>
                    <span style="font-size: 14px;">${skill.campus}</span>
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn" style="flex: 1; font-size: 14px;">
                    <i class="fas fa-envelope"></i> Message
                </button>
                <button class="btn btn-primary" style="flex: 1; font-size: 14px;">
                    <i class="fas fa-calendar"></i> Book Session
                </button>
            </div>
        `;

        container.appendChild(skillEl);
    });
}

function offerSkill() {
    showNotification('Offer skill feature coming soon!');
}

// POLLS
function createPoll() {
    showModal('polls');
    loadPolls();
}

function loadPolls() {
    const container = document.getElementById('activePolls');
    if (!container) return;

    container.innerHTML = '';

    mockData.polls.forEach(poll => {
        const pollEl = document.createElement('div');
        pollEl.style.padding = '15px';
        pollEl.style.border = '1px solid var(--border)';
        pollEl.style.borderRadius = '10px';
        pollEl.style.marginBottom = '15px';
        pollEl.style.background = 'white';

        let optionsHTML = '';
        poll.options.forEach((option, index) => {
            const percentage = poll.totalVotes > 0 ? Math.round((poll.votes[index] / poll.totalVotes) * 100) : 0;
            optionsHTML += `
            < div style = "margin-bottom: 10px;" >
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>${option}</span>
                        <span>${percentage}% (${poll.votes[index]})</span>
                    </div>
                    <div style="height: 10px; background: #f0f0f0; border-radius: 5px; overflow: hidden;">
                        <div style="width: ${percentage}%; height: 100%; background: linear-gradient(45deg, var(--primary), var(--secondary)); border-radius: 5px;"></div>
                    </div>
                </div >
            `;
        });

        pollEl.innerHTML = `
            < div style = "font-weight: 600; margin-bottom: 10px; font-size: 16px;" > ${poll.question}</div >
                ${optionsHTML}
            <div style="font-size: 12px; color: #999; margin-top: 10px; text-align: center;">
                <i class="fas fa-users"></i> ${poll.totalVotes} votes • ${poll.campus} • ${poll.timestamp}
            </div>
            <button class="btn btn-primary" style="width: 100%; margin-top: 10px;" onclick="votePoll(${poll.id})">
                <i class="fas fa-vote-yea"></i> Vote Now
            </button>
        `;

        container.appendChild(pollEl);
    });
}

function votePoll(pollId) {
    showNotification('Vote recorded!');
    loadPolls();
}

function addPollOption() {
    const optionsContainer = document.getElementById('pollOptions');
    const optionCount = optionsContainer.children.length + 1;

    const newOption = document.createElement('input');
    newOption.type = 'text';
    newOption.className = 'form-control';
    newOption.placeholder = `Option ${optionCount} `;
    newOption.style.marginBottom = '5px';

    optionsContainer.appendChild(newOption);
}

// CONFESSIONS
function showConfessionsGallery() {
    showModal('confessions');
    loadEnhancedConfessions();
}

function loadEnhancedConfessions() {
    const container = document.getElementById('confessionsListModal');
    if (!container) return;

    container.innerHTML = '';

    mockData.confessions.forEach((confession, index) => {
        const confessionEl = document.createElement('div');
        confessionEl.style.padding = '15px';
        confessionEl.style.borderBottom = '1px solid var(--border)';
        confessionEl.style.marginBottom = '15px';
        confessionEl.style.background = index < 2 ? '#fff8e1' : 'white';
        confessionEl.style.borderRadius = '10px';
        confessionEl.style.borderLeft = index < 2 ? '4px solid #FF9800' : '1px solid var(--border)';

        confessionEl.innerHTML = `
            < div style = "font-style: italic; font-size: 16px; margin-bottom: 10px; color: #333;" > "${confession.text}"</div >

                ${confession.media ? `
                <img src="${confession.media}" style="width: 100%; border-radius: 8px; margin-bottom: 10px;">
            ` : ''
            }
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: ${index < 2 ? '#FF9800' : '#666'};">
                        <i class="fas fa-fire"></i> ${confession.reactions} reactions
                    </span>
                    <span style="color: var(--campus-blue);">
                        <i class="fas fa-graduation-cap"></i> ${confession.campus}
                    </span>
                    <span style="color: #999; font-size: 12px;">
                        <i class="far fa-comment"></i> ${confession.comments?.length || 0} comments
                    </span>
                </div>
                <span style="color: #999; font-size: 12px;">${confession.timestamp}</span>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button class="btn" style="flex: 1; font-size: 12px; padding: 8px;" onclick="reactToConfession(${confession.id})">
                    <i class="far fa-heart"></i> I feel this
                </button>
                <button class="btn" style="flex: 1; font-size: 12px; padding: 8px;" onclick="shareConfession(${confession.id})">
                    <i class="fas fa-share"></i> Share
                </button>
                <button class="btn" style="flex: 1; font-size: 12px; padding: 8px;" onclick="showConfessionComments(${confession.id})">
                    <i class="far fa-comment"></i> Comment
                </button>
            </div>
        `;

        container.appendChild(confessionEl);
    });
}

function reactToConfession(confessionId) {
    const confession = mockData.confessions.find(c => c.id === confessionId);
    if (confession) {
        confession.reactions++;
        showNotification('Reaction added!');
        loadEnhancedConfessions();
    }
}

function shareConfession(confessionId) {
    showNotification('Confession shared!');
}

function showConfessionComments(confessionId) {
    showNotification('Confession comments coming soon!');
}

// GROUP FEED
function showGroupFeed() {
    showModal('groupFeed');
    loadGroupFeed();
}

function loadGroupFeed() {
    const container = document.getElementById('groupFeedContent');
    if (!container) return;

    container.innerHTML = `
            < div style = "text-align: center; padding: 40px 20px; color: #999;" >
            <i class="fas fa-newspaper" style="font-size: 50px; margin-bottom: 15px;"></i>
            <h3>Group Feed Coming Soon</h3>
            <p>See posts from your groups in one place</p>
        </div >
            `;
}

// GROUP MANAGEMENT
function showGroupManagement() {
    showModal('groupManagement');
    loadGroupManagement();
}

function loadGroupManagement() {
    const container = document.getElementById('groupManagementContent');
    if (!container) return;

    container.innerHTML = `
            < div style = "text-align: center; padding: 40px 20px; color: #999;" >
            <i class="fas fa-user-cog" style="font-size: 50px; margin-bottom: 15px;"></i>
            <h3>Group Management</h3>
            <p>Manage your groups and members here</p>
        </div >
            `;
}

// ABOUT SPARKLE
function showAboutSparkle() {
    showModal('aboutSparkle');
}

// AFTERGLOW VIEWER
let storyTimer = null;
let storyProgressInterval = null;
let isStoryPaused = false;
let storyRemainingTime = 0;
let storyStartTime = 0;
let storyTotalDuration = 0;

function showAfterglowViewer(story) {
    if (!story) return;

    const modal = document.getElementById('afterglowViewer');
    if (!modal) return;

    // Set current index if not already set correctly
    if (currentStoryIndex === -1 || activeStories[currentStoryIndex]?.story_id !== (story.story_id || story.user_id)) {
        currentStoryIndex = activeStories.findIndex(s => (s.story_id || s.user_id) === (story.story_id || story.user_id));
    }

    // Reset previous state
    isStoryPaused = false;
    storyRemainingTime = 0;
    if (storyTimer) clearTimeout(storyTimer);
    if (storyProgressInterval) clearInterval(storyProgressInterval);

    // Clear progress bars container and recreate based on story count
    const progressBarContainer = document.querySelector('.afterglow-progress');
    if (progressBarContainer) {
        progressBarContainer.innerHTML = '';
        activeStories.forEach((s, idx) => {
            const bar = document.createElement('div');
            bar.className = 'progress-segment-wrapper';
            const inner = document.createElement('div');
            inner.className = 'progress-segment-inner';
            if (idx < currentStoryIndex) inner.style.width = '100%';
            if (idx === currentStoryIndex) inner.id = 'activeProgressBar';
            bar.appendChild(inner);
            progressBarContainer.appendChild(bar);
        });
    }

    const mediaContainer = document.getElementById('viewerMedia');
    const avatar = document.getElementById('viewerAvatar');
    const username = document.getElementById('viewerUsername');
    const time = document.getElementById('viewerTime');
    const campus = document.getElementById('viewerCampus');
    const caption = document.getElementById('viewerCaption');

    // Set user info
    if (avatar) avatar.src = story.avatar_url || story.avatar || '/uploads/avatars/default.png';
    if (username) username.textContent = story.username || story.name;
    if (time) time.textContent = story.timestamp || 'Just now';
    if (campus) campus.textContent = story.campus || 'Campus';
    if (caption) caption.textContent = story.caption || '';

    // Handle Media
    mediaContainer.innerHTML = '';
    const mediaUrl = story.media_url || story.media;
    const isVideo = mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);

    if (isVideo) {
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.autoplay = true;
        video.muted = false;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain'; // Show full visibility
        mediaContainer.appendChild(video);

        video.onloadedmetadata = () => {
            startStoryTimer(video.duration * 1000);
        };
        video.onerror = () => {
            console.error("Video failed to load:", mediaUrl);
            startStoryTimer(5000);
        };
    } else {
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain'; // Show full visibility
        mediaContainer.appendChild(img);

        startStoryTimer(5000);
    }

    modal.style.display = 'flex';
}

function startStoryTimer(duration) {
    storyTotalDuration = duration;
    storyRemainingTime = duration;
    storyStartTime = Date.now();

    const progressBar = document.getElementById('activeProgressBar');

    if (storyProgressInterval) clearInterval(storyProgressInterval);

    storyProgressInterval = setInterval(() => {
        if (isStoryPaused) return;

        let elapsed = Date.now() - storyStartTime;
        let progress = ((storyTotalDuration - storyRemainingTime + elapsed) / storyTotalDuration) * 100;
        if (progressBar) progressBar.style.width = Math.min(progress, 100) + '%';

        if (elapsed >= storyRemainingTime) {
            clearInterval(storyProgressInterval);
            nextStory();
        }
    }, 50);

    if (storyTimer) clearTimeout(storyTimer);
    storyTimer = setTimeout(() => {
        if (!isStoryPaused) nextStory();
    }, storyRemainingTime);
}

function pauseStory() {
    if (isStoryPaused || currentStoryIndex === -1) return;
    isStoryPaused = true;

    const video = document.querySelector('#viewerMedia video');
    if (video) video.pause();

    let elapsed = Date.now() - storyStartTime;
    storyRemainingTime -= elapsed;
    if (storyRemainingTime < 0) storyRemainingTime = 0;

    if (storyTimer) clearTimeout(storyTimer);
}

function resumeStory() {
    if (!isStoryPaused || currentStoryIndex === -1) return;
    isStoryPaused = false;

    const video = document.querySelector('#viewerMedia video');
    if (video) video.play();

    storyStartTime = Date.now();

    if (storyTimer) clearTimeout(storyTimer);
    storyTimer = setTimeout(() => {
        if (!isStoryPaused) nextStory();
    }, storyRemainingTime);
}

function nextStory() {
    if (currentStoryIndex < activeStories.length - 1) {
        currentStoryIndex++;
        showAfterglowViewer(activeStories[currentStoryIndex]);
    } else {
        closeAfterglowViewer();
    }
}

function prevStory() {
    if (currentStoryIndex > 0) {
        currentStoryIndex--;
        showAfterglowViewer(activeStories[currentStoryIndex]);
    } else {
        showAfterglowViewer(activeStories[currentStoryIndex]);
    }
}

function closeAfterglowViewer() {
    const modal = document.getElementById('afterglowViewer');
    if (modal) modal.style.display = 'none';

    currentStoryIndex = -1;
    if (storyTimer) clearTimeout(storyTimer);
    if (storyProgressInterval) clearInterval(storyProgressInterval);

    const mediaContainer = document.getElementById('viewerMedia');
    if (mediaContainer) {
        const video = mediaContainer.querySelector('video');
        if (video) video.pause();
        mediaContainer.innerHTML = '';
    }
}

// ================================
// BADGE UPDATES
// ================================
function updateBadgeCounts() {
    // Update all badge counts
    const lostBadge = document.getElementById('lostItemsBadge');
    const foundBadge = document.getElementById('foundItemsBadge');
    const tutorsBadge = document.getElementById('tutorsBadge');
    const groupsBadge = document.getElementById('groupsCountBadge');
    const confessionsBadge = document.getElementById('confessionsBadge');
    const secondhandBadge = document.getElementById('secondhandBadge');
    const eventsBadge = document.getElementById('eventsBadge');

    if (lostBadge) lostBadge.textContent = mockData.lostFound.lost.length;
    if (foundBadge) foundBadge.textContent = mockData.lostFound.found.length;
    if (tutorsBadge) tutorsBadge.textContent = mockData.skillMarket.tutoring.length;
    if (groupsBadge) groupsBadge.textContent = mockData.groups.filter(g => g.isJoined).length;
    if (confessionsBadge) confessionsBadge.textContent = mockData.confessions.length;
    if (secondhandBadge) secondhandBadge.textContent = mockData.marketplace.secondhand.length;
    if (eventsBadge) eventsBadge.textContent = Math.floor(Math.random() * 10) + 1;
}

// ================================
// HELPER FUNCTIONS
// ================================
function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.background = 'var(--primary)';
    notification.style.color = 'white';
    notification.style.padding = '12px 20px';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    notification.style.zIndex = '10001';
    notification.style.fontSize = '14px';
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            document.body.removeChild(notification);
        }
    }, 3000);
}

function toggleAnonymousMode() {
    appState.isAnonymousMode = !appState.isAnonymousMode;
    showNotification(`Anonymous mode ${appState.isAnonymousMode ? 'enabled' : 'disabled'} `);
}

function toggleDarkMode() {
    appState.isDarkMode = !appState.isDarkMode;
    document.body.classList.toggle('dark-mode', appState.isDarkMode);
    showNotification(`Dark mode ${appState.isDarkMode ? 'enabled' : 'disabled'} `);
}

function editProfile() {
    showNotification('Edit profile feature coming soon!');
}

function createGroup() {
    showNotification('Create group feature coming soon!');
}

function uploadMoment() {
    showNotification('Upload moment feature coming soon!');
}

function manageGroup(groupId) {
    showNotification(`Manage group ${groupId} feature coming soon!`);
}

function openGroupChat(groupChat) {
    showNotification(`Open group chat: ${groupChat.name} `);
}

function openAnonymousChat(chat) {
    showNotification(`Open anonymous chat: ${chat.name} `);
}

function startChat(contact) {
    showNotification(`Start chat with ${contact.name} feature coming soon!`);
}

function shareToAfterGlow() {
    showNotification('Shared to AfterGlow!');
}

function reactToAfterglow(reaction) {
    showNotification(`Reacted with ${reaction} !`);
}

function shareAfterglowToGroup() {
    showNotification('Shared to group!');
}

function shareAfterglowToFriends() {
    showNotification('Shared with friends!');
}

function addConfessionMedia() {
    showNotification('Add confession media feature coming soon!');
}

function addLostFoundMedia() {
    showNotification('Add lost & found media feature coming soon!');
}

function messageUser(username) {
    showNotification(`Message user ${username} feature coming soon!`);
}

function clearNotifications() {
    mockData.notifications.forEach(n => n.read = true);
    loadNotifications();
    showNotification('Notifications cleared');
}

function startLiveStream() {
    showNotification('Live streaming feature coming soon!');
}

function viewEvents() {
    showNotification('Campus events feature coming soon!');
}

// ================================
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', function () {
    console.log("🎉 Sparkle Dashboard Initialized!");

    // Initialize the app
    // Detect active page from HTML
    const activePage = document.querySelector('.page.active');
    const startPage = activePage ? activePage.id.replace('Page', '') : 'home';
    switchPage(startPage);

    // Setup event listeners
    setupEventListeners();

    // Update badge counts
    updateBadgeCounts();

    // Load notifications
    loadNotifications();
});

function setupEventListeners() {
    // Hamburger menu
    document.getElementById('closeHamburger')?.addEventListener('click', hideHamburger);
    document.getElementById('hamburgerOverlay')?.addEventListener('click', hideHamburger);

    // Notification bell
    document.getElementById('notificationIcon')?.addEventListener('click', showNotificationsModal);

    // Polls icon
    document.getElementById('pollsIcon')?.addEventListener('click', createPoll);

    // Modal close buttons
    const modals = ['enhancedSettings', 'polls', 'marketplace', 'lostFound', 'skillMarket',
        'groupManagement', 'aboutSparkle', 'groupFeed', 'notifications',
        'confessions', 'afterglowViewer'];

    modals.forEach(modal => {
        const closeBtn = document.getElementById('close' + modal.charAt(0).toUpperCase() + modal.slice(1));
        if (closeBtn) {
            closeBtn.addEventListener('click', () => hideModal(modal));
        }
    });

    // Message type tabs
    document.querySelectorAll('[data-message-type]').forEach(tab => {
        tab.addEventListener('click', function () {
            const type = this.getAttribute('data-message-type');
            document.querySelectorAll('[data-message-type]').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            loadMessages(type);
        });
    });

    // Profile tabs
    document.querySelectorAll('[data-tab]').forEach(tab => {
        tab.addEventListener('click', function () {
            const tabType = this.getAttribute('data-tab');
            document.querySelectorAll('[data-tab]').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            // Load appropriate content for profile tab
        });
    });

    // Marketplace tabs
    document.querySelectorAll('[data-market]').forEach(tab => {
        tab.addEventListener('click', function () {
            const market = this.getAttribute('data-market');
            loadMarketplaceContent(market);
        });
    });

    // Anonymous mode button
    document.getElementById('anonymousBtn')?.addEventListener('click', toggleAnonymousMode);

    // Confessions button
    document.getElementById('confessionsBtn')?.addEventListener('click', showConfessionsGallery);

    // Close create modal
    document.getElementById('closeCreateModal')?.addEventListener('click', () => hideModal('create'));
    document.getElementById('closeMomentModal')?.addEventListener('click', () => hideModal('moment'));
    document.getElementById('closeAfterglowModal')?.addEventListener('click', () => hideModal('afterglow'));

    // Submit post button
    document.getElementById('submitPostBtn')?.addEventListener('click', window.submitPost);

    // Submit moment button
    document.getElementById('submitMomentBtn')?.addEventListener('click', async function () {
        const fileInput = document.getElementById('momentVideoUpload');
        const caption = document.getElementById('momentCaption')?.value || '';

        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            showNotification('Please select a video first', 'error');
            return;
        }

        const file = fileInput.files[0];
        console.log('📤 Uploading moment video...');

        try {
            const formData = new FormData();
            formData.append('media', file);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('sparkleToken')}` },
                body: formData
            });

            if (!uploadResponse.ok) throw new Error('Upload failed');
            const { url: media_url } = await uploadResponse.json();

            // Create moment (you can add a moments API endpoint or reuse posts)
            console.log('✅ Moment uploaded:', media_url);
            showNotification('Moment shared!');
            hideModal('moment');
            fileInput.value = '';
            document.getElementById('momentCaption').value = '';
            document.getElementById('momentPreview').innerHTML = '';
        } catch (error) {
            console.error('❌ Moment upload failed:', error);
            showNotification('Failed to share moment', 'error');
        }
    });

    // Submit afterglow button
    document.getElementById('submitAfterglowBtn')?.addEventListener('click', async function () {
        if (isSubmittingAfterglow) {
            console.log('⚠️ Submission already in progress, ignoring click.');
            return;
        }

        const btn = this;
        const fileInput = document.getElementById('afterglowMediaUpload');
        const caption = document.getElementById('afterglowCaption')?.value || '';

        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            showNotification('Please select a photo or video first', 'error');
            return;
        }

        if (btn.disabled) return;

        // Global lock and visual state
        isSubmittingAfterglow = true;
        btn.disabled = true;
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<span>Sharing...</span> <i class="fas fa-spinner fa-spin"></i>';

        const file = fileInput.files[0];
        console.log('📤 Uploading AfterGlow story...');

        try {
            const formData = new FormData();
            formData.append('media', file);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('sparkleToken')}` },
                body: formData
            });

            if (!uploadResponse.ok) throw new Error('Upload failed');
            const { url: media_url } = await uploadResponse.json();

            // Create story
            const storyResponse = await fetch('/api/stories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('sparkleToken')}`
                },
                body: JSON.stringify({ media_url, caption })
            });

            if (!storyResponse.ok) throw new Error('Story creation failed');

            console.log('✅ AfterGlow story created');
            showNotification('AfterGlow shared!');
            hideModal('afterglow');
            fileInput.value = '';
            document.getElementById('afterglowCaption').value = '';
            document.getElementById('afterglowPreview').innerHTML = '';

            // Reload stories
            if (window.loadAfterglowStories) window.loadAfterglowStories();

            // Reset button state for next time
            btn.disabled = false;
            btn.innerHTML = originalContent;
            isSubmittingAfterglow = false;
        } catch (error) {
            console.error('❌ AfterGlow creation failed:', error);
            showNotification('Failed to share AfterGlow', 'error');

            // Re-enable button on error
            btn.disabled = false;
            btn.innerHTML = originalContent;
            isSubmittingAfterglow = false;
        }
    });

    // File input handlers for preview
    document.getElementById('momentVideoUpload')?.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const preview = document.getElementById('momentPreview');
            preview.innerHTML = `<video src="${URL.createObjectURL(file)}" controls style="width: 100%; border-radius: 12px; margin-top: 10px;"></video>`;
        }
    });

    document.getElementById('afterglowMediaUpload')?.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const preview = document.getElementById('afterglowPreview');
            const isVideo = file.type.startsWith('video/');
            const url = URL.createObjectURL(file);
            preview.innerHTML = isVideo
                ? `<video src="${url}" controls style="width: 100%; border-radius: 12px; margin-top: 10px;"></video>`
                : `<img src="${url}" style="width: 100%; border-radius: 12px; margin-top: 10px;">`;
        }
    });

    // Post type selector logic
    document.querySelectorAll('.post-type-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.post-type-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Edit profile button
    document.getElementById('editProfileBtn')?.addEventListener('click', editProfile);

    // Create group button
    document.getElementById('createGroupBtn')?.addEventListener('click', createGroup);

    // New message button
    document.getElementById('newMessageBtn')?.addEventListener('click', () => {
        showNotification('New message feature coming soon!');
    });
}

// ================================
// MAKE FUNCTIONS GLOBALLY AVAILABLE
// ================================
window.switchPage = switchPage;
window.showModal = showModal;
window.hideModal = hideModal;
window.toggleHamburger = toggleHamburger;
window.hideHamburger = hideHamburger;
window.showEnhancedSettings = () => showModal('enhancedSettings');
window.showMarketplace = showMarketplace;
window.showLostFound = showLostFound;
window.showSkillMarket = showSkillMarket;
window.reportLostItem = reportLostItem;
window.offerSkill = offerSkill;
window.showConfessionsGallery = showConfessionsGallery;
window.showAboutSparkle = showAboutSparkle;
window.showGroupManagement = showGroupManagement;
window.showGroupFeed = showGroupFeed;
window.startLiveStream = startLiveStream;
window.createPoll = createPoll;
window.viewEvents = viewEvents;
window.shareToAfterGlow = shareToAfterGlow;
window.reactToAfterglow = reactToAfterglow;
window.shareAfterglowToGroup = shareAfterglowToGroup;
window.shareAfterglowToFriends = shareAfterglowToFriends;
window.addConfessionMedia = addConfessionMedia;
window.addPollOption = addPollOption;
window.addLostFoundMedia = addLostFoundMedia;
window.sendComment = addComment;
window.messageUser = messageUser;
window.showNotifications = showNotificationsModal;
window.clearNotifications = clearNotifications;
window.toggleAnonymousMode = toggleAnonymousMode;
window.toggleDarkMode = toggleDarkMode;
window.editProfile = editProfile;
window.createGroup = createGroup;
window.uploadMoment = uploadMoment;
window.startChat = startChat;
window.openGroupChat = openGroupChat;
window.openAnonymousChat = openAnonymousChat;
window.manageGroup = manageGroup;
window.toggleSpark = toggleSpark;
window.showComments = showComments;
window.addComment = addComment;
window.toggleSavePost = toggleSavePost;
window.sharePost = sharePost;
window.viewUserProfile = viewUserProfile;
window.connectWithUser = connectWithUser;
window.connectUser = connectWithUser; // Alias for compatibility
window.startChatWithUser = startChatWithUser;
window.sendMessageToUser = sendMessageToUser;
window.votePoll = votePoll;
window.reactToConfession = reactToConfession;
window.shareConfession = shareConfession;
window.showConfessionComments = showConfessionComments;

// Post Creation Logic
window.submitPost = async function () {
    const caption = document.getElementById('postCaption').value.trim();
    const tags = document.getElementById('postTags').value.trim();
    const postTypeBtn = document.querySelector('.type-chip.active') || document.querySelector('.post-type-btn.active');
    const postType = postTypeBtn ? postTypeBtn.getAttribute('data-post-type') : 'public';

    // In a real app, we'd handle file upload here. 
    // For now, we'll check if a file was selected but we'll mock the URL if needed.
    const mediaInput = document.getElementById('mediaUpload');
    let mediaUrl = null;

    if (mediaInput && mediaInput.files && mediaInput.files[0]) {
        // Placeholder for file upload logic
        console.log("File selected for upload:", mediaInput.files[0].name);
        // showNotification("File upload is not fully implemented yet, sending post without media.");
    }

    if (!caption) {
        showNotification("Please enter some content for your post!");
        return;
    }

    const submitBtn = document.getElementById('submitPostBtn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

    try {
        const postData = {
            content: caption,
            post_type: postType,
            tags: tags,
            media_url: mediaUrl
        };

        const result = await DashboardAPI.createPost(postData);
        console.log("Post created successfully:", result);

        showNotification("Post shared successfully! ✨");
        hideModal('create');

        // Reset form
        document.getElementById('postCaption').value = '';
        document.getElementById('postTags').value = '';
        if (mediaInput) mediaInput.value = '';
        const preview = document.getElementById('mediaPreview');
        if (preview) preview.innerHTML = '';

        // Refresh feed
        window.forceFeedRefresh = true;
        loadFeedPosts();
    } catch (error) {
        console.error("Failed to create post:", error);
        showNotification("Failed to share post. Please try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
};

console.log("🚀 Sparkle Dashboard Fully Loaded!");
console.log("👥 All 20 mock users are ready to load in Connect page");
