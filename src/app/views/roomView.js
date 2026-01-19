import { CHARACTERS, CHARACTER_BY_ID } from '../data/charactersData.js';
import * as socketClient from '../services/socketClient.js';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

// Current room state
let currentRoom = null;
let mySocketId = null;
let unsubscribeRoomState = null;
let unsubscribeDebugRoomState = null;

/**
 * Get character name by ID (Vietnamese)
 */
function getCharacterName(charId) {
    const char = CHARACTER_BY_ID[charId];
    if (!char) return null;
    return char.name.vi || char.name.nickname || char.name.en;
}

/**
 * Get a short description for a character
 */
function getCharacterShortDesc(char) {
    const info = char.profile?.vi?.info || char.profile?.en?.info || '';
    const firstSentence = info.split(/\.\s/)[0];
    if (firstSentence && firstSentence.length > 0) {
        const maxLen = 60;
        if (firstSentence.length > maxLen) {
            return firstSentence.slice(0, maxLen).trim() + '...';
        }
        return firstSentence + '.';
    }
    return 'Nhan vat trong Betrayal at House on the Hill.';
}

/**
 * Check if a character is taken by another player
 */
function isCharacterTaken(charId, room, myId) {
    if (!room) return false;
    return room.players.some(p => p.id !== myId && p.characterId === charId);
}

/**
 * Get my player from room
 */
function getMyPlayer(room, myId) {
    if (!room) return null;
    return room.players.find(p => p.id === myId);
}

/**
 * Check if I am host
 */
function isHost(room, myId) {
    return room?.hostId === myId;
}

/**
 * Check if room is in debug mode
 */
function isDebugRoom(room) {
    return room?.isDebug === true;
}

/**
 * Get current selection player in debug mode
 */
function getCurrentSelectionPlayer(room) {
    if (!room?.isDebug || !room.selectionTurnOrder) return null;
    const turnIndex = room.currentSelectionTurn || 0;
    if (turnIndex >= room.selectionTurnOrder.length) return null;
    return room.selectionTurnOrder[turnIndex];
}

/**
 * Get player by ID
 */
function getPlayerById(room, playerId) {
    if (!room) return null;
    return room.players.find(p => p.id === playerId);
}

/**
 * Render debug mode badge
 */
function renderDebugBadge(room) {
    if (!isDebugRoom(room)) return '';
    return '<span class="badge badge--debug">DEBUG MODE</span>';
}

/**
 * Render selection turn indicator for debug mode
 */
function renderSelectionTurnIndicator(room) {
    if (!isDebugRoom(room)) return '';
    
    const currentPlayerId = getCurrentSelectionPlayer(room);
    const currentPlayer = getPlayerById(room, currentPlayerId);
    
    if (!currentPlayer) {
        return '<div class="turn-indicator turn-indicator--complete">All players selected!</div>';
    }
    
    return `
        <div class="turn-indicator">
            <span class="turn-indicator__label">Selecting:</span>
            <span class="turn-indicator__player">${currentPlayer.name}</span>
        </div>
    `;
}

/**
 * Render player slot
 */
