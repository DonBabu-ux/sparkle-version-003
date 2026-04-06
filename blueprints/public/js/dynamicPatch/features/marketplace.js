// marketplace.js

export async function loadMarketplace(category = 'all') {
    const container = document.getElementById('marketGrid');
    if (!container) return;

    try {
        container.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        const listings = await window.DashboardAPI.loadMarketplace(category);
        container.innerHTML = '';

        if (!listings || listings.length === 0) {
            container.innerHTML = '<p>No items found.</p>';
            return;
        }

        listings.forEach(item => {
            const card = document.createElement('div');
            card.className = 'market-card';
            card.innerHTML = `
                <div class="market-media"><img src="${item.media || '/uploads/marketplace/default.png'}"></div>
                <div class="market-info">
                    <h4>${item.title}</h4>
                    <p>KSh ${item.price}</p>
                    <button class="btn btn-primary" onclick="window.contactSeller('${item.seller_id}', '${item.seller_name}')">Contact Seller</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load marketplace:', err);
    }
}

export async function createListing() {
    // Logic for showing create listing modal
}

export async function submitListing(data) {
    try {
        await window.DashboardAPI.createListing(data);
        if (window.showNotification) window.showNotification('Listing posted!', 'success');
        loadMarketplace();
    } catch (err) {
        console.error('Failed to post listing:', err);
    }
}
