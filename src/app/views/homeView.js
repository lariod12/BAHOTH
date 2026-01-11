import * as socketClient from '../services/socketClient.js';

// Debug mode state
let isDebugMode = false;
let debugPlayerCount = 3;

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
                <div class="debug-mode-section">
                    <label class="debug-toggle">
                        <input type="checkbox" id="debug-mode-toggle" />
                        <span class="debug-toggle__label">Debug Mode</span>
                    </label>
                    <div class="debug-options" id="debug-options">
                        <label class="debug-options__label">Players:</label>
                        <select class="debug-options__select" id="debug-player-count">
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                            <option value="6">6</option>
                        </select>
                    </div>
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
                    <div class="room-status" id="room-status" style="display: none;">
                        <span class="room-status__text" id="room-status-text"></span>
                    </div>
                    <p class="join-modal__error" id="join-error"></p>
                    <button class="action-button action-button--primary join-modal__submit" type="button" data-action="submit-join" id="submit-join-btn">
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
                    <div class="form-group">
                        <label class="form-label" for="max-players">Max Players</label>
                        <select class="form-input form-select" id="max-players">
                            <option value="3">3 players</option>
                            <option value="4">4 players</option>
                            <option value="5">5 players</option>
                            <option value="6" selected>6 players</option>
                        </select>
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
    const roomStatus = mountEl.querySelector('#room-status');
    const roomStatusText = mountEl.querySelector('#room-status-text');
    const submitJoinBtn = /** @type {HTMLButtonElement} */ (mountEl.querySelector('#submit-join-btn'));

    // Debug mode elements
    const debugModeToggle = /** @type {HTMLInputElement} */ (mountEl.querySelector('#debug-mode-toggle'));
    const debugOptions = mountEl.querySelector('#debug-options');
    const debugPlayerCountSelect = /** @type {HTMLSelectElement} */ (mountEl.querySelector('#debug-player-count'));

    // Debug mode toggle handler
    const updateDebugOptionsVisibility = () => {
        if (debugOptions) {
            debugOptions.classList.toggle('is-visible', isDebugMode);
        }
    };

    debugModeToggle?.addEventListener('change', () => {
        isDebugMode = debugModeToggle.checked;
        updateDebugOptionsVisibility();
    });

    debugPlayerCountSelect?.addEventListener('change', () => {
        debugPlayerCount = parseInt(debugPlayerCountSelect.value, 10);
    });

    // Initialize debug options visibility
    updateDebugOptionsVisibility();

    // Track room check state
    let checkedRoomId = null;
    let isRoomFull = false;

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
        if (roomStatus) roomStatus.style.display = 'none';
        if (roomStatusText) roomStatusText.textContent = '';
        checkedRoomId = null;
        isRoomFull = false;
        if (submitJoinBtn) submitJoinBtn.disabled = false;
    };

    // Check room status when Room ID changes
    const checkRoomStatus = async (roomId) => {
        if (!roomId || roomId.length < 10) {
            if (roomStatus) roomStatus.style.display = 'none';
            if (submitJoinBtn) submitJoinBtn.disabled = false;
            isRoomFull = false;
            checkedRoomId = null;
            return;
        }

        const result = await socketClient.checkRoom(roomId);

        if (!result.success) {
            if (roomStatus) roomStatus.style.display = 'none';
            if (joinError) joinError.textContent = result.error || 'Room not found';
            if (submitJoinBtn) submitJoinBtn.disabled = true;
            isRoomFull = true;
            return;
        }

        const room = result.room;
        checkedRoomId = roomId;

        if (roomStatus) roomStatus.style.display = 'block';

        if (room.isFull) {
            if (roomStatusText) {
                roomStatusText.textContent = `Room is full (${room.playerCount}/${room.maxPlayers})`;
                roomStatusText.classList.add('room-status--full');
                roomStatusText.classList.remove('room-status--ok');
            }
            if (submitJoinBtn) submitJoinBtn.disabled = true;
            isRoomFull = true;
        } else {
            if (roomStatusText) {
                roomStatusText.textContent = `${room.playerCount}/${room.maxPlayers} players`;
                roomStatusText.classList.remove('room-status--full');
                roomStatusText.classList.add('room-status--ok');
            }
            if (submitJoinBtn) submitJoinBtn.disabled = false;
            isRoomFull = false;
        }

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

    createRoomButton?.addEventListener('click', async () => {
        if (isDebugMode) {
            // Create debug room directly without modal
            const result = await socketClient.createDebugRoom(debugPlayerCount);
            if (result.success && result.room) {
                onNavigate(`#/room/${result.room.id}`);
            } else {
                console.error('Failed to create debug room:', result.error);
            }
        } else {
            openCreateModal();
        }
    });

    joinRoomButton?.addEventListener('click', () => {
        openJoinModal();
    });

    tutorialButton?.addEventListener('click', () => {
        onNavigate('#/tutorial');
    });

    // Submit create room
    const submitCreateButton = mountEl.querySelector('[data-action="submit-create"]');
    const maxPlayersSelect = /** @type {HTMLSelectElement} */ (mountEl.querySelector('#max-players'));

    submitCreateButton?.addEventListener('click', async () => {
        const name = hostNameInput?.value.trim() || 'Host';
        const maxPlayers = parseInt(maxPlayersSelect?.value || '6', 10);

        if (createError) createError.textContent = '';

        const result = await socketClient.createRoom(name, maxPlayers);

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

    // Check room status on input change (debounced)
    let checkTimeout = null;
    roomIdInput?.addEventListener('input', () => {
        if (checkTimeout) clearTimeout(checkTimeout);
        checkTimeout = setTimeout(() => {
            const roomId = roomIdInput?.value.trim().toUpperCase();
            checkRoomStatus(roomId);
        }, 500);
    });

    // Also check on blur
    roomIdInput?.addEventListener('blur', () => {
        const roomId = roomIdInput?.value.trim().toUpperCase();
        if (roomId) checkRoomStatus(roomId);
    });

    hostNameInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitCreateButton?.click();
        }
    });
}