// index.js

// Import core modules
import { initErrorHandler } from './core/error-handler.js';
import { initModals } from './ui/modals.js';
import { initNotifications } from './ui/notifications.js';
import { initFabButton } from './ui/fab-button.js';
import { initMobileFixes } from './ui/mobile-fixes.js';
import { initHubs } from './ui/hubs.js';
import { initPostMenu } from './ui/post-menu.js';

// Import features
import { initFeed } from './features/feed.js';
import { initStories } from './features/stories.js';
import { initProfile } from './features/profile.js';
import { initMoments } from './features/moments.js';
import { initSuggestions } from './features/suggestions.js';
import { initSearch } from './features/search.js';

// Import data modules
import { initializeByPath } from './data/initialization.js';
import { initSync } from './data/sync.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Sparkle Dynamic Patch (Modular) Initializing...');

    // Initialize core UI and systems
    initErrorHandler();
    initModals();
    initNotifications();
    initFabButton();
    initMobileFixes();
    initHubs();
    initPostMenu();

    // Initialize features
    initFeed();
    initStories();
    initProfile();
    initMoments();
    initSuggestions();
    initSearch();

    // Initialize data logic
    initializeByPath();
    initSync();

    console.log('✅ Sparkle Dynamic Patch Initialized successfully!');

    // Handle Deep Linking (Comments/Notifications)
    const urlParams = new URLSearchParams(window.location.search);
    const postToOpen = urlParams.get('openComments');
    const commentToTarget = urlParams.get('targetCommentId');
    if (postToOpen) {
        setTimeout(() => {
            window.openComments(postToOpen, commentToTarget);
        }, 1200); // Allow feed to load
    }
});

// Port globals for compatibility with inline scripts
window.sparkPost = (postId, btn) => import('./features/feed.js').then(m => m.toggleSpark(postId, btn));
window.toggleSpark = (postId, btn) => import('./features/feed.js').then(m => m.toggleSpark(postId, btn));
window.savePost = (postId, btn) => import('./features/feed.js').then(m => m.savePost(postId, btn));
window.sharePost = (postId) => import('./features/feed.js').then(m => m.sharePost(postId));
window.openComments = (postId, targetId) => import('./features/feed.js').then(m => m.openComments(postId, targetId));
window.closeComments = () => import('./features/feed.js').then(m => m.closeComments());
window.submitComment = () => import('./features/feed.js').then(m => m.submitComment());
window.filterComments = (query) => import('./features/feed.js').then(m => m.filterComments(query));
window.likeComment = (commentId) => import('./features/feed.js').then(m => m.likeComment(commentId));
window.replyToComment = (commentId) => import('./features/feed.js').then(m => m.replyToComment(commentId));
window.openPostViewer = (postId) => import('./features/feed.js').then(m => m.openPostViewer(postId));
window.closePostViewer = () => import('./features/feed.js').then(m => m.closePostViewer());
window.toggleViewerLike = () => import('./features/feed.js').then(m => m.toggleViewerLike());
window.postViewerComment = () => import('./features/feed.js').then(m => m.postViewerComment());
window.sharePostFromViewer = () => import('./features/feed.js').then(m => m.sharePostFromViewer());
window.savePostFromViewer = () => import('./features/feed.js').then(m => m.savePostFromViewer());
window.notInterestedFromViewer = () => import('./features/feed.js').then(m => m.notInterestedFromViewer());
window.reportPostFromViewer = () => import('./features/feed.js').then(m => m.reportPostFromViewer());
window.copyLinkFromViewer = () => import('./features/feed.js').then(m => m.copyLinkFromViewer());
window.expandCaption = (postId, fullText) => import('./features/feed.js').then(m => m.expandCaption(postId, fullText));
window.loadMorePosts = () => import('./features/feed.js').then(m => m.loadMorePosts());

window.viewAfterglow = (story) => import('./features/stories.js').then(m => m.showAfterglowViewer(story));
window.openStoryViewer = (userId) => import('./features/stories.js').then(m => m.openStoryViewer(userId));
window.closeAfterglowViewer = () => {
    // Rely on stories.js cleanup if possible, but this is a fallback
    const modal = document.querySelector('.afterglow-viewer-modal');
    if (modal && modal._cleanup) modal._cleanup();
    else if (modal) modal.remove();
};
window.uploadAfterglowMedia = () => import('./features/stories.js').then(m => m.uploadAfterglowMedia());
window.showCreateOptions = () => import('./ui/fab-button.js').then(m => m.showCreateOptions());
window.openCreateModal = () => document.getElementById('createModal').style.display = 'flex';
window.openMomentModal = () => import('./features/moments.js').then(m => m.uploadMoment());
window.openAfterglowModal = () => import('./features/stories.js').then(m => m.uploadAfterglowMedia());

window.startChat = (contact) => import('./features/messages.js').then(m => m.startChat(contact));
window.loadMarketplace = (cat) => import('./features/marketplace.js').then(m => m.loadMarketplace(cat));
window.createGroup = () => import('./features/groups.js').then(m => m.createGroup());
window.loadGroups = () => import('./features/groups.js').then(m => m.loadGroups());
