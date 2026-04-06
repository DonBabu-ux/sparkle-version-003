// polls.js

export async function loadPolls() {
    const container = document.getElementById('activePolls');
    if (!container) return;

    try {
        container.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i></div>';
        const userCampus = localStorage.getItem('sparkleUserCampus') || 'all';
        const polls = await window.DashboardAPI.loadPolls(userCampus);
        container.innerHTML = '';

        if (polls.length === 0) {
            container.innerHTML = '<p>No active polls found.</p>';
            return;
        }

        polls.forEach(poll => {
            const card = document.createElement('div');
            card.className = 'poll-card';
            const optionsHtml = poll.options.map(opt => `
                <div class="poll-option" onclick="window.votePoll('${poll.id}', '${opt.option_id}')">
                    <div class="poll-option-text">${opt.option_text}</div>
                    <div class="poll-option-bar" style="width: ${poll.total_votes > 0 ? (opt.vote_count / poll.total_votes * 100) : 0}%"></div>
                </div>
            `).join('');

            card.innerHTML = `
                <div class="poll-question">${poll.question}</div>
                <div class="poll-options">${optionsHtml}</div>
                <div class="poll-footer">
                    <span><i class="fas fa-users"></i> ${poll.total_votes || 0} votes</span>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to load polls:', error);
    }
}

export async function votePoll(pollId, optionId) {
    try {
        await window.DashboardAPI.votePoll(pollId, optionId);
        if (window.showNotification) window.showNotification('Vote recorded!', 'success');
        loadPolls();
    } catch (error) {
        console.error('Failed to vote:', error);
    }
}
