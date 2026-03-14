// confessions.js

export async function loadConfessionsGallery() {
    try {
        const confessions = await window.DashboardAPI.loadConfessions();
        const container = document.getElementById('confessionsList');
        if (!container) return;

        container.innerHTML = confessions.map(c => `
            <div class="confession-card">
                <div class="confession-text">"${c.content || c.text}"</div>
                <div class="confession-meta">
                    <span><i class="fas fa-graduation-cap"></i> ${c.campus || 'Campus'}</span>
                    <span>${c.reactions || 0} <i class="fas fa-fire"></i></span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Failed to load confessions:', e);
    }
}

export async function submitConfession() {
    const input = document.getElementById('confessionInput');
    if (!input || !input.value.trim()) return;

    try {
        await window.DashboardAPI.postConfession(input.value.trim());
        if (window.showNotification) window.showNotification('Confession whispered...', 'success');
        input.value = '';
        loadConfessionsGallery();
    } catch (e) {
        console.error('Failed to post confession:', e);
    }
}
