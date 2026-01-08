const MOCK_ROOM_ID = 'BAH-123456';
const MOCK_MIN_PLAYERS = 3;
const MOCK_MAX_PLAYERS = 6;

function renderRoomMarkup({ roomId }) {
    return `
        <div class="welcome-container room-container">
            <div class="room-surface">
                <header class="room-header">
                    <div>
                        <p class="welcome-kicker">Room</p>
                        <h1 class="page-title">Private Lobby</h1>
                        <p class="room-subtitle">Room ID: <span class="room-id">${roomId}</span></p>
                    </div>
                    <div class="room-actions">
                        <button class="chip-button" type="button" data-action="copy-id">Copy ID</button>
                        <button class="chip-button chip-button--ghost" type="button" data-action="leave-room">Leave</button>
                    </div>
                </header>

                <div class="room-grid">
                    <section class="room-panel room-panel--players">
                        <div class="room-panel__header">
                            <p class="welcome-kicker">Players</p>
                            <p class="room-panel__meta">4 / ${MOCK_MAX_PLAYERS}</p>
                        </div>
                        <div class="players-list">
                            <div class="player-slot is-host">
                                <div class="player-slot__top">
                                    <span class="player-name">You</span>
                                    <span class="badge badge--accent">HOST</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="badge badge--success">Ready</span>
                                    <span class="player-note">Creator of this room</span>
                                </div>
                            </div>

                            <div class="player-slot">
                                <div class="player-slot__top">
                                    <span class="player-name">Player 2</span>
                                    <span class="badge badge--success">Ready</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Character locked in</span>
                                </div>
                            </div>

                            <div class="player-slot">
                                <div class="player-slot__top">
                                    <span class="player-name">Player 3</span>
                                    <span class="badge badge--muted">Selecting</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Choosing a character...</span>
                                </div>
                            </div>

                            <div class="player-slot">
                                <div class="player-slot__top">
                                    <span class="player-name">Player 4</span>
                                    <span class="badge badge--muted">Not Ready</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Joined the room</span>
                                </div>
                            </div>

                            <div class="player-slot is-waiting">
                                <div class="player-slot__top">
                                    <span class="player-name">Waiting for player...</span>
                                    <span class="badge badge--muted">Slot 2</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Share the Room ID to invite</span>
                                </div>
                            </div>

                            <div class="player-slot is-waiting">
                                <div class="player-slot__top">
                                    <span class="player-name">Waiting for player...</span>
                                    <span class="badge badge--muted">Slot 3</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Min ${MOCK_MIN_PLAYERS} players required</span>
                                </div>
                            </div>

                            <div class="player-slot is-waiting">
                                <div class="player-slot__top">
                                    <span class="player-name">Waiting for player...</span>
                                    <span class="badge badge--muted">Slot 4</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Slots remain open</span>
                                </div>
                            </div>

                            <div class="player-slot is-waiting">
                                <div class="player-slot__top">
                                    <span class="player-name">Waiting for player...</span>
                                    <span class="badge badge--muted">Slot 5</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Up to ${MOCK_MAX_PLAYERS} players</span>
                                </div>
                            </div>

                            <div class="player-slot is-waiting">
                                <div class="player-slot__top">
                                    <span class="player-name">Waiting for player...</span>
                                    <span class="badge badge--muted">Slot 6</span>
                                </div>
                                <div class="player-slot__status">
                                    <span class="player-note">Invite link or Room ID</span>
                                </div>
                            </div>
                        </div>
                        <p class="room-hint">Min ${MOCK_MIN_PLAYERS} players to start · Max ${MOCK_MAX_PLAYERS} players</p>
                    </section>

                    <section class="room-panel room-panel--characters">
                        <div class="room-panel__header">
                            <p class="welcome-kicker">Choose character</p>
                            <p class="room-panel__meta">UI-only mock</p>
                        </div>
                        <div class="character-grid">
                            <div class="character-card is-selected" data-character="ox-bellows">
                                <div class="character-card__header">
                                    <span class="character-name">Ox Bellows</span>
                                    <span class="badge badge--accent">Selected</span>
                                </div>
                                <p class="character-note">Strong and steady. Great for holding the line.</p>
                            </div>

                            <div class="character-card" data-character="flash-williams">
                                <div class="character-card__header">
                                    <span class="character-name">Flash Williams</span>
                                    <span class="badge badge--muted">Available</span>
                                </div>
                                <p class="character-note">Fast explorer. Useful for early scouting.</p>
                            </div>

                            <div class="character-card" data-character="vivian-lopez">
                                <div class="character-card__header">
                                    <span class="character-name">Vivian Lopez</span>
                                    <span class="badge badge--muted">Available</span>
                                </div>
                                <p class="character-note">Balanced stats. Flexible for any role.</p>
                            </div>

                            <div class="character-card is-taken" data-character="jenny-leclerc">
                                <div class="character-card__header">
                                    <span class="character-name">Jenny LeClerc</span>
                                    <span class="badge badge--muted">Taken</span>
                                </div>
                                <p class="character-note">Reserved by another player.</p>
                            </div>

                            <div class="character-card" data-character="zoe-ingstrom">
                                <div class="character-card__header">
                                    <span class="character-name">Zoe Ingstrom</span>
                                    <span class="badge badge--muted">Available</span>
                                </div>
                                <p class="character-note">High sanity. Strong against haunt effects.</p>
                            </div>

                            <div class="character-card" data-character="father-rhinehardt">
                                <div class="character-card__header">
                                    <span class="character-name">Father Rhinehardt</span>
                                    <span class="badge badge--muted">Available</span>
                                </div>
                                <p class="character-note">Support role. Helps the team stay calm.</p>
                            </div>
                        </div>
                        <p class="room-hint">Character selection is UI-only for now</p>
                    </section>
                </div>

                <footer class="room-footer">
                    <div class="room-start">
                        <button class="action-button action-button--primary room-start__button" type="button" data-action="start-room">Start</button>
                        <p class="room-start__hint">Minimum reached (4 / 6). Ready to start.</p>
                    </div>
                </footer>
            </div>
        </div>
    `.trim();
}