function renderPlayerSlot(player, room, myId) {
    const isMe = player.id === myId;
    const isPlayerHost = player.id === room.hostId;
    const charName = player.characterId ? getCharacterName(player.characterId) : null;
    const isDebug = isDebugRoom(room);
    
    // In debug mode, check if this player is currently selecting
    const currentSelectionPlayerId = getCurrentSelectionPlayer(room);
    const isCurrentlySelecting = isDebug && player.id === currentSelectionPlayerId;

    let statusBadge = '';
    let statusNote = '';
    let slotClass = isPlayerHost ? 'is-host' : '';

    if (isDebug) {
        // Debug mode status logic
        if (player.characterId) {
            // Player has selected a character
            statusBadge = '<span class="badge badge--success">Ready</span>';
            statusNote = charName || 'Character selected';
        } else if (isCurrentlySelecting) {
            // This player's turn to select
            statusBadge = '<span class="badge badge--selecting">Selecting...</span>';
            statusNote = 'Choosing a character...';
            slotClass += ' is-selecting';
        } else {
            // Waiting for turn
            statusBadge = '<span class="badge badge--muted">Waiting</span>';
            statusNote = 'Waiting for turn...';
        }
    } else {
        // Normal mode status logic
        switch (player.status) {
            case 'ready':
                statusBadge = '<span class="badge badge--success">Ready</span>';
                statusNote = charName || 'Character locked in';
                break;
            case 'selecting':
                statusBadge = '<span class="badge badge--muted">Selecting</span>';
                statusNote = charName || 'Choosing a character...';
                break;
            case 'joined':
            default:
                statusBadge = '<span class="badge badge--muted">Not Ready</span>';
                statusNote = 'Joined the room';
                break;
        }
    }

    const hostBadge = isPlayerHost ? '<span class="badge badge--accent">HOST</span>' : statusBadge;
    const displayName = isMe ? 'You' : player.name;

    return `
        <div class="player-slot ${slotClass}">
            <div class="player-slot__top">
                <span class="player-name">${displayName}</span>
                ${hostBadge}
            </div>
            <div class="player-slot__status">
                ${isPlayerHost ? statusBadge : ''}
                <span class="player-note">${statusNote}</span>
            </div>
        </div>
    `;
}

/**
 * Render waiting slot
 */
function renderWaitingSlot(slotNum, totalPlayers, maxPlayers) {
    let note = 'Share the Room ID to invite';
    if (slotNum === 1) note = 'Share the Room ID to invite';
    else if (totalPlayers < MIN_PLAYERS) note = 'Min ' + MIN_PLAYERS + ' players required';
    else note = 'Slots remain open';

    return `
        <div class="player-slot is-waiting">
            <div class="player-slot__top">
                <span class="player-name">Waiting for player...</span>
                <span class="badge badge--muted">Slot ${slotNum}</span>
            </div>
            <div class="player-slot__status">
                <span class="player-note">${note}</span>
            </div>
        </div>
    `;
}

/**
 * Render players list
 */
function renderPlayersList(room, myId) {
    if (!room) return '';

    const maxPlayers = room.maxPlayers || MAX_PLAYERS;
    const playerSlots = room.players.map(p => renderPlayerSlot(p, room, myId)).join('');
    const waitingCount = maxPlayers - room.players.length;
    const waitingSlots = Array.from({ length: waitingCount }, (_, i) =>
        renderWaitingSlot(i + 1, room.players.length, maxPlayers)
    ).join('');

    return playerSlots + waitingSlots;
}

/**
 * Render character card
 */
function renderCharacterCard(char, room, myId) {
    const name = char.name.vi || char.name.nickname || char.name.en;
    const desc = getCharacterShortDesc(char);
    const myPlayer = getMyPlayer(room, myId);
    const isTaken = isCharacterTaken(char.id, room, myId);
    const isSelected = myPlayer?.characterId === char.id;
    const isDebug = isDebugRoom(room);

    // In debug mode, check if this character is selected by current turn player
    let isCurrentTurnSelected = false;
    if (isDebug) {
        const currentPlayerId = getCurrentSelectionPlayer(room);
        const currentPlayer = getPlayerById(room, currentPlayerId);
        isCurrentTurnSelected = currentPlayer?.characterId === char.id;
    }

    let stateClass = '';
    let badgeClass = 'badge--muted';
    let badgeText = 'Co san';

    if (isTaken) {
        stateClass = 'is-taken';
        badgeText = 'Da chon';
    } else if (isSelected || isCurrentTurnSelected) {
        stateClass = 'is-selected';
        badgeClass = 'badge--accent';
        badgeText = 'Dang chon';
    }

    // In debug mode, add selectable class for available characters
    if (isDebug && !isTaken && !isSelected) {
        stateClass += ' is-debug-selectable';
    }

    return `
        <div class="character-card ${stateClass}" data-character="${char.id}">
            <div class="character-card__header">
                <span class="character-name">${name}</span>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
            <p class="character-note">${desc}</p>
            <button class="character-info-btn" type="button" data-action="view-character" data-character-id="${char.id}">
                Xem chi tiet
            </button>
        </div>
    `.trim();
}

/**
 * Render character grid
 */
