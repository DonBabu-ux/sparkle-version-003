// hubs.js - Sidebar Hub Toggle Logic

export function initHubs() {
    console.log('🔗 Initializing Sidebar Hubs...');

    const hubs = document.querySelectorAll('.sidebar-hub-container');

    hubs.forEach(hub => {
        const trigger = hub.querySelector('.hub-trigger');
        if (!trigger) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();

            // Close other hubs
            hubs.forEach(otherHub => {
                if (otherHub !== hub) {
                    otherHub.classList.remove('active');
                    otherHub.querySelector('.hub-trigger')?.classList.remove('active-trigger');
                }
            });

            // Toggle current hub
            hub.classList.toggle('active');
            trigger.classList.toggle('active-trigger');
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.sidebar-hub-container')) {
            hubs.forEach(hub => {
                hub.classList.remove('active');
                hub.querySelector('.hub-trigger')?.classList.remove('active-trigger');
            });
        }
    });

    console.log('✅ Hubs Ready.');
}
