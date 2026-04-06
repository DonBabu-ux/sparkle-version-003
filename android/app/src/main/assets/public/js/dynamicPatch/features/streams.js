// streams.js

export function startLiveStream() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Start Live Stream</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <input type="text" id="streamTitle" class="form-control" placeholder="Stream Title">
                <button class="btn btn-primary btn-block" onclick="window.submitStream()">Go Live</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.close-modal').onclick = () => modal.remove();
}

export async function submitStream() {
    const title = document.getElementById('streamTitle')?.value;
    if (!title) return;

    try {
        await window.DashboardAPI.startStream({ title });
        if (window.showNotification) window.showNotification('Stream started!', 'success');
        document.querySelector('.modal')?.remove();
    } catch (e) {
        console.error('Failed to start stream:', e);
    }
}
