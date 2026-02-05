// dynamicPatch.js - Makes Dashboard Dynamic with Real API Data
// This script patches the existing script.js functions to use DashboardAPI

console.log('?? Loading Dynamic API Patch...');

// ============ INJECT CREATE BUTTON (FAB) ============
function injectCreateButton() {
    // Initializing Sparkle FAB
    if (document.getElementById('globalCreateBtn')) return;

    const fab = document.createElement('div');
    fab.id = 'globalCreateBtn';
    fab.style = `
        position: fixed;
        bottom: 80px; 
        right: 20px;
        width: 60px;
        height: 60px;
        background: linear-gradient(45deg, var(--primary, #FF3D6D), var(--secondary, #833AB4));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        cursor: pointer;
        z-index: 9999;
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    fab.innerHTML = '<i class="fas fa-plus"></i>';
    fab.onmouseover = () => fab.style.transform = 'scale(1.1)';
    fab.onmouseout = () => fab.style.transform = 'scale(1)';
    fab.onclick = showCreateOptions;

    document.body.appendChild(fab);
}

window.showCreateOptions = function showCreateOptions() {

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
        display: flex;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
        z-index: 10000;
        align-items: flex-end;
        justify-content: center;
    `;

    modal.innerHTML = `
        <div class="modal-content" style="
            width: 100%; 
            max-width: 500px; 
            background: white;
            border-radius: 20px 20px 0 0; 
            margin: 0; 
            animation: slideUp 0.3s ease;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
        ">
             <div style="text-align:center; padding: 15px; border-bottom:1px solid #eee; margin-bottom:15px;">
                <div style="width: 40px; height: 4px; background: #ddd; border-radius: 2px; margin: 0 auto;"></div>
                <div style="font-size: 16px; font-weight: 600; color: #333; margin-top: 10px;">Create Something Amazing</div>
             </div>
             <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 0 20px 20px;">
                <div id="newPostOption" class="create-option-card" style="
                    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                    padding: 20px 10px;
                    border-radius: 16px;
                    text-align: center;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                ">
                    <div style="width: 50px; height: 50px; background: #2196f3; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3); transition: transform 0.3s;">
                        <i class="fas fa-pen"></i>
                    </div>
                    <div style="font-weight: 700; font-size: 14px; color: #1976d2; margin-bottom: 4px;">Post</div>
                    <div style="font-size: 10px; color: #555;">Share text or image</div>
                </div>
                <div id="newMomentOption" class="create-option-card" style="
                    background: linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%);
                    padding: 20px 10px;
                    border-radius: 16px;
                    text-align: center;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                ">
                    <div style="width: 50px; height: 50px; background: #e91e63; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px; box-shadow: 0 4px 12px rgba(233, 30, 99, 0.3); transition: transform 0.3s;">
                        <i class="fas fa-video"></i>
                    </div>
                    <div style="font-weight: 700; font-size: 14px; color: #c2185b; margin-bottom: 4px;">Moment</div>
                    <div style="font-size: 10px; color: #555;">Share a short video</div>
                </div>
                <div id="newAfterglowOption" class="create-option-card" style="
                    background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
                    padding: 20px 10px;
                    border-radius: 16px;
                    text-align: center;
                    cursor: pointer;
                    border: 2px solid transparent;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                ">
                    <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #9c27b0, #e91e63); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px; box-shadow: 0 4px 12px rgba(156, 39, 176, 0.4); transition: transform 0.3s;">
                        <i class="fas fa-bolt"></i>
                    </div>
                    <div style="font-weight: 700; font-size: 14px; color: #7b1fa2; margin-bottom: 4px;">AfterGlow</div>
                    <div style="font-size: 10px; color: #555;">Share a 24hr story</div>
                </div>
             </div>
             <button class="btn btn-block" style="background: none; color: #666; padding: 15px; border: none; font-size: 15px; cursor: pointer; transition: color 0.2s;" id="cancelCreate">Cancel</button>
        </div>
        <style>
            @keyframes slideUp { 
                from { transform: translateY(100%); opacity: 0; } 
                to { transform: translateY(0); opacity: 1; } 
            }
            .create-option-card:hover {
                transform: translateY(-4px);
                border-color: rgba(156, 39, 176, 0.3);
                box-shadow: 0 8px 20px rgba(0,0,0,0.12);
            }
            .create-option-card:hover > div:first-child {
                transform: scale(1.1);
            }
            .create-option-card:active {
                transform: translateY(-2px);
            }
            #cancelCreate:hover {
                color: #333;
            }
        </style>
    `;

    document.body.appendChild(modal);

    // Handlers
    modal.querySelector('#newPostOption').onclick = () => {
        modal.remove();
        const createModal = document.getElementById('createModal');
        if (createModal) {
            createModal.style.display = 'flex';
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            document.getElementById('postCaption')?.focus();
        }
    };

    modal.querySelector('#newMomentOption').onclick = () => {
        modal.remove();
        const momentModal = document.getElementById('momentModal');
        if (momentModal) {
            momentModal.style.display = 'flex';
        }
    };

    modal.querySelector('#newAfterglowOption').onclick = () => {
        modal.remove();
        const afterglowModal = document.getElementById('afterglowModal');
        if (afterglowModal) {
            afterglowModal.style.display = 'flex';
        }
    };

    modal.querySelector('#cancelCreate').onclick = () => {
        modal.remove();
    };

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    };
};

