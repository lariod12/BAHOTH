// Game View - Dice rolling phase and main gameplay
import { CHARACTER_BY_ID, CHARACTERS } from '../data/charactersData.js';
import * as socketClient from '../services/socketClient.js';
import { renderGameMap, buildPlayerNamesMap } from '../components/GameMap.js';

/** @type {any} */
let currentGameState = null;
let mySocketId = null;
let unsubscribeGameState = null;
let sidebarOpen = false;
let introShown = false;
let introTimeout = null;
/** @type {Set<string>} Track expanded player IDs in sidebar */
let expandedPlayers = new Set();
/** @type {Set<string>} Track active player IDs */
let activePlayers = new Set();
/** @type {(() => void) | null} Unsubscribe from players active updates */
let unsubscribePlayersActive = null;

// Debug mode state
let isDebugMode = false;
let debugCurrentPlayerIndex = 0; // Which of the 3 local players is "active"

/**
 * Create mock game state for debug mode with 3 local players
 * @returns {any}
 */
function createDebugGameState() {
    // Pick 3 random characters
    const shuffled = [...CHARACTERS].sort(() => Math.random() - 0.5);
    const selectedChars = shuffled.slice(0, 3);
    
    const players = selectedChars.map((char, idx) => ({
        id: `debug-player-${idx}`,
        name: `Player ${idx + 1}`,
        characterId: char.id,
        status: 'ready'
    }));

    // Create mock map with entrance hall and some adjacent rooms
    const mockMap = {
        revealedRooms: {
            'entrance-hall': {
                id: 'entrance-hall',
                name: 'Entrance Hall',
                x: 0,
                y: 0,
                doors: ['north', 'east', 'west'],
                floor: 'ground'
            },
            'foyer': {
                id: 'foyer',
                name: 'Foyer',
                x: 0,
                y: 1,
                doors: ['south', 'east'],
                floor: 'ground'
            },
            'grand-staircase': {
                id: 'grand-staircase',
                name: 'Grand Staircase',
                x: 1,
                y: 0,
                doors: ['west', 'north'],
                floor: 'ground'
            },
            'dining-room': {
                id: 'dining-room',
                name: 'Dining Room',
                x: -1,
                y: 0,
                doors: ['east', 'south'],
                floor: 'ground'
            }
        },
        connections: {
            'entrance-hall': { north: 'foyer', east: 'grand-staircase', west: 'dining-room' },
            'foyer': { south: 'entrance-hall' },
            'grand-staircase': { west: 'entrance-hall' },
            'dining-room': { east: 'entrance-hall' }
        }
    };

    return {
        roomId: 'DEBUG-MODE',
        gamePhase: 'rolling', // Start with rolling phase
        players,
        diceRolls: {},
        needsRoll: players.map(p => p.id),
        turnOrder: [],
        currentTurnIndex: 0,
        playerMoves: {},
        playerState: {
            playerPositions: {
                'debug-player-0': 'entrance-hall',
                'debug-player-1': 'entrance-hall',
                'debug-player-2': 'entrance-hall'
            }
        },
        map: mockMap
    };
}

/**
 * Get current debug player ID
 * @returns {string}
 */
function getDebugPlayerId() {
    return `debug-player-${debugCurrentPlayerIndex}`;
}

/**
 * Get character's Speed value at startIndex
 * @param {string} characterId
 * @returns {number}
 */
function getCharacterSpeed(characterId) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 4; // default
    const speedTrait = char.traits.speed;
    return speedTrait.track[speedTrait.startIndex];
}

/**
 * Get character name (Vietnamese)
 * @param {string} characterId
 * @returns {string}
 */
function getCharacterName(characterId) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 'Unknown';
    return char.name.vi || char.name.nickname || char.name.en;
}

/**
 * Check if current player's turn
 * @param {any} gameState
 * @param {string} myId
 * @returns {boolean}
 */
function isMyTurn(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return false;
    const currentPlayer = gameState.turnOrder[gameState.currentTurnIndex];
    return currentPlayer === myId;
}

