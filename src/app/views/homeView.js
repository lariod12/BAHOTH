import * as socketClient from '../services/socketClient.js';

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

        <!-- Join Room Modal -->
        <div class="join-modal" id="join-modal" aria-hidden="true">
            <div class="join-modal__backdrop" data-action="close-join-modal"></div>
            <div class="join-modal__content">
                <header class="join-modal__header">
                    <h2 class="join-modal__title">Join Room</h2>
                    <button class="join-modal__close" type="button" data-action="close-join-modal" aria-label="Close">
                        &times;
                    </button>
                </header>
                <div class="join-modal__body">
                    <div class="form-group">
                        <label class="form-label" for="player-name">Your Name</label>
                        <input class="form-input" type="text" id="player-name" placeholder="Enter your name" maxlength="20" />
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="room-id-input">Room ID</label>
                        <input class="form-input" type="text" id="room-id-input" placeholder="BAH-XXXXXX" maxlength="10" />
                    </div>
                    <p class="join-modal__error" id="join-error"></p>
                    <button class="action-button action-button--primary join-modal__submit" type="button" data-action="submit-join">
                        Join
                    </button>
                </div>
            </div>
        </div>

        <!-- Create Room Modal -->
        <div class="join-modal" id="create-modal" aria-hidden="true">
            <div class="join-modal__backdrop" data-action="close-create-modal"></div>
            <div class="join-modal__content">
                <header class="join-modal__header">
                    <h2 class="join-modal__title">Create Room</h2>
                    <button class="join-modal__close" type="button" data-action="close-create-modal" aria-label="Close">
                        &times;
                    </button>
                </header>
                <div class="join-modal__body">
                    <div class="form-group">
                        <label class="form-label" for="host-name">Your Name</label>
                        <input class="form-input" type="text" id="host-name" placeholder="Enter your name" maxlength="20" />
                    </div>
                    <p class="join-modal__error" id="create-error"></p>
                    <button class="action-button action-button--primary join-modal__submit" type="button" data-action="submit-create">
                        Create
                    </button>
                </div>
            </div>
        </div>
    `.trim();
}

export function renderHomeView({ mountEl, onNavigate }) {
    mountEl.innerHTML = renderHomeMarkup();

    // Connect to socket server
    socketClient.connect();

    // Elements
    const joinModal = mountEl.querySelector('#join-modal');
    const createModal = mountEl.querySelector('#create-modal');
    const playerNameInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#player-name'));
    const roomIdInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#room-id-input'));
    const hostNameInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#host-name'));
    const joinError = mountEl.querySelector('#join-error');
    const createError = mountEl.querySelector('#create-error');

    // Modal controls
    const openJoinModal = () => {
        joinModal?.setAttribute('aria-hidden', 'false');
        joinModal?.classList.add('is-open');
        playerNameInput?.focus();
    };

    const closeJoinModal = () => {
        joinModal?.setAttribute('aria-hidden', 'true');
        joinModal?.classList.remove('is-open');
        if (joinError) joinError.textContent = '';
    };

    const openCreateModal = () => {
        createModal?.setAttribute('aria-hidden', 'false');
        createModal?.classList.add('is-open');
        hostNameInput?.focus();
    };

    const closeCreateModal = () => {
        createModal?.setAttribute('aria-hidden', 'true');
        createModal?.classList.remove('is-open');
        if (createError) createError.textContent = '';
    };

    // Button handlers
    const createRoomButton = mountEl.querySelector('[data-action="create-room"]');
    const joinRoomButton = mountEl.querySelector('[data-action="join-room"]');
    const tutorialButton = mountEl.querySelector('[data-action="tutorial"]');

    createRoomButton?.addEventListener('click', () => {
        openCreateModal();
    });

    joinRoomButton?.addEventListener('click', () => {
        openJoinModal();
    });

    tutorialButton?.addEventListener('click', () => {
        onNavigate('#/tutorial');
    });

    // Submit create room
    const submitCreateButton = mountEl.querySelector('[data-action="submit-create"]');
    submitCreateButton?.addEventListener('click', async () => {
        const name = hostNameInput?.value.trim() || 'Host';

        if (createError) createError.textContent = '';

        const result = await socketClient.createRoom(name);

        if (result.success && result.room) {
            closeCreateModal();
            onNavigate(`#/room/${result.room.id}`);
        } else {
            if (createError) {
                createError.textContent = result.error || 'Failed to create room';
            }
        }
    });

    // Submit join room
    const submitJoinButton = mountEl.querySelector('[data-action="submit-join"]');
    submitJoinButton?.addEventListener('click', async () => {
        const name = playerNameInput?.value.trim() || 'Player';
        const roomId = roomIdInput?.value.trim().toUpperCase();

        if (joinError) joinError.textContent = '';

        if (!roomId) {
            if (joinError) joinError.textContent = 'Please enter a Room ID';
            return;
        }

        const result = await socketClient.joinRoom(roomId, name);

        if (result.success && result.room) {
            closeJoinModal();
            onNavigate(`#/room/${result.room.id}`);
        } else {
            if (joinError) {
                joinError.textContent = result.error || 'Failed to join room';
            }
        }
    });

    // Close modals on backdrop/close button
    mountEl.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (target.closest('[data-action="close-join-modal"]')) {
            closeJoinModal();
        }
        if (target.closest('[data-action="close-create-modal"]')) {
            closeCreateModal();
        }
    });

    // Close on Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeJoinModal();
            closeCreateModal();
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Enter key to submit
    roomIdInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitJoinButton?.click();
        }
    });

    hostNameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitCreateButton?.click();
        }
    });
}