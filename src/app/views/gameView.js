// Game View - Dice rolling phase and main gameplay
import { CHARACTER_BY_ID, CHARACTERS } from '../data/charactersData.js';
import * as socketClient from '../services/socketClient.js';
import { renderGameMap, buildPlayerNamesMap } from '../components/GameMap.js';
import { ROOMS } from '../data/mapsData.js';

// Room discovery modal state
/** @type {{ isOpen: boolean; direction: string; floor: string; doorSide: string } | null} */
let roomDiscoveryModal = null;

/** @type {any} */
let currentGameState = null;
let mySocketId = null;
let unsubscribeGameState = null;
let sidebarOpen = false;
let introShown = false;
let introTimeout = null;
let turnOrderExpanded = false; // Turn order collapsed by default
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
 * Convert door side from mapsData format to map format
 * @param {'top'|'right'|'bottom'|'left'} side
 * @returns {'north'|'south'|'east'|'west'}
 */
function convertDoorSide(side) {
    const mapping = { top: 'north', bottom: 'south', left: 'west', right: 'east' };
    return mapping[side] || side;
}

/**
 * Get room definition from ROOMS by English name
 * @param {string} nameEn
 * @returns {import('../data/mapsData.js').RoomDef | undefined}
 */
function getRoomByName(nameEn) {
    return ROOMS.find(r => r.name.en === nameEn);
}

/**
 * Extract doors array from room definition
 * @param {import('../data/mapsData.js').RoomDef} roomDef
 * @returns {('north'|'south'|'east'|'west')[]}
 */
function extractDoors(roomDef) {
    return roomDef.doors.map(d => convertDoorSide(d.side));
}

/**
 * Create mock map for debug mode
 * Loads door positions from ROOMS data
 * @returns {Object}
 */
function createMockMap() {
    // Get room definitions from mapsData
    const entranceHallDef = getRoomByName('Entrance Hall');
    const foyerDef = getRoomByName('Foyer');
    const grandStaircaseDef = getRoomByName('Grand Staircase');
    const upperLandingDef = getRoomByName('Upper Landing');

    return {
        revealedRooms: {
            'entrance-hall': {
                id: 'entrance-hall',
                name: 'Entrance Hall',
                x: 0,
                y: 0,
                doors: entranceHallDef ? extractDoors(entranceHallDef) : ['north', 'west', 'east'],
                floor: 'ground'
            },
            'foyer': {
                id: 'foyer',
                name: 'Foyer',
                x: 0,
                y: 1,
                doors: foyerDef ? extractDoors(foyerDef) : ['north', 'south', 'west', 'east'],
                floor: 'ground'
            },
            'grand-staircase': {
                id: 'grand-staircase',
                name: 'Grand Staircase',
                x: 0,
                y: 2,
                doors: grandStaircaseDef ? extractDoors(grandStaircaseDef) : ['south'],
                floor: 'ground',
                stairsTo: 'upper-landing'
            },
            'upper-landing': {
                id: 'upper-landing',
                name: 'Upper Landing',
                x: 0,
                y: 0, // separate coordinate for upper floor
                doors: upperLandingDef ? extractDoors(upperLandingDef) : ['north', 'south', 'west', 'east'],
                floor: 'upper',
                stairsTo: 'grand-staircase'
            }
        },
        connections: {
            'entrance-hall': { north: 'foyer' },
            'foyer': { south: 'entrance-hall', north: 'grand-staircase' },
            'grand-staircase': { south: 'foyer' },
            'upper-landing': {}
        },
        // Special staircase connections (not regular doors)
        staircaseConnections: {
            'grand-staircase': 'upper-landing',
            'upper-landing': 'grand-staircase'
        }
    };
}

/**
 * Create character data with initial stats from character definition
 * @param {string} playerId
 * @param {string} characterId
 * @returns {Object}
 */
function createCharacterData(playerId, characterId) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return null;
    return {
        characterId,
        stats: {
            speed: char.traits.speed.startIndex,
            might: char.traits.might.startIndex,
            sanity: char.traits.sanity.startIndex,
            knowledge: char.traits.knowledge.startIndex,
        },
        isDead: false,
    };
}

/**
 * Create game state from passed player data (from debug room)
 * @param {Array} players - Players array from room
 * @returns {any}
 */
function createGameStateFromPlayers(players) {
    // Create player positions and character data - all start at entrance hall
    const playerPositions = {};
    const characterData = {};
    players.forEach(p => {
        playerPositions[p.id] = 'entrance-hall';
        const charData = createCharacterData(p.id, p.characterId);
        if (charData) {
            characterData[p.id] = charData;
        }
    });

    return {
        roomId: 'DEBUG-MODE',
        gamePhase: 'rolling',
        players: players.map(p => ({
            id: p.id,
            name: p.name,
            characterId: p.characterId,
            status: 'ready'
        })),
        diceRolls: {},
        needsRoll: players.map(p => p.id),
        turnOrder: [],
        currentTurnIndex: 0,
        playerMoves: {},
        playerState: {
            playerPositions,
            characterData
        },
        characterData,
        map: createMockMap()
    };
}

/**
 * Create mock game state for debug mode
 * Checks sessionStorage for passed data from debug room first
 * Falls back to random characters if no data passed
 * @returns {any}
 */