/**
 * Check if I need to roll dice
 * @param {any} gameState
 * @param {string} myId
 * @returns {boolean}
 */
function needsToRoll(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'rolling') return false;
    return !gameState.diceRolls[myId] && gameState.needsRoll?.includes(myId);
}

/**
 * Render dice roll overlay
 */
function renderDiceRollOverlay(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'rolling') return '';

    const players = gameState.players || [];
    const diceRolls = gameState.diceRolls || {};
    const needsRoll = gameState.needsRoll || [];
    const iNeedToRoll = needsRoll.includes(myId);

    const playersRollsHtml = players.map(p => {
        const charName = getCharacterName(p.characterId);
        const roll = diceRolls[p.id];
        const isMe = p.id === myId;
        const waiting = needsRoll.includes(p.id);

        let rollDisplay = '';
        if (roll !== undefined) {
            rollDisplay = `<span class="dice-result">${roll}</span>`;
        } else if (waiting) {
            rollDisplay = `<span class="dice-waiting">...</span>`;
        } else {
            rollDisplay = `<span class="dice-waiting">-</span>`;
        }

        return `
            <div class="dice-player ${isMe ? 'is-me' : ''} ${waiting ? 'is-waiting' : ''}">
                <span class="dice-player__name">${charName}${isMe ? ' (You)' : ''}</span>
                ${rollDisplay}
            </div>
        `;
    }).join('');

    const rollControls = iNeedToRoll ? `
        <div class="dice-controls">
            <p class="dice-instruction">Tung xi ngau de quyet dinh thu tu di</p>
            <div class="dice-input-group">
                <input type="number" class="dice-input" id="dice-manual-input" min="1" max="16" placeholder="1-16" />
                <button class="action-button action-button--secondary" type="button" data-action="roll-manual">Nhap</button>
            </div>
            <span class="dice-or">hoac</span>
            <button class="action-button action-button--primary dice-roll-btn" type="button" data-action="roll-random">
                <svg class="dice-icon dice-icon--inline" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="4" width="40" height="40" rx="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
                    <circle cx="14" cy="14" r="3.5" fill="currentColor"/>
                    <circle cx="34" cy="14" r="3.5" fill="currentColor"/>
                    <circle cx="24" cy="24" r="3.5" fill="currentColor"/>
                    <circle cx="14" cy="34" r="3.5" fill="currentColor"/>
                    <circle cx="34" cy="34" r="3.5" fill="currentColor"/>
                </svg>
                Tung Xi Ngau
            </button>
        </div>
    ` : `
        <div class="dice-controls">
            <p class="dice-instruction">Dang cho cac nguoi choi khac tung xi ngau...</p>
        </div>
    `;

    return `
        <div class="dice-overlay">
            <div class="dice-modal">
                <h2 class="dice-title">Tung Xi Ngau</h2>
                <p class="dice-subtitle">Nguoi co diem cao nhat se di truoc</p>
                <div class="dice-players-list">
                    ${playersRollsHtml}
                </div>
                ${rollControls}
            </div>
        </div>
    `;
}

/**
 * Render sidebar toggle button
 * @param {boolean} disabled - Whether toggle should be disabled
 */
function renderSidebarToggle(disabled = false) {
    const disabledAttr = disabled ? 'disabled' : '';
    const disabledClass = disabled ? 'is-disabled' : '';
    
    return `
        <button class="sidebar-toggle ${disabledClass}" 
                type="button" 
                data-action="toggle-sidebar" 
                title="Toggle Players"
                ${disabledAttr}>
            <svg class="sidebar-toggle__icon" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="6" r="4"/>
                <path d="M12 12c-3 0-6 2-6 5v3h12v-3c0-3-3-5-6-5z"/>
            </svg>
        </button>
    `;
}

/**
 * Group players by room/position
 * @param {any[]} players - Array of players
 * @param {Object} playerPositions - Map of player ID to position
 * @returns {any[]} Players sorted/grouped by room
 */
