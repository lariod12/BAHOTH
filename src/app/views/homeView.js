import * as socketClient from '../services/socketClient.js';

// Debug mode state
let isDebugMode = false;
let debugPlayerCount = 2;

// Random name generator - Horror/Haunted theme
const ADJECTIVES = [
    'Shadow', 'Dark', 'Mystic', 'Haunted', 'Cursed', 'Silent', 'Ghostly', 'Creepy',
    'Wicked', 'Eerie', 'Sinister', 'Cryptic', 'Midnight', 'Hollow', 'Grim', 'Spectral',
    'Phantom', 'Bloody', 'Ancient', 'Twisted', 'Lurking', 'Hidden', 'Forgotten', 'Lost',
    'Doomed', 'Fallen', 'Raven', 'Storm', 'Thunder', 'Frost', 'Iron', 'Steel'
];

const NOUNS = [
    'Hunter', 'Walker', 'Seeker', 'Watcher', 'Keeper', 'Slayer', 'Reaper', 'Stalker',
    'Wanderer', 'Explorer', 'Survivor', 'Warrior', 'Knight', 'Rogue', 'Phantom', 'Specter',
    'Wolf', 'Raven', 'Spider', 'Serpent', 'Dragon', 'Phoenix', 'Crow', 'Owl',
    'Blade', 'Fang', 'Claw', 'Thorn', 'Shadow', 'Storm', 'Flame', 'Frost'
];

/**
 * Generate a random name
 * @returns {string}
 */
function generateRandomName() {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adjective}${noun}`;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - True if copied successfully
 */
async function copyToClipboard(text) {
    // Method 1: Modern Clipboard API (requires HTTPS or localhost)
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.warn('Clipboard API failed:', error);
        }
    }

    // Method 2: Fallback using execCommand
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
    } catch (error) {
        console.warn('execCommand copy failed:', error);
        return false;
    }
}

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
                            <option value="2" selected>2</option>
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
                        <div class="form-input-group">
                            <input class="form-input" type="text" id="player-name" placeholder="Enter your name" maxlength="20" />
                            <button class="clear-name-btn" type="button" data-action="clear-player-name" title="Clear name">&times;</button>
                            <button class="random-name-btn" type="button" data-action="random-player-name" title="Random name">🎲</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="room-id-input">Room ID</label>
                        <input class="form-input" type="text" id="room-id-input" placeholder="XXXXXX" maxlength="6" />
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
                        <div class="form-input-group">
                            <input class="form-input" type="text" id="host-name" placeholder="Enter your name" maxlength="20" />
                            <button class="clear-name-btn" type="button" data-action="clear-host-name" title="Clear name">&times;</button>
                            <button class="random-name-btn" type="button" data-action="random-host-name" title="Random name">🎲</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="max-players">Max Players</label>
                        <select class="form-input form-select" id="max-players">
                            <option value="2" selected>2 players</option>
                            <option value="3">3 players</option>
                            <option value="4">4 players</option>
                            <option value="5">5 players</option>
                            <option value="6">6 players</option>
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
        // Auto-fill random name if empty
        if (playerNameInput && !playerNameInput.value.trim()) {
            playerNameInput.value = generateRandomName();
        }
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
        // Auto-fill random name if empty
        if (hostNameInput && !hostNameInput.value.trim()) {
            hostNameInput.value = generateRandomName();
        }
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
            // Clear any existing session before creating debug room
            socketClient.clearSession();
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

    // Random name buttons
    const randomHostNameBtn = mountEl.querySelector('[data-action="random-host-name"]');
    const randomPlayerNameBtn = mountEl.querySelector('[data-action="random-player-name"]');

    randomHostNameBtn?.addEventListener('click', () => {
        if (hostNameInput) {
            hostNameInput.value = generateRandomName();
        }
    });

    randomPlayerNameBtn?.addEventListener('click', () => {
        if (playerNameInput) {
            playerNameInput.value = generateRandomName();
        }
    });

    // Clear name buttons
    const clearHostNameBtn = mountEl.querySelector('[data-action="clear-host-name"]');
    const clearPlayerNameBtn = mountEl.querySelector('[data-action="clear-player-name"]');

    clearHostNameBtn?.addEventListener('click', () => {
        if (hostNameInput) {
            hostNameInput.value = '';
            hostNameInput.focus();
        }
    });

    clearPlayerNameBtn?.addEventListener('click', () => {
        if (playerNameInput) {
            playerNameInput.value = '';
            playerNameInput.focus();
        }
    });

    // Submit create room
    const submitCreateButton = mountEl.querySelector('[data-action="submit-create"]');
    const maxPlayersSelect = /** @type {HTMLSelectElement} */ (mountEl.querySelector('#max-players'));

    submitCreateButton?.addEventListener('click', async () => {
        const name = hostNameInput?.value.trim() || 'Host';
        const maxPlayers = parseInt(maxPlayersSelect?.value || '6', 10);

        if (createError) createError.textContent = '';

        // Clear any existing session before creating new room
        socketClient.clearSession();

        const result = await socketClient.createRoom(name, maxPlayers);

        if (result.success && result.room) {
            // Auto-copy room ID to clipboard
            const copied = await copyToClipboard(result.room.id);
            if (copied) {
                console.log('Room ID copied to clipboard:', result.room.id);
            }
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

        // Clear any existing session before joining new room
        socketClient.clearSession();

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