function renderCharacterGrid(room, myId) {
    return CHARACTERS.map(char => renderCharacterCard(char, room, myId)).join('\n');
}

/**
 * Render character modal
 */
function renderCharacterModal() {
    return `
        <div class="character-modal" id="character-modal" aria-hidden="true">
            <div class="character-modal__backdrop" data-action="close-modal"></div>
            <div class="character-modal__content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <header class="character-modal__header">
                    <h2 class="character-modal__title" id="modal-title"></h2>
                    <button class="character-modal__close" type="button" data-action="close-modal" aria-label="Dong">x</button>
                </header>
                <div class="character-modal__body" id="modal-body"></div>
            </div>
        </div>
    `.trim();
}

/**
 * Render character detail for modal
 */
function renderCharacterDetail(char) {
    const bio = char.bio.vi;
    const profile = char.profile?.vi || char.profile?.en || {};
    const hobbies = bio.hobbies?.join(', ') || 'Khong ro';
    const fear = profile.fear || 'Khong ro';
    const info = profile.info || '';

    const traitLabels = { speed: 'Toc do', might: 'Suc manh', sanity: 'Tam tri', knowledge: 'Kien thuc' };

    const traitsHtml = Object.entries(char.traits)
        .map(([key, trait]) => {
            const label = traitLabels[key] || key;
            const trackHtml = trait.track
                .map((val, idx) => idx === trait.startIndex
                    ? `<span class="trait-value trait-value--start">${val}</span>`
                    : `<span class="trait-value">${val}</span>`
                )
                .join('<span class="trait-sep"> - </span>');
            return `<div class="trait-row"><span class="trait-label">${label}</span><span class="trait-track">${trackHtml}</span></div>`;
        })
        .join('');

    return `
        <div class="character-detail">
            <div class="character-detail__bio">
                <div class="detail-row"><span class="detail-label">Tuoi:</span><span class="detail-value">${bio.age}</span></div>
                <div class="detail-row"><span class="detail-label">Chieu cao:</span><span class="detail-value">${bio.height}</span></div>
                <div class="detail-row"><span class="detail-label">Can nang:</span><span class="detail-value">${bio.weight}</span></div>
                <div class="detail-row"><span class="detail-label">Sinh nhat:</span><span class="detail-value">${bio.birthday}</span></div>
                <div class="detail-row"><span class="detail-label">So thich:</span><span class="detail-value">${hobbies}</span></div>
                <div class="detail-row"><span class="detail-label">Noi so:</span><span class="detail-value">${fear}</span></div>
            </div>
            <div class="character-detail__traits">
                <h3 class="detail-section-title">Chi so</h3>
                ${traitsHtml}
            </div>
            <div class="character-detail__story">
                <h3 class="detail-section-title">Tieu su</h3>
                <p class="detail-info">${info.replace(/\n\n/g, '</p><p class="detail-info">')}</p>
            </div>
        </div>
    `.trim();
}

/**
 * Check if game can start
 */
function canStartGame(room) {
    if (!room) return false;
    if (room.players.length < MIN_PLAYERS) return false;

    // All players must have selected a character
    const allHaveCharacter = room.players.every(p => p.characterId);
    if (!allHaveCharacter) return false;

    // In debug mode, just need all characters selected
    if (isDebugRoom(room)) {
        return true;
    }

    // In normal mode, all non-host players must be ready
    const nonHostPlayers = room.players.filter(p => p.id !== room.hostId);
    return nonHostPlayers.every(p => p.status === 'ready');
}

/**
 * Render room markup
 */
