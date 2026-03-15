// search.js
export function initSearch() {
    const searchInput = document.getElementById('universalSearchInput');
    const resultsPanel = document.getElementById('searchResultsPanel');

    if (!searchInput || !resultsPanel) return;

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        clearTimeout(debounceTimer);
        if (query.length < 2) {
            resultsPanel.classList.remove('active');
            return;
        }

        debounceTimer = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    // Hide results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !resultsPanel.contains(e.target)) {
            resultsPanel.classList.remove('active');
        }
    });

    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2) {
            resultsPanel.classList.add('active');
        }
    });
}

async function performSearch(query) {
    const resultsPanel = document.getElementById('searchResultsPanel');
    if (!resultsPanel) return;

    resultsPanel.innerHTML = '<div style="padding: 20px; text-align: center;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    resultsPanel.classList.add('active');

    try {
        const response = await window.DashboardAPI.request(`/search?q=${encodeURIComponent(query)}&type=all`);
        const results = response.data?.results || {};

        if (!results || (Object.keys(results).every(key => results[key].length === 0))) {
            resultsPanel.innerHTML = '<div style="padding: 20px; text-align: center; color: #65676b;">No results found for "' + query + '"</div>';
            return;
        }

        let html = '';

        // Prioritize Users
        if (results.users && results.users.length > 0) {
            html += '<div style="padding: 8px 16px; font-size: 12px; font-weight: 700; color: #65676b; background: #f8f9fa; border-bottom: 1px solid #eee;">PEOPLE</div>';
            results.users.forEach(user => {
                html += `
                    <div class="search-result-item" onclick="window.location.href='/profile/${user.subtitle}'">
                        <img src="${user.image || '/uploads/avatars/default.png'}" class="search-result-img">
                        <div class="search-result-info">
                            <div class="search-result-title">${user.title}</div>
                            <div class="search-result-type">@${user.subtitle}</div>
                        </div>
                    </div>
                `;
            });
        }

        // Posts
        if (results.posts && results.posts.length > 0) {
            html += '<div style="padding: 8px 16px; font-size: 12px; font-weight: 700; color: #65676b; background: #f8f9fa; border-bottom: 1px solid #eee; border-top: 1px solid #eee;">POSTS</div>';
            results.posts.slice(0, 5).forEach(post => {
                html += `
                    <div class="search-result-item" onclick="window.openPostViewer('${post.id}')">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: #eee; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            ${post.image ? `<img src="${post.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '<i class="far fa-file-alt"></i>'}
                        </div>
                        <div class="search-result-info">
                            <div class="search-result-title">${post.description.substring(0, 50)}...</div>
                            <div class="search-result-type">by @${post.subtitle}</div>
                        </div>
                    </div>
                `;
            });
        }

        // Hashtags
        if (results.hashtags && results.hashtags.length > 0) {
             html += '<div style="padding: 8px 16px; font-size: 12px; font-weight: 700; color: #65676b; background: #f8f9fa; border-bottom: 1px solid #eee; border-top: 1px solid #eee;">HASHTAGS</div>';
             results.hashtags.forEach(tag => {
                 html += `
                    <div class="search-result-item" onclick="window.location.href='/search?q=${encodeURIComponent(tag.value)}&type=posts'">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #f0f2f5; display: flex; align-items: center; justify-content: center; font-weight: 700;">#</div>
                        <div class="search-result-info">
                            <div class="search-result-title">#${tag.value}</div>
                            <div class="search-result-type">Trending topic</div>
                        </div>
                    </div>
                 `;
             });
        }

        resultsPanel.innerHTML = html;

    } catch (error) {
        console.error('Search error:', error);
        resultsPanel.innerHTML = '<div style="padding: 20px; text-align: center; color: red;">Error performing search</div>';
    }
}
