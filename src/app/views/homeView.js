function renderHomeMarkup() {
    return `
        <div class="welcome-container">
            <div class="welcome-content">
                <p class="welcome-kicker">WELCOME</p>
                <h1 class="game-title">Betrayal at House on the Hill</h1>
                <p class="game-subtitle">2nd Edition</p>
                <div class="welcome-actions">
                    <button class="action-button action-button--primary" data-action="create-room">Create Room</button>
                    <button class="action-button action-button--secondary" data-action="join-room">Join Room</button>
                    <button class="action-button action-button--secondary" data-action="tutorial">Tutorial</button>
                </div>
            </div>
        </div>
    `.trim();
}

export function renderHomeView({ mountEl, onNavigate }) {
    mountEl.innerHTML = renderHomeMarkup();

    const createRoomButton = mountEl.querySelector('[data-action="create-room"]');
    const joinRoomButton = mountEl.querySelector('[data-action="join-room"]');
    const tutorialButton = mountEl.querySelector('[data-action="tutorial"]');

    createRoomButton?.addEventListener('click', () => {
        console.log('Create Room button clicked!');
        alert('Create Room feature coming soon...');
    });

    joinRoomButton?.addEventListener('click', () => {
        console.log('Join Room button clicked!');
        alert('Join Room feature coming soon...');
    });

    tutorialButton?.addEventListener('click', () => {
        console.log('Tutorial button clicked!');
        onNavigate('#/tutorial');
    });
}