function renderRoomMarkup(room, myId) {
    const roomId = room?.id || 'Loading...';
    const playerCount = room?.players?.length || 0;
    const maxPlayers = room?.maxPlayers || MAX_PLAYERS;
    const myPlayer = getMyPlayer(room, myId);
    const amHost = isHost(room, myId);
    const canStart = canStartGame(room);
    const isDebug = isDebugRoom(room);

    // Ready button for non-host players (only in normal mode)
    const readyButton = !isDebug && !amHost && myPlayer?.characterId
        ? `<button class="action-button ${myPlayer.status === 'ready' ? 'action-button--secondary' : 'action-button--primary'}" type="button" data-action="toggle-ready">
            ${myPlayer.status === 'ready' ? 'Cancel Ready' : 'Ready'}
           </button>`
        : '';

    // Start button for host
    const startButton = amHost
        ? `<button class="action-button action-button--primary room-start__button" type="button" data-action="start-room" ${!canStart ? 'disabled' : ''}>Start</button>`
        : '';

    // Generate appropriate hint based on mode
    let startHint;
    if (isDebug) {
        // Debug mode hints
        const selectedCount = room.players.filter(p => p.characterId).length;
        if (canStart) {
            startHint = `All ${playerCount} players selected. Ready to start!`;
        } else {
            startHint = `Select characters for all players (${selectedCount}/${playerCount})`;
        }
    } else {
        // Normal mode hints
        startHint = amHost
            ? (canStart ? `All players ready (${playerCount}/${maxPlayers}). Ready to start!` : `Waiting for players... (${playerCount}/${maxPlayers})`)
            : (myPlayer?.status === 'ready' ? 'Waiting for host to start...' : 'Select a character and click Ready');
    }

    // Debug mode elements
    const debugBadge = renderDebugBadge(room);
    const turnIndicator = renderSelectionTurnIndicator(room);

    return `
        <div class="welcome-container room-container">
            <div class="room-surface">
                <header class="room-header">
                    <div>
                        <p class="welcome-kicker">Room ${debugBadge}</p>
                        <h1 class="page-title">Private Lobby</h1>
                        <p class="room-subtitle">Room ID: <span class="room-id">${roomId}</span></p>
                        ${turnIndicator}
                    </div>
                    <div class="room-actions">
                        <button class="chip-button" type="button" data-action="copy-id">Copy ID</button>
                        <button class="chip-button chip-button--ghost" type="button" data-action="leave-room">Leave</button>
                    </div>
                </header>

                <div class="room-grid">
                    <nav class="room-mobile-tabs" aria-label="Room sections">
                        <button class="room-tab is-active" type="button" data-tab="players" aria-pressed="true">Players</button>
                        <button class="room-tab" type="button" data-tab="characters" aria-pressed="false">Characters</button>
                    </nav>

                    <section class="room-panel room-panel--players" data-panel="players">
                        <div class="room-panel__header">
                            <p class="welcome-kicker">Players</p>
                            <p class="room-panel__meta">${playerCount} / ${maxPlayers}</p>
                        </div>
                        <div class="players-list" id="players-list">
                            ${renderPlayersList(room, myId)}
                        </div>
                        <p class="room-hint">Min ${MIN_PLAYERS} players to start - Max ${maxPlayers} players</p>
                    </section>

                    <section class="room-panel room-panel--characters" data-panel="characters">
                        <div class="room-panel__header">
                            <p class="welcome-kicker">Chon nhan vat</p>
                            <button class="chip-button chip-button--accent" type="button" data-action="pick-random-character">🎲 Random</button>
                        </div>
                        <div class="character-grid" id="character-grid">
                            ${renderCharacterGrid(room, myId)}
                        </div>
                        <p class="room-hint">Nhan vao nhan vat de chon</p>
                    </section>
                </div>

                <footer class="room-footer">
                    <div class="room-start">
                        ${readyButton}
                        ${startButton}
                        <p class="room-start__hint">${startHint}</p>
                    </div>
                </footer>
            </div>
        </div>
        ${renderCharacterModal()}
    `.trim();
}

/**
 * Update room UI without full re-render
 * @param {HTMLElement} mountEl
 * @param {Object} room
 * @param {string} myId
 * @param {Function} onNavigate - Navigation callback
 */
