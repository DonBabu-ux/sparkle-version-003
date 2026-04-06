/**
 * Groups Prototype UI Manager
 * Handles frontend state, interactions, and DOM rendering using MockData
 */

const GroupsProto = {
    state: {
        activePage: 'discover', // discover, view
        activeGroup: null,
        activeTab: 'posts',
        mockData: window.MockData,
        filters: 'all' // all, my, managed
    },

    init() {
        console.log('🚀 Sparkle Groups Prototype Initialized');
        this.renderDiscoverPage();
        this.setupEvents();
    },

    setupEvents() {
        document.addEventListener('click', (e) => {
            // Tab switching
            if (e.target.closest('.tab-btn')) {
                const btn = e.target.closest('.tab-btn');
                this.state.filters = btn.dataset.filter;
                this.renderDiscoverPage();
            }

            // Join/Leave logic
            if (e.target.closest('.btn-join-toggle')) {
                const btn = e.target.closest('.btn-join-toggle');
                const gid = parseInt(btn.dataset.gid);
                this.toggleJoin(gid);
                // Prevent card click
                e.stopPropagation();
            }

            // Card Click -> View Group
            if (e.target.closest('.group-discovery-card')) {
                const card = e.target.closest('.group-discovery-card');
                const gid = parseInt(card.dataset.gid);
                this.viewGroup(gid);
            }

            // View Tabs (Posts, About, etc.)
            if (e.target.closest('.v-nav-item')) {
                const navItem = e.target.closest('.v-nav-item');
                this.switchViewTab(navItem.dataset.tab);
            }

            // Back to Discovery
            if (e.target.closest('#backToDiscovery')) {
                this.renderDiscoverPage();
            }

            // Admin Tools
            if (e.target.closest('#openAdminTools')) {
                this.openAdminModal();
            }

            // Modal Taps
            if (e.target.closest('.m-tab')) {
                this.switchAdminTab(e.target.closest('.m-tab').dataset.tab);
            }

            // Close Modal
            if (e.target.closest('.close-modal') || e.target.classList.contains('proto-modal')) {
                document.getElementById('adminModal').style.display = 'none';
            }
        });
    },

    renderDiscoverPage() {
        this.state.activePage = 'discover';
        const container = document.getElementById('protoBody');
        
        let groups = this.state.mockData.groups;
        if (this.state.filters === 'my') groups = groups.filter(g => g.isMember);
        if (this.state.filters === 'managed') groups = groups.filter(g => g.role === 'admin');

        container.innerHTML = `
            <div class="proto-container">
                <div class="discovery-header">
                    <input type="text" class="search-bar-glass" placeholder="Search groups by name or topic...">
                    <div class="tab-group">
                        <button class="tab-btn ${this.state.filters === 'all' ? 'active' : ''}" data-filter="all">All Groups</button>
                        <button class="tab-btn ${this.state.filters === 'my' ? 'active' : ''}" data-filter="my">My Groups</button>
                        <button class="tab-btn ${this.state.filters === 'managed' ? 'active' : ''}" data-filter="managed">Managed Groups</button>
                    </div>
                </div>

                <div class="group-grid">
                    ${groups.map(g => this.renderGroupCard(g)).join('')}
                </div>
            </div>
        `;
    },

    renderGroupCard(g) {
        let joinBtn = `<button class="btn-sparkle btn-join-toggle" data-gid="${g.id}">Join Group</button>`;
        if (g.isMember) joinBtn = `<button class="btn-sparkle secondary btn-join-toggle" data-gid="${g.id}">Joined</button>`;
        if (!g.isMember && g.status === 'pending') joinBtn = `<button class="btn-sparkle secondary" style="opacity:0.6;" disabled>Requested</button>`;

        return `
            <div class="glass-card group-discovery-card" data-gid="${g.id}">
                <div class="card-cover">
                    <img src="${g.cover}" alt="Cover">
                    <div class="card-icon-overlay">
                        <img src="${g.icon}" alt="Icon">
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-category">${g.category}</div>
                    <h3 class="card-name">${g.name}</h3>
                    <div class="card-members">${g.members} Members</div>
                    <p class="card-bio">${g.description}</p>
                    <div class="card-actions">
                        ${joinBtn}
                    </div>
                </div>
            </div>
        `;
    },

    viewGroup(gid) {
        this.state.activePage = 'view';
        this.state.activeGroup = this.state.mockData.groups.find(g => g.id === gid);
        this.state.activeTab = 'posts';
        this.renderGroupView();
    },

    renderGroupView() {
        const g = this.state.activeGroup;
        const container = document.getElementById('protoBody');

        let actionBtn = `<button class="btn-sparkle btn-join-toggle" data-gid="${g.id}"><i class="fas fa-plus"></i> Join Group</button>`;
        if (g.isMember) {
           actionBtn = g.role === 'admin' 
           ? `<button class="btn-sparkle" id="openAdminTools"><i class="fas fa-cog"></i> Admin Tools</button>`
           : `<button class="btn-sparkle btn-join-toggle" data-gid="${g.id}"><i class="fas fa-check"></i> Joined</button>`;
        }

        container.innerHTML = `
            <div class="glass-card group-header-view">
                <div class="card-cover view-cover">
                    <img src="${g.cover}" alt="Cover">
                    <button id="backToDiscovery" style="position:absolute; top:20px; left:20px; background:rgba(0,0,0,0.5); border:none; color:#fff; padding:10px 15px; border-radius:10px; cursor:pointer;">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                </div>
                <div class="view-content-header">
                    <div class="view-icon">
                        <img src="${g.icon}" />
                    </div>
                    <div class="view-main-info">
                        <h1 class="view-name">${g.name}</h1>
                        <div class="view-meta">
                            <span><i class="fas fa-users"></i> ${g.members} Members</span>
                            <span><i class="fas fa-${g.privacy === 'public' ? 'globe-africa' : 'lock'}"></i> ${g.privacy === 'public' ? 'Public' : 'Private'} Group</span>
                        </div>
                    </div>
                    <div class="view-actions">
                        <button class="btn-sparkle secondary"><i class="fas fa-user-plus"></i> Invite</button>
                        ${actionBtn}
                        <button class="btn-sparkle secondary" style="width:45px; padding:0;"><i class="fas fa-ellipsis-h"></i></button>
                    </div>
                </div>
                <nav class="view-nav">
                    <div class="v-nav-item ${this.state.activeTab === 'posts' ? 'active' : ''}" data-tab="posts">Posts</div>
                    <div class="v-nav-item ${this.state.activeTab === 'about' ? 'active' : ''}" data-tab="about">About</div>
                    <div class="v-nav-item ${this.state.activeTab === 'members' ? 'active' : ''}" data-tab="members">Members</div>
                    <div class="v-nav-item ${this.state.activeTab === 'media' ? 'active' : ''}" data-tab="media">Media</div>
                </nav>
            </div>

            <div class="group-view-grid">
                <div class="sidebar-content">
                    <div class="glass-card s-widget">
                        <div class="sw-title">About</div>
                        <div class="sw-item">${g.about || g.description}</div>
                        <div class="sw-item" style="margin-top:20px; font-weight:800; color:#1e293b;">Rules</div>
                        <ul style="padding:0; margin:10px 0 0 0; list-style:none;">
                            ${(g.rules || ["Be respectful", "No spam"]).map(r => `<li style="font-size:13px; margin-bottom:8px; display:flex; gap:10px;"><i class="fas fa-check-circle" style="color:#ff2e88; margin-top:3px;"></i> ${r}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                <div class="main-feed-area">
                    ${g.isMember ? this.renderComposer() : ''}
                    <div id="postsFeed">
                        ${this.renderFeed()}
                    </div>
                </div>
            </div>
        `;
    },

    renderComposer() {
        return `
            <div class="glass-card p-composer">
                <div class="comp-head">
                    <img src="${this.state.mockData.currentUser.avatar}" class="comp-avatar">
                    <input type="text" class="comp-input" id="newPostInput" placeholder="Write something in ${this.state.activeGroup.name}...">
                </div>
                <div class="comp-foot">
                    <button class="btn-sparkle secondary" style="flex:none; padding:8px 15px;"><i class="fas fa-image" style="margin-right:8px;"></i> Media</button>
                    <button class="btn-sparkle" style="flex:none; padding:8px 30px;" onclick="GroupsProto.addPost()">Post</button>
                </div>
            </div>
        `;
    },

    renderFeed() {
        const posts = this.state.mockData.posts.filter(p => p.groupId === this.state.activeGroup.id);
        if (posts.length === 0) return `
            <div class="glass-card post-card-proto" style="text-align:center; padding:50px;">
                <i class="fas fa-feather fa-3x" style="opacity:0.2; margin-bottom:15px;"></i>
                <p class="hint-text" style="font-size:16px;">Be the first to comment...</p>
            </div>
        `;

        return posts.map(p => `
            <div class="glass-card post-card-proto">
                <div class="post-head">
                    <img src="${p.avatar}" class="comp-avatar">
                    <div class="post-u-info">
                        <span class="name">${p.user}</span>
                        <span class="time">${p.time}</span>
                    </div>
                </div>
                <div class="post-text">${p.content}</div>
                ${p.image ? `<div class="post-media"><img src="${p.image}"></div>` : ''}
                <div class="comp-foot" style="margin-top:15px; border-top:1px solid rgba(0,0,0,0.05);">
                    <div class="post-action"><i class="far fa-heart"></i> Like (${p.likes})</div>
                    <div class="post-action"><i class="far fa-comment"></i> Comment (${p.comments.length})</div>
                    <div class="post-action"><i class="far fa-share-square"></i> Share</div>
                </div>
                ${p.comments.length > 0 ? `
                    <div class="comments-box">
                        ${p.comments.map(c => `
                            <div style="font-size:13px; margin-bottom:10px; background:rgba(0,0,0,0.03); padding:10px; border-radius:12px;">
                                <strong style="color:var(--sparkle-pink);">${c.user}:</strong> ${c.content}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    },

    toggleJoin(gid) {
        const group = this.state.mockData.groups.find(g => g.id === gid);
        if (group.isMember) {
            group.isMember = false;
            group.status = 'none';
        } else {
            group.isMember = true;
            group.members++;
        }
        
        if (this.state.activePage === 'discover') this.renderDiscoverPage();
        else this.viewGroup(group.id);
    },

    addPost() {
        const input = document.getElementById('newPostInput');
        const text = input.value.trim();
        if (!text) return;

        const newPost = {
            id: Date.now(),
            groupId: this.state.activeGroup.id,
            user: this.state.mockData.currentUser.name,
            username: this.state.mockData.currentUser.username,
            avatar: this.state.mockData.currentUser.avatar,
            content: text,
            time: "Just now",
            likes: 0,
            comments: []
        };

        this.state.mockData.posts.unshift(newPost);
        this.renderGroupView();
    },

    openAdminModal() {
        const modal = document.getElementById('adminModal');
        modal.style.display = 'flex';
        this.switchAdminTab('requests');
    },

    switchAdminTab(tab) {
        document.querySelectorAll('.m-tab').forEach(el => el.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        const body = document.getElementById('adminModalBody');
        if (tab === 'requests') {
            body.innerHTML = `
                <h3 style="margin-top:0;">Join Requests</h3>
                ${this.state.mockData.requests.map(r => `
                    <div class="glass-card" style="display:flex; align-items:center; gap:15px; padding:15px; margin-bottom:10px;">
                        <img src="${r.avatar}" style="width:40px; height:40px; border-radius:10px;">
                        <div style="flex:1;">
                            <strong style="display:block;">${r.name}</strong>
                            <span style="font-size:12px; color:#64748b;">@${r.username}</span>
                        </div>
                        <button class="btn-sparkle" style="flex:none; padding:6px 15px;">Approve</button>
                        <button class="btn-sparkle secondary" style="flex:none; padding:6px 15px;">Decline</button>
                    </div>
                `).join('')}
            `;
        } else if (tab === 'settings') {
            body.innerHTML = `
                 <h3 style="margin-top:0;">Group Settings</h3>
                 <div style="margin-bottom:15px;">
                    <label style="font-size:13px; font-weight:800; display:block; margin-bottom:5px;">Group Name</label>
                    <input type="text" class="comp-input" value="${this.state.activeGroup.name}" style="width:100%; box-sizing:border-box;">
                 </div>
                 <div style="margin-bottom:15px;">
                    <label style="font-size:13px; font-weight:800; display:block; margin-bottom:5px;">Description</label>
                    <textarea class="comp-input" style="width:100%; box-sizing:border-box; height:100px;">${this.state.activeGroup.description}</textarea>
                 </div>
                 <button class="btn-sparkle">Save Changes</button>
            `;
        } else {
             body.innerHTML = `<h3>Other Section</h3><p>Feature coming soon...</p>`;
        }
    }
};

window.GroupsProto = GroupsProto;
