// Game View - Dice rolling phase and main gameplay
import { CHARACTER_BY_ID, CHARACTERS } from '../data/charactersData.js';
import * as socketClient from '../services/socketClient.js';
import { renderGameMap, buildPlayerNamesMap, buildPlayerColorsMap } from '../components/GameMap.js';
import { ROOMS } from '../data/mapsData.js';
import { ITEMS, EVENTS, OMENS } from '../data/cardsData.js';
import { calculateVaultLayout, calculatePlayerSpawnPosition } from '../utils/vaultLayout.js';

// Room discovery modal state
/** @type {{ isOpen: boolean; direction: string; floor: string; doorSide: string; selectedRoom: string | null; currentRotation: number; selectedFloor: string | null; needsFloorSelection: boolean } | null} */
let roomDiscoveryModal = null;

// Token drawing modal state
/** @type {{ isOpen: boolean; tokensToDrawn: Array<{type: 'omen'|'event'|'item'; drawn: boolean; selectedCard: string | null}>; currentIndex: number } | null} */
let tokenDrawingModal = null;

// Cards view modal state
/** @type {{ isOpen: boolean; cardType: 'omen'|'event'|'item'; cardIds: string[]; expandedCards: Set<string> } | null} */
let cardsViewModal = null;

// Stat adjustment modal state
/** @type {{ isOpen: boolean; stat: 'speed'|'might'|'sanity'|'knowledge'; playerId: string; tempIndex: number; originalIndex: number } | null} */
let statAdjustModal = null;

// Dice results display state
let showingDiceResults = false;
let diceResultsTimeout = null;

/** @type {any} */
let currentGameState = null;
let mySocketId = null;
let unsubscribeGameState = null;
let sidebarOpen = false;
let introShown = false;
let introTimeout = null;
let turnOrderExpanded = false; // Turn order collapsed by default
let skipMapCentering = false; // Flag to skip map centering on next updateGameUI
let tutorialOpen = false; // Tutorial modal state
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
 * Extract doors array from room definition (only regular doors, not stairs)
 * @param {import('../data/mapsData.js').RoomDef} roomDef
 * @returns {('north'|'south'|'east'|'west')[]}
 */
function extractDoors(roomDef) {
    return roomDef.doors
        .filter(d => d.kind === 'door') // Only regular doors, not stairs
        .map(d => convertDoorSide(d.side));
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
    const basementLandingDef = getRoomByName('Basement Landing');

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
            },
            'basement-landing': {
                id: 'basement-landing',
                name: 'Basement Landing',
                x: 0,
                y: 0, // separate coordinate for basement floor
                doors: basementLandingDef ? extractDoors(basementLandingDef) : ['north', 'south', 'west', 'east'],
                floor: 'basement'
            }
        },
        connections: {
            'entrance-hall': { north: 'foyer' },
            'foyer': { south: 'entrance-hall', north: 'grand-staircase' },
            'grand-staircase': { south: 'foyer' },
            'upper-landing': {},
            'basement-landing': {}
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
    // Check for backup state from tutorial return
    const backupState = sessionStorage.getItem('debugGameStateBackup');
    if (backupState) {
        try {
            const restored = JSON.parse(backupState);
            sessionStorage.removeItem('debugGameStateBackup');
            console.log('[Debug] Restored game state from tutorial backup');
            return restored;
        } catch (e) {
            console.error('Failed to restore debug game state:', e);
            sessionStorage.removeItem('debugGameStateBackup');
        }
    }

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
 * Get character's current Speed value
 * Uses current speed index from characterData if available, otherwise falls back to startIndex
 * @param {string} characterId
 * @param {Object} [characterData] - Player's character data with current stats indices
 * @returns {number}
 */
function getCharacterSpeed(characterId, characterData = null) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 4; // default
    const speedTrait = char.traits.speed;
    // Use current speed index from characterData if available
    const speedIndex = characterData?.stats?.speed ?? speedTrait.startIndex;
    return speedTrait.track[speedIndex];
}

/**
 * Check if a room is Vault and apply spawn position to player state
 * When player enters Vault room, calculate and store spawn position in near-door zone
 * @param {string} playerId - Player ID
 * @param {Object} targetRoom - Target room object
 * @param {Object} gameState - Current game state
 */
