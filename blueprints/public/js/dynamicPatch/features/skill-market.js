// skill-market.js

export async function loadSkillMarketContent(type = 'all') {
    const container = document.getElementById('availableSkills');
    if (!container) return;

    try {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        const userCampus = localStorage.getItem('sparkleUserCampus') || 'all';
        const offers = await window.DashboardAPI.loadSkillOffers(type, userCampus);
        container.innerHTML = '';

        if (!offers || offers.length === 0) {
            container.innerHTML = '<p>No skill offers found.</p>';
            return;
        }

        offers.forEach(offer => {
            const card = document.createElement('div');
            card.className = 'skill-card';
            card.innerHTML = `
                <div class="skill-card-content">
                    <div class="skill-icon"><i class="fas fa-graduation-cap"></i></div>
                    <div class="skill-info">
                        <h4>${offer.title}</h4>
                        <p>${offer.description}</p>
                        <div class="skill-footer">
                            <span class="price">KSh ${offer.price || 'Free'}</span>
                            <button class="btn btn-sm btn-primary" onclick="window.requestSkill('${offer.id}')">Request</button>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to load skill market:', error);
    }
}