// Wait for DOM and DashboardAPI to be ready
document.addEventListener('DOMContentLoaded', async function () {
    // 100ms delay to ensure script.js has initialized, but fast enough to avoid "flash of old content"
    setTimeout(async () => {
        console.log('? Applying Dynamic Data Patch...');
        injectCreateButton();
        const currentToken = localStorage.getItem('sparkleToken');
        const currentUserData = JSON.parse(localStorage.getItem('sparkleUser') || localStorage.getItem('currentUser') || '{}');
        const currentUserId = currentUserData.id || currentUserData.user_id || '';
        const currentUsername = currentUserData.username || '';
        const currentCampus = currentUserData.campus || localStorage.getItem('sparkleUserCampus') || 'Sparkle Central';

        // Helper for search
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // ============ UPLOAD MOMENT LOGIC ============
        window.uploadMoment = function () {
            // Create Modal
            const modal = document.createElement('div');
            modal.className = 'modal premium-modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '10001';

            modal.innerHTML = `
                <div class="modal-content premium-modal-content" style="max-width: 450px; animation: slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <div class="modal-header premium-modal-header">
                        <div class="modal-title premium-modal-title">
                            <i class="fas fa-video text-primary"></i> Share a Moment
                        </div>
                        <button class="close-modal premium-close-btn">&times;</button>
                    </div>
                    <div class="modal-body premium-modal-body">
                        <!-- Moment Preview/Upload Area -->
                        <div class="media-upload-section" style="margin-bottom: 20px;">
                            <div class="media-upload-container" id="momentUploadArea" style="aspect-ratio: 9/16; max-height: 300px; overflow: hidden; position: relative; border: 2px dashed rgba(255, 61, 109, 0.3); border-radius: 15px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255, 61, 109, 0.02); transition: all 0.3s ease;">
                                <div class="upload-placeholder" id="momentPlaceholder">
                                    <div class="upload-icon-circle" style="width: 60px; height: 60px; background: rgba(255, 61, 109, 0.1); color: var(--primary, #FF3D6D); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; font-size: 24px;">
                                        <i class="fas fa-clapperboard"></i>
                                    </div>
                                    <div class="upload-text" style="text-align: center;">
                                        <span class="main-text" style="display: block; font-weight: 600; color: #333;">Select Short Video</span>
                                        <span class="sub-text" style="display: block; font-size: 12px; color: #777;">Up to 30 seconds</span>
                                    </div>
                                </div>
                                <video id="momentPreview" style="display: none; width: 100%; height: 100%; object-fit: cover; border-radius: 12px;" controls muted></video>
                                <input type="file" id="momentVideo" accept="video/*" style="display: none;">
                            </div>
                        </div>

                        <!-- Caption Input -->
                        <div class="post-input-section" style="margin-bottom: 20px;">
                            <textarea class="post-textarea" id="momentCaption" rows="2" 
                                placeholder="Write a catchy caption..." 
                                style="width: 100%; border: 1px solid #eee; border-radius: 12px; padding: 12px; font-family: inherit; resize: none; outline: none; transition: border-color 0.3s;"
                                onfocus="this.style.borderColor='var(--primary)'" 
                                onblur="this.style.borderColor='#eee'"></textarea>
                        </div>

                        <!-- Status & Progress -->
                        <div id="uploadProgressContainer" style="display: none; margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                                <span id="uploadStatusText" style="color: #666;">Ready to upload</span>
                                <span id="uploadPercentage" style="font-weight: 600; color: var(--primary);">0%</span>
                            </div>
                            <div style="height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden;">
                                <div id="uploadProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--primary, #FF3D6D), var(--secondary, #833AB4)); transition: width 0.3s ease;"></div>
                            </div>
                        </div>
                        
                        <!-- Actions -->
                        <button class="btn-premium-submit" id="uploadMomentBtn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <span>Share Moment</span>
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const closeBtn = modal.querySelector('.close-modal');
            const submitBtn = modal.querySelector('#uploadMomentBtn');
            const fileInput = modal.querySelector('#momentVideo');
            const uploadArea = modal.querySelector('#momentUploadArea');
            const preview = modal.querySelector('#momentPreview');
            const placeholder = modal.querySelector('#momentPlaceholder');
            const captionInput = modal.querySelector('#momentCaption');

            const progressContainer = modal.querySelector('#uploadProgressContainer');
            const statusText = modal.querySelector('#uploadStatusText');
            const progressBar = modal.querySelector('#uploadProgressBar');
            const percentageText = modal.querySelector('#uploadPercentage');

            // Click area to trigger file input
            uploadArea.onclick = () => fileInput.click();

            // Preview local video
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (!file.type.startsWith('video/')) {
                        showNotification('Please select a video file', 'error');
                        fileInput.value = '';
                        return;
                    }

                    const url = URL.createObjectURL(file);
                    preview.src = url;
                    preview.style.display = 'block';
                    placeholder.style.display = 'none';
                    uploadArea.style.borderStyle = 'solid';
                    uploadArea.style.borderColor = 'rgba(255, 61, 109, 0.5)';
                }
            };

            const closeModal = () => {
                modal.classList.add('fade-out');
                setTimeout(() => { if (modal.parentNode) document.body.removeChild(modal); }, 300);
            };

            closeBtn.onclick = closeModal;
            modal.onclick = (e) => { if (e.target === modal) closeModal(); };

            submitBtn.onclick = async () => {
                const file = fileInput.files[0];
                if (!file) {
                    showNotification('Please select a video', 'error');
                    return;
                }

                try {
                    submitBtn.disabled = true;
                    submitBtn.style.opacity = '0.7';
                    submitBtn.innerHTML = '<span>Processing...</span> <i class="fas fa-spinner fa-spin"></i>';

                    progressContainer.style.display = 'block';
                    statusText.textContent = 'Uploading Moment...';

                    // Simulate progress for better UX
                    let progress = 0;
                    const progressInterval = setInterval(() => {
                        if (progress < 90) {
                            progress += Math.random() * 5;
                            const displayProgress = Math.min(Math.round(progress), 90);
                            progressBar.style.width = displayProgress + '%';
                            percentageText.textContent = displayProgress + '%';
                        }
                    }, 500);

                    // Create Moment (Direct upload)
                    await DashboardAPI.createMoment({
                        video: file,
                        caption: captionInput.value
                    });

                    clearInterval(progressInterval);
                    progressBar.style.width = '100%';
                    percentageText.textContent = '100%';
                    statusText.textContent = 'Shared successfully!';

                    showNotification('Moment shared successfully!');

                    setTimeout(() => {
                        closeModal();
                        if (window.loadMoments) loadMoments();
                        if (window.loadAfterglowStories) loadAfterglowStories();
                    }, 1000);

                } catch (error) {
                    console.error('Upload failed:', error);
                    statusText.textContent = 'Upload failed';
                    statusText.style.color = '#ff4757';
                    progressBar.style.background = '#ff4757';
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.innerHTML = '<span>Try Again</span> <i class="fas fa-redo"></i>';
                    showNotification('Failed to share moment', 'error');
                }
            };
        };

        console.log('� Current Token in localStorage:', currentToken ? currentToken.substring(0, 10) + '...' : 'NONE');
        console.log('�� Current User:', currentUsername, currentUserId);

        DashboardAPI.token = currentToken; // Sync token

        // ============ PROFILE UPDATE LOGIC ============
        window.saveProfileChanges = async function () {
            const nameInput = document.getElementById('editName');
            const bioInput = document.getElementById('editBio');
            const campusInput = document.getElementById('editCampus');
            const majorInput = document.getElementById('editMajor');

            if (!nameInput?.value || !campusInput?.value || !majorInput?.value) {
                alert('Please fill in all fields');
                return;
            }

            const profileData = {
                name: nameInput.value,
                bio: bioInput.value || '',
                campus: campusInput.value,
                major: majorInput.value,
                avatar_url: currentUserData.avatar || '/uploads/avatars/default.png'
            };


            try {
                showNotification('Saving profile...');
                await DashboardAPI.updateProfile(profileData);

                // Update local data
                currentUserData.name = profileData.name;
                localStorage.setItem('currentUser', JSON.stringify(currentUserData));

                showNotification('Profile updated!');
                if (typeof hideModal === 'function') {
                    hideModal('settingsModal'); // Fix ID
                } else {
                    document.getElementById('settingsModal').classList.remove('active');
                    document.getElementById('settingsModal').style.display = 'none';
                }
                updateProfileDisplay();
            } catch (err) {
                showNotification('Failed to update profile', 'error');
            }
        };

        const saveSettingsBtn = document.querySelector('#settingsModal .btn-primary');
        if (saveSettingsBtn) {
            saveSettingsBtn.onclick = (e) => {
                e.preventDefault();
                saveProfileChanges();
            };
        }

        // ============ SYNC GLOBAL STATE ============
        if (typeof appState !== 'undefined') {
            console.log(' Syncing global appState with real user data...');
            if (!appState.currentUser) {
                appState.currentUser = { id: '', username: '', name: '' };
            }

            appState.currentUser.id = currentUserId || 'guest';
            appState.currentUser.username = currentUsername || 'Guest';
            appState.currentUser.name = (currentUserData && currentUserData.name) || currentUsername || 'Guest User';

            // Initial sync of UI components
            if (typeof updateProfileDisplay === 'function') {
                updateProfileDisplay();
            }
        }

        injectCreateButton(); // Add FAB



        // ============ OVERRIDE PROFILE DISPLAY ============
        window.updateProfileDisplay = async function () {
            console.log('�� Updating Profile Display with real data...');
            try {
                // Fetch full profile to get bio, campus etc
                const profile = await DashboardAPI.loadUserProfile(currentUserId);

                // Update Sidebar Profile
                const sidebarName = document.querySelector('.profile-info h3');
                const sidebarUsername = document.querySelector('.profile-info p');
                const sidebarAvatar = document.querySelector('.profile-image img');

                if (sidebarName) sidebarName.textContent = profile.name;
                if (sidebarUsername) sidebarUsername.textContent = `@${profile.username}`;
                if (sidebarAvatar) sidebarAvatar.src = profile.avatar;

                // Update Profile Page if active
                const profileName = document.getElementById('profileName');
                const profileBio = document.getElementById('profileBio');
                const profileAvatar = document.querySelector('.profile-header .profile-avatar img');
                const followersCount = document.getElementById('followersCount');
                const followingCount = document.getElementById('followingCount');

                if (profileName) profileName.textContent = profile.name;
                if (profileBio) profileBio.textContent = profile.bio || 'No bio yet.';
                if (profileAvatar) profileAvatar.src = profile.avatar;

                // Update Counts
                const [followers, following] = await Promise.all([
                    DashboardAPI.loadFollowers(currentUserId),
                    DashboardAPI.loadFollowing(currentUserId)
                ]);
                if (followersCount) followersCount.textContent = followers.length || 0;
                if (followingCount) followingCount.textContent = following.length || 0;

            } catch (err) {
                console.error('Failed to sync profile display:', err);
            }
        };

        // ============ OVERRIDE PROFILE TABS ============
        window.switchProfileTab = async function (tab) {
            const container = document.getElementById('profileGrid');
            if (!container) return; // Not on profile page

            // Update tab styles
            document.querySelectorAll('.profile-tab').forEach(t => {
                t.classList.remove('active');
                if (t.dataset.tab === tab) t.classList.add('active');
            });

            container.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

            if (tab === 'posts') {
                try {
                    const posts = await DashboardAPI.loadUserPosts(currentUserId);
                    container.innerHTML = '';

                    if (posts.length === 0) {
                        container.innerHTML = `
                            <div style="grid-column: span 3; text-align: center; padding: 40px 20px; color: #999;">
                                <i class="fas fa-camera" style="font-size: 50px; margin-bottom: 15px;"></i>
                                <h3>No posts yet</h3>
                                <p>Share your first post with your campus!</p>
                            </div>
                        `;
                        return;
                    }

                    posts.forEach(post => {
                        const postEl = document.createElement('div');
                        postEl.style = "aspect-ratio: 1; overflow: hidden; position: relative; cursor: pointer; border-radius: 4px; background: #eee;";
                        postEl.innerHTML = post.media
                            ? `<img src="${post.media}" style="width: 100%; height: 100%; object-fit: cover;">`
                            : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary), var(--campus-purple)); color: white; padding: 10px; font-size: 14px; text-align: center;">${post.caption}</div>`;

                        postEl.addEventListener('click', () => {
                            // Simple alert for now, could be a full viewer later
                            alert(`View post: ${post.caption}`);
                        });
                        container.appendChild(postEl);
                    });

                } catch (error) {
                    console.error('Failed to load user posts:', error);
                    container.innerHTML = '<div style="color: red; padding: 20px;">Failed to load posts</div>';
                }
            } else if (tab === 'moments') {
                try {
                    container.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading moments...</div>';
                    const moments = await window.loadUserMoments(currentUserId);

                    container.innerHTML = '';
                    if (moments.length === 0) {
                        container.innerHTML = `
                            <div style="grid-column: span 3; text-align: center; padding: 40px 20px; color: #999;">
                                <i class="fas fa-video" style="font-size: 50px; margin-bottom: 15px;"></i>
                                <h3>No moments yet</h3>
                                <p>Share short videos to specific moments!</p>
                                <button class="btn btn-primary" style="margin-top: 15px;" onclick="uploadMoment()">
                                    <i class="fas fa-plus"></i> Create Moment
                                </button>
                            </div>
                        `;
                        return;
                    }

                    moments.forEach(m => {
                        const el = document.createElement('div');
                        el.style = "aspect-ratio: 9/16; overflow: hidden; position: relative; cursor: pointer; border-radius: 8px; background: #000;";
                        el.innerHTML = `
                            <video src="${m.media}" style="width:100%; height:100%; object-fit:cover;"></video>
                            <div style="position:absolute; bottom:0; left:0; width:100%; padding:10px; background:linear-gradient(to top, rgba(0,0,0,0.8), transparent); color:white; font-size:12px;">
                                <i class="fas fa-play"></i> ${m.caption || 'Moment'}
                            </div>
                         `;
                        el.onclick = () => {
                            // Simple viewer
                            const vModal = document.createElement('div');
                            vModal.className = 'modal';
                            vModal.style.display = 'flex';
                            vModal.style.background = 'black';
                            vModal.innerHTML = `
                                <button class="close-modal" style="color:white; position:absolute; top:20px; right:20px; z-index:10;">&times;</button>
                                <video src="${m.media}" controls autoplay style="max-width:100%; max-height:100vh; margin:auto;"></video>
                             `;
                            document.body.appendChild(vModal);
                            vModal.querySelector('.close-modal').onclick = () => vModal.remove();
                        };
                        container.appendChild(el);
                    });

                } catch (e) {
                    console.error(e);
                    container.innerHTML = '<div style="color:red; text-align:center;">Failed to load moments.</div>';
                }
            } else if (tab === 'saved') {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #999;">
                        <i class="fas fa-bookmark" style="font-size: 50px; margin-bottom: 15px;"></i>
                        <h3>Saved Posts</h3>
                        <p>Posts you save will appear here</p>
                    </div>
                `;
            }
        };

        window.loadUserMoments = async function (userId) {
            try {
                // Try specific endpoint first if available in DashboardAPI
                if (DashboardAPI.loadUserMoments) {
                    return await DashboardAPI.loadUserMoments(userId);
                }
                // Fallback to filtering posts (legacy)
                const posts = await DashboardAPI.loadUserPosts(userId);
                return posts.filter(p => p.media && (p.media.endsWith('.mp4') || p.media.includes('video')));
            } catch (e) {
                console.error('Failed to load user moments', e);
                return [];
            }
        };

        // ============ NOTIFICATIONS INTEGRATION ============
        window.loadNotifications = async function () {
            console.log('�� Loading real notifications...');
            const container = document.getElementById('notificationList');
            if (!container) return;

            try {
                const notifications = await DashboardAPI.loadNotifications();
                const badge = document.querySelector('.notification-badge');

                const unreadCount = notifications.filter(n => !n.read).length;
                if (badge) {
                    badge.textContent = unreadCount;
                    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
                }

                if (notifications.length === 0) {
                    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No notifications yet.</div>';
                    return;
                }

                container.innerHTML = notifications.map(n => `
                    <div class="notification-item ${n.read ? '' : 'unread'}" style="padding: 12px; border-bottom: 1px solid #eee; display: flex; gap: 10px; align-items: center; background: ${n.read ? 'transparent' : '#f0f7ff'};">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                            <i class="fas ${n.type === 'spark' ? 'fa-fire' : n.type === 'follow' ? 'fa-user-plus' : 'fa-comment'}"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 13px;"><strong>${n.user}</strong> ${n.message}</div>
                            <div style="font-size: 11px; color: #999;">${n.time}</div>
                        </div>
                    </div>
                `).join('');

            } catch (err) {
                console.error('Failed to load notifications:', err);
            }
        };

        // Patch notification click
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            if (item.querySelector('.fa-bell')) {
                item.onclick = (e) => {
                    // Original behavior shows dropdown
                    // We just ensure data is loaded
                    loadNotifications();
                };
            }
        });

        // ============ SCRIPT.JS COMPATIBILITY MAPPERS ============
        // ============ SCRIPT.JS COMPATIBILITY MAPPERS ============
        // These map the names expected by script.js and dashboard.html to the actual functions here

        // window.loadEnhancedConfessions is defined later in this file (line ~1526)
        // We do NOT map it here to prevent overwriting the valid implementation with a missing function.

        window.loadMarketplaceContent = (cat) => window.loadMarketplace(cat);
        window.loadLostFoundContent = (type) => window.loadLostFoundItems(type);
        window.loadSkillMarketContent = (type) => window.loadSkillOffers(type);

        // IMPLEMENT MISSING FUNCTIONS
        window.loadLostFoundItems = async function (type) {
            const container = document.getElementById('lostFoundContent') || document.getElementById('lostFoundGrid');
            if (!container) return;

            try {
                container.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
                const campus = localStorage.getItem('sparkleUserCampus') || 'all';
                const items = await DashboardAPI.loadLostFoundItems(type || 'all', campus);

                container.innerHTML = '';
                if (items.length === 0) {
                    container.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">No items found.</div>';
                    return;
                }

                items.forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'market-card';
                    el.style = 'background: white; border-radius: 10px; margin-bottom: 15px; border: 1px solid var(--border); overflow: hidden;';
                    el.innerHTML = `
                        <div style="padding:15px; border-left: 5px solid ${item.type === 'lost' ? '#ff4757' : '#2ed573'};">
                            <div style="font-weight:bold; font-size:16px;">${item.item_name || item.title}</div>
                            <div style="font-size:12px; color:#666; margin:5px 0;">
                                <i class="fas fa-map-marker-alt"></i> ${item.location} • ${item.date_lost || item.date_found || 'Recently'}
                            </div>
                            <div style="margin:10px 0;">${item.description}</div>
                             <button class="btn btn-sm ${item.type === 'lost' ? 'btn-danger' : 'btn-success'}" 
                                     style="background: ${item.type === 'lost' ? '#ff4757' : '#2ed573'}; color: white; border:none; border-radius: 4px; padding: 5px 10px;"
                                     onclick="contactSeller('${item.user_id}', '${item.contact_name || 'User'}')">
                         yes       ${item.type === 'lost' ? 'I Found This' : 'Claim This'}
                            </button>
                        </div>
                    `;
                    container.appendChild(el);
                });
            } catch (e) {
                console.error('Failed to load lost & found', e);
                container.innerHTML = '<div style="text-align:center; color:red;">Failed to load items.</div>';
            }
        };

        window.loadSkillOffers = async function (type) {
            const container = document.getElementById('skillMarketContent');
            if (!container) return;

            try {
                container.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
                const campus = localStorage.getItem('sparkleUserCampus') || 'all';
                const skills = await DashboardAPI.loadSkillOffers(type || 'all', campus);

                container.innerHTML = '';
                if (skills.length === 0) {
                    container.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">No skill offers found.</div>';
                    return;
                }

                skills.forEach(skill => {
                    const el = document.createElement('div');
                    el.className = 'group-card';
                    el.style = 'background: white; border-radius: 12px; margin-bottom: 15px; border: 1px solid var(--border); overflow: hidden;';
                    el.innerHTML = `
                         <div style="padding: 15px; display:flex; align-items:center; gap:15px;">
                            <div style="width:40px; height:40px; background:#e1b12c; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; flex-shrink: 0;">
                                <i class="fas fa-lightbulb"></i>
                            </div>
                            <div style="flex:1;">
                                <div style="font-weight:bold;">${skill.title}</div>
                                <div style="font-size:12px; color:#666;">${skill.user_name || 'Student'} • ${skill.category || 'General'}</div>
                                <div style="font-size:13px; margin-top:5px;">${skill.description}</div>
                            </div>
                             <button class="btn btn-primary btn-sm" onclick="startChatWithUser('${skill.user_id}')">Request</button>
                        </div>
                    `;
                    container.appendChild(el);
                });
            } catch (e) {
                console.error('Failed to load skills', e);
                container.innerHTML = '<div style="text-align:center; color:red;">Failed to load skills.</div>';
            }
        };

        window.showGroupManagement = () => {
            if (typeof showModal === 'function') showModal('groupManagement');
            window.loadGroups();
        };

        window.showGroupFeed = () => {
            if (typeof showModal === 'function') showModal('groupFeed');
            window.loadGroupFeed();
        };

        window.loadGroupManagement = () => window.loadGroups();
        window.loadGroupFeed = () => {
            const container = document.getElementById('groupFeedContent') || document.getElementById('activePolls'); // fallback
            if (container) {
                container.innerHTML = '<p style="text-align:center; padding:20px;">Loading group feed...</p>';
                DashboardAPI.loadFeed().then(posts => {
                    container.innerHTML = '';
                    const feedNodes = posts.map(post => window.createPostElement(post));
                    feedNodes.forEach(node => container.appendChild(node));
                }).catch(e => {
                    container.innerHTML = '<p style="text-align:center; color:red;">Failed to load group feed.</p>';
                });
            }
        };

        window.showMarketplace = (category) => {
            if (typeof showModal === 'function') showModal('marketplace');
            window.loadMarketplace(category);
        };

        window.showLostFound = (type) => {
            if (typeof showModal === 'function') showModal('lostFound');
            window.loadLostFoundItems(type);
        };

        // ============ CORE LOADING FUNCTIONS ============

        window.loadAfterglowStories = async function (options = {}) {
            const isSilent = options.silent || false;
            const container = document.getElementById('afterglowStories');
            if (!container) return;

            try {
                if (!isSilent) {
                    console.log(' Loading stories from API...');
                }
                const stories = await DashboardAPI.loadStories();
                const fragment = document.createDocumentFragment();

                // Keep the "Create" card
                const currentUserData = window.currentUserData || { avatar: '' };
                const createCard = document.createElement('div');
                createCard.className = 'story-create-card';
                createCard.onclick = () => window.showCreateOptions();
                createCard.innerHTML = `
                        <div class="story-create-inner">
                            <div class="story-create-avatar-container">
                                <img src="${currentUserData.avatar || '/uploads/avatars/default.png'}"
                                     alt="Your Story" class="story-create-avatar">
                                <div class="story-create-ring"></div>
                                <div class="story-create-plus">
                                    <i class="fas fa-plus"></i>
                                </div>
                            </div>
                            <div class="story-create-label">Create AfterGlow</div>
                        </div>
                `;
                fragment.appendChild(createCard);

                if (stories.length === 0) {
                    const hint = document.createElement('div');
                    hint.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 0 10px;';
                    hint.innerHTML = `
                        <div style="color: #999; font-size: 12px; white-space: nowrap;">No active glows yet.</div>
                        <button onclick="window.showCreateOptions()" style="background: rgba(156, 39, 176, 0.1); color: #9c27b0; border: 1px dashed #9c27b0; padding: 4px 12px; border-radius: 12px; cursor: pointer; font-size: 11px; white-space: nowrap;">Spark One!</button>
                    `;
                    fragment.appendChild(hint);
                } else {
                    const formatTime = (seconds) => {
                        if (seconds <= 0) return 'Expired';
                        const h = Math.floor(seconds / 3600);
                        const m = Math.floor((seconds % 3600) / 60);
                        if (h > 0) return `${h}h ${m} m`;
                        return `${m} m`;
                    };

                    stories.forEach(story => {
                        const storyEl = document.createElement('div');
                        storyEl.className = 'story-view-card';
                        storyEl.dataset.secondsLeft = story.secondsLeft;

                        storyEl.innerHTML = `
                            <div class="story-view-inner" >
                                    <div class="story-avatar-container">
                                        <div class="story-avatar-ring" style="opacity: ${Math.max(0.1, story.secondsLeft / 7200)};"></div>
                                        <img src="${story.avatar || story.avatar_url || '/uploads/avatars/default.png'}" alt="${story.username}" class="story-avatar">
                                    </div>
                                    <div class="story-info">
                                        <div class="story-username">${story.username}</div>
                                        <div class="story-time">${formatTime(story.secondsLeft)}</div>
                                    </div>
                                </div>
                            `;

                        storyEl.addEventListener('click', () => {
                            window.viewAfterglow(story);
                        });
                        fragment.appendChild(storyEl);
                    });
                }

                container.innerHTML = '';
                container.appendChild(fragment);

            } catch (error) {
                console.error('? Failed to load stories:', error);
            }
        };

        // Update countdown every minute
        window.afterglowTimerInterval = setInterval(() => {
            const container = document.getElementById('afterglowStories');
            if (!container) return; // Ensure container exists before querying
            const items = container.querySelectorAll('.story-view-card');
            items.forEach(item => {
                let seconds = parseInt(item.dataset.secondsLeft);
                if (seconds > 0) {
                    seconds -= 60;
                    item.dataset.secondsLeft = seconds;
                    const timeEl = item.querySelector('.story-time');
                    if (timeEl) {
                        const h = Math.floor(seconds / 3600);
                        const m = Math.floor((seconds % 3600) / 60);
                        if (h > 0) timeEl.textContent = `${h}h ${m} m`;
                        else timeEl.textContent = `${m} m`;
                    }

                    const ring = item.querySelector('.story-avatar-ring');
                    if (ring) ring.style.opacity = Math.max(0.1, seconds / 7200);
                } else {
                    item.remove();
                }
            });
        }, 60000);

        // Removed redundant viewAfterglow override to allow script.js premium UI to work
        window.viewAfterglow = function (story) {
            if (typeof showAfterglowViewer === 'function') {
                // Get all stories to set activeStories correctly for navigation
                if (typeof DashboardAPI !== 'undefined') {
                    DashboardAPI.loadStories().then(stories => {
                        window.activeStories = stories || [];
                        const index = stories.findIndex(s => (s.story_id || s.id) === (story.story_id || story.id));
                        window.currentStoryIndex = index !== -1 ? index : 0;
                        showAfterglowViewer(story);
                    }).catch(err => {
                        console.error("Failed to load stories for viewer:", err);
                        showAfterglowViewer(story);
                    });
                } else {
                    showAfterglowViewer(story);
                }
            } else {
                console.warn("showAfterglowViewer not found in script.js");
            }
        };

        window.loadGroups = async function () {
            // Target both the page container and the modal container
            const containers = [
                document.getElementById('groupsContainer'),
                document.getElementById('groupManagementContent')
            ].filter(el => el !== null);

            if (containers.length === 0) return;

            try {
                containers.forEach(c => c.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>');
                const userCampus = localStorage.getItem('sparkleUserCampus') || JSON.parse(localStorage.getItem('sparkleUser') || '{}').campus;
                const groups = await DashboardAPI.loadGroups(userCampus);

                const html = groups.length === 0 ?
                    '<div style="text-align:center; padding:40px; color:#999;">No groups found.</div>' :
                    groups.map(group => `
                    <div class="group-card" style = "background: white; border-radius: 12px; margin-bottom: 20px; border: 1px solid var(--border); overflow: hidden;" >
                        <div style="padding: 15px;">
                            <div style="display: flex; align-items: center; margin-bottom: 12px;">
                                <div style="width: 45px; height: 45px; border-radius: 10px; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white; overflow: hidden;">
                                    ${group.icon_url ?
                            `<img src="${group.icon_url}" style="width: 100%; height: 100%; object-fit: cover;">` :
                            `<i class="${group.icon || 'fas fa-users'}"></i>`
                        }
                                </div>
                                <div style="flex: 1; margin-left:12px;">
                                    <div style="font-weight: 600;">${group.name}</div>
                                    <div style="font-size: 12px; color: #666;">${group.members} members • ${group.campus}</div>
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="DashboardAPI.joinGroup('${group.id}').then(() => window.loadGroups())">
                                    ${group.isJoined ? 'Joined' : 'Join'}
                                </button>
                            </div>
                            <div style="font-size: 13px; color: #555;">${group.description}</div>
                        </div>
                        </div>
                    `).join('');

                containers.forEach(c => c.innerHTML = html);
            } catch (error) {
                console.error('Failed to load groups:', error);
                containers.forEach(c => c.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Failed to load groups</div>');
            }
        };

        window.showComments = async function (postId) {
            try {
                const comments = await DashboardAPI.loadComments(postId);
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.display = 'flex';
                modal.innerHTML = `
                    <div class="modal-content" style = "max-width: 500px; max-height: 80vh;" >
                        <div class="modal-header">
                            <div class="modal-title">Comments (${comments.length})</div>
                            <button class="close-modal">&times;</button>
                        </div>
                        <div class="modal-body" style="overflow-y: auto;">
                            <div id="commentsList">
                                ${comments.map(c => `
                                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                                        <img src="${c.avatar}" style="width: 32px; height: 32px; border-radius: 50%;">
                                        <div>
                                            <div style="font-weight: 600; font-size: 13px;">${c.user}</div>
                                            <div style="font-size: 14px;">${c.text}</div>
                                            <div style="font-size: 11px; color: #999;">${c.timestamp}</div>
                                        </div>
                                    </div>
                                `).join('')}
                                ${comments.length === 0 ? '<p style="text-align:center; color:#999;">No comments yet.</p>' : ''}
                            </div>
                        </div>
                        <div class="modal-footer" style="padding:15px; border-top:1px solid #eee; display:flex; gap:10px;">
                            <input type="text" id="newCommentInput" class="form-control" placeholder="Write a comment..." style="flex:1;">
                            <button class="btn btn-primary" onclick="window.submitComment('${postId}')">Post</button>
                        </div>
                    </div>
                    `;
                document.body.appendChild(modal);
                modal.querySelector('.close-modal').onclick = () => modal.remove();
            } catch (err) {
                console.error(err);
            }
        };

        window.submitComment = async (postId) => {
            const input = document.getElementById('newCommentInput');
            if (!input || !input.value.trim()) {
                alert('Please fill in all fields');
                return;
            }

            try {
                await DashboardAPI.postComment(postId, input.value.trim());
                if (typeof showNotification === 'function') showNotification('Comment posted!');
                document.querySelector('.modal').remove();
                if (window.loadFeedPosts) window.loadFeedPosts();
            } catch (err) {
                console.error(err);
            }
        };


        window.contactSeller = function (sellerId, sellerName) {
            // Attempt to get seller avatar from the DOM if available, otherwise use default
            const item = document.querySelector(`.market-card button[onclick*="contactSeller('${sellerId}')"]`)?.closest('.market-card');
            const sellerAvatar = item?.querySelector('img[src*="placeholder.com"]') ? '/uploads/avatars/default.png' : item?.querySelector('img')?.src || '/uploads/avatars/default.png';
            startChat({ id: sellerId, name: sellerName, avatar: sellerAvatar });
        };

        // Hook up marketplace category buttons
        const marketCategories = document.getElementById('marketCategories');
        if (marketCategories) {
            marketCategories.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (btn) {
                    marketCategories.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    loadMarketplace(btn.dataset.category);
                }
            });
        }

        // ============ HELPER FUNCTIONS ============
        window.joinGroupFromAPI = async function (groupId) {
            try {
                await DashboardAPI.joinGroup(groupId);
                showNotification('Joined group successfully!');
                loadGroups();
            } catch (error) {
                showNotification('Failed to join group', 'error');
            }
        };

        window.followUserFromAPI = async function (userId) {
            try {
                await DashboardAPI.followUser(userId);
                showNotification('Following user!');
                loadConnectUsers();
            } catch (error) {
                showNotification('Failed to follow user', 'error');
            }
        };

        window.sparkPostFromAPI = async function (postId) {
            try {
                await DashboardAPI.sparkPost(postId);
                loadFeedPosts();
            } catch (error) {
                console.error('Failed to spark post:', error);
            }
        };

        // ============ AUTO-LOAD DATA ON PAGE LOAD ============
        // Automatically load Feed and Stories when dashboard is ready
        window.addEventListener('load', () => {
            console.log(' Dashboard loaded - Auto-loading Feed and Stories...');

            // Small delay to ensure DOM is fully ready
            setTimeout(() => {
                // Load Feed if on home page
                if (typeof window.loadFeedPosts === 'function') {
                    const feedContainer = document.getElementById('feed');
                    if (feedContainer) {
                        console.log(' Auto-loading Feed posts...');
                        window.loadFeedPosts();
                    }
                }

                // Load Stories/AfterGlow
                if (typeof window.loadAfterglowStories === 'function') {
                    const storiesContainer = document.getElementById('afterglowStories');
                    if (storiesContainer) {
                        console.log(' Auto-loading Stories...');
                        window.loadAfterglowStories();
                    }
                }

                // Load Moments if container exists
                if (typeof window.loadMoments === 'function') {
                    const momentsContainer = document.getElementById('momentsList') || document.getElementById('momentsGrid');
                    if (momentsContainer) {
                        console.log(' Auto-loading Moments...');
                        window.loadMoments();
                    }
                }
            }, 500);
        });

        // ============ GROUP CREATION MODAL ============
        window.createGroup = function () {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                    <div class="modal-content" style = "max-width: 500px;" >
                    <div class="modal-header">
                        <div class="modal-title">Create a New Group</div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Group Name</label>
                            <input type="text" id="newGroupName" class="form-control" placeholder="e.g. Computer Science Study Group">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Description</label>
                            <textarea id="newGroupDesc" class="form-control" rows="3" placeholder="What is this group about?"></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select id="newGroupCategory" class="form-control">
                                <option value="study">Study</option>
                                <option value="social">Social</option>
                                <option value="sports">Sports</option>
                                <option value="hobby">Hobby</option>
                            </select>
                        </div>
                        <button class="btn btn-primary btn-block" id="confirmCreateGroupBtn">
                            <i class="fas fa-plus"></i> Create Group
                        </button>
                    </div>
                </div>
                    `;

            document.body.appendChild(modal);

            modal.querySelector('.close-modal').onclick = () => document.body.removeChild(modal);
            modal.addEventListener('click', (e) => { if (e.target === modal) document.body.removeChild(modal); });

            modal.querySelector('#confirmCreateGroupBtn').onclick = async () => {
                const name = document.getElementById('newGroupName').value.trim();
                const description = document.getElementById('newGroupDesc').value.trim();
                const category = document.getElementById('newGroupCategory').value;

                if (!name) {
                    showNotification('Please enter a group name', 'error');
                    return;
                }

                try {
                    showNotification('Creating group...');
                    await DashboardAPI.createGroup({ name, description, category });
                    showNotification('Group created successfully!');
                    document.body.removeChild(modal);
                    if (window.loadGroups) loadGroups();
                } catch (err) {
                    showNotification('Failed to create group', 'error');
                }
            };
        };

        // Hook up the plus button on Groups page
        const createGroupBtn = document.getElementById('createGroupBtn');
        if (createGroupBtn) {
            createGroupBtn.onclick = () => window.createGroup();
        }

        // ============ OVERRIDE AFTERGLOW UPLOAD ============
        window.uploadAfterglowMedia = async function () {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*,video/*';
            input.style.display = 'none';

            input.addEventListener('change', async function (e) {
                const file = e.target.files[0];
                if (!file) return;

                if (typeof showNotification === 'function') {
                    showNotification('Uploading story...');
                } else {
                    console.log('?? Uploading story...');
                }

                try {
                    console.log('📡 dynamicPatch: Creating story with direct file...', file.name);

                    await DashboardAPI.createStory({
                        media: file,
                        caption: ''
                    });

                    if (typeof showNotification === 'function') showNotification('Story shared!');
                    if (window.loadAfterglowStories) window.loadAfterglowStories();
                    else if (typeof loadAfterglowStories === 'function') loadAfterglowStories();

                } catch (error) {
                    console.error('❌ Story creation failed:', error);
                    if (typeof showNotification === 'function') {
                        showNotification(error.message || 'Failed to share story', 'error');
                    } else {
                        alert('Failed to share story: ' + error.message);
                    }
                }
            });

            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);
        };

        // ============ CREATE LISTING ============
        window.createListing = async function () {
            const title = prompt("Enter item title:");
            if (!title) return;
            const price = prompt("Enter price:");
            const category = prompt("Enter category (Books, Electronics, Furniture, Fashion, Other):");

            try {
                await DashboardAPI.createListing({
                    title,
                    price: parseFloat(price),
                    category,
                    description: `Student selling ${title}`,
                    campus: currentCampus
                });
                showNotification('Listing created!');
                if (window.loadMarketplace) await loadMarketplace();
            } catch (error) {
                showNotification('Failed to create listing', 'error');
            }
        };

        const createListingBtn = document.getElementById('createListingBtn');
        if (createListingBtn) {
            createListingBtn.addEventListener('click', createListing);
        }

        // ============ POST CREATION & MEDIA UPLOAD ============
        // Clone and replace to REMOVE original script.js listeners that clear fields prematurely
        const oldSubmitBtn = document.getElementById('submitPostBtn');
        const oldMediaInput = document.getElementById('mediaUpload');

        if (oldSubmitBtn) {
            const newSubmitBtn = oldSubmitBtn.cloneNode(true);
            oldSubmitBtn.parentNode.replaceChild(newSubmitBtn, oldSubmitBtn);
        }

        if (oldMediaInput) {
            const newMediaInput = oldMediaInput.cloneNode(true);
            oldMediaInput.parentNode.replaceChild(newMediaInput, oldMediaInput);
        }

        const mediaUploadArea = document.getElementById('mediaUploadArea');
        const mediaUploadInput = document.getElementById('mediaUpload');
        const mediaPreview = document.getElementById('mediaPreview');
        const submitPostBtn = document.getElementById('submitPostBtn');
        const postCaption = document.getElementById('postCaption');
        const postTags = document.getElementById('postTags');

        if (mediaUploadArea && mediaUploadInput) {
            mediaUploadArea.onclick = null; // Remove any inline onclick
            mediaUploadArea.addEventListener('click', () => mediaUploadInput.click());

            mediaUploadInput.addEventListener('change', function (e) {
                const file = e.target.files[0];
                if (file) {
                    const isVideo = file.type.startsWith('video');
                    mediaPreview.innerHTML = `
                        <div style="position: relative; display: inline-block;">
                            ${isVideo ?
                            `<video src="${URL.createObjectURL(file)}" style="max-width: 100%; max-height: 200px; border-radius: 10px;" controls></video>` :
                            `<img src="${URL.createObjectURL(file)}" style="max-width: 100%; max-height: 200px; border-radius: 10px; object-fit: cover;">`
                        }
                            <button id="removeMediaBtn" style="position: absolute; top: -10px; right: -10px; background: #ff4757; color: white; border: none; width: 24px; height: 24px; border-radius: 50%; cursor: pointer;">&times;</button>
                        </div>
                    `;
                    document.getElementById('removeMediaBtn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        mediaUploadInput.value = '';
                        mediaPreview.innerHTML = '';
                    });
                }
            });
        }

        if (submitPostBtn) {
            // Add handler for visibility chips
            document.querySelectorAll('.type-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    document.querySelectorAll('.type-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                });
            });

            submitPostBtn.addEventListener('click', async () => {
                const caption = postCaption.value.trim();
                const tagsRaw = postTags.value.trim();
                const file = mediaUploadInput.files[0];
                const postType = document.querySelector('.type-chip.active')?.dataset.postType || 'public';

                if (!caption && !file) {
                    showNotification('Please add a caption or media', 'error');
                    return;
                }

                submitPostBtn.disabled = true;
                submitPostBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

                try {
                    const tags = tagsRaw ? tagsRaw.split(' ').map(t => t.replace('#', '')) : [];

                    await DashboardAPI.createPost({
                        caption,
                        media: file,
                        tags: JSON.stringify(tags),
                        isAnonymous: postType === 'anonymous',
                        postType: postType
                    });

                    showNotification('Post shared successfully!');
                    postCaption.value = '';
                    postTags.value = '';
                    mediaUploadInput.value = '';
                    mediaPreview.innerHTML = '';
                    hideModal('create');
                    if (window.loadFeedPosts) loadFeedPosts();
                } catch (error) {
                    console.error('Post creation failed:', error);
                    showNotification('Failed to share post', 'error');
                } finally {
                    submitPostBtn.disabled = false;
                    submitPostBtn.innerHTML = '<span>Spark It!</span> <i class="fas fa-bolt"></i>';
                }
                return; // Bypass original logic

                console.log(' Attempting to post:', { caption, hasFile: !!file, postType });

                if (!caption && !file) {
                    showNotification('Please add a caption or media', 'error');
                    return;
                }

                submitPostBtn.disabled = true;
                submitPostBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';

                try {
                    let mediaUrl = null;
                    if (file) {
                        console.log(' Uploading media to Cloudinary...');
                        const formData = new FormData();
                        formData.append('media', file);

                        const uploadResponse = await fetch(`${DashboardAPI.baseUrl}/upload`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${DashboardAPI.token}`
                            },
                            body: formData
                        });

                        if (!uploadResponse.ok) throw new Error('Media upload failed');
                        const uploadData = await uploadResponse.json();
                        mediaUrl = uploadData.url;
                        console.log(' Media uploaded:', mediaUrl);
                    }

                    const tags = tagsRaw ? tagsRaw.split(' ').map(t => t.replace('#', '')) : [];

                    await DashboardAPI.createPost({
                        caption,
                        media: mediaUrl,
                        tags: JSON.stringify(tags),
                        isAnonymous: postType === 'anonymous',
                        postType: postType
                    });

                    showNotification('Post shared successfully!');
                    postCaption.value = '';
                    postTags.value = '';
                    mediaUploadInput.value = '';
                    mediaPreview.innerHTML = '';
                    hideModal('create');
                    if (window.loadFeedPosts) loadFeedPosts();
                } catch (error) {
                    console.error('❌ Post creation failed:', error);
                    showNotification('Failed to share post', 'error');
                } finally {
                    submitPostBtn.disabled = false;
                    submitPostBtn.innerHTML = '<span>Spark It!</span> <i class="fas fa-bolt"></i>';
                }
            });
        }

        // ============ USER PROFILE MODAL ============
        window.viewUserProfileFromAPI = async function (userId) {
            console.log(` Loading profile for user ${userId} from API...`);
            try {
                showNotification('Loading profile...');
                const [user, posts, followers, following] = await Promise.all([
                    DashboardAPI.loadUserProfile(userId),
                    DashboardAPI.loadUserPosts(userId),
                    DashboardAPI.loadFollowers(userId),
                    DashboardAPI.loadFollowing(userId)
                ]);

                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.display = 'flex';
                modal.innerHTML = `
                    <div class="modal-content" style="max-width: 500px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;">
                        <div class="modal-header">
                            <div class="modal-title">${user.name}'s Profile</div>
                            <button class="close-modal">&times;</button>
                        </div>
                        <div class="modal-body" style="overflow-y: auto; flex: 1; padding: 20px;">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <img src="${user.avatar || user.avatar_url || '/uploads/avatars/default.png'}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary); margin-bottom: 10px;">
                                <h3>${user.name}</h3>
                                <p style="color: var(--primary); font-weight: 600;">@${user.username}</p>
                                <p style="color: #666; font-size: 14px;">
                                    <i class="fas fa-graduation-cap"></i> ${user.campus} • ${user.major} • ${user.year}
                                </p>
                            </div>

                            <div style="display: flex; justify-content: center; gap: 30px; margin-bottom: 20px; text-align: center;">
                                <div style="cursor: pointer;" id="showFollowersBtn">
                                    <div style="font-weight: bold; font-size: 18px;">${followers.length}</div>
                                    <div style="font-size: 12px; color: #999;">Followers</div>
                                </div>
                                <div style="cursor: pointer;" id="showFollowingBtn">
                                    <div style="font-weight: bold; font-size: 18px;">${following.length}</div>
                                    <div style="font-size: 12px; color: #999;">Following</div>
                                </div>
                                <div>
                                    <div style="font-weight: bold; font-size: 18px;">${posts.length}</div>
                                    <div style="font-size: 12px; color: #999;">Posts</div>
                                </div>
                            </div>

                            <div style="background: #f8f9fa; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                                <h4 style="font-size: 14px; text-transform: uppercase; color: #999; margin-bottom: 8px;">Bio</h4>
                                <p style="line-height: 1.5;">${user.bio || 'No bio yet.'}</p>
                            </div>

                            <div style="margin-bottom: 20px;">
                                <h4 style="font-size: 14px; text-transform: uppercase; color: #999; margin-bottom: 15px;">Posts</h4>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                                    ${posts.length === 0 ? '<p style="grid-column: span 3; text-align: center; color: #999;">No posts yet.</p>' :
                        posts.map(post => `
                                        <div style="aspect-ratio: 1; border-radius: 8px; overflow: hidden; position: relative; cursor: pointer;">
                                            ${post.media ? `<img src="${post.media}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                `<div style="width:100%; height:100%; background:#eee; display:flex; align-items:center; justify-content:center; padding:10px; font-size:10px; overflow:hidden;">${post.caption}</div>`}
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                        <div style="padding: 15px; border-top: 1px solid var(--border); display: flex; gap: 10px;">
                            <button class="btn btn-primary" style="flex: 1;" id="profileFollowBtn">
                                <i class="fas fa-user-plus"></i> Follow
                            </button>
                            <button class="btn" style="flex: 1;" id="profileMessageBtn">
                                <i class="fas fa-paper-plane"></i> Message
                            </button>
                        </div>
                    </div>
                `;

                document.body.appendChild(modal);

                // Social list triggers
                modal.querySelector('#showFollowersBtn').onclick = () => showUserListModal('Followers', followers);
                modal.querySelector('#showFollowingBtn').onclick = () => showUserListModal('Following', following);

                modal.querySelector('#profileFollowBtn').onclick = async () => {
                    await followUserFromAPI(userId);
                    // Refresh view
                    document.body.removeChild(modal);
                    viewUserProfileFromAPI(userId);
                };
                modal.querySelector('#profileMessageBtn').onclick = () => {
                    document.body.removeChild(modal);
                    startChat({ id: user.id, name: user.name, avatar: user.avatar });
                };

                modal.addEventListener('click', (e) => {
                    if (e.target === modal || e.target.classList.contains('close-modal')) {
                        document.body.removeChild(modal);
                    }
                });
            } catch (error) {
                console.error('Failed to view profile:', error);
                showNotification('Failed to load profile', 'error');
            }
        };

        window.showUserListModal = function (title, users) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '2000'; // Above profile modal
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px; max-height: 70vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <div class="modal-title">${title} (${users.length})</div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body" style="overflow-y: auto; flex: 1; padding: 15px;">
                        ${users.length === 0 ? `<p style="text-align:center; color:#999; padding:20px;">No students found.</p>` :
                    users.map(u => `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;" class="user-list-item" data-id="${u.id}">
                                <img src="${u.avatar || u.avatar_url || '/uploads/avatars/default.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600;">${u.name}</div>
                                    <div style="font-size: 12px; color: #666;">@${u.username}</div>
                                </div>
                                <i class="fas fa-chevron-right" style="color: #ccc; font-size: 12px;"></i>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelectorAll('.user-list-item').forEach(item => {
                item.onclick = () => {
                    const userId = item.getAttribute('data-id');
                    document.body.removeChild(modal);
                    // If we are already in a profile modal, we might want to close it first or just stack
                    // For simplicity, we'll try to find any existing profile modal and close it if we navigate
                    const existingProfileModal = document.querySelector('.modal');
                    if (existingProfileModal && existingProfileModal !== modal) {
                        // document.body.removeChild(existingProfileModal); // Keep it or close it? 
                        // Let's close it so we don't have infinite stacks
                        // document.body.removeChild(existingProfileModal);
                    }
                    viewUserProfileFromAPI(userId);
                };
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('close-modal')) {
                    document.body.removeChild(modal);
                }
            });
        };

        // ============ OVERRIDE CREATE POST ELEMENT ============
        // ============ OVERRIDE CREATE POST ELEMENT ============
        // Fully implemented to avoid reliance on missing script.js function
        window.createPostElement = function (post) {
            const timeAgo = (dateStr) => {
                const date = new Date(dateStr);
                const now = new Date();
                const seconds = Math.floor((now - date) / 1000);
                if (seconds < 60) return 'Just now';
                const minutes = Math.floor(seconds / 60);
                if (minutes < 60) return `${minutes}m ago`;
                const hours = Math.floor(minutes / 60);
                if (hours < 24) return `${hours}h ago`;
                const days = Math.floor(hours / 24);
                if (days < 7) return `${days}d ago`;
                return date.toLocaleDateString();
            };

            const postEl = document.createElement('div');
            postEl.className = 'post-card';
            postEl.dataset.id = post.post_id || post.id;

            // Make the whole card clickable for "View Post" functionality
            postEl.onclick = (e) => {
                // Don't trigger if clicking buttons or specific interactive elements
                if (e.target.closest('button') || e.target.closest('.post-avatar') || e.target.closest('.post-username') || e.target.closest('.read-more') || e.target.closest('.post-media')) return;
                window.location.href = `/post/${post.post_id || post.id}`;
            };

            const displayTime = (post.created_at || post.timestamp) ? timeAgo(post.created_at || post.timestamp) : 'Just now';

            // Caption Truncation Logic
            const fullCaption = post.content || post.caption || '';
            const isLongCaption = fullCaption.length > 300; // Truncate after 300 chars
            const displayCaption = isLongCaption ? fullCaption.substring(0, 300) + '...' : fullCaption;

            // Logic to handle both "post.isLiked" or "post.user_has_liked" depending on API mapping
            const isLiked = post.isLiked || post.user_has_liked || false;
            const likesCount = post.sparks || post.likes_count || 0;
            const commentsCount = post.comments || post.comments_count || 0;

            postEl.innerHTML = `
                <div class="post-header">
                    <div class="post-avatar-wrapper">
                        <a href="/profile/${post.user_id || post.userId}" style="display: block; width: 100%; height: 100%;">
                            <img src="${post.avatar || post.avatar_url || '/uploads/avatars/default.png'}" 
                                 alt="${post.username || post.user_name}" 
                                 class="post-avatar" 
                                 onerror="this.onerror=null;this.src='/uploads/avatars/default.png';">
                        </a>
                    </div>
                    <div class="post-user-info">
                        <div class="post-username" 
                             style="cursor: pointer;"
                             onclick="event.stopPropagation(); window.location.href='/profile/${post.user_id || post.userId}'">
                             ${post.isAnonymous ? 'Anonymous Student' : (post.name || post.username || post.user_name || 'Sparkler')}
                             ${post.isAnonymous ? '<span class="anonymous-badge"><i class="fas fa-mask"></i></span>' : ''}
                        </div>
                        <div class="post-campus">
                            <i class="fas fa-graduation-cap"></i>
                            ${post.campus || 'Sparkle Campus'}
                        </div>
                        <div class="post-time">${displayTime}</div>
                    </div>
                    ${post.is_admin ? '<span class="group-admin-badge">Admin</span>' : ''}
                    
                    ${(post.userId === (window.currentUserId || '')) ? `
                    <button class="action-btn" style="margin-left: auto; color: #ff4757;" title="Delete Post" onclick="event.stopPropagation(); window.deletePostConfirm('${post.post_id || post.id}', this)">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    ` : ''}
                </div>

                <div class="post-content-area">
                    <div class="post-caption" style="margin-bottom: 10px;">
                        <span class="post-caption-username">${post.isAnonymous ? 'Anonymous' : (post.username || post.name)}</span> 
                        ${displayCaption}
                        ${isLongCaption ? `<span class="read-more" style="color: var(--primary); cursor: pointer; font-weight: 500;" onclick="event.stopPropagation(); window.location.href='/post/${post.post_id || post.id}'"> See more</span>` : ''}
                    </div>
                </div>

                ${post.media ? `
                <div class="post-media-container">
                    ${(post.media.match(/\.(mp4|webm|ogg)$/i) || post.media.includes('video'))
                        ? `<video src="${post.media}" controls class="post-media" onclick="event.stopPropagation();"></video>`
                        : `<img src="${post.media}" alt="Post media" class="post-media" loading="lazy" onclick="event.stopPropagation(); window.open('${post.media}', '_blank')">`
                    }
                </div>` : ''}

                <div class="post-actions" style="margin-top: auto;">
                    <div class="post-action-left">
                        <button class="action-btn spark-btn ${isLiked ? 'active' : ''}" 
                                onclick="event.stopPropagation(); window.toggleSpark('${post.post_id || post.id}', this)">
                            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
                            <span class="spark-count">${likesCount}</span>
                        </button>
                        <button class="action-btn" onclick="event.stopPropagation(); window.location.href='/post/${post.post_id || post.id}'">
                            <i class="far fa-comment"></i>
                            <span class="spark-count">${commentsCount}</span>
                        </button>
                    </div>
                    <button class="action-btn" style="margin-left: auto;" onclick="event.stopPropagation(); alert('Share feature coming soon!')">
                        <i class="far fa-paper-plane"></i>
                    </button>
                </div>
            `;

            // Re-attach delete logic if needed globally or just rely on global function
            // We adding a global helper for delete to keep HTML string clean
            if (!window.deletePostConfirm) {
                window.deletePostConfirm = async (postId, btn) => {
                    if (confirm('Are you sure you want to delete this post?')) {
                        try {
                            await DashboardAPI.deletePost(postId);
                            const card = btn.closest('.post-card');
                            if (card) {
                                card.style.opacity = '0.5';
                                card.style.pointerEvents = 'none';
                                setTimeout(() => card.remove(), 500);
                            }
                            showNotification('Post deleted');
                        } catch (err) {
                            showNotification('Failed to delete post', 'error');
                        }
                    }
                }
            }

            return postEl;
        };

        // ============ CHAT HISTORY INTEGRATION ============
        window.startChat = async function (contact) {
            console.log(` Starting chat with ${contact.name}...`);

            const messagesContainer = document.getElementById('chatMessages');
            if (!messagesContainer) return;

            // Create Modal UI
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '3000'; // High z-index
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px; height: 80vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 20px;">
                    <div class="modal-header" style="padding: 15px 20px; border-bottom: 1px solid var(--border); background: white;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${contact.avatar || contact.avatar_url || '/uploads/avatars/default.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
                            <div>
                                <div style="font-weight: bold; font-size: 16px;">${contact.name}</div>
                                <div style="font-size: 12px; color: var(--success); display: flex; align-items: center; gap: 4px;">
                                    <span style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%;"></span> Online
                                </div>
                            </div>
                        </div>
                        <button class="close-modal" id="closeChatBtn" style="font-size: 24px; background: none; border: none; cursor: pointer;">&times;</button>
                    </div>
                    <div id="chatMessages" class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px; background: #f0f2f5;">
                        <div style="text-align:center; padding:20px; color:#999;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
                    </div>
                    <div class="modal-footer" style="padding: 15px 20px; border-top: 1px solid var(--border); background: white;">
                        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                            <button id="anonToggleBtn" style="background: #f0f0f0; border: none; padding: 5px 12px; border-radius: 15px; font-size: 12px; color: #666; cursor: pointer;">
                                <i class="fas fa-mask"></i> Send Anonymously: <span id="anonStatus">OFF</span>
                            </button>
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="text" id="chatMessageInput" class="form-control" placeholder="Type your message..." 
                                   style="border-radius: 25px; height: 45px; padding: 0 20px; border: 1px solid #ddd; flex: 1;">
                            <button id="sendChatBtn" class="btn btn-primary" style="border-radius: 50%; width: 45px; height: 45px; padding: 0; display: flex; align-items: center; justify-content: center; transform: rotate(45deg);">
                                <i class="fas fa-paper-plane" style="margin-left: -3px; margin-top: -3px;"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const closeBtn = modal.querySelector('#closeChatBtn');
            const sendBtn = modal.querySelector('#sendChatBtn');
            const input = modal.querySelector('#chatMessageInput');
            const anonBtn = modal.querySelector('#anonToggleBtn');
            const anonStatus = modal.querySelector('#anonStatus');

            let isAnonMode = contact.isAnonymous || false;
            if (isAnonMode) {
                anonStatus.textContent = 'ON';
                anonBtn.style.background = '#6610f2';
                anonBtn.style.color = 'white';
            }

            anonBtn.onclick = () => {
                isAnonMode = !isAnonMode;
                anonStatus.textContent = isAnonMode ? 'ON' : 'OFF';
                anonBtn.style.background = isAnonMode ? '#6610f2' : '#f0f0f0';
                anonBtn.style.color = isAnonMode ? 'white' : '#666';
            };

            closeBtn.onclick = () => modal.remove();
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

            sendBtn.onclick = () => sendMessageToUser(contact.id, contact.chat_session_id, isAnonMode);
            input.onkeypress = (e) => { if (e.key === 'Enter') sendMessageToUser(contact.id, contact.chat_session_id, isAnonMode); };

            input.focus();

            // Load history
            if (contact.chat_session_id) {
                await renderChatHistory(contact.chat_session_id);
            } else if (contact.id || contact.username) {
                // Try to find if we already have a session
                const chats = await DashboardAPI.loadChats();
                const existing = chats.find(c => c.other_user === contact.username || c.other_name === contact.name);
                if (existing) {
                    contact.chat_session_id = existing.chat_session_id;
                    await renderChatHistory(existing.chat_session_id);
                } else {
                    const messagesContainer = document.getElementById('chatMessages');
                    if (messagesContainer) messagesContainer.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">Start a conversation with ${contact.name}!</div>`;
                }
            }
        };

        window.renderChatHistory = async function (sessionId) {
            const messagesContainer = document.getElementById('chatMessages');
            if (!messagesContainer) return;

            try {
                // messagesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#999;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
                const history = await DashboardAPI.loadChatHistory(sessionId);
                messagesContainer.innerHTML = '';

                if (history.length === 0) {
                    messagesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">No previous messages.</div>';
                } else {
                    history.forEach(msg => {
                        const isMe = msg.senderUsername === currentUsername;
                        const messageEl = document.createElement('div');
                        messageEl.style.marginBottom = '15px';
                        messageEl.style.display = 'flex';
                        messageEl.style.flexDirection = isMe ? 'row-reverse' : 'row';
                        messageEl.style.alignItems = 'flex-end';
                        messageEl.style.gap = '8px';

                        messageEl.innerHTML = `
                            ${!isMe ? `<img src="${msg.senderAvatar || msg.avatar_url || '/uploads/avatars/default.png'}" style="width: 30px; height: 30px; border-radius: 50%; align-self: flex-start;">` : ''}
                            <div style="background: ${isMe ? 'linear-gradient(45deg, var(--primary), var(--secondary))' : '#f0f0f0'}; 
                                        color: ${isMe ? 'white' : 'black'}; 
                                        padding: 10px 15px; border-radius: 18px; max-width: 70%;
                                        ${isMe ? 'border-bottom-right-radius: 5px;' : 'border-bottom-left-radius: 5px;'}">
                                ${msg.is_anonymous && !isMe ? `<div style="font-size: 10px; opacity: 0.7; margin-bottom: 4px;"><i class="fas fa-mask"></i> Anonymous student</div>` : ''}
                                ${msg.is_anonymous && isMe ? `<div style="font-size: 10px; opacity: 0.7; margin-bottom: 4px;"><i class="fas fa-mask"></i> Sent anonymously</div>` : ''}
                                <div>${msg.content || msg.text || ''}</div>
                                <div style="font-size: 11px; color: ${isMe ? 'rgba(255,255,255,0.8)' : '#999'}; text-align: right; margin-top: 5px;">
                                    ${msg.timestamp || new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        `;
                        messagesContainer.appendChild(messageEl);
                    });
                }
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } catch (error) {
                console.error('Failed to load chat history:', error);
            }
        };

        window.sendMessageToUser = async function (recipientId, sessionId = null, isAnonymous = false) {
            const input = document.querySelector('#chatMessageInput');
            const content = input?.value.trim();
            if (!content) return;

            try {
                const result = await DashboardAPI.sendMessage({
                    recipient_id: recipientId,
                    chat_session_id: sessionId,
                    content: content,
                    is_anonymous: isAnonymous
                });

                if (input) input.value = '';

                // Refresh the history
                if (result.chat_session_id) {
                    // Update the contact object with the new session ID if it was null
                    const currentChatModal = document.querySelector('.modal[style*="z-index: 3000"]');
                    if (currentChatModal) {
                        // This is a bit hacky, ideally the contact object would be passed around
                        // For now, we assume the contact object used to open the modal is accessible
                        // or we re-fetch it. For simplicity, we'll just update the session ID for the next send.
                        // A better approach would be to store the contact object in the modal's dataset.
                        // For now, we'll just ensure renderChatHistory gets the correct ID.
                    }
                    await renderChatHistory(result.chat_session_id);
                }

                // Also refresh the chat list in the background
                loadChatsFromAPI();
            } catch (error) {
                console.error('Failed to send message:', error);
                if (typeof showNotification === 'function') showNotification('Failed to send message', 'error');
            }
        };

        window.startChatWithUser = async (userId) => {
            console.log(' Fetching user info to start chat:', userId);
            try {
                const user = await DashboardAPI.loadUserProfile(userId);
                startChat({ id: user.id || userId, name: user.name || 'Student', avatar: user.avatar, username: user.username });
            } catch (e) {
                console.error('Failed to start chat with user profile:', e);
                startChat({ id: userId, name: 'Student' });
            }
        };

        // Handle "New Message" button
        document.getElementById('newMessageBtn')?.addEventListener('click', () => {
            // Redirect to connect page to find someone to message?
            // Or show a search modal
            const query = prompt("Enter username or name to find student:");
            if (query) {
                window.loadConnectUsers(query);
                window.switchPage('connect');
            }
        });

        // ============ OVERRIDE MARKETPLACE LOADING ============
        window.loadMarketplace = async function (category = 'all') {
            const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
            const userCampus = localStorage.getItem('sparkleUserCampus') || user.campus || 'all';

            console.log(` Loading marketplace (${category}, campus: ${userCampus}) from API...`);
            const container = document.getElementById('marketplaceContent') || document.getElementById('marketGrid');
            if (!container) {
                console.warn('⚠️ Market container not found');
                return;
            }

            try {
                container.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

                const listings = await DashboardAPI.loadMarketplace(category, userCampus);
                container.innerHTML = '';

                if (!listings || listings.length === 0) {
                    container.innerHTML = `<div style="grid-column: span 2; text-align: center; padding: 40px; color: #666;">
                        <i class="fas fa-store-slash" style="font-size: 40px; margin-bottom: 10px; color:#ccc;"></i>
                        <p>No items found in ${userCampus !== 'all' ? userCampus : 'any campus'}.</p>
                        <button class="btn btn-sm" onclick="window.createListing()" style="margin-top:10px;">Sell Something</button>
                    </div>`;
                    return;
                }

                listings.forEach(item => {
                    const isOwner = item.sellerId === (user.id || user.user_id);
                    const card = document.createElement('div');
                    card.className = 'market-card';
                    card.style = 'background: white; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); display: flex; flex-direction: column; height: 100%;';

                    const imageUrl = (item.images && item.images.length > 0) ? item.images[0] : 'https://via.placeholder.com/300x200?text=No+Image';

                    card.innerHTML = `
                        <div style="position: relative; height: 150px;">
                            <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/300x200?text=Image+Error'">
                            ${item.isSold ? '<div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 2px 8px; border-radius: 5px; font-size: 12px;">SOLD</div>' : ''}
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 5px 10px; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); color: white; font-size: 12px;">
                                ${item.category || 'Item'}
                            </div>
                        </div>
                        <div style="padding: 12px; flex: 1; display: flex; flex-direction: column; gap: 4px;">
                            <div style="font-weight: bold; font-size: 14px; color: #333;">${item.title}</div>
                            <div style="color: var(--primary, #3498db); font-weight: bold; font-size: 16px;">KSh ${item.price}</div>
                            <div style="font-size: 11px; color: #7f8c8d; margin-top: auto;">
                                <i class="fas fa-map-marker-alt"></i> ${item.campus || 'Global'} • ${item.seller || 'Student'}
                            </div>
                            <div style="margin-top: 10px;">
                                ${isOwner && !item.isSold ?
                            `<button class="btn btn-block" style="width:100%; font-size: 12px; padding: 8px; background:#f1f2f6; border:none; border-radius:5px; cursor:pointer;" onclick="markAsSold('${item.id}')">Mark as Sold</button>` :
                            `<button class="btn btn-primary btn-block" style="width:100%; font-size: 12px; padding: 8px; background:var(--primary, #3498db); color:white; border:none; border-radius:5px; cursor:pointer;" onclick="contactSeller('${item.sellerId}', '${item.seller}')" ${item.isSold ? 'disabled' : ''}>${item.isSold ? 'Sold' : 'Contact Seller'}</button>`
                        }
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });
            } catch (error) {
                console.error('Failed to load market:', error);
                container.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 40px; color: red;">Failed to load marketplace items.</div>';
            }
        };

        // Alias for compatibility
        window.loadMarketplaceContent = window.loadMarketplace;

        window.markAsSold = async function (listingId) {
            try {
                await DashboardAPI.markListingAsSold(listingId);
                showNotification('Item marked as sold!');
                loadMarketplace();
            } catch (error) {
                showNotification('Failed to update listing', 'error');
            }
        };

        // ============ CREATE LISTING MODAL ============
        window.createListing = function () {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <div class="modal-title"><i class="fas fa-tag"></i> Sell Item</div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Title</label>
                            <input type="text" id="listingTitle" class="form-control" placeholder="What are you selling?">
                        </div>
                        <div class="form-group">
                            <label>Price (KSh)</label>
                            <input type="number" id="listingPrice" class="form-control" placeholder="e.g. 500">
                        </div>
                        <div class="form-group">
                            <label>Category</label>
                            <select id="listingCategory" class="form-control">
                                <option value="books">Textbooks</option>
                                <option value="electronics">Electronics</option>
                                <option value="furniture">Furniture</option>
                                <option value="clothing">Clothing</option>
                                <option value="services">Services</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea id="listingDescription" class="form-control" rows="3" placeholder="Condition, details, etc."></textarea>
                        </div>
                        <button class="btn btn-primary btn-block" onclick="submitListing()">Post Listing</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
        };

        window.submitListing = async function () {
            const title = document.getElementById('listingTitle')?.value;
            const price = document.getElementById('listingPrice')?.value;
            const category = document.getElementById('listingCategory')?.value;
            const description = document.getElementById('listingDescription')?.value;

            if (!title || !price || !category || !description) {
                alert('Please fill in all fields');
                return;
            }

            try {
                showNotification('Posting listing...');
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                await DashboardAPI.createListing({
                    title,
                    description,
                    price,
                    category,
                    campus: user.campus || 'General'
                });
                showNotification('Listing posted!', 'success');
                document.querySelector('.modal').remove();
                if (window.loadMarketplace) window.loadMarketplace();
            } catch (error) {
                console.error(error);
                showNotification('Failed to create listing', 'error');
            }
        };


        // ============ OVERRIDE EVENTS LOADING ============
        window.loadEvents = async function (campus = 'all') {
            console.log(` Loading events for ${campus}...`);
            // Try multiple possible container IDs
            const container = document.getElementById('eventsContainer') || document.getElementById('eventsContent') || document.getElementById('eventsGrid');

            if (!container) {
                console.warn('⚠️ Events container not found');
                return;
            }

            try {
                container.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

                const events = await DashboardAPI.loadEvents(campus);
                container.innerHTML = '';

                if (!events || events.length === 0) {
                    container.innerHTML = `<div style="grid-column: span 3; text-align: center; padding: 40px; color: #666;">
                        <i class="fas fa-calendar-times" style="font-size: 40px; margin-bottom: 10px; color:#ccc;"></i>
                        <p>No upcoming events found in ${campus !== 'all' ? campus : 'any campus'}.</p>
                        <button class="btn btn-sm" onclick="showModal('createEventModal')" style="margin-top:10px;">Host an Event</button>
                    </div>`;
                    return;
                }

                events.forEach(event => {
                    const el = document.createElement('div');
                    el.className = 'event-card';
                    el.style = "background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);";

                    const date = new Date(event.date);
                    const month = date.toLocaleString('default', { month: 'short' });
                    const day = date.getDate();

                    el.innerHTML = `
                        <div style="height: 120px; background: #eee; position: relative;">
                            <img src="${event.image || 'https://via.placeholder.com/300x150?text=Event'}" style="width:100%; height:100%; object-fit:cover;">
                            <div style="position: absolute; top: 10px; right: 10px; background: white; padding: 5px 12px; border-radius: 8px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                                <div style="font-size: 10px; font-weight: bold; color: var(--primary); text-transform: uppercase;">${month}</div>
                                <div style="font-size: 18px; font-weight: bold; color: #333;">${day}</div>
                            </div>
                        </div>
                        <div style="padding: 15px;">
                            <h3 style="margin: 0 0 5px 0; font-size: 16px;">${event.title}</h3>
                            <div style="font-size: 12px; color: #666; margin-bottom: 10px;">
                                <i class="fas fa-clock"></i> ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 
                                <i class="fas fa-map-marker-alt"></i> ${event.location || 'TBA'}
                            </div>
                            <p style="font-size: 13px; color: #555; margin-bottom: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                ${event.description || 'No description'}
                            </p>
                            <button class="btn btn-block" style="background: #f0f2f5; color: #333; font-weight: 600;">View Details</button>
                        </div>
                    `;
                    container.appendChild(el);
                });

            } catch (e) {
                console.error('Failed to load events', e);
                container.innerHTML = '<div style="color:red; text-align:center; padding:20px;">Failed to load events.</div>';
            }
        };

        // ============ OVERRIDE PAGE SWITCHING ============
        const originalSwitchPage = window.switchPage;
        window.switchPage = async function (page) {
            console.log(' Switching to page (Dynamic):', page);

            // Call original to handle UI toggling
            if (typeof originalSwitchPage === 'function') {
                originalSwitchPage(page);
            } else {
                // Fallback if original is missing/broken
                document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
                const target = document.getElementById(page + 'Page');
                if (target) target.classList.remove('hidden');

                document.querySelectorAll('.nav-item').forEach(n => {
                    n.classList.remove('active');
                    if (n.dataset.page === page) n.classList.add('active');
                });
            }

            // Dynamic Data Hooks - Load data for each page
            try {
                if (page === 'home') {
                    console.log(' Loading home feed...');
                    if (window.loadFeedPosts) await loadFeedPosts();
                    if (window.loadAfterglowStories) await loadAfterglowStories();

                } else if (page === 'connect') {
                    console.log(' Loading connect users...');
                    if (window.loadConnectUsers) await loadConnectUsers();

                } else if (page === 'messages') {
                    console.log(' Loading messages...');
                    if (window.loadChatsFromAPI) await loadChatsFromAPI();

                } else if (page === 'groups') {
                    console.log(' Loading groups...');
                    if (window.loadGroups) await loadGroups();

                } else if (page === 'moments') {
                    console.log(' Loading moments...');
                    if (window.loadMoments) await loadMoments();

                } else if (page === 'market' || page === 'marketplace') {
                    console.log(' Loading marketplace...');
                    if (window.loadMarketplace) await loadMarketplace('all');

                } else if (page === 'lostfound' || page === 'lost-found') {
                    console.log(' Loading lost & found...');
                    if (window.loadLostFoundContent) await loadLostFoundContent('all');

                } else if (page === 'skills' || page === 'skill-market') {
                    console.log(' Loading skill marketplace...');
                    if (window.loadSkillMarketContent) await loadSkillMarketContent('all');

                } else if (page === 'profile') {
                    console.log(' Loading profile...');
                    if (window.updateProfileDisplay) await updateProfileDisplay();
                    if (window.switchProfileTab) await switchProfileTab('posts');
                }
            } catch (error) {
                console.error('❌ Error loading page data:', error);
            }
        };

        // ============ OVERRIDE PROFILE PAGE DISPLAY ============
        window.updateProfileDisplay = async function () {
            const profilePage = document.getElementById('profilePage');
            if (!profilePage) return;

            console.log(' Updating Profile Page with real data...');
            try {
                // Get current user ID (synced or default)
                const userId = localStorage.getItem('sparkleUserId') || '1';

                // Fetch all data in parallel
                const [user, posts, followers, following] = await Promise.all([
                    DashboardAPI.loadUserProfile(userId),
                    DashboardAPI.loadUserPosts(userId),
                    DashboardAPI.loadFollowers(userId),
                    DashboardAPI.loadFollowing(userId)
                ]);

                // Update Header Info
                const nameEl = document.getElementById('profileName');
                const campusEl = document.getElementById('profileCampus');
                const bioEl = document.getElementById('profileBio');
                const avatarEl = document.getElementById('profileAvatar');

                if (nameEl) nameEl.textContent = user.name;
                if (campusEl) campusEl.innerHTML = `<i class="fas fa-graduation-cap"></i> ${user.campus} • ${user.major || 'Student'}`;
                if (bioEl) bioEl.textContent = user.bio || 'No bio yet.';
                if (avatarEl) avatarEl.src = user.avatar;

                // Update Stats
                const postsCount = document.getElementById('profilePosts');
                const sparksCount = document.getElementById('profileSparks'); // We might not have this from API yet, mock or calc
                const groupsCount = document.getElementById('profileGroups'); // We might not have this from API yet

                if (postsCount) postsCount.textContent = posts.length;
                // For now preserve existing values for sparks/groups or fetch if API supports
                // if (sparksCount) sparksCount.textContent = ...

                // Store data for tabs
                profilePage.dataset.posts = JSON.stringify(posts);
                // We'd need to fetch groups/moments too for full tabs

                // Default load posts grid
                const grid = document.getElementById('profileGrid');
                if (grid) {
                    grid.innerHTML = '';
                    if (posts.length === 0) {
                        grid.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 40px; color: #999;">No posts yet.</div>';
                    } else {
                        posts.forEach(post => {
                            const item = document.createElement('div');
                            item.className = 'profile-post-item';
                            // Add some inline style to match grid layout if css is missing class
                            item.style = 'aspect-ratio: 1; overflow: hidden; border-radius: 10px; position: relative; cursor: pointer; border: 1px solid var(--border);';

                            const content = post.media ?
                                `<img src="${post.media}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                `<div style="width:100%; height:100%; background:#f8f9fa; display:flex; align-items:center; justify-content:center; padding:10px; font-size:12px; color:#333; text-align:center;">${post.caption}</div>`;

                            item.innerHTML = content;
                            grid.appendChild(item);
                        });
                    }
                }

            } catch (error) {
                console.error('Failed to update profile page:', error);
            }
        };

        // ============ PROFILE TABS LOGIC ============
        window.switchProfileTab = async function (tab) {
            console.log('Switching profile tab:', tab);
            const tabs = document.querySelectorAll('.profile-tab');
            tabs.forEach(t => {
                t.classList.remove('active');
                if (t.dataset.tab === tab) t.classList.add('active');
            });

            // In a real app we'd filter the grid based on tab
            // For now we just logged it. Real implementation would fetch/render 'moments' or 'groups' here.
        };

        // ============ OVERRIDE FEED POSTS LOADING ============
        window.loadFeedPosts = async function (options = {}) {
            const isSilent = options.silent || false;
            const container = document.getElementById('feed');
            if (!container) return;

            try {
                if (!isSilent) {
                    container.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
                }

                const posts = await DashboardAPI.loadFeed();
                if (!posts) return;

                // Create fragment for flicker-free update
                const fragment = document.createDocumentFragment();
                if (posts.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'text-align: center; padding: 40px 20px; color: #999;';
                    empty.innerHTML = `
                        <i class="fas fa-newspaper" style="font-size: 50px; margin-bottom: 20px;"></i>
                        <h3>No posts yet</h3>
                        <p>Be the first to share something!</p>
                    `;
                    fragment.appendChild(empty);
                } else {
                    posts.forEach(post => {
                        try {
                            const postEl = window.createPostElement(post);
                            fragment.appendChild(postEl);
                        } catch (e) {
                            console.error('Render error:', e);
                        }
                    });
                }

                // Swap content quickly
                container.innerHTML = '';
                container.appendChild(fragment);

            } catch (error) {
                console.error('❌ Failed to load feed:', error);
                if (!isSilent) {
                    container.innerHTML = `<div style="text-align:center; padding:40px; color:var(--danger);">Failed to load feed. <br><button onclick="window.loadFeedPosts()" class="btn btn-sm" style="margin-top:10px;">Retry</button></div>`;
                }
            }
        };

        // ============ OVERRIDE MESSAGING LOADING ============
        window.loadMessages = async function (type = 'direct') {
            console.log(` Loading ${type} messages...`);
            if (type === 'direct' || type === 'anonymous') {
                await loadChatsFromAPI();
            } else {
                const container = document.getElementById('messagesList');
                if (container) {
                    container.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">
                        <i class="fas fa-lock" style="font-size:30px; margin-bottom:10px;"></i>
                        <br>${type.charAt(0).toUpperCase() + type.slice(1)} messaging coming soon!
                    </div>`;
                }
            }
        };

        // ============ OVERRIDE CONFESSIONS LOADING ============
        window.loadEnhancedConfessions = async function () {
            const container = document.getElementById('confessionsListModal');
            if (!container) return;

            try {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
                const userCampus = localStorage.getItem('sparkleUserCampus') || JSON.parse(localStorage.getItem('sparkleUser') || '{}').campus;
                const confessions = await DashboardAPI.loadConfessions(userCampus);
                container.innerHTML = '';

                if (confessions.length === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No confessions yet. Be the first to share!</div>';
                    return;
                }

                confessions.forEach(conf => {
                    const card = document.createElement('div');
                    card.className = 'confession-card';
                    card.innerHTML = `
                        <div class="confession-text">"${conf.text}"</div>
                        <div class="confession-meta">
                            <span><i class="fas fa-university"></i> ${conf.campus || 'Campus'}</span>
                            <span>${conf.timestamp}</span>
                        </div>
                        <div class="confession-actions">
                            <button class="confession-action" onclick="reactToConfession('${conf.id}')">
                                <i class="fas fa-fire"></i> ${conf.reactions || 0}
                            </button>
                            <button class="confession-action" onclick="showConfessionComments('${conf.id}')">
                                <i class="fas fa-comment"></i>
                            </button>
                            <button class="confession-action" onclick="shareConfession('${conf.id}')">
                                <i class="fas fa-share-alt"></i>
                            </button>
                        </div>
                    `;
                    container.appendChild(card);
                });
            } catch (error) {
                console.error('Failed to load confessions:', error);
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">Failed to load confessions.</div>';
            }
        };

        // ============ OVERRIDE POLLS LOADING ============
        window.loadPolls = async function () {
            const container = document.getElementById('activePolls');
            if (!container) return;
            const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
            const userCampus = localStorage.getItem('sparkleUserCampus') || user.campus || 'all';

            try {
                container.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i></div>';
                const polls = await DashboardAPI.loadPolls(userCampus);
                container.innerHTML = '';

                if (polls.length === 0) {
                    container.innerHTML = `<div style="text-align: center; color: #666;">No active polls in ${userCampus !== 'all' ? userCampus : 'any campus'}.</div>`;
                    return;
                }

                polls.forEach(poll => {
                    const card = document.createElement('div');
                    card.className = 'poll-card';
                    // The options from the API now contain option_id and option_text
                    const optionsHtml = poll.options.map((opt) => `
                        <div class="poll-option" onclick="window.votePoll('${poll.id || poll.poll_id}', '${opt.option_id}')">
                            <div class="poll-option-text">${opt.option_text || opt.text}</div>
                            <div class="poll-option-bar" style="width: ${opt.vote_count > 0 ? (Math.round((opt.vote_count / (poll.total_votes || 1)) * 100)) : 0}%"></div>
                            <div class="poll-option-percent">${opt.vote_count > 0 ? (Math.round((opt.vote_count / (poll.total_votes || 1)) * 100)) : 0}%</div>
                        </div>
                    `).join('');

                    card.innerHTML = `
                        <div class="poll-question">${poll.question}</div>
                        <div class="poll-options">${optionsHtml}</div>
                        <div class="poll-footer">
                            <span><i class="fas fa-users"></i> ${poll.total_votes || 0} votes</span>
                            <span>• Ends in ${poll.time_left || '24h'}</span>
                        </div>
                    `;
                    container.appendChild(card);
                });
            } catch (error) {
                console.error('Failed to load polls:', error);
                container.innerHTML = '<div style="text-align: center; color: var(--danger);">Failed to load polls.</div>';
            }
        };

        window.votePoll = async (pollId, optionId) => {
            try {
                await DashboardAPI.votePoll(pollId, optionId);
                showNotification('Vote recorded!');
                loadPolls();
            } catch (error) {
                console.error('Failed to vote:', error);
                if (error.message.includes('Already voted')) {
                    showNotification('You have already voted on this poll', 'info');
                } else {
                    showNotification('Failed to record vote', 'error');
                }
            }
        };

        // ============ OVERRIDE MARKETPLACE LOADING ============
        // Redundant loadMarketplaceContent definition removed (now uses consolidated version with alias)

        // ============ OVERRIDE LOST & FOUND LOADING ============
        window.loadLostFoundContent = async function (type = 'all') {
            const container = document.getElementById('lostFoundItems');
            if (!container) return;
            const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
            const userCampus = localStorage.getItem('sparkleUserCampus') || user.campus || 'all';

            try {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
                const items = await DashboardAPI.loadLostFoundItems(type, userCampus);
                container.innerHTML = '';

                if (items.length === 0) {
                    container.innerHTML = `<div style="text-align: center; padding: 40px; color: #666;">No items reported in ${userCampus !== 'all' ? userCampus : 'any campus'}.</div>`;
                    return;
                }

                items.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'lost-card';
                    card.style = 'background: white; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 15px; overflow: hidden;';
                    card.innerHTML = `
                        <div style="padding: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                                <div class="badge ${item.type === 'lost' ? 'badge-danger' : 'badge-success'}" 
                                     style="background: ${item.type === 'lost' ? '#ff4757' : '#2ed573'}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">
                                    ${item.type.toUpperCase()}
                                </div>
                                <div style="font-size: 11px; color: #999;">${DashboardAPI.formatTimestamp(item.timestamp)}</div>
                            </div>
                            <div style="font-weight: 600; margin-bottom: 5px;">${item.title}</div>
                            <div style="font-size: 13px; color: #666; margin-bottom: 10px;">${item.description}</div>
                            <div style="font-size: 12px; color: #888; display: flex; align-items: center; gap: 5px;">
                                <i class="fas fa-map-marker-alt"></i> ${item.location || item.campus}
                            </div>
                            <button class="btn btn-block" style="margin-top: 15px; font-size: 12px; width:100%;" onclick="claimItem('${item.id}')">
                                ${item.type === 'lost' ? 'I found this' : 'This is mine'}
                            </button>
                        </div>
                    `;
                    container.appendChild(card);
                });
            } catch (error) {
                console.error('Failed to load lost & found:', error);
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">Failed to load items.</div>';
            }
        };

        // ============ OVERRIDE SKILL MARKET LOADING ============
        window.loadSkillMarketContent = async function (type = 'all') {
            const container = document.getElementById('availableSkills');
            if (!container) return;
            const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
            const userCampus = localStorage.getItem('sparkleUserCampus') || user.campus || 'all';

            try {
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

                // Fetch offers from API
                const offers = await DashboardAPI.loadSkillOffers(type === 'all' ? null : type, userCampus);
                container.innerHTML = '';

                if (!offers || offers.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #666;">
                            <i class="fas fa-graduation-cap fa-3x" style="display: block; margin-bottom: 20px; opacity: 0.2;"></i>
                            No skill offers found ${userCampus !== 'all' ? 'in ' + userCampus : ''}.
                            <br><small>Be the first to offer a skill!</small>
                        </div>`;
                    return;
                }

                offers.forEach(offer => {
                    const card = document.createElement('div');
                    card.className = 'skill-card';
                    card.style = 'background: white; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 15px; overflow: hidden;';
                    card.innerHTML = `
                        <div style="padding: 15px;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary, #3498db); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                                    <i class="fas fa-graduation-cap"></i>
                                </div>
                                <div>
                                    <div style="font-weight: 600; font-size: 14px;">${offer.title}</div>
                                    <div style="font-size: 11px; color: #888;">${offer.tutor_name || offer.username || 'Student'}</div>
                                </div>
                            </div>
                            <div style="font-size: 13px; color: #555; margin-bottom: 12px; height: 3.6em; overflow: hidden;">${offer.description}</div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-weight: 700; color: var(--primary, #3498db);">KSh ${offer.price || 'Free'}</div>
                                <button class="btn btn-sm btn-primary" style="padding: 5px 15px; font-size: 12px;" onclick="requestSkill('${offer.id}')">Request</button>
                            </div>
                        </div>
                    `;
                    container.appendChild(card);
                });
            } catch (error) {
                console.error('Failed to load skill market:', error);
                container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--danger);">Failed to load offers.</div>';
            }
        };

        // Aliases for compatibility with different HTML versions
        window.loadMarketplace = window.loadMarketplaceContent;
        window.loadLostFound = window.loadLostFoundContent;
        window.loadSkillMarket = window.loadSkillMarketContent;

        // Redundant loadConnectUsers definition removed (uses more robust version below)

        // Add listener for real-time search
        const userSearchInput = document.getElementById('userSearchInput');
        if (userSearchInput) {
            userSearchInput.addEventListener('input', debounce(() => {
                window.loadConnectUsers();
            }, 500));
        }

        // ============ OVERRIDE MOMENTS LOADING ============
        window.loadMoments = async function () {
            const container = document.getElementById('momentsList') || document.getElementById('momentVideoContainer');
            if (!container) return;

            try {
                console.log('Creating Moments UI...');
                container.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:white;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

                // Fetch from API
                const moments = await DashboardAPI.loadMoments();
                container.innerHTML = '';

                if (moments.length === 0) {
                    container.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: white; text-align: center;">
                            <i class="fas fa-film" style="font-size: 48px; margin-bottom: 20px; opacity: 0.5;"></i>
                            <h3>No Moments Yet</h3>
                            <p style="opacity: 0.7; max-width: 300px; margin-bottom: 20px;">Be the first to share a moment with your campus!</p>
                            <button class="btn btn-primary" onclick="uploadMoment()">
                                <i class="fas fa-plus"></i> Create Moment
                            </button>
                        </div>
                    `;
                    return;
                }

                moments.forEach(moment => {
                    const momentEl = document.createElement('div');
                    momentEl.className = 'moment-video';
                    momentEl.style.height = '100%'; // Ensure full height
                    momentEl.setAttribute('data-moment-id', moment.id);

                    const videoSrc = moment.video || 'assets/videos/sample1.mp4';

                    momentEl.innerHTML = `
                        <video class="moment-video-player" loop playsinline style="width:100%; height:100%; object-fit:cover;">
                            <source src="${videoSrc}" type="video/mp4">
                        </video>
                        <div class="moment-overlay">
                            <div class="moment-header">
                                <img src="${moment.avatar}" alt="${moment.name}" class="moment-avatar">
                                <div class="moment-user-info">
                                    <div class="moment-username">${moment.name}</div>
                                    <div class="moment-campus">${moment.campus}</div>
                                </div>
                            </div>
                            <div class="moment-caption">${moment.caption || ''}</div>
                            <div class="moment-stats">
                                <span class="moment-action-btn"><i class="fas fa-heart"></i> ${moment.likes || 0}</span>
                                <span class="moment-action-btn"><i class="fas fa-comment"></i> ${moment.comments || 0}</span>
                                <span class="moment-action-btn"><i class="fas fa-share"></i> Share</span>
                            </div>
                        </div>
                    `;

                    // Add click to play/pause
                    const video = momentEl.querySelector('video');
                    momentEl.addEventListener('click', () => {
                        if (video.paused) video.play();
                        else video.pause();
                    });

                    container.appendChild(momentEl);
                });

            } catch (error) {
                console.error('Failed to load moments:', error);
                container.innerHTML = '<div style="color:white; text-align:center; padding-top:50%;">Failed to load moments</div>';
            }
        };

        // ============ OVERRIDE CONNECT USERS LOADING ============
        window.loadConnectUsers = async function (q = '', filterCampus = null, options = {}) {
            const isSilent = options.silent || false;
            const container = document.getElementById('connectContainer');
            if (!container) return;

            try {
                if (!isSilent && !q) {
                    container.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>';
                }

                const currentUserId = (JSON.parse(localStorage.getItem('sparkleUser') || '{}')).id || '';
                const users = await DashboardAPI.searchUsers(q, filterCampus);
                const availableUsers = users.filter(u => u.id !== currentUserId);

                const fragment = document.createDocumentFragment();
                if (availableUsers.length === 0) {
                    const empty = document.createElement('div');
                    empty.style.cssText = 'text-align: center; padding: 40px 20px; color: #999; width: 100%;';
                    empty.innerHTML = `
                        <i class="fas fa-users-slash" style="font-size: 40px; margin-bottom: 15px;"></i>
                        <p>No students found matching your search</p>
                    `;
                    fragment.appendChild(empty);
                } else {
                    availableUsers.forEach(user => {
                        const userEl = document.createElement('div');
                        userEl.className = 'connect-card';
                        userEl.innerHTML = `
                            <div class="connect-card-inner">
                                <div class="connect-avatar-container">
                                    <img src="${user.avatar || '/uploads/avatars/default.png'}" alt="${user.name}" class="connect-avatar">
                                    <div class="status-indicator online"></div>
                                </div>
                                <div class="connect-info">
                                    <div class="connect-name">${user.name} @${user.username}</div>
                                    <div class="connect-campus"><i class="fas fa-university"></i> ${user.campus || 'Main Campus'}</div>
                                    <div class="connect-bio">${user.bio || 'Living the Sparkle life! ✨'}</div>
                                </div>
                                <div class="connect-actions">
                                    <button class="btn btn-primary btn-sm" onclick="window.startChatWithUser('${user.id}')">
                                        <i class="fas fa-comments"></i> Chat
                                    </button>
                                    <button class="btn btn-outline btn-sm" onclick="window.viewUserProfileFromAPI('${user.id}')">
                                        Profile
                                    </button>
                                </div>
                            </div>
                        `;
                        fragment.appendChild(userEl);
                    });
                }

                container.innerHTML = '';
                container.appendChild(fragment);

            } catch (error) {
                console.error('Failed to load users:', error);
                container.innerHTML = '<div style="color: red; text-align:center;">Failed to load users</div>';
            }
        };

        // ============ OVERRIDE GROUPS LOADING ============
        // DUPLICATE REMOVED: loadGroups


        // ============ CUSTOM CHAT LOADING ============
        window.loadChatsFromAPI = async function (filterQuery = '') {
            console.log(' Loading chats from API...');

            const listContainer = document.querySelector('.messages-list');
            if (!listContainer) return;

            try {
                if (!filterQuery) listContainer.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>';
                const chats = await DashboardAPI.loadChats();
                console.log(` Loaded ${chats.length} chat sessions`);

                const filteredChats = chats.filter(c => {
                    // Match search query
                    const queryMatch = !filterQuery ||
                        (c.other_name && c.other_name.toLowerCase().includes(filterQuery.toLowerCase())) ||
                        (c.other_user && c.other_user.toLowerCase().includes(filterQuery.toLowerCase()));

                    if (!queryMatch) return false;

                    // Match type tab (based on global active tab)
                    const activeTab = document.querySelector('[data-message-type].active')?.getAttribute('data-message-type') || 'all';

                    if (activeTab === 'anonymous') return c.last_message_anonymous === 1;
                    if (activeTab === 'unread') return c.is_read === 0 || c.unread > 0;
                    if (activeTab === 'groups') return c.chat_session_id && (c.chat_session_id.toString().includes('group') || c.is_group);
                    if (activeTab === 'direct') return !c.last_message_anonymous && !(c.chat_session_id && c.chat_session_id.toString().includes('group'));

                    return true; // "all" or fallback
                });

                if (filteredChats.length === 0) {
                    listContainer.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;"><i class="fas fa-comment-slash" style="font-size:32px; display:block; margin-bottom:10px; opacity:0.3;"></i>No messages found in this category.</div>';
                    return;
                }

                listContainer.innerHTML = '';
                filteredChats.forEach(chat => {
                    const el = document.createElement('div');
                    el.className = 'conversation-item-premium';

                    const isAnonymous = chat.last_message_anonymous === 1;
                    const displayName = isAnonymous ? 'Anonymous Student' : (chat.other_name || chat.other_username || chat.other_user || 'Sparkler');
                    const chatAvatar = isAnonymous ? '/uploads/avatars/default.png' : (chat.other_avatar || '/uploads/avatars/default.png');

                    el.onclick = () => {
                        // Load chat details
                        document.querySelectorAll('.conversation-item-premium').forEach(p => p.classList.remove('active'));
                        el.classList.add('active');
                        startChat({
                            chat_session_id: chat.chat_session_id,
                            id: chat.other_user_id || chat.other_user,
                            name: displayName,
                            username: isAnonymous ? 'anonymous' : (chat.other_username || chat.other_user || 'unknown'),
                            avatar: chatAvatar,
                            isAnonymous: isAnonymous
                        });
                    };

                    const lastMsgTime = chat.last_message_time ? new Date(chat.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';
                    const lastMsgText = isAnonymous ? '<i>[Anonymous Message]</i>' : (chat.last_message_text || chat.last_message || 'Click to view conversation');

                    el.innerHTML = `
                        < div class="avatar-container-premium" >
                            <img src="${chatAvatar}" alt="User" class="avatar-premium" style="${isAnonymous ? 'filter: grayscale(1);' : ''}">
                            ${isAnonymous ? '<div style="position:absolute; bottom:0; right:0; background:#333; color:white; font-size:10px; padding:2px 4px; border-radius:4px;"><i class="fas fa-mask"></i></div>' : ''}
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-weight: 600; font-size: 16px; font-family: 'Outfit'; color: ${isAnonymous ? '#6610f2' : 'inherit'};">${displayName}</span>
                                <span style="font-size: 11px; color: #999;">${lastMsgTime}</span>
                            </div>
                            <div style="font-size: 13px; color: #666; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; opacity: 0.8;">
                                ${lastMsgText}
                            </div>
                        </div>
                    `;
                    listContainer.appendChild(el);
                });
            } catch (e) {
                console.error('Failed to load chats:', e);
            }
        };

        // ============ SIDEBAR HANDLERS ============
        window.showMarketplace = function (category) {
            window.switchPage('marketplace');
            if (window.loadMarketplace) window.loadMarketplace(category);
        };

        // ============ LOST & FOUND PAGE LOADER ============
        window.showLostFound = async function (type) {
            window.switchPage('lostFound');
            if (window.loadLostFoundContent) await window.loadLostFoundContent(type || 'all');
        };

        // Redundant loadLostFoundItems definition removed

        window.claimItem = async function (itemId) {
            try {
                await DashboardAPI.claimLostFoundItem(itemId);
                if (typeof showNotification === 'function') showNotification('Item claimed!', 'success');
                loadLostFoundItems('all');
            } catch (e) {
                console.error(e);
                alert('Failed to claim item');
            }
        };

        // ============ SKILL MARKETPLACE PAGE LOADER ============
        window.showSkillMarket = async function (type) {
            window.switchPage('skillMarket');
            if (window.loadSkillMarketContent) await window.loadSkillMarketContent(type || 'all');
        };

        // Redundant loadSkillOffers definition removed

        window.requestSkillHelp = async function (offerId, tutorName) {
            const message = prompt(`Send a message to ${tutorName}: `);
            if (!message) return;

            try {
                await DashboardAPI.requestSkill(offerId, message);
                if (typeof showNotification === 'function') showNotification('Request sent!', 'success');
            } catch (e) {
                console.error(e);
                alert('Failed to send request');
            }
        };

        // ============ ENHANCED SETTINGS (INSTAGRAM STYLE) ============
        window.showEnhancedSettings = () => {
            const modal = document.getElementById('enhancedSettingsModal');
            if (modal) modal.style.display = 'flex';
        };

        window.switchEnhancedSetting = (tabId, btn) => {
            document.querySelectorAll('.enhanced-settings-content').forEach(el => el.style.display = 'none');
            const target = document.getElementById(tabId);
            if (target) target.style.display = 'block';

            document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));
            if (btn) btn.classList.add('active');
        };

        window.saveDetailedProfile = async () => {
            const nameInput = document.getElementById('enhanced-edit-name') || document.getElementById('editName');
            const bioInput = document.getElementById('enhanced-edit-bio') || document.getElementById('editBio');
            const campusInput = document.getElementById('enhanced-edit-campus') || document.getElementById('editCampus');

            const name = nameInput?.value;
            const bio = bioInput?.value || '';
            const campus = campusInput?.value;

            if (!name || !campus) {
                return alert('Name and Campus are required');
            }

            try {
                await DashboardAPI.updateProfile({ name, bio, campus });
                alert('Profile updated! Refresh to see changes.');

                // Update local storage
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                user.name = name;
                user.bio = bio;
                user.campus = campus;
                localStorage.setItem('sparkleUser', JSON.stringify(user));
                localStorage.setItem('sparkleUserCampus', campus);

                if (window.loadFeedPosts) window.loadFeedPosts();
            } catch (e) {
                console.error(e);
                alert('Failed to update profile');
            }
        };

        window.showConfessionsGallery = async function () {
            try {
                // showNotification not defined in patch but might be in script.js? assume yes or alert
                if (typeof showNotification === 'function') showNotification('Loading confessions...');

                const confessions = await DashboardAPI.loadConfessions();

                // Remove existing if any
                const existing = document.getElementById('confessionsModal');
                if (existing) existing.remove();

                const modal = document.createElement('div');
                modal.id = 'confessionsModal';
                modal.className = 'modal';
                modal.style.display = 'flex';
                modal.innerHTML = `
                        < div class="modal-content" style = "max-height:80vh; overflow-y:auto; max-width:500px;" >
                        <div class="modal-header">
                            <div class="modal-title"><i class="fas fa-user-secret"></i> Anonymous Confessions</div>
                            <button class="close-modal">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div style="background:#f0f2f5; padding:15px; border-radius:10px; margin-bottom:20px; text-align:center; font-style:italic; color:#666;">
                                "Secrets are safe here..."
                            </div>
                            <div id="confessionsList">
                                ${confessions.map(c => `
                                    <div style="background:white; border:1px solid #ddd; padding:15px; border-radius:10px; margin-bottom:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                                        <div style="font-size:15px; line-height:1.5;">"${c.content || c.text}"</div>
                                        <div style="display:flex; justify-content:space-between; margin-top:10px;font-size:12px;color:#999;">
                                            <span><i class="fas fa-graduation-cap"></i> ${c.campus || 'Campus'}</span>
                                            <span>${c.rating_count !== undefined ? c.rating_count : (c.reactions !== undefined ? c.reactions : 0)} <i class="fas fa-fire" style="color:orange;"></i></span>
                                        </div>
                                    </div>
                                `).join('')}
                                ${confessions.length === 0 ? '<div style="text-align:center; color:#999;">No confessions yet. Be the first to whisper.</div>' : ''}
                            </div>
                            <hr style="margin:20px 0; border:0; border-top:1px solid #eee;">
                            <div class="form-group">
                                <label>Whisper a Confession</label>
                                <textarea class="form-control" id="confessionInput" placeholder="Type anonymously..." rows="3"></textarea>
                                <button class="btn btn-primary btn-block" style="margin-top:10px;" onclick="submitConfession()">Whisper</button>
                            </div>
                        </div>
                    </div >
                        `;

                document.body.appendChild(modal);
                modal.querySelector('.close-modal').onclick = () => modal.remove();

            } catch (e) {
                console.error(e);
            }
        };

        window.submitConfession = async function () {
            const input = document.getElementById('confessionInput');
            if (!input || !input.value.trim()) return;

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{}');
                await DashboardAPI.postConfession(input.value.trim(), user.campus || 'General');

                if (typeof showNotification === 'function') showNotification('Confession whispered...', 'success');
                else alert('Confession whispered...');

                input.value = '';

                // Refresh the list inside the modal
                const listContainer = document.getElementById('confessionsList');
                if (listContainer) {
                    listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#999;"><i class="fas fa-spinner fa-spin"></i> Refreshing...</div>';
                    const confessions = await DashboardAPI.loadConfessions();

                    listContainer.innerHTML = confessions.map(c => `
                        < div style = "background:white; border:1px solid #ddd; padding:15px; border-radius:10px; margin-bottom:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05);" >
                            <div style="font-size:15px; line-height:1.5;">"${c.content || c.text}"</div>
                            <div style="display:flex; justify-content:space-between; margin-top:10px;font-size:12px;color:#999;">
                                <span><i class="fas fa-graduation-cap"></i> ${c.campus || 'Campus'}</span>
                                <span>${c.rating_count !== undefined ? c.rating_count : (c.reactions !== undefined ? c.reactions : 0)} <i class="fas fa-fire" style="color:orange;"></i></span>
                            </div>
                        </div >
                        `).join('') || '<div style="text-align:center; color:#999;">No confessions yet. Be the first to whisper.</div>';
                }

            } catch (e) {
                console.error(e);
                alert('Failed to post confession');
            }
        };

        // Helper function to show backend status modal
        const showBackendStatusModal = (feature, endpoints) => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                        < div class="modal-content" style = "max-width:500px;" >
                    <div class="modal-header">
                        <div class="modal-title"><i class="fas fa-code"></i> ${feature}</div>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 10px; padding: 20px; margin-bottom: 15px;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                <i class="fas fa-exclamation-triangle" style="color: #856404; font-size: 20px;"></i>
                                <strong style="color: #856404;">Frontend Ready - Awaiting Backend</strong>
                            </div>
                            <p style="margin: 0; color: #856404; font-size: 14px;">This feature is ready on the frontend but requires backend implementation:</p>
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                            <strong style="display: block; margin-bottom: 10px; color: #333;">Required API Endpoints:</strong>
                            <ul style="margin: 0; padding-left: 20px; color: #666; font-size: 13px;">
                                ${endpoints.map(ep => `<li><code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">${ep}</code></li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div >
                        `;
            document.body.appendChild(modal);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
        };

        // ============ POLLS - FULL IMPLEMENTATION ============
        // ============ POLLS - FULL IMPLEMENTATION ============
        window.createPoll = () => {
            const modal = document.getElementById('createPollModal');
            if (modal) {
                modal.style.display = 'flex';
                // Reset fields
                document.getElementById('pollQuestion').value = '';
                const container = document.getElementById('pollOptionsContainer');
                if (container) {
                    container.innerHTML = `
                        < label class="form-label" > Options</label >
                            <input type="text" class="form-control poll-option" style="margin-bottom: 5px;" placeholder="Option 1">
                                <input type="text" class="form-control poll-option" style="margin-bottom: 5px;" placeholder="Option 2">
                                    `;
                }
            } else {
                console.warn('createPollModal not found in DOM');
            }
        };

        window.addPollOption = () => {
            const container = document.getElementById('pollOptionsContainer') || document.getElementById('pollOptionsList');
            if (!container) return;

            if (container.querySelectorAll('input').length >= 6) {
                alert('Maximum 6 options allowed');
                return;
            }

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-control poll-option';
            input.style.marginBottom = '5px';
            input.placeholder = `Option ${container.querySelectorAll('input').length + 1}`;
            container.appendChild(input);
        };

        window.submitPoll = async () => {
            const questionInput = document.getElementById('pollQuestion');
            const question = questionInput?.value;
            // Handle both .poll-option (dashboard-modals.ejs) and legacy .poll-option-val
            const optionInputs = document.querySelectorAll('.poll-option, .poll-option-val');
            const options = Array.from(optionInputs).map(i => i.value).filter(v => v && v.trim());

            console.log('Sending Poll:', { question, optionsCount: options.length });

            if (!question || options.length < 2) {
                return alert('Please fill in all fields (Question and at least 2 options)');
            }

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{ }');
                await DashboardAPI.createPoll({
                    question,
                    options,
                    campus: user.campus || 'General',
                    is_anonymous: document.getElementById('pollAnonymous')?.checked || false
                });

                if (typeof showNotification === 'function') showNotification('Poll created!', 'success');

                // Close any open poll modals
                const modal = document.getElementById('createPollModal');
                if (modal) modal.style.display = 'none';
                const dynamicModals = document.querySelectorAll('.modal');
                dynamicModals.forEach(m => {
                    if (m.innerHTML.includes('Create Poll')) m.remove();
                });

                if (window.loadPolls) window.loadPolls();
            } catch (e) {
                console.error(e);
                alert('Failed to create poll');
            }
        };


        // ============ EVENTS - FULL IMPLEMENTATION ============
        window.viewEvents = async () => {
            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{ }');
                const userCampus = localStorage.getItem('sparkleUserCampus') || user.campus || 'all';

                // Load events for user's campus or all
                let events = await DashboardAPI.loadEvents(userCampus);

                // If no events for specific campus, try loading all
                if (events.length === 0 && userCampus !== 'all') {
                    console.log('No events for ' + userCampus + ', loading all...');
                    events = await DashboardAPI.loadEvents('all');
                }

                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.style.display = 'flex';
                modal.innerHTML = `
                                    <div class="modal-content" style="max-width:600px; max-height:80vh; overflow-y:auto;">
                                        <div class="modal-header">
                                            <div class="modal-title"><i class="fas fa-calendar-alt"></i> Campus Events</div>
                                            <button class="close-modal">&times;</button>
                                        </div>
                                        <div class="modal-body">
                                            <button class="btn btn-primary btn-block" style="margin-bottom:20px;" onclick="createEvent()">
                                                <i class="fas fa-plus"></i> Create Event
                                            </button>
                                            ${events.length === 0 ? '<p style="text-align:center; color:#999;">No upcoming events</p>' : events.map(e => `
                                <div style="background:#f8f9fa; padding:15px; border-radius:10px; margin-bottom:15px;">
                                    <h4 style="margin:0 0 10px 0;">${e.title}</h4>
                                    <p style="margin:0 0 10px 0; color:#666; font-size:14px;">${e.description || ''}</p>
                                    <div style="display:flex; gap:15px; font-size:13px; color:#666; margin-bottom:10px;">
                                        <span><i class="fas fa-map-marker-alt"></i> ${e.location}</span>
                                        <span><i class="fas fa-clock"></i> ${new Date(e.start_time).toLocaleString()}</span>
                                    </div>
                                    <div style="display:flex; gap:10px;">
                                        <button class="btn btn-primary" style="font-size:12px;" onclick="rsvpToEvent('${e.event_id}', 'going')">
                                            <i class="fas fa-check"></i> Going (${e.total_rsvps || 0})
                                        </button>
                                        <button class="btn" style="font-size:12px;" onclick="rsvpToEvent('${e.event_id}', 'maybe')">Maybe</button>
                                    </div>
                                </div>
                            `).join('')}
                                        </div>
                                    </div>
                                    `;
                document.body.appendChild(modal);
                modal.querySelector('.close-modal').onclick = () => modal.remove();
            } catch (e) {
                console.error(e);
                alert('Failed to load events');
            }
        };

        window.createEvent = () => {
            const modal = document.getElementById('createEventModal');
            if (modal) {
                modal.style.display = 'flex';
                // Reset form
                ['eventTitle', 'eventDescription', 'eventStartTime', 'eventLocation'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
            } else {
                console.warn('createEventModal not found');
            }
        };
        window.submitEvent = async () => {

            const title = document.getElementById('eventTitle')?.value;
            const description = document.getElementById('eventDescription')?.value;
            const location = document.getElementById('eventLocation')?.value;
            const start_time = document.getElementById('eventStartTime')?.value;

            if (!title || !description || !location || !start_time) {
                return alert('Please fill in all fields');
            }

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{ }');
                await DashboardAPI.createEvent({
                    title,
                    description,
                    location,
                    campus: user.campus || 'General',
                    start_time,
                    is_public: true
                });

                if (typeof showNotification === 'function') showNotification('Event created!', 'success');

                const modal = document.getElementById('createEventModal');
                if (modal) modal.style.display = 'none';
                const dynamicModals = document.querySelectorAll('.modal');
                dynamicModals.forEach(m => {
                    if (m.innerHTML.includes('Create Campus Event') || m.innerHTML.includes('Create Event')) m.remove();
                });

                if (window.viewEvents) viewEvents();
            } catch (e) {
                console.error(e);
                alert('Failed to create event');
            }
        };


        window.rsvpToEvent = async (eventId, status) => {
            try {
                await DashboardAPI.rsvpEvent(eventId, status);
                if (typeof showNotification === 'function') showNotification('RSVP updated!', 'success');
                document.querySelectorAll('.modal').forEach(m => m.remove());
                viewEvents(); // Refresh
            } catch (e) {
                console.error(e);
                alert('Failed to RSVP');
            }
        };

        // ============ LIVE STREAMING - FULL IMPLEMENTATION ============
        window.startLiveStream = () => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                                    <div class="modal-content" style="max-width:500px;">
                                        <div class="modal-header">
                                            <div class="modal-title"><i class="fas fa-video"></i> Start Live Stream</div>
                                            <button class="close-modal">&times;</button>
                                        </div>
                                        <div class="modal-body">
                                            <div class="form-group">
                                                <label>Stream Title</label>
                                                <input type="text" class="form-control" id="streamTitle" placeholder="What are you streaming?">
                                            </div>
                                            <div class="form-group">
                                                <label>Description</label>
                                                <textarea class="form-control" id="streamDescription" rows="2"></textarea>
                                            </div>
                                            <div class="form-group">
                                                <label>Category</label>
                                                <select class="form-control" id="streamCategory">
                                                    <option>Gaming</option>
                                                    <option>Study</option>
                                                    <option>Music</option>
                                                    <option>Chat</option>
                                                    <option>Other</option>
                                                </select>
                                            </div>
                                            <button class="btn btn-primary btn-block" onclick="submitStream()">Go Live</button>
                                        </div>
                                    </div>
                                    `;
            document.body.appendChild(modal);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
        };

        window.submitStream = async () => {
            const title = document.getElementById('streamTitle').value;
            const description = document.getElementById('streamDescription').value;
            const category = document.getElementById('streamCategory').value;

            if (!title) {
                return alert('Please provide a stream title');
            }

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{ }');
                const result = await DashboardAPI.startStream({
                    title,
                    description,
                    category,
                    campus: user.campus || 'General',
                    stream_url: 'https://stream.sparkle.app/' + Date.now() // Mock URL
                });

                if (typeof showNotification === 'function') showNotification('Stream started!', 'success');
                document.querySelector('.modal').remove();
            } catch (e) {
                console.error(e);
                alert('Failed to start stream');
            }
        };

        // ============ SKILLS - FULL IMPLEMENTATION ============
        window.offerSkill = () => {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                                    <div class="modal-content" style="max-width:500px;">
                                        <div class="modal-header">
                                            <div class="modal-title"><i class="fas fa-graduation-cap"></i> Offer Your Skills</div>
                                            <button class="close-modal">&times;</button>
                                        </div>
                                        <div class="modal-body">
                                            <div class="form-group">
                                                <label>Skill Type</label>
                                                <select class="form-control" id="skillType">
                                                    <option value="tutoring">Tutoring</option>
                                                    <option value="tech">Tech Help</option>
                                                    <option value="language">Language</option>
                                                    <option value="music">Music</option>
                                                    <option value="sports">Sports</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label>Title</label>
                                                <input type="text" class="form-control" id="skillTitle" placeholder="e.g., Math Tutoring, Guitar Lessons">
                                            </div>
                                            <div class="form-group">
                                                <label>Description</label>
                                                <textarea class="form-control" id="skillDescription" rows="3"></textarea>
                                            </div>
                                            <div class="form-group">
                                                <label>Price</label>
                                                <select class="form-control" id="skillPriceType">
                                                    <option value="free">Free</option>
                                                    <option value="paid">Paid</option>
                                                    <option value="negotiable">Negotiable</option>
                                                </select>
                                            </div>
                                            <button class="btn btn-primary btn-block" onclick="submitSkillOffer()">Offer Skill</button>
                                        </div>
                                    </div>
                                    `;
            document.body.appendChild(modal);
            modal.querySelector('.close-modal').onclick = () => modal.remove();
        };

        window.submitSkillOffer = async () => {
            const skill_type = document.getElementById('skillType')?.value;
            const title = document.getElementById('skillTitle')?.value;
            const description = document.getElementById('skillDescription')?.value;
            const price_type = document.getElementById('skillPriceType')?.value;

            if (!skill_type || !title || !description || !price_type) {
                return alert('Please fill in all fields');
            }

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || '{ }');
                await DashboardAPI.createSkillOffer({
                    skill_type,
                    title,
                    description,
                    price_type,
                    campus: user.campus || 'General',
                    subjects: [title]
                });

                if (typeof showNotification === 'function') showNotification('Skill offer created!', 'success');

                const dynamicModals = document.querySelectorAll('.modal');
                dynamicModals.forEach(m => {
                    if (m.innerHTML.includes('Offer Your Skills')) m.remove();
                });

                if (window.loadSkillMarketContent) window.loadSkillMarketContent();
            } catch (e) {
                console.error(e);
                alert('Failed to create offer');
            }
        };


        // ============ LOST & FOUND - FULL IMPLEMENTATION ============
        window.reportLostItem = () => {
            if (typeof showModal === 'function') {
                showModal('lostFound');
            } else {
                const modal = document.getElementById('lostFoundModal');
                if (modal) modal.style.display = 'flex';
            }

            // Set up the report button
            const reportBtn = document.getElementById('reportItemBtn');
            if (reportBtn) {
                reportBtn.onclick = window.submitLostFoundItem;
            }
        };

        window.submitLostFoundItem = async () => {
            // Handle cross-template IDs (lfItemName vs itemName, etc.)
            const type = document.getElementById('lfType')?.value || document.getElementById('itemType')?.value;
            const title = document.getElementById('lfItemName')?.value || document.getElementById('itemName')?.value;
            const description = document.getElementById('lfDescription')?.value || document.getElementById('itemDetails')?.value;
            const location = document.getElementById('lfLocation')?.value || 'See details';

            if (!type || !title || !description) {
                return alert('Please fill in all fields');
            }

            try {
                const user = JSON.parse(localStorage.getItem('sparkleUser') || localStorage.getItem('currentUser') || '{ }');
                await DashboardAPI.reportLostFoundItem({
                    type,
                    item_name: title,
                    description,
                    location_found: location,
                    date_occurred: new Date().toISOString().split('T')[0],
                    contact_email: user.email || 'Contact via message',
                    campus: user.campus || 'General'
                });

                if (typeof showNotification === 'function') showNotification('Item reported!', 'success');

                // Clear fields across templates
                ['lfItemName', 'itemName', 'lfDescription', 'itemDetails', 'lfLocation'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });

                const modal = document.getElementById('lostFoundModal');
                if (modal) modal.style.display = 'none';

                if (window.loadLostFoundContent) window.loadLostFoundContent(type);
            } catch (e) {
                console.error('Failed to report item:', e);
                alert('Failed to report item: ' + e.message);
            }
        };




        // ============ SIDEBAR BADGE SYNCHRONIZATION ============
        window.updateSidebarBadges = async function () {
            console.log(' Updating sidebar badges...');
            try {
                // 1. Groups Badge (Joined groups)
                const groups = await DashboardAPI.loadGroups();
                const groupsBadge = document.getElementById('groupsCountBadge');
                if (groupsBadge) groupsBadge.textContent = groups.length || '';

                // 2. Lost & Found Badges
                const lostItems = await DashboardAPI.loadLostFoundItems('lost');
                const lostBadge = document.getElementById('lostItemsBadge');
                if (lostBadge) lostBadge.textContent = lostItems.length || '';

                const foundItems = await DashboardAPI.loadLostFoundItems('found');
                const foundBadge = document.getElementById('foundItemsBadge');
                if (foundBadge) foundBadge.textContent = foundItems.length || '';


                // 3. Skill Marketplace Badge
                const skills = await DashboardAPI.loadSkillOffers('tutoring');
                const tutorsBadge = document.getElementById('tutorsBadge');
                if (tutorsBadge) tutorsBadge.textContent = skills.length || '';

                // 4. Events Badge
                const events = await DashboardAPI.loadEvents();
                const eventsBadge = document.getElementById('eventsBadge');
                if (eventsBadge) eventsBadge.textContent = events.length || '';

                // 5. Messages Badge (Unread count placeholder - backend might not have count yet)
                const messagesBadge = document.getElementById('messagesBadge');
                if (messagesBadge) messagesBadge.textContent = '3+'; // Mock indicator for now

            } catch (error) {
                console.error('Failed to update sidebar badges:', error);
            }
        };

        // ============ AUTO-RELOAD DATA ============
        console.log(' Dashboard is live! Initializing data...');
        await loadFeedPosts();
        await loadAfterglowStories();
        await loadGroups();
        await loadConnectUsers();
        if (window.loadMoments) await loadMoments();
        if (window.loadMarketplace) await loadMarketplace();

        // Initial badge update
        await updateSidebarBadges();

        // Silent Background Refresh every 15 seconds
        setInterval(async () => {
            console.log('🔄 Silent Background Refresh...');
            // Don't refresh if a modal is open (optional safety)
            if (document.querySelector('.modal[style*="display: flex"]') || document.querySelector('.afterglow-viewer-modal[style*="display: flex"]')) {
                console.log('⏸️ Refresh paused - Modal active');
                return;
            }

            await Promise.allSettled([
                loadFeedPosts({ silent: true }),
                loadAfterglowStories({ silent: true }),
                loadConnectUsers({ silent: true }),
                updateSidebarBadges()
            ]);
        }, 15000);

        console.log(' Dashboard is now fully dynamic!');

        // ============ SEARCH LISTENERS ============
        document.getElementById('userSearchInput')?.addEventListener('input', debounce(async (e) => {
            console.log(' Searching users:', e.target.value);
            await loadConnectUsers(e.target.value);
        }, 500));

        document.getElementById('messageSearchInput')?.addEventListener('input', debounce(async (e) => {
            console.log('�� Filtering messages:', e.target.value);
            await loadChatsFromAPI(e.target.value);
        }, 300));

        // ============ FORM SUBMISSION LISTENERS ============

        // 1. Confessions Submission
        document.getElementById('postConfessionBtn')?.addEventListener('click', async () => {
            const text = document.getElementById('confessionText')?.value;
            if (!text) return alert('Please enter a confession');

            try {
                await DashboardAPI.postConfession(text);
                if (typeof showNotification === 'function') showNotification('Confession posted anonymously!');
                document.getElementById('confessionText').value = '';
                await loadEnhancedConfessions(); // Refresh gallery
            } catch (error) {
                console.error('Failed to post confession:', error);
                alert('Failed to post confession');
            }
        });

        // 2. Marketplace "Sell Item"
        document.getElementById('createListingBtn')?.addEventListener('click', () => {
            alert('Marketplace listing creation is being integrated with the new backend. Please use the "Create Post" modal and select "Campus Only" for now.');
        });

        // 3. Lost & Found Reporting
        document.getElementById('reportItemBtn')?.addEventListener('click', async () => {
            const type = document.getElementById('itemType')?.value;
            const title = document.getElementById('itemName')?.value;
            const description = document.getElementById('itemDetails')?.value;

            if (!title || !description) return alert('Please fill in all fields');

            try {
                await DashboardAPI.reportLostFoundItem({ type, title, description });
                if (typeof showNotification === 'function') showNotification('Item reported!');
                document.getElementById('itemName').value = '';
                document.getElementById('itemDetails').value = '';
                await loadLostFoundContent(); // Refresh
            } catch (error) {
                console.error('Failed to report item:', error);
                alert('Failed to report item');
            }
        });

        // 4. Skill Market Offering
        document.getElementById('offerSkillBtn')?.addEventListener('click', async () => {
            const title = document.getElementById('skillTitle')?.value;
            const description = document.getElementById('skillDescription')?.value;

            if (!title || !description) return alert('Please fill in all fields');

            try {
                await DashboardAPI.createSkillOffer({ title, description });
                if (typeof showNotification === 'function') showNotification('Skill offered!');
                document.getElementById('skillTitle').value = '';
                document.getElementById('skillDescription').value = '';
                await loadSkillMarketContent(); // Refresh
            } catch (error) {
                console.error('Failed to offer skill:', error);
                alert('Failed to offer skill');
            }
        });

        // 5. Poll Creation
        document.getElementById('createPollBtn')?.addEventListener('click', async () => {
            const question = document.getElementById('pollQuestion')?.value;
            const optionsInputs = document.querySelectorAll('#pollOptions input');
            const options = Array.from(optionsInputs).map(i => i.value).filter(v => v.trim() !== '');

            if (!question || options.length < 2) return alert('Please enter a question and at least 2 options');

            try {
                await DashboardAPI.createPoll(question, options);
                if (typeof showNotification === 'function') showNotification('Poll created!');
                document.getElementById('pollQuestion').value = '';
                await loadPolls(); // Refresh
            } catch (error) {
                console.error('Failed to create poll:', error);
                alert('Failed to create poll');
            }
        });


        // ============ INITIAL LOAD ROUTING ============
        // This ensures the correct content loads even if we didn't use switchPage()
        const path = window.location.pathname;
        if (path.includes('/lost-found')) {
            console.log('�� Direct load: Lost & Found');
            // Ensure function exists before calling
            if (typeof window.loadLostFoundContent === 'function') window.loadLostFoundContent('all');
            else console.error('window.loadLostFoundContent is not defined');
        } else if (path.includes('/marketplace')) {
            console.log('�� Direct load: Marketplace');
            if (typeof window.loadMarketplace === 'function') window.loadMarketplace('all');
        } else if (path.includes('/skill-market')) {
            console.log('�� Direct load: Skill Market');
        } else if (path.includes('/skill-market')) {
            console.log('�� Direct load: Skill Market');
            // 'loadSkillOffers' uses 'skillMarketContent', but /skill-market page uses 'availableSkills'
            // 'loadSkillMarketContent' correctly targets 'availableSkills'
            if (typeof window.loadSkillMarketContent === 'function') window.loadSkillMarketContent('all');
            else if (typeof window.loadSkillOffers === 'function') window.loadSkillOffers('all');
        } else if (path.includes('/groups')) {
            console.log('�� Direct load: Groups');
            if (typeof window.loadGroups === 'function') window.loadGroups();
        } else if (path.includes('/moments')) {
            console.log('�� Direct load: Moments');
            if (typeof window.loadMoments === 'function') window.loadMoments();
        } else if (path.includes('/messages')) {
            console.log('�� Direct load: Messages');
            if (typeof window.loadChatsFromAPI === 'function') window.loadChatsFromAPI();
        } else if (path.includes('/connect')) {
            console.log('�� Direct load: Connect');
            if (typeof window.loadConnectUsers === 'function') window.loadConnectUsers();
        } else if (path === '/dashboard' || path === '/' || path.includes('index')) {
            console.log('�� Direct load: Dashboard');
            if (window.loadFeedPosts) window.loadFeedPosts();
            if (window.loadAfterglowStories) window.loadAfterglowStories();
        }

    }, 100);
});