function createDebugGameState() {
    // Check for passed data from debug room
    const savedData = sessionStorage.getItem('debugGameData');
    if (savedData) {
        try {
            const { players } = JSON.parse(savedData);
            sessionStorage.removeItem('debugGameData'); // Clear after use
            if (players && players.length >= 3) {
                return createGameStateFromPlayers(players);
            }
        } catch (e) {
            console.error('Failed to parse debug game data:', e);
        }
    }

    // Fallback: generate random players (legacy behavior)
    const shuffled = [...CHARACTERS].sort(() => Math.random() - 0.5);
    const selectedChars = shuffled.slice(0, 3);
    
    const players = selectedChars.map((char, idx) => ({
        id: `debug-player-${idx}`,
        name: `Player ${idx + 1}`,
        characterId: char.id,
        status: 'ready'
    }));

    // Create player positions and character data
    const playerPositions = {};
    const characterData = {};
    players.forEach(p => {
        playerPositions[p.id] = 'entrance-hall';
        const charData = createCharacterData(p.id, p.characterId);
        if (charData) {
            characterData[p.id] = charData;
        }
    });

    return {
        roomId: 'DEBUG-MODE',
        gamePhase: 'rolling',
        players,
        diceRolls: {},
        needsRoll: players.map(p => p.id),
        turnOrder: [],
        currentTurnIndex: 0,
        playerMoves: {},
        playerState: {
            playerPositions,
            characterData
        },
        characterData,
        map: createMockMap()
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
 * Get stat value from character's trait track at given index
 * @param {string} characterId
 * @param {'speed' | 'might' | 'sanity' | 'knowledge'} trait
 * @param {number} currentIndex
 * @returns {number}
 */
function getStatValue(characterId, trait, currentIndex) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 0;
    const traitData = char.traits[trait];
    if (!traitData) return 0;
    const idx = Math.max(0, Math.min(7, currentIndex));
    return traitData.track[idx];
}

/**
 * Get all stat values for a player from characterData
 * @param {Object} characterData - Player's character data with stats indices
 * @returns {{ speed: number; might: number; sanity: number; knowledge: number } | null}
 */
function getAllStatValues(characterData) {
    if (!characterData || !characterData.characterId || !characterData.stats) return null;
    const { characterId, stats } = characterData;
    return {
        speed: getStatValue(characterId, 'speed', stats.speed),
        might: getStatValue(characterId, 'might', stats.might),
        sanity: getStatValue(characterId, 'sanity', stats.sanity),
        knowledge: getStatValue(characterId, 'knowledge', stats.knowledge),
    };
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
    
    // In debug mode, check if current debug player needs to roll
    // Otherwise check if myId needs to roll
    const iNeedToRoll = isDebugMode 
        ? needsRoll.length > 0  // In debug mode, show controls if anyone needs to roll
        : needsRoll.includes(myId);

    // Get current player who needs to roll (for debug mode display)
    const currentRollingPlayer = needsRoll.length > 0 
        ? players.find(p => p.id === needsRoll[0])
        : null;

    const playersRollsHtml = players.map(p => {
        const charName = getCharacterName(p.characterId);
        const roll = diceRolls[p.id];
        const isMe = p.id === myId;
        const isCurrentRoller = isDebugMode && p.id === needsRoll[0];
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
            <div class="dice-player ${isMe ? 'is-me' : ''} ${waiting ? 'is-waiting' : ''} ${isCurrentRoller ? 'is-current-roller' : ''}">
                <span class="dice-player__name">${charName}${isMe ? ' (You)' : ''}${isCurrentRoller ? ' - Dang tung' : ''}</span>
                ${rollDisplay}
            </div>
        `;
    }).join('');

    // In debug mode, show which player is rolling
    const rollingPlayerName = currentRollingPlayer 
        ? getCharacterName(currentRollingPlayer.characterId)
        : '';

    const rollControls = iNeedToRoll ? `
        <div class="dice-controls">
            <p class="dice-instruction">${isDebugMode && rollingPlayerName ? `${rollingPlayerName} dang tung xi ngau` : 'Tung xi ngau de quyet dinh thu tu di'}</p>
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
 */
function renderSidebarToggle() {
    return `
        <button class="sidebar-toggle" 
                type="button" 
                data-action="toggle-sidebar" 
                title="Toggle Players">
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
 * Render character stats section (4 traits: Speed, Might, Sanity, Knowledge)
 * @param {Object} characterData - Player's character data with stats indices
 * @returns {string} HTML string
 */
function renderCharacterStats(characterData) {
    const statValues = getAllStatValues(characterData);
    if (!statValues) return '';

    return `
        <div class="sidebar-traits">
            <div class="sidebar-trait sidebar-trait--speed">
                <span class="sidebar-trait__label">Speed</span>
                <span class="sidebar-trait__value">${statValues.speed}</span>
            </div>
            <div class="sidebar-trait sidebar-trait--might">
                <span class="sidebar-trait__label">Might</span>
                <span class="sidebar-trait__value">${statValues.might}</span>
            </div>
            <div class="sidebar-trait sidebar-trait--sanity">
                <span class="sidebar-trait__label">Sanity</span>
                <span class="sidebar-trait__value">${statValues.sanity}</span>
            </div>
            <div class="sidebar-trait sidebar-trait--knowledge">
                <span class="sidebar-trait__label">Knowledge</span>
                <span class="sidebar-trait__value">${statValues.knowledge}</span>
            </div>
        </div>
    `;
}

/**
 * Render character modal (reused from roomView)
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
 * @param {Object} char - Character definition
 * @param {Object} currentStats - Current stat indices (optional, for showing current values)
 */
function renderCharacterDetail(char, currentStats = null) {
    const bio = char.bio.vi;
    const profile = char.profile?.vi || char.profile?.en || {};
    const hobbies = bio.hobbies?.join(', ') || 'Khong ro';
    const fear = profile.fear || 'Khong ro';
    const info = profile.info || '';

    const traitLabels = { speed: 'Toc do', might: 'Suc manh', sanity: 'Tam tri', knowledge: 'Kien thuc' };

    const traitsHtml = Object.entries(char.traits)
        .map(([key, trait]) => {
            const label = traitLabels[key] || key;
            const currentIndex = currentStats ? currentStats[key] : trait.startIndex;
            const trackHtml = trait.track
                .map((val, idx) => {
                    const isStart = idx === trait.startIndex;
                    const isCurrent = idx === currentIndex;
                    let classes = 'trait-value';
                    if (isStart) classes += ' trait-value--start';
                    if (isCurrent && !isStart) classes += ' trait-value--current';
                    return `<span class="${classes}">${val}</span>`;
                })
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
 * Open character modal
 * @param {HTMLElement} mountEl
 * @param {string} charId
 * @param {Object} currentStats - Current stat indices (optional)
 */
function openCharacterModal(mountEl, charId, currentStats = null) {
    const char = CHARACTER_BY_ID[charId];
    const modal = mountEl.querySelector('#character-modal');
    const modalTitle = mountEl.querySelector('#modal-title');
    const modalBody = mountEl.querySelector('#modal-body');

    if (!char || !modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = char.name.vi || char.name.nickname || char.name.en;
    modalBody.innerHTML = renderCharacterDetail(char, currentStats);
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
 * Get floor display name
 * @param {'ground' | 'upper' | 'basement'} floor
 * @returns {string}
 */
function getFloorDisplayName(floor) {
    const floorNames = {
        ground: 'Tang tret',
        upper: 'Tang tren',
        basement: 'Tang ham'
    };
    return floorNames[floor] || floor;
}

/**
 * Render sidebar with current player info (replaces player-bar)
 */
function renderSidebar(gameState, myId) {
    if (!gameState) return '';

    const me = gameState.players?.find(p => p.id === myId);
    if (!me) return '';

    const charName = getCharacterName(me.characterId);
    const movesLeft = gameState.playerMoves?.[myId] ?? 0;
    const myTurn = isMyTurn(gameState, myId);
    const playerPositions = gameState.playerState?.playerPositions || {};
    const myPosition = playerPositions[myId] || 'Unknown';

    // Get current room info for floor
    const revealedRooms = gameState.map?.revealedRooms || {};
    const currentRoom = revealedRooms[myPosition];
    const currentFloor = currentRoom?.floor || 'ground';
    const floorDisplay = getFloorDisplayName(currentFloor);
    const roomName = currentRoom?.name || myPosition;

    // Get character stats from game state
    const characterData = gameState.playerState?.characterData?.[myId] || gameState.characterData?.[myId];

    // TODO: Get actual cards from game state when implemented
    const omenCards = [];
    const eventCards = [];
    const itemCards = [];

    const openClass = sidebarOpen ? 'is-open' : '';

    return `
        <aside class="game-sidebar ${openClass} ${myTurn ? 'is-my-turn' : ''}">
            <div class="sidebar-header">
                <span class="sidebar-title">${charName}</span>
                <button class="sidebar-close" type="button" data-action="close-sidebar">&times;</button>
            </div>
            <div class="sidebar-content">
                <div class="sidebar-stats">
                    <div class="sidebar-stat">
                        <span class="sidebar-stat__label">Vi tri</span>
                        <span class="sidebar-stat__value">${roomName}</span>
                    </div>
                    <div class="sidebar-stat sidebar-stat--floor sidebar-stat--floor-${currentFloor}">
                        <span class="sidebar-stat__label">Tang</span>
                        <span class="sidebar-stat__value">${floorDisplay}</span>
                    </div>
                    <div class="sidebar-stat sidebar-stat--highlight">
                        <span class="sidebar-stat__label">Luot di</span>
                        <span class="sidebar-stat__value">${movesLeft}</span>
                    </div>
                </div>
                ${renderCharacterStats(characterData)}
                <div class="sidebar-cards">
                    <div class="sidebar-card sidebar-card--omen">
                        <span class="sidebar-card__count">${omenCards.length}</span>
                        <span class="sidebar-card__label">Omen</span>
                    </div>
                    <div class="sidebar-card sidebar-card--event">
                        <span class="sidebar-card__count">${eventCards.length}</span>
                        <span class="sidebar-card__label">Event</span>
                    </div>
                    <div class="sidebar-card sidebar-card--item">
                        <span class="sidebar-card__count">${itemCards.length}</span>
                        <span class="sidebar-card__label">Item</span>
                    </div>
                </div>
                <button class="sidebar-detail-btn" type="button" data-action="view-character-detail" data-character-id="${me.characterId}">
                    Xem chi tiet nhan vat
                </button>
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
 * Render turn order indicator (collapsible)
 */
function renderTurnOrder(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return '';

    const turnOrder = gameState.turnOrder || [];
    const currentIndex = gameState.currentTurnIndex ?? 0;
    const players = gameState.players || [];
    const playerPositions = gameState.playerState?.playerPositions || {};
    
    // Get current player info for collapsed view
    const currentPlayerId = turnOrder[currentIndex];
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const currentCharName = currentPlayer ? getCharacterName(currentPlayer.characterId) : 'Unknown';
    const isCurrentMe = currentPlayerId === myId;

    const orderedPlayers = turnOrder.map((socketId, idx) => {
        const player = players.find(p => p.id === socketId);
        if (!player) return null;
        const charName = getCharacterName(player.characterId);
        const isMe = socketId === myId;
        const isCurrent = idx === currentIndex;

        const position = playerPositions[socketId] || 'Unknown';

        // In debug mode, make turn indicators clickable to switch player
        const clickableAttr = isDebugMode ? `data-action="debug-switch-player" data-player-id="${socketId}"` : '';
        const clickableClass = isDebugMode ? 'is-clickable' : '';

        return `
            <div class="turn-indicator ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${clickableClass}" ${clickableAttr}>
                <span class="turn-indicator__order">${idx + 1}</span>
                <div class="turn-indicator__info">
                    <span class="turn-indicator__name">${charName}${isMe ? ' (You)' : ''}</span>
                    <span class="turn-indicator__room">${position}</span>
                </div>
            </div>
        `;
    }).filter(Boolean).join('');

    const expandedClass = turnOrderExpanded ? 'is-expanded' : '';
    const chevronIcon = turnOrderExpanded ? '▲' : '▼';

    return `
        <div class="turn-order ${expandedClass}">
            <div class="turn-order__header" data-action="toggle-turn-order">
                <span class="turn-order__current">
                    <span class="turn-order__current-label">Luot:</span>
                    <span class="turn-order__current-name">${currentCharName}${isCurrentMe ? ' (You)' : ''}</span>
                </span>
                <span class="turn-order__chevron">${chevronIcon}</span>
            </div>
            <div class="turn-order__list">${orderedPlayers}</div>
        </div>
    `;
}

/**
 * Check if player can use stairs from current room
 * @param {Object} gameState
 * @param {string} myId
 * @returns {{ canGoUp: boolean; canGoDown: boolean; targetRoom: string | null }}
 */
function getStairsAvailability(gameState, myId) {
    const playerPositions = gameState?.playerState?.playerPositions || {};
    const currentRoomId = playerPositions[myId];
    const revealedRooms = gameState?.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    const staircaseConnections = gameState?.map?.staircaseConnections || {};

    if (!currentRoom || !staircaseConnections[currentRoomId]) {
        return { canGoUp: false, canGoDown: false, targetRoom: null };
    }

    const targetRoomId = staircaseConnections[currentRoomId];
    const targetRoom = revealedRooms[targetRoomId];

    if (!targetRoom) {
        return { canGoUp: false, canGoDown: false, targetRoom: null };
    }

    // Determine direction based on floor
    const currentFloor = currentRoom.floor;
    const targetFloor = targetRoom.floor;

    // ground -> upper = up, upper -> ground = down
    // ground -> basement = down, basement -> ground = up
    const floorOrder = { basement: 0, ground: 1, upper: 2 };
    const goingUp = floorOrder[targetFloor] > floorOrder[currentFloor];

    return {
        canGoUp: goingUp,
        canGoDown: !goingUp,
        targetRoom: targetRoomId
    };
}

/**
 * Render game controls (movement arrows + dice + stairs)
 */
function renderGameControls(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return '';

    const myTurn = isMyTurn(gameState, myId);
    const movesLeft = gameState.playerMoves?.[myId] ?? 0;
    const canMove = myTurn && movesLeft > 0;

    // Check stairs availability
    const stairs = getStairsAvailability(gameState, myId);
    const showUpBtn = stairs.canGoUp && canMove;
    const showDownBtn = stairs.canGoDown && canMove;

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
            <div class="stairs-controls">
                ${showUpBtn ? `
                    <button class="stairs-btn stairs-btn--up" type="button" data-action="use-stairs" data-target="${stairs.targetRoom}" title="Leo len tang tren">
                        <span class="stairs-btn__arrow">▲</span>
                        <span class="stairs-btn__label">UP</span>
                    </button>
                ` : ''}
                ${showDownBtn ? `
                    <button class="stairs-btn stairs-btn--down" type="button" data-action="use-stairs" data-target="${stairs.targetRoom}" title="Di xuong tang duoi">
                        <span class="stairs-btn__arrow">▼</span>
                        <span class="stairs-btn__label">DOWN</span>
                    </button>
                ` : ''}
            </div>
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
        const revealedRooms = mapState?.revealedRooms || {};
        
        // Room discovery modal
        let roomDiscoveryHtml = '';
        if (roomDiscoveryModal?.isOpen) {
            roomDiscoveryHtml = renderRoomDiscoveryModal(
                roomDiscoveryModal.floor,
                roomDiscoveryModal.doorSide,
                revealedRooms
            );
        }
        
        content = `
            ${renderGameIntro()}
            ${renderSidebarToggle()}
            <div class="game-layout">
                ${renderSidebar(gameState, myId)}
                <div class="game-main">
                    ${renderTurnOrder(gameState, myId)}
                    <div class="game-area">
                        ${renderGameMap(mapState, playerPositions, playerNames, myId, myPosition)}
                    </div>
                </div>
            </div>
            ${renderGameControls(gameState, myId)}
            ${roomDiscoveryHtml}
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
            ${renderCharacterModal()}
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

        // Toggle turn order expand/collapse
        if (action === 'toggle-turn-order') {
            turnOrderExpanded = !turnOrderExpanded;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Debug switch player (click on turn order)
        if (action === 'debug-switch-player') {
            const playerId = actionEl?.dataset.playerId;
            if (playerId && currentGameState) {
                const playerIdx = currentGameState.players.findIndex(p => p.id === playerId);
                if (playerIdx !== -1) {
                    debugCurrentPlayerIndex = playerIdx;
                    // Set mySocketId to the actual player ID from game state
                    mySocketId = currentGameState.players[playerIdx].id;
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

        // Use stairs (debug)
        if (action === 'use-stairs') {
            const targetRoom = actionEl?.dataset.target;
            if (targetRoom) {
                handleDebugUseStairs(mountEl, targetRoom);
            }
            return;
        }

        // Room discovery actions
        if (action === 'confirm-room-select') {
            const hiddenInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#room-select-value'));
            const selectedRoom = hiddenInput?.value;
            if (selectedRoom) {
                handleRoomDiscovery(mountEl, selectedRoom);
            } else {
                alert('Vui long chon mot phong');
            }
            return;
        }

        // Select room from list
        if (target.closest('.room-discovery__item')) {
            const item = /** @type {HTMLElement} */ (target.closest('.room-discovery__item'));
            const roomName = item.dataset.roomName;
            const searchInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#room-search-input'));
            const hiddenInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#room-select-value'));
            
            // Update UI
            if (searchInput) searchInput.value = item.textContent || '';
            if (hiddenInput) hiddenInput.value = roomName || '';
            
            // Mark as selected
            mountEl.querySelectorAll('.room-discovery__item').forEach(el => el.classList.remove('is-selected'));
            item.classList.add('is-selected');
            return;
        }

        if (action === 'random-room') {
            handleRandomRoomDiscovery(mountEl);
            return;
        }

        if (action === 'cancel-room-discovery') {
            cancelRoomDiscovery(mountEl);
            return;
        }

        // View character detail
        if (action === 'view-character-detail') {
            const charId = actionEl?.dataset.characterId;
            if (charId && currentGameState) {
                // Get current stats for this character
                const characterData = currentGameState.playerState?.characterData?.[mySocketId] || currentGameState.characterData?.[mySocketId];
                const currentStats = characterData?.stats || null;
                openCharacterModal(mountEl, charId, currentStats);
            }
            return;
        }

        // Close modal
        if (action === 'close-modal') {
            closeCharacterModal(mountEl);
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

    // Room search input handler
    mountEl.addEventListener('input', (e) => {
        const target = /** @type {HTMLInputElement} */ (e.target);
        if (target.id === 'room-search-input') {
            const searchText = target.value.toLowerCase().trim();
            const items = mountEl.querySelectorAll('.room-discovery__item');
            
            items.forEach(item => {
                const itemEl = /** @type {HTMLElement} */ (item);
                const searchData = itemEl.dataset.searchText || '';
                const matches = searchText === '' || searchData.includes(searchText);
                itemEl.style.display = matches ? '' : 'none';
            });
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

        // Toggle turn order expand/collapse
        if (action === 'toggle-turn-order') {
            turnOrderExpanded = !turnOrderExpanded;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

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

        // View character detail
        if (action === 'view-character-detail') {
            const actionEl = target.closest('[data-action]');
            const charId = actionEl?.dataset.characterId;
            if (charId && currentGameState) {
                // Get current stats for this character
                const characterData = currentGameState.playerState?.characterData?.[mySocketId] || currentGameState.characterData?.[mySocketId];
                const currentStats = characterData?.stats || null;
                openCharacterModal(mountEl, charId, currentStats);
            }
            return;
        }

        // Close modal
        if (action === 'close-modal') {
            closeCharacterModal(mountEl);
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
    if (currentGameState.needsRoll.length === 0) return;

    // Roll for the first player who needs to roll
    const playerId = currentGameState.needsRoll[0];
    
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
            mySocketId = currentGameState.players[firstIdx].id;
        }
    }
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Map direction to door direction for movement
 * @param {string} direction - UI direction (up/down/left/right)
 * @returns {string} - Door direction (north/south/west/east)
 */
function mapDirectionToDoor(direction) {
    const mapping = {
        'up': 'north',
        'down': 'south',
        'left': 'west',
        'right': 'east'
    };
    return mapping[direction] || direction;
}

/**
 * Get opposite door direction
 * @param {string} doorDir - Door direction (north/south/east/west)
 * @returns {string} - Opposite direction
 */
function getOppositeDoor(doorDir) {
    const opposites = {
        'north': 'south',
        'south': 'north',
        'east': 'west',
        'west': 'east'
    };
    return opposites[doorDir] || doorDir;
}

/**
 * Convert door direction to mapsData side format
 * @param {string} doorDir - Door direction (north/south/east/west)
 * @returns {string} - Side format (top/bottom/left/right)
 */
function doorDirToSide(doorDir) {
    const mapping = {
        'north': 'top',
        'south': 'bottom',
        'east': 'right',
        'west': 'left'
    };
    return mapping[doorDir] || doorDir;
}

/**
 * Get available rooms for a floor that haven't been revealed yet
 * @param {string} floor - Floor type (ground/upper/basement)
 * @param {Record<string, any>} revealedRooms - Already revealed rooms
 * @returns {import('../data/mapsData.js').RoomDef[]}
 */
function getAvailableRoomsForFloor(floor, revealedRooms) {
    // Get names of already revealed rooms
    const revealedNames = new Set(Object.values(revealedRooms).map(r => r.name));
    
    // Filter rooms that:
    // 1. Are allowed on this floor
    // 2. Haven't been revealed yet
    // 3. Are not starting rooms (they're already placed)
    return ROOMS.filter(room => {
        if (room.isStartingRoom) return false;
        if (!room.floorsAllowed.includes(floor)) return false;
        if (revealedNames.has(room.name.en)) return false;
        return true;
    });
}

/**
 * Check if a room has a door on the required side
 * @param {import('../data/mapsData.js').RoomDef} roomDef - Room definition
 * @param {string} requiredSide - Required door side (top/bottom/left/right)
 * @returns {boolean}
 */
function roomHasDoorOnSide(roomDef, requiredSide) {
    return roomDef.doors.some(d => d.side === requiredSide && d.kind === 'door');
}

/**
 * Check if a door is blocked (e.g., front-door of Entrance Hall)
 * @param {string} roomName - Room name in English
 * @param {string} doorDirection - Door direction (north/south/east/west)
 * @returns {boolean}
 */
function isDoorBlocked(roomName, doorDirection) {
    // Entrance Hall's front door (south/bottom) cannot be used
    if (roomName === 'Entrance Hall' && doorDirection === 'south') {
        return true;
    }
    return false;
}

/**
 * Filter rooms that have a connecting door on the required side
 * @param {import('../data/mapsData.js').RoomDef[]} rooms - Available rooms
 * @param {string} requiredDoorSide - Required door side (top/bottom/left/right)
 * @returns {import('../data/mapsData.js').RoomDef[]}
 */
function filterRoomsWithConnectingDoor(rooms, requiredDoorSide) {
    return rooms.filter(room => roomHasDoorOnSide(room, requiredDoorSide));
}

/**
 * Render room discovery modal
 * @param {string} floor - Current floor
 * @param {string} doorSide - Required door side for connection
 * @param {Record<string, any>} revealedRooms - Already revealed rooms
 * @returns {string}
 */
function renderRoomDiscoveryModal(floor, doorSide, revealedRooms) {
    if (!roomDiscoveryModal?.isOpen) return '';
    
    const availableRooms = getAvailableRoomsForFloor(floor, revealedRooms);
    const validRooms = filterRoomsWithConnectingDoor(availableRooms, doorSide);
    
    const floorNames = {
        ground: 'Tang tret',
        upper: 'Tang tren',
        basement: 'Tang ham'
    };
    const floorDisplay = floorNames[floor] || floor;
    
    const roomListHtml = validRooms.map(room => {
        const nameVi = room.name.vi || room.name.en;
        return `<div class="room-discovery__item" data-room-name="${room.name.en}" data-search-text="${nameVi.toLowerCase()} ${room.name.en.toLowerCase()}">${nameVi}</div>`;
    }).join('');
    
    const noRoomsMessage = validRooms.length === 0 
        ? `<p class="room-discovery__no-rooms">Khong con phong nao co the dat o huong nay!</p>` 
        : '';
    
    return `
        <div class="room-discovery-overlay">
            <div class="room-discovery-modal">
                <h2 class="room-discovery__title">Rut bai phong moi</h2>
                <p class="room-discovery__subtitle">Ban dang di vao mot khu vuc chua kham pha (${floorDisplay})</p>
                
                ${noRoomsMessage}
                
                ${validRooms.length > 0 ? `
                    <div class="room-discovery__options">
                        <div class="room-discovery__option">
                            <label class="room-discovery__label">Chon phong:</label>
                            <div class="room-discovery__search-wrapper">
                                <input type="text" 
                                       class="room-discovery__search" 
                                       id="room-search-input" 
                                       placeholder="Nhap ten phong de tim kiem..."
                                       autocomplete="off" />
                                <div class="room-discovery__list" id="room-list">
                                    ${roomListHtml}
                                </div>
                            </div>
                            <input type="hidden" id="room-select-value" value="" />
                            <button class="action-button action-button--primary" type="button" data-action="confirm-room-select">
                                Xac nhan
                            </button>
                        </div>
                        
                        <div class="room-discovery__divider">
                            <span>hoac</span>
                        </div>
                        
                        <div class="room-discovery__option">
                            <button class="action-button action-button--secondary room-discovery__random-btn" type="button" data-action="random-room">
                                Rut ngau nhien
                            </button>
                        </div>
                    </div>
                ` : ''}
                
                <button class="room-discovery__cancel" type="button" data-action="cancel-room-discovery">
                    Huy bo
                </button>
            </div>
        </div>
    `;
}

/**
 * Handle debug mode move - uses same logic as main game (map connections)
 * @param {HTMLElement} mountEl
 * @param {string} direction
 */
function handleDebugMove(mountEl, direction) {
    if (!currentGameState || currentGameState.gamePhase !== 'playing') return;

    // Use mySocketId which is set to current player's actual ID
    const playerId = mySocketId;
    const currentTurnPlayer = currentGameState.turnOrder[currentGameState.currentTurnIndex];
    
    // Only allow move if it's this player's turn
    if (playerId !== currentTurnPlayer) {
        console.log(`Not ${playerId}'s turn, current turn: ${currentTurnPlayer}`);
        return;
    }
    
    const moves = currentGameState.playerMoves[playerId] || 0;
    if (moves <= 0) {
        console.log(`No moves left for ${playerId}`);
        return;
    }
    
    // Get current position and map data
    const currentRoomId = currentGameState.playerState.playerPositions[playerId];
    const mapConnections = currentGameState.map?.connections || {};
    const revealedRooms = currentGameState.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    
    // Convert UI direction to door direction
    const doorDirection = mapDirectionToDoor(direction);
    
    // Check if there's a connection in that direction
    const roomConnections = mapConnections[currentRoomId] || {};
    const targetRoomId = roomConnections[doorDirection];
    
    if (!targetRoomId) {
        // No connection - check if current room has a door in that direction
        if (currentRoom && currentRoom.doors.includes(doorDirection)) {
            // Check if this door is blocked (e.g., front door of Entrance Hall)
            if (isDoorBlocked(currentRoom.name, doorDirection)) {
                console.log(`Door to ${doorDirection} from ${currentRoom.name} is blocked`);
                return;
            }
            
            // There's a door but no room connected - show room discovery modal
            const currentFloor = currentRoom.floor;
            const requiredDoorSide = doorDirToSide(getOppositeDoor(doorDirection));
            
            roomDiscoveryModal = {
                isOpen: true,
                direction: doorDirection,
                floor: currentFloor,
                doorSide: requiredDoorSide
            };
            
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }
        
        // No door in that direction - don't move
        console.log(`No door to ${doorDirection} from ${currentRoomId}`);
        return;
    }
    
    // Move to target room
    currentGameState.playerState.playerPositions[playerId] = targetRoomId;
    
    // Decrease moves
    currentGameState.playerMoves[playerId] = moves - 1;
    
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
        
        // Auto switch to next player and update mySocketId
        const nextIdx = currentGameState.players.findIndex(p => p.id === nextPlayerId);
        if (nextIdx !== -1) {
            debugCurrentPlayerIndex = nextIdx;
            mySocketId = nextPlayerId;
        }
    }
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Handle debug mode use stairs - move between floors
 * @param {HTMLElement} mountEl
 * @param {string} targetRoomId
 */
function handleDebugUseStairs(mountEl, targetRoomId) {
    if (!currentGameState || currentGameState.gamePhase !== 'playing') return;

    const playerId = mySocketId;
    const currentTurnPlayer = currentGameState.turnOrder[currentGameState.currentTurnIndex];
    
    // Only allow if it's this player's turn
    if (playerId !== currentTurnPlayer) {
        console.log(`Not ${playerId}'s turn`);
        return;
    }
    
    const moves = currentGameState.playerMoves[playerId] || 0;
    if (moves <= 0) {
        console.log(`No moves left for ${playerId}`);
        return;
    }
    
    // Verify target room exists
    const revealedRooms = currentGameState.map?.revealedRooms || {};
    if (!revealedRooms[targetRoomId]) {
        console.log(`Target room ${targetRoomId} not found`);
        return;
    }
    
    // Move to target room (stairs)
    currentGameState.playerState.playerPositions[playerId] = targetRoomId;
    
    // Decrease moves (using stairs costs 1 move)
    currentGameState.playerMoves[playerId] = moves - 1;
    
    // Check if turn ended
    if (currentGameState.playerMoves[playerId] <= 0) {
        currentGameState.currentTurnIndex = (currentGameState.currentTurnIndex + 1) % currentGameState.turnOrder.length;
        
        const nextPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
        const nextPlayer = currentGameState.players.find(p => p.id === nextPlayerId);
        if (nextPlayer) {
            const speed = getCharacterSpeed(nextPlayer.characterId);
            currentGameState.playerMoves[nextPlayerId] = speed;
        }
        
        const nextIdx = currentGameState.players.findIndex(p => p.id === nextPlayerId);
        if (nextIdx !== -1) {
            debugCurrentPlayerIndex = nextIdx;
            mySocketId = nextPlayerId;
        }
    }
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Generate unique room ID from room name
 * @param {string} roomName - Room name in English
 * @returns {string}
 */
function generateRoomId(roomName) {
    return roomName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Calculate new room position based on direction from current room
 * @param {Object} currentRoom - Current room object
 * @param {string} direction - Door direction (north/south/east/west)
 * @returns {{ x: number; y: number }}
 */
function calculateNewRoomPosition(currentRoom, direction) {
    const offsets = {
        'north': { x: 0, y: 1 },
        'south': { x: 0, y: -1 },
        'east': { x: 1, y: 0 },
        'west': { x: -1, y: 0 }
    };
    const offset = offsets[direction] || { x: 0, y: 0 };
    return {
        x: currentRoom.x + offset.x,
        y: currentRoom.y + offset.y
    };
}

/**
 * Handle room discovery - add new room to map and move player
 * @param {HTMLElement} mountEl
 * @param {string} roomNameEn - English name of the room to add
 */
function handleRoomDiscovery(mountEl, roomNameEn) {
    if (!currentGameState || !roomDiscoveryModal) return;
    
    const playerId = mySocketId;
    const currentRoomId = currentGameState.playerState.playerPositions[playerId];
    const revealedRooms = currentGameState.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    
    if (!currentRoom) return;
    
    // Find room definition
    const roomDef = ROOMS.find(r => r.name.en === roomNameEn);
    if (!roomDef) {
        console.log(`Room definition not found: ${roomNameEn}`);
        return;
    }
    
    // Generate new room ID and position
    const newRoomId = generateRoomId(roomNameEn);
    const newPosition = calculateNewRoomPosition(currentRoom, roomDiscoveryModal.direction);
    
    // Extract doors from room definition
    const newRoomDoors = roomDef.doors
        .filter(d => d.kind === 'door')
        .map(d => convertDoorSide(d.side));
    
    // Create new room object
    const newRoom = {
        id: newRoomId,
        name: roomDef.name.en,
        x: newPosition.x,
        y: newPosition.y,
        doors: newRoomDoors,
        floor: currentRoom.floor
    };
    
    // Add room to revealed rooms
    currentGameState.map.revealedRooms[newRoomId] = newRoom;
    
    // Add connections (bidirectional)
    const direction = roomDiscoveryModal.direction;
    const oppositeDir = getOppositeDoor(direction);
    
    if (!currentGameState.map.connections[currentRoomId]) {
        currentGameState.map.connections[currentRoomId] = {};
    }
    currentGameState.map.connections[currentRoomId][direction] = newRoomId;
    
    if (!currentGameState.map.connections[newRoomId]) {
        currentGameState.map.connections[newRoomId] = {};
    }
    currentGameState.map.connections[newRoomId][oppositeDir] = currentRoomId;
    
    // Move player to new room
    currentGameState.playerState.playerPositions[playerId] = newRoomId;
    
    // Discovering a room costs 1 move (same as normal movement)
    const moves = currentGameState.playerMoves[playerId] || 0;
    currentGameState.playerMoves[playerId] = moves - 1;
    
    // Check if turn ended (no more moves)
    if (currentGameState.playerMoves[playerId] <= 0) {
        // Move to next player
        currentGameState.currentTurnIndex = (currentGameState.currentTurnIndex + 1) % currentGameState.turnOrder.length;
        
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
            mySocketId = nextPlayerId;
        }
    }
    
    // Close modal
    roomDiscoveryModal = null;
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Handle random room selection
 * @param {HTMLElement} mountEl
 */
function handleRandomRoomDiscovery(mountEl) {
    if (!currentGameState || !roomDiscoveryModal) return;
    
    const revealedRooms = currentGameState.map?.revealedRooms || {};
    const availableRooms = getAvailableRoomsForFloor(roomDiscoveryModal.floor, revealedRooms);
    const validRooms = filterRoomsWithConnectingDoor(availableRooms, roomDiscoveryModal.doorSide);
    
    if (validRooms.length === 0) {
        console.log('No valid rooms available');
        return;
    }
    
    // Pick random room
    const randomIndex = Math.floor(Math.random() * validRooms.length);
    const selectedRoom = validRooms[randomIndex];
    
    handleRoomDiscovery(mountEl, selectedRoom.name.en);
}

/**
 * Cancel room discovery modal
 * @param {HTMLElement} mountEl
 */
function cancelRoomDiscovery(mountEl) {
    roomDiscoveryModal = null;
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Render game view
 * @param {{ mountEl: HTMLElement; onNavigate: (hash: string) => void; roomId: string | null; debugMode?: boolean }} options
 */
export function renderGameView({ mountEl, onNavigate, roomId, debugMode = false }) {
    // Set debug mode flag
    isDebugMode = debugMode;
    debugCurrentPlayerIndex = 0;
    
    // Reset state for fresh game
    sidebarOpen = false;
    introShown = false;
    movesInitializedForTurn = -1;
    expandedPlayers.clear();
    activePlayers.clear();
    
    if (debugMode) {
        // Initialize debug game state
        currentGameState = createDebugGameState();
        
        // Set mySocketId to first player (will control all players in debug mode)
        debugCurrentPlayerIndex = 0;
        mySocketId = currentGameState.players[0]?.id || 'debug-player-0';
        
        // Show intro same as main game (will auto-hide after 5s or on click)
        introShown = false;
        
        // Initial render
        mountEl.innerHTML = renderGameScreen(currentGameState, mySocketId);
        
        // Auto-hide intro after 5 seconds (same as main game behavior)
        introTimeout = setTimeout(() => {
            hideIntro(mountEl);
        }, 5000);
        
        // Attach debug event listeners
        attachDebugEventListeners(mountEl);
        
        // Cleanup on navigate away
        window.addEventListener('hashchange', () => {
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
        turnOrderExpanded = false;
        movesInitializedForTurn = -1;
        expandedPlayers.clear();
        activePlayers.clear();
    }, { once: true });
}
