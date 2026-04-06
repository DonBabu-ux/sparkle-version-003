// events.js

export async function loadEvents(campus = 'all') {
    const container = document.getElementById('eventsGrid');
    if (!container) return;

    try {
        container.innerHTML = '<div style="grid-column: span 3; text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
        const events = await window.DashboardAPI.loadEvents(campus);
        container.innerHTML = '';

        if (!events || events.length === 0) {
            container.innerHTML = '<p>No upcoming events.</p>';
            return;
        }

        events.forEach(event => {
            const card = document.createElement('div');
            card.className = 'event-card';
            card.innerHTML = `
                <div class="event-image"><img src="${event.image || '/uploads/events/default.png'}"></div>
                <div class="event-info">
                    <h4>${event.title}</h4>
                    <p>${event.location} • ${new Date(event.start_time).toLocaleString()}</p>
                    <button class="btn btn-primary" onclick="window.rsvpToEvent('${event.event_id}', 'going')">RSVP</button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error('Failed to load events:', e);
    }
}

export async function submitEvent(data) {
    try {
        await window.DashboardAPI.createEvent(data);
        if (window.showNotification) window.showNotification('Event created!', 'success');
        loadEvents();
    } catch (e) {
        console.error('Failed to create event:', e);
    }
}