function groupPlayersByRoom(players, playerPositions) {
    // Sort players by their position/room name
    return [...players].sort((a, b) => {
        const posA = playerPositions[a.id] || 'Unknown';
        const posB = playerPositions[b.id] || 'Unknown';
        return posA.localeCompare(posB);
    });
}

/**
 * Render sidebar with other players
 */
function renderSidebar(gameState, myId) {
    if (!gameState) return '';

    const players = gameState.players || [];
    const playerState = gameState.playerState || {};
    const playerPositions = playerState.playerPositions || {};
    const turnOrder = gameState.turnOrder || [];
    const currentIndex = gameState.currentTurnIndex ?? 0;
    const currentTurnPlayer = turnOrder[currentIndex];

    // Filter out current player
    const otherPlayers = players.filter(p => p.id !== myId);

    const openClass = sidebarOpen ? 'is-open' : '';

    if (otherPlayers.length === 0) {
        return `
            <aside class="game-sidebar ${openClass}">
                <div class="sidebar-header">
                    <span class="sidebar-title">Players</span>
                    <button class="sidebar-close" type="button" data-action="close-sidebar">&times;</button>
                </div>
                <div class="sidebar-empty">No other players</div>
            </aside>
        `;
    }

    // Group players by room before rendering
    const groupedPlayers = groupPlayersByRoom(otherPlayers, playerPositions);

    const playersHtml = groupedPlayers.map(player => {
        const charName = getCharacterName(player.characterId);
        const position = playerPositions[player.id] || 'Unknown';
        const isCurrentTurn = player.id === currentTurnPlayer;
        const turnIndex = turnOrder.indexOf(player.id);
        const isExpanded = expandedPlayers.has(player.id);
        const expandedClass = isExpanded ? 'is-expanded' : '';

        return `
            <div class="sidebar-player ${isCurrentTurn ? 'is-current-turn' : ''} ${expandedClass}"
                 data-action="expand-player" 
                 data-player-id="${player.id}">
                <div class="sidebar-player__header">
                    <div class="sidebar-player__icon">
                        <svg class="pawn-icon" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="6" r="4"/>
                            <path d="M12 12c-3 0-6 2-6 5v3h12v-3c0-3-3-5-6-5z"/>
                        </svg>
                    </div>
                    <div class="sidebar-player__info">
                        <span class="sidebar-player__name">${charName}</span>
                        <span class="sidebar-player__room">${position}</span>
                        <span class="sidebar-player__order">#${turnIndex + 1}</span>
                    </div>
                </div>
                <div class="sidebar-player__details" style="display: ${isExpanded ? 'block' : 'none'}">
                    <div class="sidebar-player__detail-row">
                        <span class="detail-label">Position:</span>
                        <span class="detail-value">${position}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <aside class="game-sidebar ${openClass}">
            <div class="sidebar-header">
                <span class="sidebar-title">Players</span>
                <button class="sidebar-close" type="button" data-action="close-sidebar">&times;</button>
            </div>
            <div class="sidebar-players">
                ${playersHtml}
            </div>
        </aside>
    `;
}

/**
 * Render player bar (bottom HUD) with card slots
 */
function renderPlayerBar(gameState, myId) {
    if (!gameState) return '';

    const me = gameState.players?.find(p => p.id === myId);
    if (!me) return '';

    const charName = getCharacterName(me.characterId);
    const movesLeft = gameState.playerMoves?.[myId] ?? 0;
    const myTurn = isMyTurn(gameState, myId);

    // TODO: Get actual cards from game state when implemented
    const omenCards = [];
    const eventCards = [];
    const itemCards = [];

    return `
        <div class="player-bar ${myTurn ? 'is-my-turn' : ''}">
            <div class="player-bar__info">
                <div class="player-bar__avatar">
                    <svg class="pawn-icon pawn-icon--large" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="6" r="4"/>
                        <path d="M12 12c-3 0-6 2-6 5v3h12v-3c0-3-3-5-6-5z"/>
                    </svg>
                </div>
                <div class="player-bar__details">
                    <span class="player-bar__name">${charName}</span>
                    <span class="player-bar__moves">Luot di: <strong>${movesLeft}</strong></span>
                </div>
            </div>
            <div class="player-bar__cards">
                <div class="card-slot card-slot--omen" title="Omen Cards">
                    <span class="card-slot__label">Omen</span>
                    <span class="card-slot__count">${omenCards.length}</span>
                </div>
                <div class="card-slot card-slot--event" title="Event Cards">
                    <span class="card-slot__label">Event</span>
                    <span class="card-slot__count">${eventCards.length}</span>
                </div>
                <div class="card-slot card-slot--item" title="Item Cards">
                    <span class="card-slot__label">Item</span>
                    <span class="card-slot__count">${itemCards.length}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render turn order indicator
 */
function renderTurnOrder(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return '';

    const turnOrder = gameState.turnOrder || [];
    const currentIndex = gameState.currentTurnIndex ?? 0;
    const players = gameState.players || [];

    const orderedPlayers = turnOrder.map((socketId, idx) => {
        const player = players.find(p => p.id === socketId);
        if (!player) return null;
        const charName = getCharacterName(player.characterId);
        const isMe = socketId === myId;
        const isCurrent = idx === currentIndex;

        // In debug mode, make turn indicators clickable to switch player
        const clickableAttr = isDebugMode ? `data-action="debug-switch-player" data-player-id="${socketId}"` : '';
        const clickableClass = isDebugMode ? 'is-clickable' : '';

        return `
            <div class="turn-indicator ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${clickableClass}" ${clickableAttr}>
                <span class="turn-indicator__order">${idx + 1}</span>
                <span class="turn-indicator__name">${charName}${isMe ? ' (You)' : ''}</span>
            </div>
        `;
    }).filter(Boolean).join('');

    return `
        <div class="turn-order">
            <p class="turn-order__label">Thu tu luot di:</p>
            <div class="turn-order__list">${orderedPlayers}</div>
        </div>
    `;
}

/**
 * Render game controls (movement arrows + dice)
 */
function renderGameControls(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return '';

    const myTurn = isMyTurn(gameState, myId);
    const movesLeft = gameState.playerMoves?.[myId] ?? 0;
    const canMove = myTurn && movesLeft > 0;

    return `
        <div class="game-controls">
            <div class="movement-controls">
                <button class="move-btn move-btn--up" type="button" data-action="move" data-direction="up" ${!canMove ? 'disabled' : ''}>
                    ▲
                </button>
                <div class="move-btn-row">
                    <button class="move-btn move-btn--left" type="button" data-action="move" data-direction="left" ${!canMove ? 'disabled' : ''}>
                        ◀
                    </button>
                    <div class="move-center">
                        <span class="moves-remaining">${movesLeft}</span>
                    </div>
                    <button class="move-btn move-btn--right" type="button" data-action="move" data-direction="right" ${!canMove ? 'disabled' : ''}>
                        ▶
                    </button>
                </div>
                <button class="move-btn move-btn--down" type="button" data-action="move" data-direction="down" ${!canMove ? 'disabled' : ''}>
                    ▼
                </button>
            </div>
            <button class="dice-event-btn" type="button" data-action="dice-event" disabled title="Chi kich hoat khi co su kien">
                <svg class="dice-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="4" width="40" height="40" rx="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
                    <circle cx="14" cy="14" r="3.5" fill="currentColor"/>
                    <circle cx="34" cy="14" r="3.5" fill="currentColor"/>
                    <circle cx="24" cy="24" r="3.5" fill="currentColor"/>
                    <circle cx="14" cy="34" r="3.5" fill="currentColor"/>
                    <circle cx="34" cy="34" r="3.5" fill="currentColor"/>
                </svg>
            </button>
        </div>
    `;
}

/**
 * Render game intro overlay (shows for 5 seconds when entering game)
 */
function renderGameIntro() {
    if (introShown) return '';

    return `
        <div class="game-intro" data-action="skip-intro">
            <div class="game-intro__content">
                <h1 class="game-intro__title">Chao mung den Vinh thu bo hoang</h1>
                <p class="game-intro__subtitle">Betrayal at House on the Hill</p>
                <p class="game-intro__hint">Click de bat dau...</p>
            </div>
        </div>
    `;
}

/**
 * Render main game screen
 */
function renderGameScreen(gameState, myId) {
    const isRolling = gameState?.gamePhase === 'rolling';
    const isPlaying = gameState?.gamePhase === 'playing';

    let content = '';

    if (isRolling) {
        content = renderDiceRollOverlay(gameState, myId);
    } else if (isPlaying) {
        // Build map data
        const mapState = gameState.map || null;
        const playerState = gameState.playerState || {};
        const playerPositions = playerState.playerPositions || {};
        const players = gameState.players || [];
        const playerNames = buildPlayerNamesMap(players, getCharacterName);
        const myPosition = playerPositions[myId];
        
        // Check if it's my turn to disable sidebar toggle
        const myTurn = isMyTurn(gameState, myId);

        content = `
            ${renderGameIntro()}
            ${renderSidebarToggle(myTurn)}
            <div class="game-layout">
                ${renderSidebar(gameState, myId)}
                <div class="game-main">
                    ${renderTurnOrder(gameState, myId)}
                    <div class="game-area">
                        ${renderGameMap(mapState, playerPositions, playerNames, myId, myPosition)}
                    </div>
                </div>
            </div>
            ${renderPlayerBar(gameState, myId)}
            ${renderGameControls(gameState, myId)}
        `;
    } else {
        content = `
            <div class="game-loading">
                <p>Dang tai tro choi...</p>
            </div>
        `;
    }

    return `
        <div class="game-container">
            ${content}
        </div>
    `;
}

/**
 * Hide intro and re-render
 */
function hideIntro(mountEl) {
    if (introShown) return;
    introShown = true;
    if (introTimeout) {
        clearTimeout(introTimeout);
        introTimeout = null;
    }
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Toggle sidebar open/close
 */
function toggleSidebar(mountEl) {
    sidebarOpen = !sidebarOpen;
    const sidebar = mountEl.querySelector('.game-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('is-open', sidebarOpen);
    }
}

/**
 * Close sidebar
 */
function closeSidebar(mountEl) {
    sidebarOpen = false;
    const sidebar = mountEl.querySelector('.game-sidebar');
    if (sidebar) {
        sidebar.classList.remove('is-open');
    }
}

/**
 * Toggle player expand/collapse in sidebar
 * @param {string} playerId - Player ID to toggle
 */
function togglePlayerExpand(playerId) {
    if (expandedPlayers.has(playerId)) {
        expandedPlayers.delete(playerId);
    } else {
        expandedPlayers.add(playerId);
    }
}

/**
 * Setup visibility change listener for active tracking
 * Emits active status when tab visibility changes
 */
function setupVisibilityTracking() {
    document.addEventListener('visibilitychange', () => {
        const isVisible = document.visibilityState === 'visible';
        socketClient.setActive(isVisible);
    });
    
    // Initial emit if visible
    if (document.visibilityState === 'visible') {
        socketClient.setActive(true);
    }
}

/**
 * Check if all players are active and hide intro
 * @param {string[]} activePlayerIds - List of active player IDs
 * @param {Object[]} allPlayers - All players in game
 * @param {HTMLElement} mountEl - Mount element for re-render
 */
function checkAllPlayersActive(activePlayerIds, allPlayers, mountEl) {
    // Update local activePlayers set
    activePlayers = new Set(activePlayerIds);
    
    // Check if all players are active
    const allActive = allPlayers.every(p => activePlayerIds.includes(p.id));
    if (allActive && !introShown) {
        hideIntro(mountEl);
    }
}

/**
 * Attach debug mode event listeners
 * @param {HTMLElement} mountEl
 */
function attachDebugEventListeners(mountEl) {
    mountEl.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const actionEl = target.closest('[data-action]');
        const action = actionEl?.dataset.action;

        // Debug switch player (click on turn order)
        if (action === 'debug-switch-player') {
            const playerId = actionEl?.dataset.playerId;
            if (playerId && currentGameState) {
                const playerIdx = currentGameState.players.findIndex(p => p.id === playerId);
                if (playerIdx !== -1) {
                    debugCurrentPlayerIndex = playerIdx;
                    mySocketId = getDebugPlayerId();
                    updateGameUI(mountEl, currentGameState, mySocketId);
                }
            }
            return;
        }

        // Skip intro
        if (action === 'skip-intro') {
            hideIntro(mountEl);
            return;
        }

        // Toggle sidebar
        if (action === 'toggle-sidebar') {
            const toggleBtn = target.closest('.sidebar-toggle');
            if (toggleBtn?.hasAttribute('disabled')) return;
            toggleSidebar(mountEl);
            return;
        }

        // Close sidebar
        if (action === 'close-sidebar') {
            closeSidebar(mountEl);
            return;
        }

        // Expand player in sidebar
        if (action === 'expand-player') {
            const playerEl = target.closest('[data-player-id]');
            const playerId = playerEl?.dataset.playerId;
            if (playerId) {
                togglePlayerExpand(playerId);
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
            return;
        }

        // Roll manual (debug)
        if (action === 'roll-manual') {
            const input = /** @type {HTMLInputElement} */ (mountEl.querySelector('#dice-manual-input'));
            const value = parseInt(input?.value || '0', 10);
            if (value >= 1 && value <= 16) {
                handleDebugDiceRoll(mountEl, value);
            } else {
                alert('Vui long nhap so tu 1 den 16');
            }
            return;
        }

        // Roll random (debug)
        if (action === 'roll-random') {
            const randomValue = Math.floor(Math.random() * 16) + 1;
            handleDebugDiceRoll(mountEl, randomValue);
            return;
        }

        // Move (debug)
        if (action === 'move') {
            const moveTarget = target.closest('[data-direction]');
            const direction = moveTarget?.dataset.direction;
            if (direction) {
                handleDebugMove(mountEl, direction);
            }
            return;
        }
    });

    // Enter key for dice input
    mountEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.id === 'dice-manual-input') {
            const btn = mountEl.querySelector('[data-action="roll-manual"]');
            btn?.click();
        }
    });
}

/**
 * Attach event listeners
 */
function attachEventListeners(mountEl, roomId) {
    // Roll dice manually
    mountEl.addEventListener('click', async (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const action = target.dataset.action || target.closest('[data-action]')?.dataset.action;

        // Skip intro
        if (action === 'skip-intro') {
            hideIntro(mountEl);
            return;
        }

        // Toggle sidebar
        if (action === 'toggle-sidebar') {
            // Don't toggle if button is disabled
            const toggleBtn = target.closest('.sidebar-toggle');
            if (toggleBtn?.hasAttribute('disabled')) {
                return;
            }
            toggleSidebar(mountEl);
            return;
        }

        // Close sidebar
        if (action === 'close-sidebar') {
            closeSidebar(mountEl);
            return;
        }

        // Expand/collapse player in sidebar
        if (action === 'expand-player') {
            const playerEl = target.closest('[data-player-id]');
            const playerId = playerEl?.dataset.playerId;
            if (playerId) {
                togglePlayerExpand(playerId);
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
            return;
        }

        // Roll manual
        if (action === 'roll-manual') {
            const input = /** @type {HTMLInputElement} */ (mountEl.querySelector('#dice-manual-input'));
            const value = parseInt(input?.value || '0', 10);
            if (value >= 1 && value <= 16) {
                await socketClient.rollDice(value);
            } else {
                alert('Vui long nhap so tu 1 den 16');
            }
            return;
        }

        // Roll random
        if (action === 'roll-random') {
            const randomValue = Math.floor(Math.random() * 16) + 1;
            await socketClient.rollDice(randomValue);
            return;
        }

        // Move
        if (action === 'move') {
            const moveTarget = target.closest('[data-direction]');
            const direction = moveTarget?.dataset.direction;
            if (direction) {
                await socketClient.move(direction);
            }
            return;
        }

        // Dice event (disabled for now)
        if (action === 'dice-event') {
            // Placeholder for future events
            return;
        }
    });

    // Enter key for dice input
    mountEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.id === 'dice-manual-input') {
            const btn = mountEl.querySelector('[data-action="roll-manual"]');
            btn?.click();
        }
    });
}

// Track if we've initialized moves for the current turn
let movesInitializedForTurn = -1;

/**
 * Update game UI
 */
async function updateGameUI(mountEl, gameState, myId) {
    // When it becomes my turn in 'playing' phase, set my moves based on speed
    if (gameState?.gamePhase === 'playing' && myId) {
        const currentTurnIndex = gameState.currentTurnIndex ?? 0;
        const currentPlayer = gameState.turnOrder?.[currentTurnIndex];
        const me = gameState.players?.find(p => p.id === myId);
        const myMoves = gameState.playerMoves?.[myId] ?? 0;

        // If it's my turn and moves are 0 and we haven't initialized for this turn
        if (currentPlayer === myId && myMoves === 0 && movesInitializedForTurn !== currentTurnIndex) {
            if (me?.characterId) {
                movesInitializedForTurn = currentTurnIndex;
                const speed = getCharacterSpeed(me.characterId);
                await socketClient.setMoves(speed);
                return; // Will re-render after state update
            }
        }

        // Note: Intro is now controlled by checkAllPlayersActive, not by timeout
    }

    const html = renderGameScreen(gameState, myId);
    mountEl.innerHTML = html;
}

/**
 * Handle debug mode dice roll
 * @param {HTMLElement} mountEl
 * @param {number} value
 */
function handleDebugDiceRoll(mountEl, value) {
    if (!currentGameState || currentGameState.gamePhase !== 'rolling') return;

    const playerId = getDebugPlayerId();
    
    // Record the roll
    currentGameState.diceRolls[playerId] = value;
    
    // Remove from needsRoll
    currentGameState.needsRoll = currentGameState.needsRoll.filter(id => id !== playerId);
    
    // Check if all rolled
    if (currentGameState.needsRoll.length === 0) {
        // Determine turn order by dice rolls (highest first)
        const rolls = currentGameState.diceRolls;
        const sorted = Object.entries(rolls).sort((a, b) => b[1] - a[1]);
        currentGameState.turnOrder = sorted.map(([id]) => id);
        currentGameState.currentTurnIndex = 0;
        currentGameState.gamePhase = 'playing';
        
        // Set initial moves for first player
        const firstPlayer = currentGameState.players.find(p => p.id === currentGameState.turnOrder[0]);
        if (firstPlayer) {
            const speed = getCharacterSpeed(firstPlayer.characterId);
            currentGameState.playerMoves[firstPlayer.id] = speed;
        }
        
        // Auto switch to first player in turn order
        const firstIdx = currentGameState.players.findIndex(p => p.id === currentGameState.turnOrder[0]);
        if (firstIdx !== -1) {
            debugCurrentPlayerIndex = firstIdx;
        }
    } else {
        // Auto switch to next player who needs to roll
        const nextNeedRoll = currentGameState.needsRoll[0];
        const nextIdx = currentGameState.players.findIndex(p => p.id === nextNeedRoll);
        if (nextIdx !== -1) {
            debugCurrentPlayerIndex = nextIdx;
        }
    }
    
    updateGameUI(mountEl, currentGameState, getDebugPlayerId());
}

/**
 * Handle debug mode move
 * @param {HTMLElement} mountEl
 * @param {string} direction
 */
function handleDebugMove(mountEl, direction) {
    if (!currentGameState || currentGameState.gamePhase !== 'playing') return;

    const playerId = getDebugPlayerId();
    const currentTurnPlayer = currentGameState.turnOrder[currentGameState.currentTurnIndex];
    
    // Only allow move if it's this player's turn
    if (playerId !== currentTurnPlayer) return;
    
    const moves = currentGameState.playerMoves[playerId] || 0;
    if (moves <= 0) return;
    
    // Decrease moves
    currentGameState.playerMoves[playerId] = moves - 1;
    
    // Update position (simplified - just show direction moved)
    const currentPos = currentGameState.playerState.playerPositions[playerId] || 'Entrance Hall';
    currentGameState.playerState.playerPositions[playerId] = `${currentPos} (moved ${direction})`;
    
    // Check if turn ended
    if (currentGameState.playerMoves[playerId] <= 0) {
        // Move to next player
        currentGameState.currentTurnIndex = (currentGameState.currentTurnIndex + 1) % currentGameState.turnOrder.length;
        
        // Set moves for next player
        const nextPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
        const nextPlayer = currentGameState.players.find(p => p.id === nextPlayerId);
        if (nextPlayer) {
            const speed = getCharacterSpeed(nextPlayer.characterId);
            currentGameState.playerMoves[nextPlayerId] = speed;
        }
        
        // Auto switch to next player
        const nextIdx = currentGameState.players.findIndex(p => p.id === nextPlayerId);
        if (nextIdx !== -1) {
            debugCurrentPlayerIndex = nextIdx;
        }
    }
    
    updateGameUI(mountEl, currentGameState, getDebugPlayerId());
}

/**
 * Render game view
 * @param {{ mountEl: HTMLElement; onNavigate: (hash: string) => void; roomId: string | null; debugMode?: boolean }} options
 */
export function renderGameView({ mountEl, onNavigate, roomId, debugMode = false }) {
    // Set debug mode flag
    isDebugMode = debugMode;
    debugCurrentPlayerIndex = 0;
    
    if (debugMode) {
        // Initialize debug game state
        currentGameState = createDebugGameState();
        mySocketId = getDebugPlayerId();
        introShown = true; // Skip intro in debug mode
        
        // Initial render
        mountEl.innerHTML = renderGameScreen(currentGameState, mySocketId);
        
        // Attach debug event listeners
        attachDebugEventListeners(mountEl);
        
        return;
    }
    
    // Normal mode - connect socket
    socketClient.connect();
    mySocketId = socketClient.getSocketId();

    // Initial loading state
    mountEl.innerHTML = renderGameScreen(null, mySocketId);

    // Subscribe to game state updates
    unsubscribeGameState = socketClient.onGameState((state) => {
        currentGameState = state;
        mySocketId = socketClient.getSocketId();
        updateGameUI(mountEl, currentGameState, mySocketId);
    });

    // Subscribe to players active updates for intro logic
    unsubscribePlayersActive = socketClient.onPlayersActive((data) => {
        const activePlayerIds = data.activePlayers || [];
        const allPlayers = currentGameState?.players || [];
        checkAllPlayersActive(activePlayerIds, allPlayers, mountEl);
    });

    // Setup visibility tracking for active status
    setupVisibilityTracking();

    // Request game state
    socketClient.getGameState(roomId);

    // Attach event listeners
    attachEventListeners(mountEl, roomId);

    // Cleanup on navigate away
    window.addEventListener('hashchange', () => {
        if (unsubscribeGameState) {
            unsubscribeGameState();
            unsubscribeGameState = null;
        }
        if (unsubscribePlayersActive) {
            unsubscribePlayersActive();
            unsubscribePlayersActive = null;
        }
        if (introTimeout) {
            clearTimeout(introTimeout);
            introTimeout = null;
        }
        // Reset state for next game
        sidebarOpen = false;
        introShown = false;
        movesInitializedForTurn = -1;
        expandedPlayers.clear();
        activePlayers.clear();
    }, { once: true });
}
