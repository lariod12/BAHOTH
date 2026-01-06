function renderHomeMarkup() {
    return `
        <div class="welcome-container">
            <div class="welcome-content">
                <p class="welcome-kicker">WELCOME</p>
                <h1 class="game-title">Betrayal at House on the Hill</h1>
                <p class="game-subtitle">2nd Edition</p>
                <div class="welcome-actions">
                    <button class="action-button action-button--primary" data-action="play">Play</button>
                    <button class="action-button action-button--secondary" data-action="tutorial">Tutorial</button>
                </div>
            </div>
        </div>
    `.trim();
}

export function renderHomeView({ mountEl, onNavigate }) {
    mountEl.innerHTML = renderHomeMarkup();

    const playButton = mountEl.querySelector('[data-action="play"]');
    const tutorialButton = mountEl.querySelector('[data-action="tutorial"]');

    playButton?.addEventListener('click', () => {
        console.log('Play button clicked!');
        alert('Game starting soon...');
    });

    tutorialButton?.addEventListener('click', () => {
        console.log('Tutorial button clicked!');
        onNavigate('#/tutorial');
    });
}