function updateRoomUI(mountEl, room, myId, onNavigate) {
    // Update players list
    const playersList = mountEl.querySelector('#players-list');
    if (playersList) {
        playersList.innerHTML = renderPlayersList(room, myId);
    }

    // Update character grid
    const characterGrid = mountEl.querySelector('#character-grid');
    if (characterGrid) {
        characterGrid.innerHTML = renderCharacterGrid(room, myId);
        attachCharacterCardListeners(mountEl, room, myId);
    }

    // Update player count
    const meta = mountEl.querySelector('.room-panel__meta');
    if (meta) {
        meta.textContent = `${room.players.length} / ${room.maxPlayers || MAX_PLAYERS}`;
    }

    // Update turn indicator for debug mode
    const headerDiv = mountEl.querySelector('.room-header > div');
    if (headerDiv) {
        const existingIndicator = headerDiv.querySelector('.turn-indicator');
        const newIndicator = renderSelectionTurnIndicator(room);
        
        if (existingIndicator) {
            if (newIndicator) {
                existingIndicator.outerHTML = newIndicator;
            } else {
                existingIndicator.remove();
            }
        } else if (newIndicator) {
            headerDiv.insertAdjacentHTML('beforeend', newIndicator);
        }
    }

    // Update footer buttons and hint
    const footer = mountEl.querySelector('.room-footer .room-start');
    if (footer) {
        const myPlayer = getMyPlayer(room, myId);
        const amHost = isHost(room, myId);
        const canStart = canStartGame(room);
        const isDebug = isDebugRoom(room);

        let footerHtml = '';

        // Ready button only in normal mode
        if (!isDebug && !amHost && myPlayer?.characterId) {
            footerHtml += `<button class="action-button ${myPlayer.status === 'ready' ? 'action-button--secondary' : 'action-button--primary'}" type="button" data-action="toggle-ready">
                ${myPlayer.status === 'ready' ? 'Cancel Ready' : 'Ready'}
            </button>`;
        }

        if (amHost) {
            footerHtml += `<button class="action-button action-button--primary room-start__button" type="button" data-action="start-room" ${!canStart ? 'disabled' : ''}>Start</button>`;
        }

        const maxPlayers = room.maxPlayers || MAX_PLAYERS;
        const playerCount = room.players.length;
        
        // Generate appropriate hint based on mode
        let hint;
        if (isDebug) {
            const selectedCount = room.players.filter(p => p.characterId).length;
            if (canStart) {
                hint = `All ${playerCount} players selected. Ready to start!`;
            } else {
                hint = `Select characters for all players (${selectedCount}/${playerCount})`;
            }
        } else {
            hint = amHost
                ? (canStart ? `All players ready (${playerCount}/${maxPlayers}). Ready to start!` : `Waiting for players... (${playerCount}/${maxPlayers})`)
                : (myPlayer?.status === 'ready' ? 'Waiting for host to start...' : 'Select a character and click Ready');
        }

        footerHtml += `<p class="room-start__hint">${hint}</p>`;

        footer.innerHTML = footerHtml;
        attachFooterListeners(mountEl, onNavigate);
    }
}

/**
 * Attach character card click listeners
 */
function attachCharacterCardListeners(mountEl, room, myId) {
    const characterCards = mountEl.querySelectorAll('[data-character]');
    const isDebug = isDebugRoom(room);

    for (const card of characterCards) {
        if (card.classList.contains('is-taken')) continue;

        card.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.closest('[data-action="view-character"]')) return;

            const charId = card.getAttribute('data-character');
            if (!charId) return;

            if (isDebug) {
                // Debug mode: select character for current turn player
                const currentPlayerId = getCurrentSelectionPlayer(room);
                if (!currentPlayerId) {
                    console.log('All players have selected characters');
                    return;
                }

                const result = await socketClient.debugSelectCharacter(currentPlayerId, charId);
                if (!result.success) {
                    console.error('Failed to select character:', result.error);
                }
            } else {
                // Normal mode: select character for self
                const result = await socketClient.selectCharacter(charId);
                if (!result.success) {
                    console.error('Failed to select character:', result.error);
                } else {
                    // Update session with selected character
                    socketClient.updateSessionCharacter(charId);
                }
            }
        });
    }

    // View character detail buttons
    const viewButtons = mountEl.querySelectorAll('[data-action="view-character"]');
    for (const btn of viewButtons) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const charId = btn.getAttribute('data-character-id');
            if (charId) openCharacterModal(mountEl, charId);
        });
    }
}

/**
 * Save debug game data to sessionStorage for transfer to game view
 * @param {Object} room - Current room state
 */
