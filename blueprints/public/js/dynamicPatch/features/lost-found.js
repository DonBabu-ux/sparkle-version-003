// lost-found.js

export async function loadLostFoundContent(type = 'all') {
    const container = document.getElementById('lostFoundItems');
    if (!container) return;

    try {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        const userCampus = localStorage.getItem('sparkleUserCampus') || 'all';
        const items = await window.DashboardAPI.loadLostFoundItems(type, userCampus);
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = '<p>No items found.</p>';
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'lost-card';
            card.innerHTML = `
                <div class="lost-card-content">
                    <div class="badge ${item.type}">${item.type.toUpperCase()}</div>
                    <h4>${item.title}</h4>
                    <p>${item.description}</p>
                    <button class="btn btn-primary btn-block" onclick="window.claimItem('${item.id}')">
                        ${item.type === 'lost' ? 'I found this' : 'This is mine'}
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to load lost & found:', error);
    }
}

export async function submitLostFoundItem() {
    const type = document.getElementById('lfType')?.value;
    const title = document.getElementById('lfItemName')?.value;
    const description = document.getElementById('lfDescription')?.value;

    if (!type || !title || !description) return;

    try {
        await window.DashboardAPI.reportLostFoundItem({ type, item_name: title, description });
        if (window.showNotification) window.showNotification('Item reported!', 'success');
        loadLostFoundContent(type);
    } catch (e) {
        console.error('Failed to report item:', e);
    }
}
