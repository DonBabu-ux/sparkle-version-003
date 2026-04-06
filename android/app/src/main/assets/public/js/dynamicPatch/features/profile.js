// profile.js

export function initProfile() {
    // Initial sync
    syncGlobalState();
}

function syncGlobalState() {
    const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (window.appState) {
        window.appState.currentUser = {
            id: currentUserData.id || 'guest',
            username: currentUserData.username || 'Guest',
            name: currentUserData.name || 'Guest User'
        };
        updateProfileDisplay();
    }
}

export async function updateProfileDisplay() {
    const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const userId = currentUserData.id;
    if (!userId) return;

    try {
        const profile = await window.DashboardAPI.loadUserProfile(userId);

        const sidebarName = document.querySelector('.profile-info h3');
        const sidebarUsername = document.querySelector('.profile-info p');
        const sidebarAvatar = document.querySelector('.profile-image img');

        if (sidebarName) sidebarName.textContent = profile.name;
        if (sidebarUsername) sidebarUsername.textContent = `@${profile.username}`;
        if (sidebarAvatar) sidebarAvatar.src = profile.avatar;

        const profileName = document.getElementById('profileName');
        const profileBio = document.getElementById('profileBio');

        if (profileName) profileName.textContent = profile.name;
        if (profileBio) profileBio.textContent = profile.bio || 'No bio yet.';

    } catch (err) {
        console.error('Failed to sync profile display:', err);
    }
}

export async function saveProfileChanges() {
    const nameInput = document.getElementById('editName');
    const bioInput = document.getElementById('editBio');
    const campusInput = document.getElementById('editCampus');
    const majorInput = document.getElementById('editMajor');

    if (!nameInput?.value || !campusInput?.value || !majorInput?.value) {
        if (window.showNotification) window.showNotification('Please fill in all fields', 'warning');
        return;
    }

    const profileData = {
        name: nameInput.value,
        bio: bioInput.value || '',
        campus: campusInput.value,
        major: majorInput.value
    };

    try {
        await window.DashboardAPI.updateProfile(profileData);
        if (window.showNotification) window.showNotification('Profile updated!', 'success');
        updateProfileDisplay();
    } catch (err) {
        if (window.showNotification) window.showNotification('Failed to update profile', 'error');
    }
}

export async function switchProfileTab(tab) {
    const container = document.getElementById('profileGrid');
    if (!container) return;

    document.querySelectorAll('.profile-tab').forEach(t => {
        t.classList.remove('active');
        if (t.dataset.tab === tab) t.classList.add('active');
    });

    container.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    if (tab === 'posts') {
        const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const posts = await window.DashboardAPI.loadUserPosts(currentUserData.id);
        container.innerHTML = '';
        posts.forEach(post => {
            const postEl = document.createElement('div');
            postEl.className = 'post-grid-item';
            postEl.innerHTML = post.media ? `<img src="${post.media}">` : `<div>${post.caption}</div>`;
            container.appendChild(postEl);
        });
    }
}
