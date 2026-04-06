// initialization.js
import { loadFeedPosts } from '../features/feed.js';
import { loadAfterglowStories } from '../features/stories.js';
import { loadGroups } from '../features/groups.js';
import { loadMarketplace } from '../features/marketplace.js';
import { loadLostFoundContent } from '../features/lost-found.js';
import { loadSkillMarketContent } from '../features/skill-market.js';

export function initializeByPath() {
    const path = window.location.pathname;
    console.log(`📱 Initializing features for path: ${path}`);

    if (path.includes('/lost-found')) {
        loadLostFoundContent('all');
    } else if (path.includes('/marketplace')) {
        loadMarketplace('all');
    } else if (path.includes('/skill-market')) {
        loadSkillMarketContent('all');
    } else if (path.includes('/groups')) {
        loadGroups();
    } else if (path === '/dashboard' || path === '/' || path.includes('index')) {
        loadFeedPosts();
        loadAfterglowStories();
    }
}