export function renderRoomView({ mountEl, onNavigate }) {
    const roomId = MOCK_ROOM_ID;

    mountEl.innerHTML = renderRoomMarkup({ roomId });

    const copyButton = mountEl.querySelector('[data-action="copy-id"]');
    copyButton?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            copyButton.textContent = 'Copied';
            setTimeout(() => {
                copyButton.textContent = 'Copy ID';
            }, 1800);
        } catch (error) {
            console.warn('Clipboard API unavailable', error);
            alert(`Room ID: ${roomId}`);
        }
    });

    const leaveButton = mountEl.querySelector('[data-action="leave-room"]');
    leaveButton?.addEventListener('click', () => {
        onNavigate('#/');
    });

    const characterCards = Array.from(mountEl.querySelectorAll('[data-character]'));
    const resetAvailableBadges = () => {
        for (const card of characterCards) {
            if (card.classList.contains('is-taken')) continue;
            card.classList.remove('is-selected');
            const badge = card.querySelector('.badge');
            if (!badge) continue;
            badge.textContent = 'Available';
            badge.classList.remove('badge--accent');
            badge.classList.add('badge--muted');
        }
    };

    for (const card of characterCards) {
        if (card.classList.contains('is-taken')) continue;
        card.addEventListener('click', () => {
            resetAvailableBadges();
            card.classList.add('is-selected');
            const badge = card.querySelector('.badge');
            if (badge) {
                badge.textContent = 'Selected';
                badge.classList.remove('badge--muted');
                badge.classList.add('badge--accent');
            }
        });
    }

    const startButton = mountEl.querySelector('[data-action="start-room"]');
    startButton?.addEventListener('click', () => {
        alert('Game start (mock).');
    });
}

