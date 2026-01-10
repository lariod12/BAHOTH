import { CHARACTERS, CHARACTER_BY_ID } from '../data/charactersData.js';
import * as socketClient from '../services/socketClient.js';

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;

// Current room state
let currentRoom = null;
let mySocketId = null;
let unsubscribeRoomState = null;

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
 * Render player slot
 */
function renderPlayerSlot(player, room, myId) {
    const isMe = player.id === myId;
    const isPlayerHost = player.id === room.hostId;
    const charName = player.characterId ? getCharacterName(player.characterId) : null;

    let statusBadge = '';
    let statusNote = '';

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

    const hostBadge = isPlayerHost ? '<span class="badge badge--accent">HOST</span>' : statusBadge;
    const displayName = isMe ? 'You' : player.name;

    return `
        <div class="player-slot ${isPlayerHost ? 'is-host' : ''}">
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

    let stateClass = '';
    let badgeClass = 'badge--muted';
    let badgeText = 'Co san';

    if (isTaken) {
        stateClass = 'is-taken';
        badgeText = 'Da chon';
    } else if (isSelected) {
        stateClass = 'is-selected';
        badgeClass = 'badge--accent';
        badgeText = 'Dang chon';
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
    return room.players.every(p => p.status === 'ready');
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

    // Ready button for non-host players
    const readyButton = !amHost && myPlayer?.characterId
        ? `<button class="action-button ${myPlayer.status === 'ready' ? 'action-button--secondary' : 'action-button--primary'}" type="button" data-action="toggle-ready">
            ${myPlayer.status === 'ready' ? 'Cancel Ready' : 'Ready'}
           </button>`
        : '';

    // Start button for host
    const startButton = amHost
        ? `<button class="action-button action-button--primary room-start__button" type="button" data-action="start-room" ${!canStart ? 'disabled' : ''}>Start</button>`
        : '';

    const startHint = amHost
        ? (canStart ? `All players ready (${playerCount}/${maxPlayers}). Ready to start!` : `Waiting for players... (${playerCount}/${maxPlayers})`)
        : (myPlayer?.status === 'ready' ? 'Waiting for host to start...' : 'Select a character and click Ready');

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
 */
function updateRoomUI(mountEl, room, myId) {
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
        meta.textContent = `${room.players.length} / ${MAX_PLAYERS}`;
    }

    // Update footer buttons and hint
    const footer = mountEl.querySelector('.room-footer .room-start');
    if (footer) {
        const myPlayer = getMyPlayer(room, myId);
        const amHost = isHost(room, myId);
        const canStart = canStartGame(room);

        let footerHtml = '';

        if (!amHost && myPlayer?.characterId) {
            footerHtml += `<button class="action-button ${myPlayer.status === 'ready' ? 'action-button--secondary' : 'action-button--primary'}" type="button" data-action="toggle-ready">
                ${myPlayer.status === 'ready' ? 'Cancel Ready' : 'Ready'}
            </button>`;
        }

        if (amHost) {
            footerHtml += `<button class="action-button action-button--primary room-start__button" type="button" data-action="start-room" ${!canStart ? 'disabled' : ''}>Start</button>`;
        }

        const hint = amHost
            ? (canStart ? `All players ready (${room.players.length}/${MAX_PLAYERS}). Ready to start!` : `Waiting for players... (${room.players.length}/${MAX_PLAYERS})`)
            : (myPlayer?.status === 'ready' ? 'Waiting for host to start...' : 'Select a character and click Ready');

        footerHtml += `<p class="room-start__hint">${hint}</p>`;

        footer.innerHTML = footerHtml;
        attachFooterListeners(mountEl);
    }
}

/**
 * Attach character card click listeners
 */
function attachCharacterCardListeners(mountEl, room, myId) {
    const characterCards = mountEl.querySelectorAll('[data-character]');

    for (const card of characterCards) {
        if (card.classList.contains('is-taken')) continue;

        card.addEventListener('click', async (e) => {
            const target = e.target;
            if (target.closest('[data-action="view-character"]')) return;

            const charId = card.getAttribute('data-character');
            if (!charId) return;

            // Select character via socket
            const result = await socketClient.selectCharacter(charId);
            if (!result.success) {
                console.error('Failed to select character:', result.error);
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
 * Attach footer button listeners
 */
function attachFooterListeners(mountEl) {
    const readyButton = mountEl.querySelector('[data-action="toggle-ready"]');
    readyButton?.addEventListener('click', async () => {
        const result = await socketClient.toggleReady();
        if (!result.success) {
            console.error('Failed to toggle ready:', result.error);
        }
    });

    const startButton = mountEl.querySelector('[data-action="start-room"]');
    startButton?.addEventListener('click', async () => {
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
        updateRoomUI(mountEl, room, mySocketId);
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
        if (unsubscribeRoomState) {
            unsubscribeRoomState();
            unsubscribeRoomState = null;
        }
        currentRoom = null;
        onNavigate('#/');
    });

    // Initial character card listeners
    attachCharacterCardListeners(mountEl, currentRoom, mySocketId);
    attachFooterListeners(mountEl);
}
