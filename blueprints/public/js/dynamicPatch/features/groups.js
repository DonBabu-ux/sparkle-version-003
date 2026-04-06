// groups.js

export async function loadGroups() {
    const container = document.getElementById('groupsContainer');
    if (!container) return;

    try {
        container.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        const userCampus = localStorage.getItem('sparkleUserCampus') || 'all';
        const groups = await window.DashboardAPI.loadGroups(userCampus);

        container.innerHTML = groups.length === 0 ?
            '<div style="text-align:center; padding:40px; color:#999;">No groups found.</div>' :
            groups.map(group => `
                <div class="group-card">
                    <div class="group-header">
                        <div class="group-icon"><i class="${group.icon || 'fas fa-users'}"></i></div>
                        <div class="group-meta">
                            <div class="group-name">${group.name}</div>
                            <div class="group-stats">${group.members} members • ${group.campus}</div>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="window.DashboardAPI.joinGroup('${group.id}').then(() => window.loadGroups())">
                            ${group.isJoined ? 'Joined' : 'Join'}
                        </button>
                    </div>
                </div>
            `).join('');
    } catch (error) {
        console.error('Failed to load groups:', error);
    }
}

export function createGroup() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Create a New Group</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <input type="text" id="newGroupName" class="form-control" placeholder="Group Name">
                <textarea id="newGroupDesc" class="form-control" placeholder="Description"></textarea>
                <button class="btn btn-primary btn-block" id="confirmCreateGroupBtn">Create Group</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.close-modal').onclick = () => modal.remove();
    modal.querySelector('#confirmCreateGroupBtn').onclick = async () => {
        const name = document.getElementById('newGroupName').value.trim();
        const description = document.getElementById('newGroupDesc').value.trim();
        if (!name) return;

        try {
            await window.DashboardAPI.createGroup({ name, description });
            if (window.showNotification) window.showNotification('Group created successfully!', 'success');
            modal.remove();
            loadGroups();
        } catch (err) {
            console.error('Failed to create group:', err);
        }
    };
}