function applyVaultSpawnPosition(playerId, targetRoom, gameState) {
    if (!targetRoom || !gameState) return;
    
    // Check if target room is Vault
    const isVault = targetRoom.name === 'Vault' || targetRoom.id === 'vault';
    if (!isVault) return;
    
    // Initialize playerSpawnPositions if not exists
    if (!gameState.playerState.playerSpawnPositions) {
        gameState.playerState.playerSpawnPositions = {};
    }
    
    // Calculate Vault layout
    const rotation = targetRoom.rotation || 0;
    const vaultLayout = targetRoom.vaultLayout || calculateVaultLayout(rotation);
    
    // Calculate spawn position (using default room bounds)
    // Room bounds are relative to room tile (100x100 for standard room)
    const roomBounds = { width: 100, height: 100 };
    const spawnPosition = calculatePlayerSpawnPosition(vaultLayout, roomBounds);
    
    // Store spawn position in player state
    gameState.playerState.playerSpawnPositions[playerId] = {
        roomId: targetRoom.id,
        zone: vaultLayout.nearDoorZone,
        position: spawnPosition
    };
    
    console.log(`[Vault] Player ${playerId} spawn position set to ${vaultLayout.nearDoorZone}`, spawnPosition);
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
 * Get character color
 * @param {string} characterId
 * @returns {string}
 */
function getCharacterColor(characterId) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 'white';
    return char.color || 'white';
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
 * Render dice results screen (after all players rolled)
 */
function renderDiceResults(gameState, myId) {
    const players = gameState.players || [];
    const diceRolls = gameState.diceRolls || {};
    const turnOrder = gameState.turnOrder || [];
    
    // Sort players by turn order (highest roll first)
    const sortedPlayers = turnOrder.map(playerId => {
        const player = players.find(p => p.id === playerId);
        return player ? { ...player, roll: diceRolls[playerId] } : null;
    }).filter(p => p !== null);
    
    const playersHtml = sortedPlayers.map((player, index) => {
        const charName = getCharacterName(player.characterId);
        const isMe = player.id === myId;
        const orderLabel = index === 0 ? 'Di truoc' : `Thu tu ${index + 1}`;
        
        return `
            <div class="dice-result-player ${isMe ? 'is-me' : ''} ${index === 0 ? 'is-first' : ''}">
                <span class="dice-result-player__name">${charName}${isMe ? ' (You)' : ''}</span>
                <span class="dice-result-player__roll">${player.roll}</span>
                <span class="dice-result-player__order">${orderLabel}</span>
            </div>
        `;
    }).join('');
    
    return `
        <div class="dice-overlay">
            <div class="dice-modal dice-modal--results">
                <h2 class="dice-title">Ket qua Tung Xi Ngau</h2>
                <p class="dice-subtitle">Nguoi co diem cao nhat se di truoc</p>
                <div class="dice-results-list">
                    ${playersHtml}
                </div>
                <p class="dice-results-countdown">Bat dau trong 5 giay...</p>
            </div>
        </div>
    `;
}

/**
 * Render dice roll overlay
 */
function renderDiceRollOverlay(gameState, myId) {
    if (!gameState) return '';
    
    // Show results screen if all players rolled
    if (showingDiceResults) {
        return renderDiceResults(gameState, myId);
    }
    
    // Only show rolling UI if in rolling phase
    if (gameState.gamePhase !== 'rolling') return '';

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
function renderSidebarToggle(gameState, myId) {
    // Get current player's character color
    let colorClass = '';
    if (gameState && myId) {
        const me = gameState.players?.find(p => p.id === myId);
        if (me?.characterId) {
            const color = getCharacterColor(me.characterId);
            colorClass = `sidebar-toggle--${color}`;
        }
    }

    return `
        <button class="sidebar-toggle ${colorClass}"
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
            <div class="sidebar-trait sidebar-trait--speed" data-action="adjust-stat" data-stat="speed">
                <span class="sidebar-trait__label">Speed</span>
                <span class="sidebar-trait__value">${statValues.speed}</span>
            </div>
            <div class="sidebar-trait sidebar-trait--might" data-action="adjust-stat" data-stat="might">
                <span class="sidebar-trait__label">Might</span>
                <span class="sidebar-trait__value">${statValues.might}</span>
            </div>
            <div class="sidebar-trait sidebar-trait--sanity" data-action="adjust-stat" data-stat="sanity">
                <span class="sidebar-trait__label">Sanity</span>
                <span class="sidebar-trait__value">${statValues.sanity}</span>
            </div>
            <div class="sidebar-trait sidebar-trait--knowledge" data-action="adjust-stat" data-stat="knowledge">
                <span class="sidebar-trait__label">Knowledge</span>
                <span class="sidebar-trait__value">${statValues.knowledge}</span>
            </div>
        </div>
    `;
}

/**
 * Render stat adjustment modal
 * @returns {string} HTML string
 */
function renderStatAdjustModal() {
    if (!statAdjustModal?.isOpen || !currentGameState) return '';
    
    const { stat, playerId, tempIndex, originalIndex } = statAdjustModal;
    const characterData = currentGameState.playerState?.characterData?.[playerId] || currentGameState.characterData?.[playerId];
    if (!characterData) return '';
    
    const char = CHARACTER_BY_ID[characterData.characterId];
    if (!char) return '';
    
    const traitData = char.traits[stat];
    const currentIndex = tempIndex;
    const currentValue = traitData.track[currentIndex];
    const minIndex = 0;
    const maxIndex = traitData.track.length - 1;
    const hasChanged = tempIndex !== originalIndex;
    
    const statLabels = {
        speed: 'Toc do (Speed)',
        might: 'Suc manh (Might)',
        sanity: 'Tam tri (Sanity)',
        knowledge: 'Kien thuc (Knowledge)'
    };
    
    // Render track with current position highlighted
    const trackHtml = traitData.track.map((val, idx) => {
        const isStart = idx === traitData.startIndex;
        const isCurrent = idx === currentIndex;
        const isOriginal = idx === originalIndex && hasChanged;
        let classes = 'stat-adjust__track-value';
        if (isStart) classes += ' stat-adjust__track-value--start';
        if (isCurrent) classes += ' stat-adjust__track-value--current';
        if (isOriginal) classes += ' stat-adjust__track-value--original';
        return `<span class="${classes}">${val}</span>`;
    }).join('');
    
    return `
        <div class="stat-adjust-overlay" data-action="close-stat-adjust">
            <div class="stat-adjust-modal stat-adjust-modal--${stat}" data-modal-content="true">
                <header class="stat-adjust-modal__header">
                    <h3 class="stat-adjust-modal__title">${statLabels[stat]}</h3>
                    <button class="stat-adjust-modal__close" type="button" data-action="close-stat-adjust">x</button>
                </header>
                <div class="stat-adjust-modal__body">
                    <div class="stat-adjust__track">${trackHtml}</div>
                    <div class="stat-adjust__controls">
                        <button class="stat-adjust__btn stat-adjust__btn--minus" 
                                type="button" 
                                data-action="stat-decrease"
                                ${currentIndex <= minIndex ? 'disabled' : ''}>
                            -
                        </button>
                        <span class="stat-adjust__current-value">${currentValue}</span>
                        <button class="stat-adjust__btn stat-adjust__btn--plus" 
                                type="button" 
                                data-action="stat-increase"
                                ${currentIndex >= maxIndex ? 'disabled' : ''}>
                            +
                        </button>
                    </div>
                    <p class="stat-adjust__hint">Index: ${currentIndex} / ${maxIndex}</p>
                    <button class="stat-adjust__confirm action-button action-button--primary" 
                            type="button" 
                            data-action="stat-confirm"
                            ${!hasChanged ? 'disabled' : ''}>
                        Xac nhan
                    </button>
                </div>
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

    // Get actual cards from game state
    const playerCards = gameState.playerState?.playerCards?.[myId] || { omens: [], events: [], items: [] };
    const omenCards = playerCards.omens || [];
    const eventCards = playerCards.events || [];
    const itemCards = playerCards.items || [];

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
                    <div class="sidebar-card sidebar-card--omen" data-action="view-cards" data-card-type="omen">
                        <span class="sidebar-card__count">${omenCards.length}</span>
                        <span class="sidebar-card__label">Omen</span>
                    </div>
                    <div class="sidebar-card sidebar-card--event" data-action="view-cards" data-card-type="event">
                        <span class="sidebar-card__count">${eventCards.length}</span>
                        <span class="sidebar-card__label">Event</span>
                    </div>
                    <div class="sidebar-card sidebar-card--item" data-action="view-cards" data-card-type="item">
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
 * @returns {{ canGoUp: boolean; canGoDown: boolean; targetRoom: string | null; isMysticElevator: boolean; availableFloors: string[] }}
 */
function getStairsAvailability(gameState, myId) {
    const playerPositions = gameState?.playerState?.playerPositions || {};
    const currentRoomId = playerPositions[myId];
    const revealedRooms = gameState?.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    const staircaseConnections = gameState?.map?.staircaseConnections || {};

    const defaultResult = { canGoUp: false, canGoDown: false, targetRoom: null, isMysticElevator: false, availableFloors: [] };

    if (!currentRoom) return defaultResult;
    
    // Special case: Mystic Elevator - can go to any floor
    if (currentRoom.name === 'Mystic Elevator') {
        const currentFloor = currentRoom.floor;
        const availableFloors = ['upper', 'ground', 'basement'].filter(f => f !== currentFloor);
        return {
            canGoUp: currentFloor !== 'upper',
            canGoDown: currentFloor !== 'basement',
            targetRoom: null, // Will be determined by floor selection
            isMysticElevator: true,
            availableFloors
        };
    }
    
    // Special case: Stairs From Basement - goes UP to Foyer
    if (currentRoom.name === 'Stairs From Basement') {
        // Find Foyer room
        let foyerRoomId = null;
        for (const [roomId, room] of Object.entries(revealedRooms)) {
            if (room.name === 'Foyer') {
                foyerRoomId = roomId;
                break;
            }
        }
        if (foyerRoomId) {
            return {
                canGoUp: true,
                canGoDown: false,
                targetRoom: foyerRoomId,
                isMysticElevator: false,
                availableFloors: []
            };
        }
    }
    
    // Special case: Foyer - can go DOWN to Stairs From Basement (if revealed)
    if (currentRoom.name === 'Foyer') {
        // Find Stairs From Basement room
        let stairsFromBasementId = null;
        for (const [roomId, room] of Object.entries(revealedRooms)) {
            if (room.name === 'Stairs From Basement') {
                stairsFromBasementId = roomId;
                break;
            }
        }
        
        // Check if Grand Staircase connection exists (for UP)
        const grandStaircaseTarget = staircaseConnections[currentRoomId];
        const canGoUpToGrandStaircase = !!grandStaircaseTarget;
        
        if (stairsFromBasementId) {
            return {
                canGoUp: canGoUpToGrandStaircase,
                canGoDown: true,
                targetRoom: stairsFromBasementId, // DOWN goes to Stairs From Basement
                targetRoomUp: grandStaircaseTarget, // UP goes to Grand Staircase target
                isMysticElevator: false,
                availableFloors: []
            };
        }
    }

    if (!staircaseConnections[currentRoomId]) {
        return defaultResult;
    }

    const targetRoomId = staircaseConnections[currentRoomId];
    const targetRoom = revealedRooms[targetRoomId];

    if (!targetRoom) {
        return defaultResult;
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
        targetRoom: targetRoomId,
        isMysticElevator: false,
        availableFloors: []
    };
}

/**
 * Get available movement directions from current room
 * @param {Object} gameState
 * @param {string} myId
 * @returns {{ north: boolean; south: boolean; east: boolean; west: boolean }}
 */
function getAvailableDirections(gameState, myId) {
    const result = { north: false, south: false, east: false, west: false };
    
    const playerPositions = gameState?.playerState?.playerPositions || {};
    const currentRoomId = playerPositions[myId];
    const revealedRooms = gameState?.map?.revealedRooms || {};
    const connections = gameState?.map?.connections || {};
    const elevatorShafts = gameState?.map?.elevatorShafts || {};
    const currentRoom = revealedRooms[currentRoomId];
    
    if (!currentRoom) return result;
    
    // Check each door direction
    const doors = currentRoom.doors || [];
    const roomConnections = connections[currentRoomId] || {};
    
    // Direction offsets
    const dirOffsets = {
        north: { x: 0, y: 1 },
        south: { x: 0, y: -1 },
        east: { x: 1, y: 0 },
        west: { x: -1, y: 0 }
    };
    
    for (const dir of doors) {
        // Check if door is blocked (e.g., front door of Entrance Hall)
        if (isDoorBlocked(currentRoom.name, dir)) {
            continue;
        }
        
        // Check if direction leads to an elevator shaft on this floor
        const shaftId = elevatorShafts[currentRoom.floor];
        if (shaftId) {
            const shaft = revealedRooms[shaftId];
            if (shaft) {
                const offset = dirOffsets[dir];
                const targetX = currentRoom.x + offset.x;
                const targetY = currentRoom.y + offset.y;
                // If target position matches shaft position, block movement
                if (shaft.x === targetX && shaft.y === targetY) {
                    continue; // Can't enter elevator shaft without elevator
                }
            }
        }
        
        // Check if target room is an elevator shaft (via connection)
        const targetRoomId = roomConnections[dir];
        if (targetRoomId) {
            const targetRoom = revealedRooms[targetRoomId];
            if (targetRoom && targetRoom.isElevatorShaft && !targetRoom.elevatorPresent) {
                continue;
            }
        }
        
        result[dir] = true;
    }
    
    return result;
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
    const showUpBtn = stairs.canGoUp && canMove && !stairs.isMysticElevator;
    const showDownBtn = stairs.canGoDown && canMove && !stairs.isMysticElevator;
    const showElevator = stairs.isMysticElevator && canMove;

    // Get available directions based on doors
    const availableDirs = getAvailableDirections(gameState, myId);
    const canMoveUp = canMove && availableDirs.north;
    const canMoveDown = canMove && availableDirs.south;
    const canMoveLeft = canMove && availableDirs.west;
    const canMoveRight = canMove && availableDirs.east;
    
    // Elevator floor buttons - sorted: upper on top, ground middle, basement bottom
    const floorNames = { upper: 'Tang tren', ground: 'Tang tret', basement: 'Tang ham' };
    const floorOrder = ['upper', 'ground', 'basement'];
    const sortedFloors = showElevator ? floorOrder.filter(f => stairs.availableFloors.includes(f)) : [];
    const elevatorButtons = sortedFloors.map(floor => {
        return `<button class="stairs-btn stairs-btn--elevator stairs-btn--floor-${floor}" type="button" data-action="use-elevator" data-floor="${floor}" title="${floorNames[floor]}">
            <span class="stairs-btn__label">${floorNames[floor]}</span>
        </button>`;
    }).join('');

    return `
        <div class="game-controls">
            <div class="movement-controls">
                <button class="move-btn move-btn--up" type="button" data-action="move" data-direction="up" ${!canMoveUp ? 'disabled' : ''}>
                    ▲
                </button>
                <div class="move-btn-row">
                    <button class="move-btn move-btn--left" type="button" data-action="move" data-direction="left" ${!canMoveLeft ? 'disabled' : ''}>
                        ◀
                    </button>
                    <div class="move-center">
                        <span class="moves-remaining">${movesLeft}</span>
                    </div>
                    <button class="move-btn move-btn--right" type="button" data-action="move" data-direction="right" ${!canMoveRight ? 'disabled' : ''}>
                        ▶
                    </button>
                </div>
                <button class="move-btn move-btn--down" type="button" data-action="move" data-direction="down" ${!canMoveDown ? 'disabled' : ''}>
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
                    <button class="stairs-btn stairs-btn--up" type="button" data-action="use-stairs" data-target="${stairs.targetRoomUp || stairs.targetRoom}" title="Leo len tang tren">
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
                ${showElevator ? `
                    <div class="elevator-controls">
                        <span class="elevator-label">Thang may:</span>
                        ${elevatorButtons}
                    </div>
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
 * Render tutorial modal overlay (in-game tutorial)
 */
function renderTutorialModal() {
    if (!tutorialOpen) return '';

    return `
        <div class="tutorial-modal-overlay">
            <div class="tutorial-modal-overlay__backdrop" data-action="close-tutorial"></div>
            <div class="tutorial-modal-overlay__content">
                <header class="tutorial-modal-overlay__header">
                    <h2>Huong Dan Choi</h2>
                    <button class="tutorial-modal-overlay__close" type="button" data-action="close-tutorial">×</button>
                </header>
                <div class="tutorial-modal-overlay__body">
                    <div class="tutorial-books">
                        <button class="tutorial-book-btn" data-tutorial-book="rules">
                            <span class="tutorial-book-btn__title">RULESBOOK</span>
                            <span class="tutorial-book-btn__desc">Luat choi co ban</span>
                        </button>
                        <button class="tutorial-book-btn" data-tutorial-book="traitors">
                            <span class="tutorial-book-btn__title">TRAITORS TOME</span>
                            <span class="tutorial-book-btn__desc">Bang tra cuu ke phan boi</span>
                        </button>
                        <button class="tutorial-book-btn" data-tutorial-book="survival">
                            <span class="tutorial-book-btn__title">SURVIVAL</span>
                            <span class="tutorial-book-btn__desc">Huong dan song sot</span>
                        </button>
                    </div>
                    <p class="tutorial-modal-overlay__note">Chon sach de xem chi tiet. Cac sach se mo trong tab moi.</p>
                </div>
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
        const playerEntryDirections = playerState.playerEntryDirections || {};
        const players = gameState.players || [];
        const playerNames = buildPlayerNamesMap(players, getCharacterName);
        const playerColors = buildPlayerColorsMap(players, getCharacterColor);
        const myPosition = playerPositions[myId];
        const revealedRooms = mapState?.revealedRooms || {};
        const currentRoom = myPosition ? revealedRooms[myPosition] : null;

        // Get active player ID from turn order
        const activePlayerId = gameState.turnOrder?.[gameState.currentTurnIndex] || null;
        
        // Room discovery modal
        let roomDiscoveryHtml = '';
        let roomPreview = null;
        
        if (roomDiscoveryModal?.isOpen) {
            if (roomDiscoveryModal.selectedRoom) {
                // Create room preview data for map
                const selectedRoomDef = ROOMS.find(r => r.name.en === roomDiscoveryModal.selectedRoom);
                if (selectedRoomDef && currentRoom) {
                    const currentRotation = roomDiscoveryModal.currentRotation || 0;
                    const originalDoors = selectedRoomDef.doors
                        .filter(d => d.kind === 'door')
                        .map(d => convertDoorSide(d.side));
                    const rotatedDoors = rotateRoomDoors(originalDoors, currentRotation);
                    const isValid = isRotationValid(selectedRoomDef, currentRotation, roomDiscoveryModal.doorSide);
                    
                    // Calculate preview position (next to current room)
                    const direction = roomDiscoveryModal.direction;
                    const offsets = {
                        'north': { x: 0, y: 1 },
                        'south': { x: 0, y: -1 },
                        'east': { x: 1, y: 0 },
                        'west': { x: -1, y: 0 }
                    };
                    const offset = offsets[direction] || { x: 0, y: 0 };
                    
                    roomPreview = {
                        name: selectedRoomDef.name.vi || selectedRoomDef.name.en,
                        doors: rotatedDoors,
                        rotation: currentRotation,
                        x: currentRoom.x + offset.x,
                        y: currentRoom.y + offset.y,
                        isValid
                    };
                }
            }
            
            roomDiscoveryHtml = renderRoomDiscoveryModal(
                roomDiscoveryModal.floor,
                roomDiscoveryModal.doorSide,
                revealedRooms
            );
        }
        
        content = `
            ${renderGameIntro()}
            ${renderSidebarToggle(gameState, myId)}
            <div class="game-layout">
                ${renderSidebar(gameState, myId)}
                <div class="game-main">
                    ${renderTurnOrder(gameState, myId)}
                    <div class="game-area">
                        ${renderGameMap(mapState, playerPositions, playerNames, playerColors, myId, myPosition, roomPreview, playerEntryDirections, activePlayerId)}
                    </div>
                </div>
            </div>
            ${renderGameControls(gameState, myId)}
            ${roomDiscoveryHtml}
            ${renderTokenDrawingModal()}
            ${renderCardsViewModal()}
            ${renderStatAdjustModal()}
            ${renderTutorialModal()}
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
            <button class="tutorial-fab" type="button" data-action="open-tutorial" title="Huong dan choi">
                <svg class="tutorial-fab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="8" y1="7" x2="16" y2="7" stroke="currentColor" stroke-width="1.5"/>
                    <line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="1.5"/>
                </svg>
            </button>
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

        // Click outside sidebar to close it
        if (sidebarOpen) {
            const sidebar = mountEl.querySelector('.game-sidebar');
            const toggleBtn = mountEl.querySelector('.sidebar-toggle');
            const cardsViewModal = mountEl.querySelector('.cards-view-overlay');
            const statAdjustOverlay = mountEl.querySelector('.stat-adjust-overlay');
            const isClickInsideSidebar = sidebar?.contains(target);
            const isClickOnToggle = toggleBtn?.contains(target);
            const isClickInsideCardsView = cardsViewModal?.contains(target);
            const isClickInsideStatAdjust = statAdjustOverlay?.contains(target);
            
            if (!isClickInsideSidebar && !isClickOnToggle && !isClickInsideCardsView && !isClickInsideStatAdjust) {
                closeSidebar(mountEl);
            }
        }

        // Click outside turn order to collapse it
        if (turnOrderExpanded) {
            const turnOrder = mountEl.querySelector('.turn-order');
            const isClickInsideTurnOrder = turnOrder?.contains(target);

            if (!isClickInsideTurnOrder) {
                turnOrderExpanded = false;
                skipMapCentering = true; // Don't jump to player when closing turn order
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
        }

        // Toggle turn order expand/collapse
        if (action === 'toggle-turn-order') {
            turnOrderExpanded = !turnOrderExpanded;
            skipMapCentering = true; // Don't jump to player when toggling turn order
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
                    skipMapCentering = true; // Don't jump to player when switching in turn order
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

        // Open tutorial - show modal overlay
        if (action === 'open-tutorial') {
            tutorialOpen = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Close tutorial modal
        if (action === 'close-tutorial') {
            tutorialOpen = false;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Tutorial book selection - open in new tab
        if (target.closest('[data-tutorial-book]')) {
            const bookBtn = target.closest('[data-tutorial-book]');
            const book = bookBtn?.dataset.tutorialBook;
            if (book) {
                let url = '';
                if (book === 'rules') {
                    url = window.location.origin + '/#/tutorial/rulesbook';
                } else if (book === 'traitors') {
                    url = window.location.origin + '/#/tutorial/traitors-tome';
                } else if (book === 'survival') {
                    url = window.location.origin + '/#/tutorial/survival';
                }
                if (url) {
                    window.open(url, '_blank');
                }
            }
            return;
        }

        // Toggle sidebar
        if (action === 'toggle-sidebar') {
            const toggleBtn = target.closest('.sidebar-toggle');
            if (toggleBtn?.hasAttribute('disabled')) return;
            toggleSidebar(mountEl);
            // Also center map on player with smooth scroll
            centerMapOnPlayer(mountEl, true);
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
        
        // Use Mystic Elevator (debug)
        if (action === 'use-elevator') {
            const targetFloor = actionEl?.dataset.floor;
            if (targetFloor) {
                handleDebugUseElevator(mountEl, targetFloor);
            }
            return;
        }

        // Room discovery actions
        // Step 1: Select room and go to rotation step (auto-place on current floor)
        if (action === 'select-room-next') {
            const hiddenInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#room-select-value'));
            const selectedRoom = hiddenInput?.value;
            if (selectedRoom && roomDiscoveryModal) {
                const roomDef = ROOMS.find(r => r.name.en === selectedRoom);
                
                // Find first valid rotation
                const initialRotation = roomDef 
                    ? findFirstValidRotation(roomDef, roomDiscoveryModal.doorSide)
                    : 0;
                
                roomDiscoveryModal.selectedRoom = selectedRoom;
                roomDiscoveryModal.currentRotation = initialRotation;
                updateGameUI(mountEl, currentGameState, mySocketId);
            } else {
                alert('Vui long chon mot phong');
            }
            return;
        }

        // Rotate room preview (click on room)
        if (action === 'rotate-room') {
            if (roomDiscoveryModal && roomDiscoveryModal.selectedRoom) {
                // Rotate 90 degrees each click
                roomDiscoveryModal.currentRotation = (roomDiscoveryModal.currentRotation + 90) % 360;
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
            return;
        }

        // Step 2: Confirm room placement with rotation
        if (action === 'confirm-room-placement') {
            if (roomDiscoveryModal?.selectedRoom) {
                const rotation = roomDiscoveryModal.currentRotation || 0;
                handleRoomDiscovery(mountEl, roomDiscoveryModal.selectedRoom, rotation);
            }
            return;
        }

        // Back to room selection
        if (action === 'back-to-room-select') {
            if (roomDiscoveryModal) {
                roomDiscoveryModal.selectedRoom = null;
                roomDiscoveryModal.currentRotation = 0;
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
            return;
        }

        // Select room from list (Step 1)
        if (target.closest('.room-discovery__item') && target.closest('#room-list')) {
            const item = /** @type {HTMLElement} */ (target.closest('.room-discovery__item'));
            const roomName = item.dataset.roomName;
            const searchInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#room-search-input'));
            const hiddenInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#room-select-value'));
            
            // Update UI
            if (searchInput) searchInput.value = item.textContent || '';
            if (hiddenInput) hiddenInput.value = roomName || '';
            
            // Mark as selected
            mountEl.querySelectorAll('#room-list .room-discovery__item').forEach(el => el.classList.remove('is-selected'));
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

        // Token drawing actions
        if (action === 'token-draw-random') {
            handleRandomCardDraw(mountEl);
            return;
        }

        if (action === 'token-draw-next') {
            handleTokenDrawNext(mountEl);
            return;
        }

        // Stat adjustment actions
        if (action === 'adjust-stat') {
            const stat = actionEl?.dataset.stat;
            if (stat && mySocketId && currentGameState) {
                const characterData = currentGameState.playerState?.characterData?.[mySocketId] || currentGameState.characterData?.[mySocketId];
                if (characterData) {
                    const currentIndex = characterData.stats[stat];
                    statAdjustModal = {
                        isOpen: true,
                        stat: stat,
                        playerId: mySocketId,
                        tempIndex: currentIndex,
                        originalIndex: currentIndex
                    };
                    updateGameUI(mountEl, currentGameState, mySocketId);
                }
            }
            return;
        }

        if (action === 'close-stat-adjust') {
            // Don't close if clicking inside modal content
            if (target.closest('[data-modal-content="true"]') && !target.closest('[data-action="close-stat-adjust"]')) {
                return;
            }
            statAdjustModal = null;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        if (action === 'stat-increase') {
            if (statAdjustModal && currentGameState) {
                const { stat, playerId } = statAdjustModal;
                const characterData = currentGameState.playerState?.characterData?.[playerId] || currentGameState.characterData?.[playerId];
                if (characterData) {
                    const char = CHARACTER_BY_ID[characterData.characterId];
                    const maxIndex = char.traits[stat].track.length - 1;
                    if (statAdjustModal.tempIndex < maxIndex) {
                        statAdjustModal.tempIndex++;
                        updateGameUI(mountEl, currentGameState, mySocketId);
                    }
                }
            }
            return;
        }

        if (action === 'stat-decrease') {
            if (statAdjustModal) {
                if (statAdjustModal.tempIndex > 0) {
                    statAdjustModal.tempIndex--;
                    updateGameUI(mountEl, currentGameState, mySocketId);
                }
            }
            return;
        }

        if (action === 'stat-confirm') {
            if (statAdjustModal && currentGameState) {
                const { stat, playerId, tempIndex } = statAdjustModal;
                const characterData = currentGameState.playerState?.characterData?.[playerId] || currentGameState.characterData?.[playerId];
                if (characterData) {
                    characterData.stats[stat] = tempIndex;
                    statAdjustModal = null;
                    updateGameUI(mountEl, currentGameState, mySocketId);
                }
            }
            return;
        }

        // Cards view actions
        if (action === 'view-cards') {
            const cardType = actionEl?.dataset.cardType;
            if (cardType) {
                openCardsViewModal(mountEl, cardType);
            }
            return;
        }

        if (action === 'close-cards-view') {
            closeCardsViewModal(mountEl);
            return;
        }

        if (action === 'toggle-card') {
            // Get the exact header element that was clicked
            const header = target.closest('.card-detail__header');
            const cardId = header?.dataset.cardId;
            if (cardId) {
                toggleCardExpansion(mountEl, cardId);
            }
            return;
        }

        // Select card from list
        if (target.closest('.token-card__item') && target.closest('#token-card-list')) {
            const item = /** @type {HTMLElement} */ (target.closest('.token-card__item'));
            const cardId = item.dataset.cardId;
            
            if (cardId) {
                handleCardSelect(mountEl, cardId);
            }
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
        
        // Token card search
        if (target.id === 'token-card-search-input') {
            const searchText = target.value.toLowerCase().trim();
            const items = mountEl.querySelectorAll('.token-card__item');
            
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

        // Click outside sidebar to close it
        if (sidebarOpen) {
            const sidebar = mountEl.querySelector('.game-sidebar');
            const toggleBtn = mountEl.querySelector('.sidebar-toggle');
            const cardsViewModal = mountEl.querySelector('.cards-view-overlay');
            const statAdjustOverlay = mountEl.querySelector('.stat-adjust-overlay');
            const isClickInsideSidebar = sidebar?.contains(target);
            const isClickOnToggle = toggleBtn?.contains(target);
            const isClickInsideCardsView = cardsViewModal?.contains(target);
            const isClickInsideStatAdjust = statAdjustOverlay?.contains(target);
            
            if (!isClickInsideSidebar && !isClickOnToggle && !isClickInsideCardsView && !isClickInsideStatAdjust) {
                closeSidebar(mountEl);
            }
        }

        // Click outside turn order to collapse it
        if (turnOrderExpanded) {
            const turnOrder = mountEl.querySelector('.turn-order');
            const isClickInsideTurnOrder = turnOrder?.contains(target);

            if (!isClickInsideTurnOrder) {
                turnOrderExpanded = false;
                skipMapCentering = true; // Don't jump to player when closing turn order
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
        }

        // Toggle turn order expand/collapse
        if (action === 'toggle-turn-order') {
            turnOrderExpanded = !turnOrderExpanded;
            skipMapCentering = true; // Don't jump to player when toggling turn order
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Skip intro
        if (action === 'skip-intro') {
            hideIntro(mountEl);
            return;
        }

        // Open tutorial - show modal overlay
        if (action === 'open-tutorial') {
            tutorialOpen = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Close tutorial modal
        if (action === 'close-tutorial') {
            tutorialOpen = false;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Tutorial book selection - open in new tab
        if (target.closest('[data-tutorial-book]')) {
            const bookBtn = target.closest('[data-tutorial-book]');
            const book = bookBtn?.dataset.tutorialBook;
            if (book) {
                let url = '';
                if (book === 'rules') {
                    url = window.location.origin + '/#/tutorial/rulesbook';
                } else if (book === 'traitors') {
                    url = window.location.origin + '/#/tutorial/traitors-tome';
                } else if (book === 'survival') {
                    url = window.location.origin + '/#/tutorial/survival';
                }
                if (url) {
                    window.open(url, '_blank');
                }
            }
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
            // Also center map on player with smooth scroll
            centerMapOnPlayer(mountEl, true);
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

        // Cards view actions (normal mode)
        if (action === 'view-cards') {
            const cardType = target.closest('[data-card-type]')?.dataset.cardType;
            if (cardType) {
                openCardsViewModal(mountEl, cardType);
            }
            return;
        }

        if (action === 'close-cards-view') {
            closeCardsViewModal(mountEl);
            return;
        }

        if (action === 'toggle-card') {
            const header = target.closest('.card-detail__header');
            const cardId = header?.dataset.cardId;
            if (cardId) {
                toggleCardExpansion(mountEl, cardId);
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

// Track if we've initialized moves for the current turn
let movesInitializedForTurn = -1;

/**
 * Center map on player's current position
 * @param {HTMLElement} mountEl
 * @param {boolean} smooth - Use smooth scrolling (default: false for instant)
 */
function centerMapOnPlayer(mountEl, smooth = false) {
    // Use double requestAnimationFrame to ensure DOM layout is fully complete
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const gameMap = mountEl.querySelector('.game-map');
            const grid = mountEl.querySelector('.game-map__grid');
            if (!gameMap || !grid) return;

            const playerCol = parseInt(gameMap.dataset.playerCol) || 0;
            const playerRow = parseInt(gameMap.dataset.playerRow) || 0;

            if (playerCol === 0 && playerRow === 0) return;

            // Cell size (90px) + gap (6px)
            const cellSize = 96;

            // Get computed padding from grid (which is calc(50vh - 45px) calc(50vw - 45px))
            const gridStyle = getComputedStyle(grid);
            const paddingLeft = parseFloat(gridStyle.paddingLeft) || 0;
            const paddingTop = parseFloat(gridStyle.paddingTop) || 0;

            // Player cell position within grid content area (0-indexed)
            const playerCellX = (playerCol - 1) * cellSize;
            const playerCellY = (playerRow - 1) * cellSize;

            // Absolute position in scrollable area (padding + cell position + half cell to center)
            const targetX = paddingLeft + playerCellX + (cellSize / 2);
            const targetY = paddingTop + playerCellY + (cellSize / 2);

            // Scroll to center the player in viewport
            const scrollX = targetX - (gameMap.clientWidth / 2);
            const scrollY = targetY - (gameMap.clientHeight / 2);

            gameMap.scrollTo({
                left: Math.max(0, scrollX),
                top: Math.max(0, scrollY),
                behavior: smooth ? 'smooth' : 'instant'
            });
        });
    });
}

/**
 * Center map on room preview position (for room discovery mode)
 * @param {HTMLElement} mountEl
 * @param {boolean} smooth - Use smooth scrolling (default: false for instant)
 */
function centerMapOnPreview(mountEl, smooth = false) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const gameMap = mountEl.querySelector('.game-map');
            const grid = mountEl.querySelector('.game-map__grid');
            if (!gameMap || !grid) return;

            const previewCol = parseInt(gameMap.dataset.previewCol) || 0;
            const previewRow = parseInt(gameMap.dataset.previewRow) || 0;

            if (previewCol === 0 && previewRow === 0) return;

            // Cell size (90px) + gap (6px)
            const cellSize = 96;

            // Get computed padding from grid
            const gridStyle = getComputedStyle(grid);
            const paddingLeft = parseFloat(gridStyle.paddingLeft) || 0;
            const paddingTop = parseFloat(gridStyle.paddingTop) || 0;

            // Preview cell position within grid content area (0-indexed)
            const previewCellX = (previewCol - 1) * cellSize;
            const previewCellY = (previewRow - 1) * cellSize;

            // Absolute position in scrollable area (padding + cell position + half cell to center)
            const targetX = paddingLeft + previewCellX + (cellSize / 2);
            const targetY = paddingTop + previewCellY + (cellSize / 2);

            // Scroll to center the preview in viewport
            const scrollX = targetX - (gameMap.clientWidth / 2);
            const scrollY = targetY - (gameMap.clientHeight / 2);

            gameMap.scrollTo({
                left: Math.max(0, scrollX),
                top: Math.max(0, scrollY),
                behavior: smooth ? 'smooth' : 'instant'
            });
        });
    });
}

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
                const charData = gameState.playerState?.characterData?.[myId] || gameState.characterData?.[myId];
                const speed = getCharacterSpeed(me.characterId, charData);
                await socketClient.setMoves(speed);
                return; // Will re-render after state update
            }
        }

        // Note: Intro is now controlled by checkAllPlayersActive, not by timeout
    }

    const html = renderGameScreen(gameState, myId);
    mountEl.innerHTML = html;

    // Skip centering if flag is set (e.g., when toggling turn order)
    if (skipMapCentering) {
        skipMapCentering = false;
        return;
    }

    // Center map based on current mode
    if (roomDiscoveryModal?.isOpen && roomDiscoveryModal?.selectedRoom) {
        // When room discovery modal is open with a selected room, focus on preview
        centerMapOnPreview(mountEl);
    } else {
        // Otherwise focus on player position
        centerMapOnPlayer(mountEl);
    }
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
        
        // Show dice results for 5 seconds before starting game
        showingDiceResults = true;
        updateGameUI(mountEl, currentGameState, mySocketId);
        
        // Clear any existing timeout
        if (diceResultsTimeout) {
            clearTimeout(diceResultsTimeout);
        }
        
        // After 5 seconds, transition to playing phase
        diceResultsTimeout = setTimeout(() => {
            showingDiceResults = false;
            currentGameState.gamePhase = 'playing';
            
            // Set initial moves for first player
            const firstPlayer = currentGameState.players.find(p => p.id === currentGameState.turnOrder[0]);
            if (firstPlayer) {
                const charData = currentGameState.playerState?.characterData?.[firstPlayer.id] || currentGameState.characterData?.[firstPlayer.id];
                const speed = getCharacterSpeed(firstPlayer.characterId, charData);
                currentGameState.playerMoves[firstPlayer.id] = speed;
            }
            
            // Auto switch to first player in turn order
            const firstIdx = currentGameState.players.findIndex(p => p.id === currentGameState.turnOrder[0]);
            if (firstIdx !== -1) {
                debugCurrentPlayerIndex = firstIdx;
                mySocketId = currentGameState.players[firstIdx].id;
            }
            
            updateGameUI(mountEl, currentGameState, mySocketId);
        }, 5000);
        
        return;
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
 * Get all possible orientations for a room to connect with required door side
 * @param {import('../data/mapsData.js').RoomDef} roomDef
 * @param {string} requiredConnectionSide - The side that must connect (e.g., 'top' means new room needs door on top)
 * @returns {Array<{ rotation: number; label: string; doorSide: string }>}
 */
function getPossibleRoomOrientations(roomDef, requiredConnectionSide) {
    const orientations = [];
    const rotationMap = {
        'top': { rotation: 0, label: 'Tren (0°)' },
        'right': { rotation: 90, label: 'Phai (90°)' },
        'bottom': { rotation: 180, label: 'Duoi (180°)' },
        'left': { rotation: 270, label: 'Trai (270°)' }
    };
    
    // For each door in the room, calculate what rotation would place it at requiredConnectionSide
    roomDef.doors.forEach(door => {
        if (door.kind !== 'door') return;
        
        // Calculate rotation needed to move door.side to requiredConnectionSide
        const sides = ['top', 'right', 'bottom', 'left'];
        const fromIndex = sides.indexOf(door.side);
        const toIndex = sides.indexOf(requiredConnectionSide);
        
        if (fromIndex === -1 || toIndex === -1) return;
        
        const rotationSteps = (toIndex - fromIndex + 4) % 4;
        const rotation = rotationSteps * 90;
        
        // Avoid duplicates
        if (!orientations.some(o => o.rotation === rotation)) {
            orientations.push({
                rotation,
                label: `Xoay ${rotation}° (cua ${door.side} -> ${requiredConnectionSide})`,
                doorSide: door.side
            });
        }
    });
    
    return orientations;
}

/**
 * Rotate room doors based on rotation angle
 * @param {string[]} doors - Original door directions (north/south/east/west)
 * @param {number} rotation - Rotation angle (0, 90, 180, 270)
 * @returns {string[]}
 */
function rotateRoomDoors(doors, rotation) {
    if (rotation === 0) return doors;
    
    const rotationSteps = rotation / 90;
    const directionOrder = ['north', 'east', 'south', 'west'];
    
    return doors.map(door => {
        const currentIndex = directionOrder.indexOf(door);
        if (currentIndex === -1) return door;
        const newIndex = (currentIndex + rotationSteps) % 4;
        return directionOrder[newIndex];
    });
}

/**
 * Check if a door is blocked (e.g., front-door of Entrance Hall)
 * @param {string} roomName - Room name in English
 * @param {string} doorDirection - Door direction (north/south/east/west)
 * @param {string} [targetRoomId] - Optional target room ID to check
 * @returns {boolean}
 */
function isDoorBlocked(roomName, doorDirection, targetRoomId) {
    // Entrance Hall's front door (south/bottom) cannot be used
    if (roomName === 'Entrance Hall' && doorDirection === 'south') {
        return true;
    }
    
    // Check if target room is an elevator shaft (elevator not present)
    if (targetRoomId) {
        const revealedRooms = currentGameState?.map?.revealedRooms || {};
        const targetRoom = revealedRooms[targetRoomId];
        if (targetRoom && targetRoom.isElevatorShaft && !targetRoom.elevatorPresent) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check if moving to a room is blocked by elevator shaft
 * @param {string} targetRoomId - Target room ID
 * @returns {boolean}
 */
function isElevatorShaftBlocked(targetRoomId) {
    const revealedRooms = currentGameState?.map?.revealedRooms || {};
    const targetRoom = revealedRooms[targetRoomId];
    return targetRoom && targetRoom.isElevatorShaft && !targetRoom.elevatorPresent;
}

/**
 * Filter rooms that have at least one door (can be rotated to connect)
 * @param {import('../data/mapsData.js').RoomDef[]} rooms - Available rooms
 * @param {string} requiredDoorSide - Required door side (top/bottom/left/right)
 * @returns {import('../data/mapsData.js').RoomDef[]}
 */
function filterRoomsWithConnectingDoor(rooms, requiredDoorSide) {
    return rooms.filter(room => {
        // Room must have at least one regular door that can be rotated to connect
        const hasRegularDoor = room.doors.some(d => d.kind === 'door');
        if (!hasRegularDoor) return false;
        
        // Check if any orientation is possible
        const orientations = getPossibleRoomOrientations(room, requiredDoorSide);
        return orientations.length > 0;
    });
}

/**
 * Check if current rotation is valid (has connecting door)
 * @param {import('../data/mapsData.js').RoomDef} roomDef
 * @param {number} rotation
 * @param {string} requiredDoorSide
 * @returns {boolean}
 */
function isRotationValid(roomDef, rotation, requiredDoorSide) {
    const originalDoors = roomDef.doors
        .filter(d => d.kind === 'door')
        .map(d => convertDoorSide(d.side));
    
    const rotatedDoors = rotateRoomDoors(originalDoors, rotation);
    const requiredDoorDir = convertDoorSide(requiredDoorSide);
    
    return rotatedDoors.includes(requiredDoorDir);
}

/**
 * Find first valid rotation for a room
 * @param {import('../data/mapsData.js').RoomDef} roomDef
 * @param {string} requiredDoorSide
 * @returns {number} - First valid rotation (0, 90, 180, 270) or 0 if none found
 */
function findFirstValidRotation(roomDef, requiredDoorSide) {
    const rotations = [0, 90, 180, 270];
    for (const rotation of rotations) {
        if (isRotationValid(roomDef, rotation, requiredDoorSide)) {
            return rotation;
        }
    }
    return 0; // Fallback
}

/**
 * Render room discovery modal (simplified - just buttons)
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
    
    // Step 1: Select room (floor selection removed - room auto-placed on current floor)
    if (!roomDiscoveryModal.selectedRoom) {
        // Floor short names for display
        const floorShortNames = {
            ground: 'G',
            upper: 'U',
            basement: 'B'
        };
        
        const roomListHtml = validRooms.map(room => {
            const nameVi = room.name.vi || room.name.en;
            // Show allowed floors instead of *
            const floorsLabel = room.floorsAllowed.length > 1 
                ? ` (${room.floorsAllowed.map(f => floorShortNames[f] || f).join('/')})`
                : '';
            // Show token types with counts
            let tokenIndicator = '';
            if (room.tokens && room.tokens.length > 0) {
                const tokenCounts = {};
                room.tokens.forEach(token => {
                    tokenCounts[token] = (tokenCounts[token] || 0) + 1;
                });
                const tokenLabels = [];
                if (tokenCounts.item) tokenLabels.push(tokenCounts.item > 1 ? `Itemx${tokenCounts.item}` : 'Item');
                if (tokenCounts.event) tokenLabels.push(tokenCounts.event > 1 ? `Eventx${tokenCounts.event}` : 'Event');
                if (tokenCounts.omen) tokenLabels.push(tokenCounts.omen > 1 ? `Omenx${tokenCounts.omen}` : 'Omen');
                tokenIndicator = ` (${tokenLabels.join(', ')})`;
            }
            return `<div class="room-discovery__item" data-room-name="${room.name.en}" data-search-text="${nameVi.toLowerCase()} ${room.name.en.toLowerCase()}">${nameVi}${floorsLabel}${tokenIndicator}</div>`;
        }).join('');
        
        const noRoomsMessage = validRooms.length === 0 
            ? `<p class="room-discovery__no-rooms">Khong con phong nao co the dat o huong nay!</p>` 
            : '';
        
        return `
            <div class="room-discovery-overlay">
                <div class="room-discovery-modal">
                    <h2 class="room-discovery__title">Rut bai phong moi</h2>
                    <p class="room-discovery__subtitle">Chon phong (${floorDisplay})</p>
                    
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
                                <button class="action-button action-button--primary" type="button" data-action="select-room-next">
                                    Tiep theo
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
    
    // Step 2: Simple control panel (room preview is on map)
    const selectedRoomDef = ROOMS.find(r => r.name.en === roomDiscoveryModal.selectedRoom);
    if (!selectedRoomDef) return '';
    
    const roomNameVi = selectedRoomDef.name.vi || selectedRoomDef.name.en;
    const currentRotation = roomDiscoveryModal.currentRotation || 0;
    const isValid = isRotationValid(selectedRoomDef, currentRotation, doorSide);
    
    return `
        <div class="room-discovery-panel">
            <div class="room-discovery-panel__content">
                <h3 class="room-discovery-panel__title">${roomNameVi}</h3>
                <p class="room-discovery-panel__hint">Click vao phong tren map de xoay</p>
                <p class="room-discovery-panel__status ${isValid ? 'room-discovery-panel__status--valid' : 'room-discovery-panel__status--invalid'}">
                    ${isValid ? '✓ Hop le' : '✗ Chua hop le'}
                </p>
                <div class="room-discovery-panel__buttons">
                    <button class="action-button action-button--secondary" type="button" data-action="back-to-room-select">
                        Quay lai
                    </button>
                    <button class="action-button action-button--primary" type="button" data-action="confirm-room-placement" ${!isValid ? 'disabled' : ''}>
                        Xac nhan
                    </button>
                </div>
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
            
            // Check if there's already a room at the target position (just not connected)
            const dirOffsets = {
                north: { x: 0, y: 1 },
                south: { x: 0, y: -1 },
                east: { x: 1, y: 0 },
                west: { x: -1, y: 0 }
            };
            const offset = dirOffsets[doorDirection];
            const targetX = currentRoom.x + offset.x;
            const targetY = currentRoom.y + offset.y;
            
            // Find room at target position on same floor
            let existingRoom = null;
            let existingRoomId = null;
            for (const [roomId, room] of Object.entries(revealedRooms)) {
                if (room.floor === currentRoom.floor && room.x === targetX && room.y === targetY) {
                    // Skip elevator shafts
                    if (!room.isElevatorShaft) {
                        existingRoom = room;
                        existingRoomId = roomId;
                        break;
                    }
                }
            }
            
            // If room exists at target position, connect and move
            if (existingRoom && existingRoomId) {
                const oppositeDir = getOppositeDoor(doorDirection);
                // Check if target room has a door facing us
                if (existingRoom.doors && existingRoom.doors.includes(oppositeDir)) {
                    // Create connection
                    if (!mapConnections[currentRoomId]) mapConnections[currentRoomId] = {};
                    if (!mapConnections[existingRoomId]) mapConnections[existingRoomId] = {};
                    mapConnections[currentRoomId][doorDirection] = existingRoomId;
                    mapConnections[existingRoomId][oppositeDir] = currentRoomId;
                    
                    // Move player
                    currentGameState.playerState.playerPositions[playerId] = existingRoomId;
                    currentGameState.playerMoves[playerId] = moves - 1;
                    
                    // Track entry direction (opposite of door direction = which side player entered from)
                    if (!currentGameState.playerState.playerEntryDirections) {
                        currentGameState.playerState.playerEntryDirections = {};
                    }
                    currentGameState.playerState.playerEntryDirections[playerId] = oppositeDir;
                    
                    // Apply Vault spawn position if entering Vault room
                    applyVaultSpawnPosition(playerId, existingRoom, currentGameState);
                    
                    // Check if turn ended
                    if (currentGameState.playerMoves[playerId] <= 0) {
                        currentGameState.currentTurnIndex = (currentGameState.currentTurnIndex + 1) % currentGameState.turnOrder.length;
                        const nextPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
                        const nextPlayer = currentGameState.players.find(p => p.id === nextPlayerId);
                        if (nextPlayer) {
                            const nextCharData = currentGameState.playerState?.characterData?.[nextPlayerId] || currentGameState.characterData?.[nextPlayerId];
                            const speed = getCharacterSpeed(nextPlayer.characterId, nextCharData);
                            currentGameState.playerMoves[nextPlayerId] = speed;
                        }
                        const nextIdx = currentGameState.players.findIndex(p => p.id === nextPlayerId);
                        if (nextIdx !== -1) {
                            debugCurrentPlayerIndex = nextIdx;
                            mySocketId = nextPlayerId;
                        }
                    }
                    
                    updateGameUI(mountEl, currentGameState, mySocketId);
                    return;
                }
            }
            
            // No existing room - show room discovery modal
            const currentFloor = currentRoom.floor;
            const requiredDoorSide = doorDirToSide(getOppositeDoor(doorDirection));
            
            roomDiscoveryModal = {
                isOpen: true,
                direction: doorDirection,
                floor: currentFloor,
                doorSide: requiredDoorSide,
                selectedRoom: null,
                currentRotation: 0,
                selectedFloor: null,
                needsFloorSelection: false
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
    
    // Track entry direction (opposite of door direction = which side player entered from)
    if (!currentGameState.playerState.playerEntryDirections) {
        currentGameState.playerState.playerEntryDirections = {};
    }
    const oppositeDir = getOppositeDoor(doorDirection);
    currentGameState.playerState.playerEntryDirections[playerId] = oppositeDir;
    
    // Decrease moves
    currentGameState.playerMoves[playerId] = moves - 1;
    
    // Apply Vault spawn position if entering Vault room
    const targetRoom = revealedRooms[targetRoomId];
    applyVaultSpawnPosition(playerId, targetRoom, currentGameState);
    
    // Check if target room has tokens and hasn't been drawn yet
    if (targetRoom && targetRoom.tokens && targetRoom.tokens.length > 0) {
        // Initialize drawnRooms tracking if not exists
        if (!currentGameState.playerState.drawnRooms) {
            currentGameState.playerState.drawnRooms = [];
        }
        
        // Check if this room's tokens haven't been drawn yet
        if (!currentGameState.playerState.drawnRooms.includes(targetRoomId)) {
            // Mark room as drawn
            currentGameState.playerState.drawnRooms.push(targetRoomId);
            
            // Trigger token drawing
            initTokenDrawing(mountEl, targetRoom.tokens);
            updateGameUI(mountEl, currentGameState, mySocketId);
            return; // Don't end turn yet
        }
    }
    
    // Check if turn ended
    if (currentGameState.playerMoves[playerId] <= 0) {
        // Move to next player
        currentGameState.currentTurnIndex = (currentGameState.currentTurnIndex + 1) % currentGameState.turnOrder.length;
        
        // Set moves for next player
        const nextPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
        const nextPlayer = currentGameState.players.find(p => p.id === nextPlayerId);
        if (nextPlayer) {
            const nextCharData = currentGameState.playerState?.characterData?.[nextPlayerId] || currentGameState.characterData?.[nextPlayerId];
            const speed = getCharacterSpeed(nextPlayer.characterId, nextCharData);
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
    
    // Clear entry direction when using stairs (no specific door entry)
    if (!currentGameState.playerState.playerEntryDirections) {
        currentGameState.playerState.playerEntryDirections = {};
    }
    currentGameState.playerState.playerEntryDirections[playerId] = null;
    
    // Decrease moves (using stairs costs 1 move)
    currentGameState.playerMoves[playerId] = moves - 1;
    
    // Apply Vault spawn position if entering Vault room
    const targetRoom = revealedRooms[targetRoomId];
    applyVaultSpawnPosition(playerId, targetRoom, currentGameState);
    
    // Check if target room has tokens and hasn't been drawn yet
    if (targetRoom && targetRoom.tokens && targetRoom.tokens.length > 0) {
        // Initialize drawnRooms tracking if not exists
        if (!currentGameState.playerState.drawnRooms) {
            currentGameState.playerState.drawnRooms = [];
        }
        
        // Check if this room's tokens haven't been drawn yet
        if (!currentGameState.playerState.drawnRooms.includes(targetRoomId)) {
            // Mark room as drawn
            currentGameState.playerState.drawnRooms.push(targetRoomId);
            
            // Trigger token drawing
            initTokenDrawing(mountEl, targetRoom.tokens);
            updateGameUI(mountEl, currentGameState, mySocketId);
            return; // Don't end turn yet
        }
    }
    
    // Check if turn ended
    if (currentGameState.playerMoves[playerId] <= 0) {
        currentGameState.currentTurnIndex = (currentGameState.currentTurnIndex + 1) % currentGameState.turnOrder.length;
        
        const nextPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
        const nextPlayer = currentGameState.players.find(p => p.id === nextPlayerId);
        if (nextPlayer) {
            const nextCharData = currentGameState.playerState?.characterData?.[nextPlayerId] || currentGameState.characterData?.[nextPlayerId];
            const speed = getCharacterSpeed(nextPlayer.characterId, nextCharData);
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
 * Handle debug mode use Mystic Elevator - move to selected floor
 * Elevator snaps to landing room (door-to-door connection)
 * Remembers position for each floor visited
 * Creates elevator shaft on floors where elevator is not present
 * @param {HTMLElement} mountEl
 * @param {string} targetFloor - 'upper', 'ground', or 'basement'
 */
function handleDebugUseElevator(mountEl, targetFloor) {
    if (!currentGameState || currentGameState.gamePhase !== 'playing') return;

    const playerId = mySocketId;
    const currentTurnPlayer = currentGameState.turnOrder[currentGameState.currentTurnIndex];
    
    if (playerId !== currentTurnPlayer) {
        console.log(`Not ${playerId}'s turn`);
        return;
    }
    
    const moves = currentGameState.playerMoves[playerId] || 0;
    if (moves <= 0) {
        console.log(`No moves left for ${playerId}`);
        return;
    }
    
    const revealedRooms = currentGameState.map?.revealedRooms || {};
    const currentRoomId = currentGameState.playerState.playerPositions[playerId];
    const currentRoom = revealedRooms[currentRoomId];
    
    if (!currentRoom || currentRoom.name !== 'Mystic Elevator') {
        console.log('Not in Mystic Elevator');
        return;
    }
    
    const previousFloor = currentRoom.floor;
    const previousX = currentRoom.x;
    const previousY = currentRoom.y;
    const previousDoors = [...(currentRoom.doors || ['north'])];
    const previousConnections = { ...currentGameState.map.connections[currentRoomId] };
    
    // Initialize elevator floor positions tracking if not exists
    if (!currentRoom.floorPositions) {
        currentRoom.floorPositions = {};
    }
    
    // Save current floor position before moving (including doors)
    currentRoom.floorPositions[previousFloor] = {
        x: previousX,
        y: previousY,
        doors: previousDoors,
        connections: previousConnections
    };
    
    // Initialize elevator shafts tracking if not exists
    if (!currentGameState.map.elevatorShafts) {
        currentGameState.map.elevatorShafts = {};
    }
    
    let newX, newY;
    let newDoors = ['north']; // Default door direction
    let newConnections = {};
    
    // Check if we have a saved position for target floor
    if (currentRoom.floorPositions[targetFloor]) {
        // Return to saved position on this floor
        const savedPos = currentRoom.floorPositions[targetFloor];
        newX = savedPos.x;
        newY = savedPos.y;
        newDoors = savedPos.doors || ['north'];
        newConnections = { ...savedPos.connections };
    } else {
        // First time visiting this floor - snap to landing room
        const landingNames = {
            'upper': 'Upper Landing',
            'basement': 'Basement Landing',
            'ground': 'Foyer'
        };
        const landingName = landingNames[targetFloor];
        
        // Find the landing room
        let landingRoom = null;
        let landingRoomId = null;
        for (const [roomId, room] of Object.entries(revealedRooms)) {
            if (room.name === landingName && room.floor === targetFloor) {
                landingRoom = room;
                landingRoomId = roomId;
                break;
            }
        }
        
        if (landingRoom) {
            // Place elevator south of landing (elevator's north door connects to landing's south door)
            newX = landingRoom.x;
            newY = landingRoom.y - 1;
            // Connect elevator (north) to landing (south)
            newConnections = { north: landingRoomId };
            if (!currentGameState.map.connections[landingRoomId]) {
                currentGameState.map.connections[landingRoomId] = {};
            }
            currentGameState.map.connections[landingRoomId].south = currentRoomId;
        } else {
            // Fallback: place at origin if no landing found
            newX = 0;
            newY = 0;
        }
    }
    
    // Create elevator shaft on the floor we're leaving (blocked until elevator returns)
    const shaftId = `elevator-shaft-${previousFloor}`;
    revealedRooms[shaftId] = {
        id: shaftId,
        name: 'Elevator Shaft',
        x: previousX,
        y: previousY,
        floor: previousFloor,
        doors: previousDoors, // Same doors as elevator had on this floor
        isElevatorShaft: true,
        elevatorPresent: false
    };
    currentGameState.map.elevatorShafts[previousFloor] = shaftId;
    
    // Remove connections TO the old elevator position (now shaft)
    // Find rooms that were connected to elevator and remove their connection
    const oldConnections = currentGameState.map.connections[currentRoomId] || {};
    for (const [dir, connectedRoomId] of Object.entries(oldConnections)) {
        if (connectedRoomId && currentGameState.map.connections[connectedRoomId]) {
            // Find and remove the reverse connection
            const reverseDir = getOppositeDoor(dir);
            if (currentGameState.map.connections[connectedRoomId][reverseDir] === currentRoomId) {
                // Point to shaft instead (but shaft has no connections = blocked)
                delete currentGameState.map.connections[connectedRoomId][reverseDir];
            }
        }
    }
    
    // Shaft has no connections (blocked)
    currentGameState.map.connections[shaftId] = {};
    
    // Remove shaft on target floor if exists (elevator is arriving)
    const targetShaftId = currentGameState.map.elevatorShafts[targetFloor];
    if (targetShaftId && revealedRooms[targetShaftId]) {
        delete revealedRooms[targetShaftId];
        delete currentGameState.map.connections[targetShaftId];
        delete currentGameState.map.elevatorShafts[targetFloor];
    }
    
    // Move elevator to new floor (player stays in elevator)
    currentRoom.floor = targetFloor;
    currentRoom.x = newX;
    currentRoom.y = newY;
    currentRoom.doors = newDoors; // Restore saved doors for this floor
    
    // Update connections
    currentGameState.map.connections[currentRoomId] = newConnections;
    
    // Using elevator does NOT cost a move (free action)
    // Player can continue moving after using elevator
    
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
 * Find room at specific position and floor
 * @param {Object} revealedRooms - Map of revealed rooms
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} floor - Floor name
 * @returns {Object|null} Room object or null
 */
function findRoomAtPosition(revealedRooms, x, y, floor) {
    for (const roomId in revealedRooms) {
        const room = revealedRooms[roomId];
        if (room.x === x && room.y === y && room.floor === floor) {
            return room;
        }
    }
    return null;
}

/**
 * Remove doors that connect to walls (not doors) of adjacent existing rooms
 * When a new room is placed, check all its doors against adjacent rooms.
 * If a door points to an existing room that doesn't have a matching door, remove it.
 * @param {Object} newRoom - The newly placed room
 * @param {Object} revealedRooms - Map of all revealed rooms
 * @param {string} excludeDirection - Direction to exclude (the door we came from)
 * @returns {string[]} Updated doors array with invalid doors removed
 */
function removeDoorsToWalls(newRoom, revealedRooms, excludeDirection) {
    const directionOffsets = {
        'north': { x: 0, y: 1 },
        'south': { x: 0, y: -1 },
        'east': { x: 1, y: 0 },
        'west': { x: -1, y: 0 }
    };
    
    const validDoors = newRoom.doors.filter(doorDir => {
        // Always keep the door we came from (it's already connected)
        if (doorDir === excludeDirection) return true;
        
        // Calculate adjacent position for this door
        const offset = directionOffsets[doorDir];
        if (!offset) return true;
        
        const adjacentX = newRoom.x + offset.x;
        const adjacentY = newRoom.y + offset.y;
        
        // Find if there's an existing room at that position
        const adjacentRoom = findRoomAtPosition(revealedRooms, adjacentX, adjacentY, newRoom.floor);
        
        // No room there - keep the door (can discover new room later)
        if (!adjacentRoom) return true;
        
        // There's a room - check if it has a matching door
        const oppositeDir = getOppositeDoor(doorDir);
        const adjacentHasDoor = adjacentRoom.doors && adjacentRoom.doors.includes(oppositeDir);
        
        if (!adjacentHasDoor) {
            // Adjacent room has wall, not door - remove this door
            console.log(`[Room] Removing door '${doorDir}' from ${newRoom.name} - connects to wall of ${adjacentRoom.name}`);
            return false;
        }
        
        // Adjacent room has matching door - keep door
        return true;
    });
    
    return validDoors;
}

/**
 * Handle room discovery - add new room to map and move player
 * @param {HTMLElement} mountEl
 * @param {string} roomNameEn - English name of the room to add
 * @param {number} rotation - Rotation angle (0, 90, 180, 270)
 */
function handleRoomDiscovery(mountEl, roomNameEn, rotation = 0) {
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
    
    // Always use current floor (room auto-placed on current floor)
    const targetFloor = currentRoom.floor;
    
    // Generate new room ID and position
    const newRoomId = generateRoomId(roomNameEn);
    const newPosition = calculateNewRoomPosition(currentRoom, roomDiscoveryModal.direction);
    
    // Extract doors from room definition and apply rotation
    const originalDoors = roomDef.doors
        .filter(d => d.kind === 'door')
        .map(d => convertDoorSide(d.side));
    
    const rotatedDoors = rotateRoomDoors(originalDoors, rotation);
    
    // Create new room object
    const newRoom = {
        id: newRoomId,
        name: roomDef.name.en,
        x: newPosition.x,
        y: newPosition.y,
        doors: rotatedDoors,
        floor: targetFloor,
        rotation: rotation, // Store rotation for reference
        tokens: roomDef.tokens ? [...roomDef.tokens] : [] // Copy tokens from room definition
    };
    
    // Add Vault layout if this is a Vault room
    if (roomDef.name.en === 'Vault' && roomDef.specialLayout) {
        newRoom.vaultLayout = calculateVaultLayout(rotation);
    }
    
    // Remove doors that connect to walls of existing adjacent rooms
    const oppositeDir = getOppositeDoor(roomDiscoveryModal.direction);
    newRoom.doors = removeDoorsToWalls(newRoom, revealedRooms, oppositeDir);
    
    // Add room to revealed rooms
    currentGameState.map.revealedRooms[newRoomId] = newRoom;
    
    // Add connections (bidirectional)
    const direction = roomDiscoveryModal.direction;
    
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
    
    // Track entry direction (opposite of discovery direction = which side player entered from)
    if (!currentGameState.playerState.playerEntryDirections) {
        currentGameState.playerState.playerEntryDirections = {};
    }
    currentGameState.playerState.playerEntryDirections[playerId] = oppositeDir;
    
    // Apply Vault spawn position if entering Vault room
    applyVaultSpawnPosition(playerId, newRoom, currentGameState);
    
    // Discovering a room costs 1 move (same as normal movement)
    const moves = currentGameState.playerMoves[playerId] || 0;
    currentGameState.playerMoves[playerId] = moves - 1;
    
    // Close room discovery modal
    roomDiscoveryModal = null;
    
    // Check if new room has tokens - trigger token drawing
    if (newRoom.tokens && newRoom.tokens.length > 0) {
        // Initialize drawnRooms tracking if not exists
        if (!currentGameState.playerState.drawnRooms) {
            currentGameState.playerState.drawnRooms = [];
        }
        
        // Mark room as drawn
        currentGameState.playerState.drawnRooms.push(newRoomId);
        
        initTokenDrawing(mountEl, newRoom.tokens);
        // Don't end turn yet, wait for token drawing to complete
        updateGameUI(mountEl, currentGameState, mySocketId);
        return;
    }
    
    // Check if turn ended (no more moves)
    if (currentGameState.playerMoves[playerId] <= 0) {
        // Move to next player
        currentGameState.currentTurnIndex = (currentGameState.currentTurnIndex + 1) % currentGameState.turnOrder.length;
        
        const nextPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
        const nextPlayer = currentGameState.players.find(p => p.id === nextPlayerId);
        if (nextPlayer) {
            const nextCharData = currentGameState.playerState?.characterData?.[nextPlayerId] || currentGameState.characterData?.[nextPlayerId];
            const speed = getCharacterSpeed(nextPlayer.characterId, nextCharData);
            currentGameState.playerMoves[nextPlayerId] = speed;
        }
        
        // Auto switch to next player
        const nextIdx = currentGameState.players.findIndex(p => p.id === nextPlayerId);
        if (nextIdx !== -1) {
            debugCurrentPlayerIndex = nextIdx;
            mySocketId = nextPlayerId;
        }
    }
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Handle random room selection - just select room, user still needs to rotate and confirm
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
    
    // Find first valid rotation to snap to correct position
    const initialRotation = findFirstValidRotation(selectedRoom, roomDiscoveryModal.doorSide);
    
    // Set selected room and go to rotation step
    roomDiscoveryModal.selectedRoom = selectedRoom.name.en;
    roomDiscoveryModal.currentRotation = initialRotation;
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Cancel room discovery modal
 * @param {HTMLElement} mountEl
 */
function cancelRoomDiscovery(mountEl) {
    if (roomDiscoveryModal) {
        roomDiscoveryModal.selectedRoom = null;
        roomDiscoveryModal.currentRotation = 0;
    }
    roomDiscoveryModal = null;
    updateGameUI(mountEl, currentGameState, mySocketId);
}

// ===== TOKEN DRAWING FUNCTIONS =====

/**
 * Get card data by type and id
 * @param {'omen'|'event'|'item'} type
 * @param {string} cardId
 * @returns {any}
 */
function getCardData(type, cardId) {
    const deck = type === 'omen' ? OMENS : type === 'event' ? EVENTS : ITEMS;
    return deck.find(c => c.id === cardId);
}

/**
 * Get all cards of a type
 * @param {'omen'|'event'|'item'} type
 * @returns {any[]}
 */
function getCardsByType(type) {
    return type === 'omen' ? OMENS : type === 'event' ? EVENTS : ITEMS;
}

/**
 * Get all card IDs that have been drawn/used in the game
 * Includes cards in player inventories and cards drawn in current token drawing session
 * @returns {{ omens: string[]; events: string[]; items: string[] }}
 */
function getUsedCardIds() {
    const used = { omens: [], events: [], items: [] };
    
    if (!currentGameState) return used;
    
    // Collect cards from all players' inventories
    const allPlayerCards = currentGameState.playerState?.playerCards || {};
    for (const playerId in allPlayerCards) {
        const playerCards = allPlayerCards[playerId];
        if (playerCards.omens) used.omens.push(...playerCards.omens);
        if (playerCards.events) used.events.push(...playerCards.events);
        if (playerCards.items) used.items.push(...playerCards.items);
    }
    
    // Also include cards selected in current token drawing session (not yet confirmed)
    if (tokenDrawingModal && tokenDrawingModal.tokensToDrawn) {
        tokenDrawingModal.tokensToDrawn.forEach((token, idx) => {
            // Only count cards from previous tokens in current session (not current one being selected)
            if (idx < tokenDrawingModal.currentIndex && token.selectedCard) {
                const cardType = token.type === 'omen' ? 'omens' : token.type === 'event' ? 'events' : 'items';
                used[cardType].push(token.selectedCard);
            }
        });
    }
    
    return used;
}

/**
 * Get available cards for selection (excluding already used cards)
 * Exception: 'anh_phan_chieu' can appear up to 2 times
 * @param {'omen'|'event'|'item'} type
 * @returns {any[]}
 */
function getAvailableCards(type) {
    const allCards = getCardsByType(type);
    const usedCards = getUsedCardIds();
    const usedList = type === 'omen' ? usedCards.omens : type === 'event' ? usedCards.events : usedCards.items;
    
    // Count occurrences of each used card
    const usedCount = {};
    usedList.forEach(cardId => {
        usedCount[cardId] = (usedCount[cardId] || 0) + 1;
    });
    
    // Filter out cards that have reached their max usage
    return allCards.filter(card => {
        const count = usedCount[card.id] || 0;
        
        // Special case: 'anh_phan_chieu' can be used up to 2 times
        if (card.id === 'anh_phan_chieu' || card.id === 'anh_phan_chieu_2') {
            // Each variant can only be used once, but both can exist in game
            return count < 1;
        }
        
        // All other cards can only be used once
        return count < 1;
    });
}

/**
 * Initialize token drawing modal when entering room with tokens
 * @param {HTMLElement} mountEl
 * @param {string[]} tokens - Array of token types from room
 */
function initTokenDrawing(mountEl, tokens) {
    if (!tokens || tokens.length === 0) return;
    
    tokenDrawingModal = {
        isOpen: true,
        tokensToDrawn: tokens.map(type => ({
            type: type,
            drawn: false,
            selectedCard: null
        })),
        currentIndex: 0
    };
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Handle manual card selection
 * @param {HTMLElement} mountEl
 * @param {string} cardId
 */
function handleCardSelect(mountEl, cardId) {
    if (!tokenDrawingModal) return;
    
    const current = tokenDrawingModal.tokensToDrawn[tokenDrawingModal.currentIndex];
    if (!current) return;
    
    current.selectedCard = cardId;
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Handle random card draw
 * @param {HTMLElement} mountEl
 */
function handleRandomCardDraw(mountEl) {
    if (!tokenDrawingModal) return;
    
    const current = tokenDrawingModal.tokensToDrawn[tokenDrawingModal.currentIndex];
    if (!current) return;
    
    // Use getAvailableCards to only pick from unused cards
    const cards = getAvailableCards(current.type);
    if (cards.length === 0) {
        console.log(`[Token] No available ${current.type} cards left`);
        return;
    }
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    
    current.selectedCard = randomCard.id;
    current.drawn = true;
    
    // Move to next token or finish
    if (tokenDrawingModal.currentIndex < tokenDrawingModal.tokensToDrawn.length - 1) {
        tokenDrawingModal.currentIndex++;
    } else {
        confirmTokenDrawing(mountEl);
        return;
    }
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Handle next button (after manual selection)
 * @param {HTMLElement} mountEl
 */
function handleTokenDrawNext(mountEl) {
    if (!tokenDrawingModal) return;
    
    const current = tokenDrawingModal.tokensToDrawn[tokenDrawingModal.currentIndex];
    if (!current || !current.selectedCard) return;
    
    current.drawn = true;
    
    // Move to next token or finish
    if (tokenDrawingModal.currentIndex < tokenDrawingModal.tokensToDrawn.length - 1) {
        tokenDrawingModal.currentIndex++;
    } else {
        confirmTokenDrawing(mountEl);
        return;
    }
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Confirm and save drawn cards to player inventory
 * @param {HTMLElement} mountEl
 */
function confirmTokenDrawing(mountEl) {
    if (!tokenDrawingModal || !currentGameState) return;
    
    const playerId = mySocketId;
    
    // Initialize player cards if not exists
    if (!currentGameState.playerState.playerCards) {
        currentGameState.playerState.playerCards = {};
    }
    if (!currentGameState.playerState.playerCards[playerId]) {
        currentGameState.playerState.playerCards[playerId] = {
            omens: [],
            events: [],
            items: []
        };
    }
    
    // Add drawn cards to player inventory
    tokenDrawingModal.tokensToDrawn.forEach(token => {
        if (token.drawn && token.selectedCard) {
            const cardType = token.type === 'omen' ? 'omens' : token.type === 'event' ? 'events' : 'items';
            currentGameState.playerState.playerCards[playerId][cardType].push(token.selectedCard);
        }
    });
    
    // Close modal
    tokenDrawingModal = null;
    
    // Check if turn ended (no more moves)
    if (currentGameState.playerMoves[playerId] <= 0) {
        // Move to next player
        currentGameState.currentTurnIndex = (currentGameState.currentTurnIndex + 1) % currentGameState.turnOrder.length;
        
        const nextPlayerId = currentGameState.turnOrder[currentGameState.currentTurnIndex];
        const nextPlayer = currentGameState.players.find(p => p.id === nextPlayerId);
        if (nextPlayer) {
            const nextCharData = currentGameState.playerState?.characterData?.[nextPlayerId] || currentGameState.characterData?.[nextPlayerId];
            const speed = getCharacterSpeed(nextPlayer.characterId, nextCharData);
            currentGameState.playerMoves[nextPlayerId] = speed;
        }
        
        // Auto switch to next player in debug mode
        if (isDebugMode) {
            const nextIdx = currentGameState.players.findIndex(p => p.id === nextPlayerId);
            if (nextIdx !== -1) {
                debugCurrentPlayerIndex = nextIdx;
                mySocketId = nextPlayerId;
            }
        }
    }
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Render token drawing modal
 * @returns {string}
 */
function renderTokenDrawingModal() {
    if (!tokenDrawingModal || !tokenDrawingModal.isOpen) return '';
    
    const current = tokenDrawingModal.tokensToDrawn[tokenDrawingModal.currentIndex];
    if (!current) return '';
    
    const typeLabels = { omen: 'Omen', event: 'Event', item: 'Item' };
    const typeLabel = typeLabels[current.type];
    
    const totalTokens = tokenDrawingModal.tokensToDrawn.length;
    const currentNum = tokenDrawingModal.currentIndex + 1;
    
    // Use getAvailableCards to filter out already used cards
    const cards = getAvailableCards(current.type);
    
    // Card list for dropdown
    const cardListHtml = cards.map(card => {
        const cardName = card.name?.vi || card.id;
        const isSelected = current.selectedCard === card.id;
        return `<div class="token-card__item ${isSelected ? 'is-selected' : ''}" data-card-id="${card.id}" data-search-text="${cardName.toLowerCase()}">${cardName}</div>`;
    }).join('');
    
    return `
        <div class="token-drawing-overlay">
            <div class="token-drawing-modal">
                <h2 class="token-drawing__title">Rut bai ${typeLabel}</h2>
                <p class="token-drawing__subtitle">Token ${currentNum}/${totalTokens}</p>
                
                <div class="token-drawing__options">
                    <div class="token-drawing__option">
                        <label class="token-drawing__label">Chon bai:</label>
                        <div class="token-card__search-wrapper">
                            <input type="text" 
                                   class="token-card__search" 
                                   id="token-card-search-input" 
                                   placeholder="Nhap ten bai de tim kiem..."
                                   autocomplete="off" />
                            <div class="token-card__list" id="token-card-list">
                                ${cardListHtml}
                            </div>
                        </div>
                        <button class="action-button action-button--primary" 
                                type="button" 
                                data-action="token-draw-next"
                                ${!current.selectedCard ? 'disabled' : ''}>
                            ${currentNum < totalTokens ? 'Tiep theo' : 'Xac nhan'}
                        </button>
                    </div>
                    
                    <div class="token-drawing__divider">
                        <span>hoac</span>
                    </div>
                    
                    <div class="token-drawing__option">
                        <button class="action-button action-button--secondary token-drawing__random-btn" 
                                type="button" 
                                data-action="token-draw-random">
                            Rut ngau nhien
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ===== CARDS VIEW MODAL FUNCTIONS =====

/**
 * Open cards view modal
 * @param {HTMLElement} mountEl
 * @param {'omen'|'event'|'item'} cardType
 */
function openCardsViewModal(mountEl, cardType) {
    if (!currentGameState) return;
    
    const playerId = mySocketId;
    const playerCards = currentGameState.playerState?.playerCards?.[playerId];
    
    if (!playerCards) return;
    
    const cardIds = cardType === 'omen' ? playerCards.omens : 
                    cardType === 'event' ? playerCards.events : 
                    playerCards.items;
    
    if (!cardIds || cardIds.length === 0) return;
    
    cardsViewModal = {
        isOpen: true,
        cardType,
        cardIds,
        expandedCards: new Set() // Start with all collapsed
    };
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Toggle card expansion
 * @param {HTMLElement} mountEl
 * @param {string} cardId
 */
function toggleCardExpansion(mountEl, cardId) {
    if (!cardsViewModal) return;
    
    if (cardsViewModal.expandedCards.has(cardId)) {
        cardsViewModal.expandedCards.delete(cardId);
    } else {
        cardsViewModal.expandedCards.add(cardId);
    }
    
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Close cards view modal
 * @param {HTMLElement} mountEl
 */
function closeCardsViewModal(mountEl) {
    cardsViewModal = null;
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Render cards view modal
 * @returns {string}
 */
function renderCardsViewModal() {
    if (!cardsViewModal || !cardsViewModal.isOpen) return '';
    
    const typeLabels = { omen: 'Omen', event: 'Event', item: 'Item' };
    const typeLabel = typeLabels[cardsViewModal.cardType];
    
    const cardsHtml = cardsViewModal.cardIds.map(cardId => {
        const cardData = getCardData(cardsViewModal.cardType, cardId);
        if (!cardData) return '';
        
        const cardName = cardData.name?.vi || cardId;
        const cardText = cardData.text?.vi || '';
        const isExpanded = cardsViewModal.expandedCards.has(cardId);
        
        return `
            <div class="card-detail ${isExpanded ? 'is-expanded' : ''}">
                <div class="card-detail__header" data-action="toggle-card" data-card-id="${cardId}">
                    <h3 class="card-detail__name">${cardName}</h3>
                    <span class="card-detail__toggle">${isExpanded ? '−' : '+'}</span>
                </div>
                ${isExpanded ? `<p class="card-detail__text">${cardText}</p>` : ''}
            </div>
        `;
    }).join('');
    
    return `
        <div class="cards-view-overlay">
            <div class="cards-view-modal">
                <div class="cards-view__header">
                    <h2 class="cards-view__title">${typeLabel} (${cardsViewModal.cardIds.length})</h2>
                    <button class="cards-view__close" type="button" data-action="close-cards-view">&times;</button>
                </div>
                <div class="cards-view__content">
                    ${cardsHtml}
                </div>
            </div>
        </div>
    `;
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

        // Center map on player
        centerMapOnPlayer(mountEl);

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