function saveDebugGameData(room) {
    const debugGameData = {
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            characterId: p.characterId,
            isAutoPlayer: p.isAutoPlayer
        })),
        playerCount: room.players.length
    };
    sessionStorage.setItem('debugGameData', JSON.stringify(debugGameData));
}

/**
 * Attach footer button listeners
 * @param {HTMLElement} mountEl
 * @param {Function} onNavigate - Navigation callback for debug mode
 */
function attachFooterListeners(mountEl, onNavigate) {
    const readyButton = mountEl.querySelector('[data-action="toggle-ready"]');
    readyButton?.addEventListener('click', async () => {
        const result = await socketClient.toggleReady();
        if (!result.success) {
            console.error('Failed to toggle ready:', result.error);
        }
    });

    const startButton = mountEl.querySelector('[data-action="start-room"]');
    startButton?.addEventListener('click', async () => {
        // Debug mode: navigate directly to /game/debug with player data
        if (isDebugRoom(currentRoom)) {
            saveDebugGameData(currentRoom);
            onNavigate('#/game/debug');
            return;
        }

        // Normal mode: call server to start game
        const result = await socketClient.startGame();
        if (!result.success) {
            alert(result.error || 'Cannot start game');
        }
    });
}

/**
 * Open character modal
 */
function openCharacterModal(mountEl, charId) {
    const char = CHARACTER_BY_ID[charId];
    const modal = mountEl.querySelector('#character-modal');
    const modalTitle = mountEl.querySelector('#modal-title');
    const modalBody = mountEl.querySelector('#modal-body');

    if (!char || !modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = char.name.vi || char.name.nickname || char.name.en;
    modalBody.innerHTML = renderCharacterDetail(char);
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

/**
 * Close character modal
 */
function closeCharacterModal(mountEl) {
    const modal = mountEl.querySelector('#character-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
}

/**
 * Main render function
 */
export async function renderRoomView({ mountEl, onNavigate, roomId }) {
    // Connect to socket
    socketClient.connect();
    mySocketId = socketClient.getSocketId();

    // If roomId provided, try to join that room
    if (roomId) {
        // Check if we're already in this room
        const stateResult = await socketClient.getRoomState(roomId);
        if (stateResult.success && stateResult.room) {
            currentRoom = stateResult.room;
            mySocketId = socketClient.getSocketId();

            // Check if I'm already in the room
            const myPlayer = currentRoom.players.find(p => p.id === mySocketId);
            if (!myPlayer) {
                // Need to join the room
                const joinResult = await socketClient.joinRoom(roomId, 'Player');
                if (!joinResult.success) {
                    alert(joinResult.error || 'Failed to join room');
                    onNavigate('#/');
                    return;
                }
                currentRoom = joinResult.room;
                // Save session for reconnection
                socketClient.saveSession(roomId, 'Player');
            } else {
                // Already in room - save/update session
                socketClient.saveSession(roomId, myPlayer.name, myPlayer.characterId);
            }
        } else {
            // Room doesn't exist
            alert('Room not found');
            onNavigate('#/');
            return;
        }
    }

    // Wait for socket ID
    await new Promise(resolve => {
        const checkId = () => {
            mySocketId = socketClient.getSocketId();
            if (mySocketId) {
                resolve();
            } else {
                setTimeout(checkId, 50);
            }
        };
        checkId();
    });

    // Render initial UI
    mountEl.innerHTML = renderRoomMarkup(currentRoom, mySocketId);

    // Subscribe to room state updates
    unsubscribeRoomState = socketClient.onRoomState((room) => {
        currentRoom = room;
        mySocketId = socketClient.getSocketId();
        updateRoomUI(mountEl, room, mySocketId, onNavigate);
    });

    // Subscribe to debug room state updates
    unsubscribeDebugRoomState = socketClient.onDebugRoomState((room) => {
        currentRoom = room;
        mySocketId = socketClient.getSocketId();
        updateRoomUI(mountEl, room, mySocketId, onNavigate);
    });

    // Set up event listeners
    setupEventListeners(mountEl, onNavigate);

    // Update status when switching to characters tab
    const mobileTabs = mountEl.querySelectorAll('[data-tab]');
    for (const tabButton of mobileTabs) {
        tabButton.addEventListener('click', async () => {
            const tab = tabButton.getAttribute('data-tab');
            if (tab === 'characters') {
                const myPlayer = getMyPlayer(currentRoom, mySocketId);
                if (myPlayer && myPlayer.status === 'joined') {
                    await socketClient.updateStatus('selecting');
                }
            }
        });
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners(mountEl, onNavigate) {
    // Modal close
    mountEl.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('[data-action="close-modal"]')) {
            closeCharacterModal(mountEl);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCharacterModal(mountEl);
        }
    });

    // Tab switching
    const mobileTabs = Array.from(mountEl.querySelectorAll('[data-tab]'));
    const setMobileTab = (tab) => {
        const surface = mountEl.querySelector('.room-surface');
        if (surface) {
            surface.setAttribute('data-active-panel', tab);
        }
        for (const btn of mobileTabs) {
            const isActive = btn.getAttribute('data-tab') === tab;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }
    };

    for (const tabButton of mobileTabs) {
        tabButton.addEventListener('click', () => {
            const tab = tabButton.getAttribute('data-tab');
            if (tab) setMobileTab(tab);
        });
    }
    setMobileTab('players');

    // Copy ID
    const copyButton = mountEl.querySelector('[data-action="copy-id"]');
    copyButton?.addEventListener('click', async () => {
        const roomIdText = currentRoom?.id || '';
        const fullUrl = window.location.origin + window.location.pathname + '#/room/' + roomIdText;
        try {
            await navigator.clipboard.writeText(fullUrl);
            copyButton.textContent = 'Copied';
            setTimeout(() => {
                copyButton.textContent = 'Copy ID';
            }, 1800);
        } catch (error) {
            console.warn('Clipboard API unavailable', error);
            prompt('Copy this link:', fullUrl);
        }
    });

    // Leave room
    const leaveButton = mountEl.querySelector('[data-action="leave-room"]');
    leaveButton?.addEventListener('click', async () => {
        await socketClient.leaveRoom();
        // Clear session when manually leaving
        socketClient.clearSession();
        if (unsubscribeRoomState) {
            unsubscribeRoomState();
            unsubscribeRoomState = null;
        }
        if (unsubscribeDebugRoomState) {
            unsubscribeDebugRoomState();
            unsubscribeDebugRoomState = null;
        }
        currentRoom = null;
        onNavigate('#/');
    });

    // Subscribe to game start
    const unsubscribeGameStart = socketClient.onGameStart(({ roomId }) => {
        // Navigate to game view when game starts
        unsubscribeGameStart();
        if (unsubscribeRoomState) {
            unsubscribeRoomState();
            unsubscribeRoomState = null;
        }
        if (unsubscribeDebugRoomState) {
            unsubscribeDebugRoomState();
            unsubscribeDebugRoomState = null;
        }
        onNavigate(`#/game/${roomId}`);
    });

    // Pick random character
    const pickRandomButton = mountEl.querySelector('[data-action="pick-random-character"]');
    pickRandomButton?.addEventListener('click', async () => {
        // Get available characters (not taken by other players)
        const availableChars = CHARACTERS.filter(char => !isCharacterTaken(char.id, currentRoom, mySocketId));

        if (availableChars.length === 0) {
            console.log('No available characters');
            return;
        }

        // Pick a random character
        const randomChar = availableChars[Math.floor(Math.random() * availableChars.length)];

        if (isDebugRoom(currentRoom)) {
            // Debug mode: select character for current turn player
            const currentPlayerId = getCurrentSelectionPlayer(currentRoom);
            if (!currentPlayerId) {
                console.log('All players have selected characters');
                return;
            }
            const result = await socketClient.debugSelectCharacter(currentPlayerId, randomChar.id);
            if (!result.success) {
                console.error('Failed to select random character:', result.error);
            }
        } else {
            // Normal mode: select character for self
            const result = await socketClient.selectCharacter(randomChar.id);
            if (!result.success) {
                console.error('Failed to select random character:', result.error);
            }
        }
    });

    // Initial character card listeners
    attachCharacterCardListeners(mountEl, currentRoom, mySocketId);
    attachFooterListeners(mountEl, onNavigate);
}
