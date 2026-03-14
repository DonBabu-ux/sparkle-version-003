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

    // Initialize data logic
    initializeByPath();
    initSync();

    console.log('✅ Sparkle Dynamic Patch Initialized successfully!');
});

// Port globals for compatibility with inline scripts
window.sparkPost = (postId, btn) => import('./features/feed.js').then(m => m.toggleSpark(postId, btn));
window.toggleSpark = (postId, btn) => import('./features/feed.js').then(m => m.toggleSpark(postId, btn));
window.savePost = (postId, btn) => import('./features/feed.js').then(m => m.savePost(postId, btn));
window.sharePost = (postId) => import('./features/feed.js').then(m => m.sharePost(postId));
window.addComment = (postId, input) => import('./features/feed.js').then(m => m.addComment(postId, input));
window.toggleComments = (postId) => import('./features/feed.js').then(m => m.toggleComments(postId));

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
