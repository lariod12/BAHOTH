// Game View - Dice rolling phase and main gameplay
import { CHARACTER_BY_ID, CHARACTERS } from '../data/charactersData.js';
import * as socketClient from '../services/socketClient.js';
import { renderGameMap, buildPlayerNamesMap, buildPlayerColorsMap } from '../components/GameMap.js';
import { ROOMS } from '../data/mapsData.js';
import { ITEMS, EVENTS, OMENS } from '../data/cardsData.js';
import { calculateVaultLayout, calculatePlayerSpawnPosition } from '../utils/vaultLayout.js';
import { createDefaultHauntState, isHauntTriggered, getFaction, isAlly, isEnemy, getFactionLabel, getTraitorId, applyHauntState } from '../utils/factionUtils.js';

// Room discovery modal state
/** @type {{ isOpen: boolean; direction: string; floor: string; doorSide: string; selectedRoom: string | null; currentRotation: number; selectedFloor: string | null; needsFloorSelection: boolean } | null} */
let roomDiscoveryModal = null;

// Token drawing modal state
/** @type {{ isOpen: boolean; tokensToDrawn: Array<{type: 'omen'|'event'|'item'; drawn: boolean; selectedCard: string | null}>; currentIndex: number } | null} */
let tokenDrawingModal = null;

// Cards view modal state
/** @type {{ isOpen: boolean; cardType: 'omen'|'event'|'item'; cardIds: string[]; expandedCards: Set<string> } | null} */
let cardsViewModal = null;

// Dice event modal state
/** @type {{ isOpen: boolean; inputValue: string; result: number | null } | null} */
let diceEventModal = null;

// End turn confirmation modal state
/** @type {{ isOpen: boolean } | null} */
let endTurnModal = null;

// Reset game confirmation modal state (debug mode)
/** @type {{ isOpen: boolean } | null} */
let resetGameModal = null;

// Event dice modal state - for immediate roll events
/** @type {{
 *   isOpen: boolean;
 *   eventCard: object;           // Event card data
 *   rollStat: string|string[];   // Stat(s) to roll (single or array for choice)
 *   selectedStat: string|null;   // Selected stat when rollStat is array
 *   diceCount: number;           // Number of dice based on stat
 *   inputValue: string;
 *   result: number | null;
 *   resultsApplied: boolean;     // Prevent double application
 *   currentRollIndex: number;    // For multi-roll events (nguoi_treo_co)
 *   allResults: Array<{stat: string, result: number}>; // Store all roll results
 *   pendingEffect: object|null;  // Effect to apply after damage roll
 * } | null} */
let eventDiceModal = null;

// Damage dice modal state - for rolling damage after event effect
/** @type {{
 *   isOpen: boolean;
 *   damageType: 'physical' | 'mental' | 'both';
 *   physicalDice: number;
 *   mentalDice: number;
 *   inputValue: string;
 *   result: number | null;
 *   physicalResult: number | null;
 *   mentalResult: number | null;
 *   currentPhase: 'physical' | 'mental' | 'done';
 * } | null} */
let damageDiceModal = null;

/** Room effect dice modal state - for room-triggered dice rolls
 * @type {{
 *   isOpen: boolean;
 *   roomName: string;
 *   roomEffect: object;
 *   diceCount: number;
 *   inputValue: string;
 *   result: number | null;
 *   resultsApplied: boolean;
 *   pendingMovement: {
 *     direction: string;
 *     targetRoomId: string | null;
 *     targetRoomName: string | null;
 *   } | null;
 * } | null} */
let roomEffectDiceModal = null;

/** Combat modal state - for player vs player combat after haunt
 * @type {{
 *   isOpen: boolean;
 *   phase: 'confirm' | 'attacker_roll' | 'waiting_defender' | 'defender_roll' | 'result';
 *   attackerId: string;
 *   defenderId: string;
 *   attackerName: string;
 *   defenderName: string;
 *   attackStat: 'might';
 *   attackerDiceCount: number;
 *   defenderDiceCount: number;
 *   attackerRoll: number | null;
 *   defenderRoll: number | null;
 *   inputValue: string;
 *   winner: 'attacker' | 'defender' | 'tie' | null;
 *   damage: number;
 *   loserId: string | null;
 * } | null} */
let combatModal = null;

/** Pending movement after combat resolution
 * @type {{ direction: string; targetRoomId: string } | null} */
let pendingCombatMovement = null;

/** Track completed combats to prevent re-triggering in same room
 * Key: "roomId:playerId1:playerId2" (sorted player IDs), Value: true
 * Combat only triggers again when one player leaves and re-enters the room
 * @type {Map<string, boolean>} */
let completedCombats = new Map();

/** Track if current player has already attacked this turn
 * Reset when turn advances - enforces "1 attack per turn" rule
 * @type {boolean} */
let hasAttackedThisTurn = false;

/** Damage distribution modal state - for distributing combat/event damage across stats
 * @type {{
 *   isOpen: boolean;
 *   totalDamage: number;
 *   damageType: 'physical' | 'mental' | null;
 *   stat1: string | null;
 *   stat2: string | null;
 *   stat1Damage: number;
 *   stat2Damage: number;
 *   source: 'combat' | 'event';
 * } | null} */
let damageDistributionModal = null;

// Pending mental damage (when both physical and mental damage need to be distributed)
let pendingMentalDamage = null;

// Event result notification modal (shows outcome of event rolls like stat gains or "nothing happens")
/** @type {{ isOpen: boolean; title: string; message: string; type: 'success' | 'neutral' | 'danger' } | null} */
let eventResultModal = null;

// Dice results display state
let showingDiceResults = false;
let diceResultsTimeout = null;

// Reconnection subscriptions
let unsubscribeReconnectResult = null;
let unsubscribePlayerDisconnected = null;
let unsubscribePlayerReconnected = null;
let unsubscribeDebugReset = null;

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
let isDebugMode = false; // Flag to track if we're in debug mode
/** @type {Set<string>} Track expanded player IDs in sidebar */
let expandedPlayers = new Set();
/** @type {Set<string>} Track active player IDs */
let activePlayers = new Set();
/** @type {(() => void) | null} Unsubscribe from players active updates */
let unsubscribePlayersActive = null;





// Track if event listeners are already attached (prevent duplicate)
let eventListenersAttached = false;

// Rooms that require dice rolls (from mapsData.js text containing "roll")
const DICE_ROLL_ROOMS = new Set([
    'Catacombs',           // Sanity roll 6+ to cross
    'Chasm',               // Speed roll 3+ to cross
    'Pentagram Chamber',   // Knowledge roll 4+ when exiting
    'Collapsed Room',      // Speed roll 5+ to avoid falling
    'Graveyard',           // Sanity roll 4+ when exiting
    'Junk Room',           // Might roll 3+ when exiting
    'Vault',               // Knowledge roll 6+ to open
    'Tower',               // Might roll 3+ to cross
    'Attic',               // Speed roll 3+ when exiting
    'Mystic Elevator',     // Roll 2 dice for floor
]);

/**
 * Room effects that require dice rolls when entering/exiting
 * @typedef {'enter' | 'exit' | 'cross'} TriggerType
 * @typedef {'speed' | 'might' | 'sanity' | 'knowledge'} StatType
 */
const ROOM_EFFECTS = {
    // === ENTER/CROSS ROOMS ===
    'Collapsed Room': {
        trigger: 'enter',
        rollStat: 'speed',
        target: 5,
        description: {
            vi: 'Phong sap! Ban phai roll Speed 5+ de tranh roi xuong.',
            en: 'Collapsed Room! Roll Speed 5+ to avoid falling.'
        },
        failEffect: {
            type: 'fallToBasement',
            damageType: 'physical',
            dice: 1
        },
        continueOnFail: false
    },
    'Chasm': {
        trigger: 'enter',
        rollStat: 'speed',
        target: 3,
        description: {
            vi: 'Khe vuc! Roll Speed 3+ de bang qua.',
            en: 'Chasm! Roll Speed 3+ to cross.'
        },
        failEffect: {
            type: 'stopMoving'
        },
        continueOnFail: false
    },
    'Tower': {
        trigger: 'enter',
        rollStat: 'might',
        target: 3,
        description: {
            vi: 'Thap! Roll Might 3+ de bang qua.',
            en: 'Tower! Roll Might 3+ to cross.'
        },
        failEffect: {
            type: 'stopMoving'
        },
        continueOnFail: false
    },
    'Catacombs': {
        trigger: 'enter',
        rollStat: 'sanity',
        target: 6,
        description: {
            vi: 'Ham mo! Roll Sanity 6+ de bang qua.',
            en: 'Catacombs! Roll Sanity 6+ to cross.'
        },
        failEffect: {
            type: 'stopMoving'
        },
        continueOnFail: false
    },

    // === EXIT ROOMS ===
    'Graveyard': {
        trigger: 'exit',
        rollStat: 'sanity',
        target: 4,
        description: {
            vi: 'Nghia dia! Roll Sanity 4+ khi roi di.',
            en: 'Graveyard! Roll Sanity 4+ when leaving.'
        },
        failEffect: {
            type: 'statLoss',
            stat: 'knowledge',
            amount: 1
        },
        continueOnFail: true
    },
    'Pentagram Chamber': {
        trigger: 'exit',
        rollStat: 'knowledge',
        target: 4,
        description: {
            vi: 'Phong ngu giac! Roll Knowledge 4+ khi roi di.',
            en: 'Pentagram Chamber! Roll Knowledge 4+ when leaving.'
        },
        failEffect: {
            type: 'statLoss',
            stat: 'sanity',
            amount: 1
        },
        continueOnFail: true
    },
    'Junk Room': {
        trigger: 'exit',
        rollStat: 'might',
        target: 3,
        description: {
            vi: 'Phong do dac! Roll Might 3+ khi roi di.',
            en: 'Junk Room! Roll Might 3+ when leaving.'
        },
        failEffect: {
            type: 'statLoss',
            stat: 'speed',
            amount: 1
        },
        continueOnFail: true
    },
    'Attic': {
        trigger: 'exit',
        rollStat: 'speed',
        target: 3,
        description: {
            vi: 'Gac mai! Roll Speed 3+ khi roi di.',
            en: 'Attic! Roll Speed 3+ when leaving.'
        },
        failEffect: {
            type: 'statLoss',
            stat: 'might',
            amount: 1
        },
        continueOnFail: true
    }
};

/**
 * Show haunt announcement modal
 * @param {HTMLElement} mountEl - Mount element
 * @param {number} hauntNumber - Haunt scenario number
 * @param {string} traitorName - Name of the traitor
 * @param {boolean} amITraitor - Whether current player is the traitor
 */
function showHauntAnnouncementModal(mountEl, hauntNumber, traitorName, amITraitor) {
    // Remove existing modal if any
    const existing = document.querySelector('.haunt-announcement-overlay');
    if (existing) existing.remove();

    const factionText = amITraitor
        ? 'Ban la KE PHAN BOI!'
        : 'Ban la NGUOI SONG SOT!';
    const factionClass = amITraitor ? 'traitor' : 'survivor';

    const modal = document.createElement('div');
    modal.className = `haunt-announcement-overlay haunt-announcement-overlay--${factionClass}`;
    modal.innerHTML = `
        <div class="haunt-announcement-modal haunt-announcement-modal--${factionClass}">
            <div class="haunt-announcement__icon">👻</div>
            <h2 class="haunt-announcement__title haunt-announcement__title--${factionClass}">THE HAUNT BEGINS!</h2>
            <div class="haunt-announcement__number">Haunt #${hauntNumber}</div>
            <div class="haunt-announcement__traitor">
                <span class="haunt-announcement__traitor-label">Ke Phan Boi:</span>
                <span class="haunt-announcement__traitor-name">${traitorName}</span>
            </div>
            <div class="haunt-announcement__faction haunt-announcement__faction--${factionClass}">
                <span class="haunt-announcement__faction-text">${factionText}</span>
            </div>
            <button class="haunt-announcement__close haunt-announcement__close--${factionClass} action-button" type="button">
                Bat dau chien dau!
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // Close only on button click or tap anywhere on modal
    const closeModal = () => {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.haunt-announcement__close')?.addEventListener('click', closeModal);

    // Also close when clicking on overlay (outside modal)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {'success' | 'warning' | 'info'} [type='info'] - Toast type
 * @param {number} [duration=3000] - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast if any
    const existing = document.querySelector('.game-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `game-toast game-toast--${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        animation: toast-slide-in 0.3s ease;
        ${type === 'success' ? 'background: #10b981; color: white;' : ''}
        ${type === 'warning' ? 'background: #f59e0b; color: white;' : ''}
        ${type === 'info' ? 'background: #3b82f6; color: white;' : ''}
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toast-slide-out 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Show debug waiting popup (waiting for second player)
 */
function showDebugWaitingPopup() {
    // Remove existing popup if any
    const existing = document.querySelector('.debug-waiting-overlay');
    if (existing) return; // Already showing

    const popup = document.createElement('div');
    popup.className = 'debug-waiting-overlay';
    popup.innerHTML = `
        <div class="debug-waiting-modal">
            <h3>DEBUG MODE</h3>
            <p>Waiting for other player...</p>
            <div class="debug-waiting-spinner"></div>
        </div>
    `;

    document.body.appendChild(popup);
}

/**
 * Hide debug waiting popup
 */
function hideDebugWaitingPopup() {
    const popup = document.querySelector('.debug-waiting-overlay');
    if (popup) {
        popup.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => popup.remove(), 300);
    }
}

/**
 * Check if current room requires dice roll
 * @param {Object} gameState - Game state
 * @param {string} myId - Player ID
 * @returns {boolean} Whether dice roll button should be active
 */
function roomRequiresDiceRoll(gameState, myId) {
    if (!gameState || !myId) return false;

    const playerPositions = gameState?.playerState?.playerPositions || {};
    const currentRoomId = playerPositions[myId];
    if (!currentRoomId) return false;

    const revealedRooms = gameState?.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    if (!currentRoom) return false;

    return DICE_ROLL_ROOMS.has(currentRoom.name);
}

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
        faction: null, // null = pre-haunt (all allies), 'heroes' | 'traitor' after haunt
    };
}

/**
 * Ensure characterData is initialized for all players
 * This is needed because the server doesn't initialize characterData
 * @param {object} gameState - The game state to check/update
 */
function ensureCharacterDataInitialized(gameState) {
    if (!gameState || !gameState.players) return;

    // Ensure playerState exists
    if (!gameState.playerState) {
        gameState.playerState = {};
    }

    // Ensure characterData container exists
    if (!gameState.playerState.characterData) {
        gameState.playerState.characterData = {};
    }

    // Initialize characterData for each player if missing
    for (const player of gameState.players) {
        if (!player.characterId) continue;

        if (!gameState.playerState.characterData[player.id]) {
            const charData = createCharacterData(player.id, player.characterId);
            if (charData) {
                gameState.playerState.characterData[player.id] = charData;
                console.log('[CharacterData] Initialized for player:', player.id, player.characterId);
            }
        }
    }
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
 * Get current Might stat value for a character
 * @param {string} characterId
 * @param {object|null} characterData - Optional character data with current stats
 * @returns {number} Current might value
 */
function getCharacterMight(characterId, characterData = null) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 3; // default
    const mightTrait = char.traits.might;
    // Use current might index from characterData if available
    const mightIndex = characterData?.stats?.might ?? mightTrait.startIndex;
    return mightTrait.track[mightIndex];
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

// ===== EVENT DICE ROLL HELPER FUNCTIONS =====

/**
 * Check if an event requires immediate dice roll
 * @param {string} cardId - Event card ID
 * @returns {boolean}
 */
function checkEventRequiresImmediateRoll(cardId) {
    const card = EVENTS.find(e => e.id === cardId);
    return card?.immediateRoll === true;
}

/**
 * Get event card data by ID
 * @param {string} cardId - Event card ID
 * @returns {object|null}
 */
function getEventCardById(cardId) {
    return EVENTS.find(e => e.id === cardId) || null;
}

/**
 * Get player's current stat value for dice count
 * @param {string} playerId - Player ID
 * @param {string} stat - Stat name (speed, might, sanity, knowledge)
 * @returns {number}
 */
function getPlayerStatForDice(playerId, stat) {
    if (!currentGameState || !playerId || !stat) return 4; // default

    const player = currentGameState.players?.find(p => p.id === playerId);
    if (!player) return 4;

    const charData = currentGameState.playerState?.characterData?.[playerId];
    if (!charData || !charData.stats) {
        // Use starting index from character definition
        const char = CHARACTER_BY_ID[player.characterId];
        if (!char) return 4;
        return char.traits[stat]?.track[char.traits[stat]?.startIndex] || 4;
    }

    return getStatValue(player.characterId, stat, charData.stats[stat]);
}

/**
 * Open event dice modal for immediate roll event
 * @param {HTMLElement} mountEl
 * @param {string} cardId - Event card ID
 */
function openEventDiceModal(mountEl, cardId) {
    const card = getEventCardById(cardId);
    if (!card) {
        console.error('[EventDice] Card not found:', cardId);
        return;
    }

    const playerId = mySocketId;

    // Determine roll stat and dice count
    let rollStat = card.rollStat || card.rollStats?.[0];
    let diceCount = card.fixedDice || 0;

    // If not fixed dice, get from player stat
    if (!card.fixedDice && rollStat && typeof rollStat === 'string') {
        diceCount = getPlayerStatForDice(playerId, rollStat);
    }

    eventDiceModal = {
        isOpen: true,
        eventCard: card,
        rollStat: card.rollStat || card.rollStats,
        selectedStat: null,
        diceCount: diceCount,
        inputValue: '',
        result: null,
        resultsApplied: false,
        currentRollIndex: 0,
        allResults: [],
        pendingEffect: null,
    };

    console.log('[EventDice] Opened modal for:', card.name?.vi, 'rollStat:', rollStat, 'diceCount:', diceCount);
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Parse roll result range and check if result matches
 * @param {string} range - Range string like "4+", "1-3", "0"
 * @param {number} result - Dice result
 * @returns {boolean}
 */
function matchesRollRange(range, result) {
    if (!range) return false;

    // Handle "X+" format (X or higher)
    if (range.endsWith('+')) {
        const min = parseInt(range.slice(0, -1), 10);
        return result >= min;
    }

    // Handle "X-Y" format (range)
    if (range.includes('-')) {
        const [minStr, maxStr] = range.split('-');
        const min = parseInt(minStr, 10);
        const max = parseInt(maxStr, 10);
        return result >= min && result <= max;
    }

    // Handle single number
    const exact = parseInt(range, 10);
    return result === exact;
}

/**
 * Find matching outcome for dice result
 * @param {Array} rollResults - Array of roll result outcomes
 * @param {number} result - Dice result
 * @returns {object|null}
 */
function findMatchingOutcome(rollResults, result) {
    if (!rollResults || !Array.isArray(rollResults)) return null;

    for (const outcome of rollResults) {
        if (matchesRollRange(outcome.range, result)) {
            return outcome;
        }
    }

    return null;
}

/**
 * Open damage dice modal
 * @param {HTMLElement} mountEl
 * @param {number} physicalDice - Number of physical damage dice (0 if none)
 * @param {number} mentalDice - Number of mental damage dice (0 if none)
 */
function openDamageDiceModal(mountEl, physicalDice, mentalDice) {
    let damageType = 'both';
    let startPhase = 'rollPhysical'; // NEW: Start with rolling, not stat selection

    if (physicalDice > 0 && mentalDice === 0) {
        damageType = 'physical';
        startPhase = 'rollPhysical';
    } else if (physicalDice === 0 && mentalDice > 0) {
        damageType = 'mental';
        startPhase = 'rollMental';
    }

    damageDiceModal = {
        isOpen: true,
        damageType: damageType,
        physicalDice: physicalDice,
        mentalDice: mentalDice,
        inputValue: '',
        result: null,
        physicalResult: null,
        mentalResult: null,
        currentPhase: startPhase,
        // Stats are no longer selected here - will be distributed in damageDistributionModal
        selectedPhysicalStat: null,
        selectedMentalStat: null,
    };

    console.log('[DamageDice] Opened modal - physical:', physicalDice, 'mental:', mentalDice, 'startPhase:', startPhase);
    skipMapCentering = true;
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Open combat modal when player enters room with enemy
 * @param {HTMLElement} mountEl
 * @param {string} attackerId - Player initiating combat
 * @param {string} defenderId - Player being attacked
 * @param {{ direction: string; targetRoomId: string } | null} movement - Pending movement info (null if player already moved)
 * @param {boolean} isForced - If true, attack is forced (no skip option)
 */
function openCombatModal(mountEl, attackerId, defenderId, movement, isForced = false) {
    const attacker = currentGameState.players?.find(p => p.id === attackerId);
    const defender = currentGameState.players?.find(p => p.id === defenderId);

    if (!attacker || !defender) {
        console.error('[Combat] Player not found:', attackerId, defenderId);
        return;
    }

    const attackerName = getCharacterName(attacker.characterId);
    const defenderName = getCharacterName(defender.characterId);
    const defenderFaction = getFaction(currentGameState, defenderId);
    const defenderFactionLabel = getFactionLabel(defenderFaction);

    // Get Might stat for dice count
    const attackerMight = getCharacterMight(attacker.characterId,
        currentGameState.playerState?.characterData?.[attackerId]);
    const defenderMight = getCharacterMight(defender.characterId,
        currentGameState.playerState?.characterData?.[defenderId]);

    combatModal = {
        isOpen: true,
        phase: 'confirm',
        attackerId: attackerId,
        defenderId: defenderId,
        attackerName: attackerName,
        defenderName: defenderName,
        defenderFactionLabel: defenderFactionLabel,
        attackStat: 'might',
        attackerDiceCount: attackerMight,
        defenderDiceCount: defenderMight,
        attackerRoll: null,
        defenderRoll: null,
        inputValue: '',
        winner: null,
        damage: 0,
        loserId: null,
        isForced: isForced
    };

    // Store pending movement to resume after combat
    pendingCombatMovement = movement;

    console.log('[Combat] Opened modal - attacker:', attackerName, 'defender:', defenderName);
    skipMapCentering = true;

    // Sync combat state to server immediately so other players see it
    // and to prevent the onGameState handler from closing this modal
        currentGameState.combatState = {
        isActive: true,
        phase: 'confirm',
        attackerId: attackerId,
        defenderId: defenderId,
        attackerRoll: null,
        defenderRoll: null,
        winner: null,
        damage: 0,
        loserId: null,
        isForced: isForced
        };
        syncGameStateToServer();

    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Close combat modal and handle results
 * @param {HTMLElement} mountEl
 * @param {boolean} attackerLost - If true, attacker lost and loses their turn
 * @param {object} resultInfo - Combat result info for notification (optional)
 */
function closeCombatModal(mountEl, attackerLost = false, resultInfo = null) {
    const wasAttacker = combatModal?.attackerId === mySocketId;
    const attackerId = combatModal?.attackerId;
    const defenderId = combatModal?.defenderId;
    const movement = pendingCombatMovement;

    // Store result info for notification before clearing modal
    const combatResult = resultInfo || (combatModal ? {
        attackerName: combatModal.attackerName,
        defenderName: combatModal.defenderName,
        attackerRoll: combatModal.attackerRoll,
        defenderRoll: combatModal.defenderRoll,
        winner: combatModal.winner,
        damage: combatModal.damage
    } : null);

    // Mark combat as completed so it won't trigger again in the same room
    // Combat will only trigger again when one player leaves and re-enters
    console.log('[Combat] closeCombatModal - attackerId:', attackerId, 'defenderId:', defenderId, 'currentGameState:', !!currentGameState);
    if (attackerId && defenderId && currentGameState) {
        const playerPositions = currentGameState.playerState?.playerPositions || {};
        const combatRoomId = playerPositions[attackerId] || playerPositions[defenderId];
        console.log('[Combat] closeCombatModal - combatRoomId:', combatRoomId);
        if (combatRoomId) {
            markCombatCompleted(combatRoomId, attackerId, defenderId);
        }
    } else {
        console.log('[Combat] closeCombatModal - NOT calling markCombatCompleted due to missing data');
    }

    combatModal = null;
    pendingCombatMovement = null;

    // If attacker lost, they lose their turn
    if (attackerLost && currentGameState && attackerId) {
        // Set attacker's moves to 0
        currentGameState.playerMoves[attackerId] = 0;

        // Advance to next player's turn if attacker's turn
        const currentTurnPlayer = currentGameState.turnOrder[currentGameState.currentTurnIndex];
        if (currentTurnPlayer === attackerId) {
            console.log('[Combat] Attacker lost - advancing turn');
            advanceToNextTurn();
        }
    }

    // Set combat result for notification (sync to all players)
    if (combatResult && currentGameState) {
        currentGameState.combatResult = combatResult;
    }

    // Sync combat state clear to server
    if (currentGameState) {
        currentGameState.combatState = null;
        syncGameStateToServer();
    }

    // Show combat result notification
    if (combatResult) {
        showCombatResultNotification(mountEl, combatResult);
    }

    // If attacker won or tie, resume movement
    if (!attackerLost && wasAttacker && movement) {
        // Resume the movement that was interrupted
        handleMoveAfterCombat(mountEl, movement.direction, movement.targetRoomId);
    } else {
        // Check if current player's turn should end (moves depleted)
        if (currentGameState) {
            const currentTurnPlayer = currentGameState.turnOrder[currentGameState.currentTurnIndex];
            const currentPlayerMoves = currentGameState.playerMoves[currentTurnPlayer] || 0;

            if (currentPlayerMoves <= 0) {
                console.log('[Combat] Current player has 0 moves after combat, advancing turn');
                advanceToNextTurn();
                syncGameStateToServer();
            }
        }

        updateGameUI(mountEl, currentGameState, mySocketId);
    }
}

/**
 * Show combat result notification to all players
 * @param {HTMLElement} mountEl
 * @param {object} result - Combat result info
 */
function showCombatResultNotification(mountEl, result) {
    // Remove existing notification if any
    const existing = document.querySelector('.combat-result-notification');
    if (existing) existing.remove();

    const { attackerName, defenderName, attackerRoll, defenderRoll, winner, damage } = result;

    let resultText = '';
    let resultClass = '';

    if (winner === 'tie') {
        resultText = 'HOA! Khong ai chiu sat thuong.';
        resultClass = 'combat-result-notification--tie';
    } else if (winner === 'attacker') {
        resultText = `${attackerName} tan cong thanh cong! ${defenderName} chiu ${damage} sat thuong.`;
        resultClass = 'combat-result-notification--attacker';
    } else {
        resultText = `${defenderName} phan don thanh cong! ${attackerName} chiu ${damage} sat thuong va mat luot.`;
        resultClass = 'combat-result-notification--defender';
    }

    const notification = document.createElement('div');
    notification.className = `combat-result-notification ${resultClass}`;
    notification.innerHTML = `
        <div class="combat-result-notification__content">
            <div class="combat-result-notification__header">KET QUA CHIEN DAU</div>
            <div class="combat-result-notification__scores">
                <span class="combat-result-notification__score">${attackerName}: ${attackerRoll ?? '?'}</span>
                <span class="combat-result-notification__vs">VS</span>
                <span class="combat-result-notification__score">${defenderName}: ${defenderRoll ?? '?'}</span>
            </div>
            <div class="combat-result-notification__result">${resultText}</div>
            <button class="combat-result-notification__btn" type="button" data-action="close-combat-result">OK</button>
        </div>
    `;

    document.body.appendChild(notification);

    // Handle close button
    notification.querySelector('[data-action="close-combat-result"]')?.addEventListener('click', () => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
            // Clear combat result from state
            if (currentGameState) {
                currentGameState.combatResult = null;
            }
        }, 300);
    });

    // Auto-close after 8 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                notification.remove();
                if (currentGameState) {
                    currentGameState.combatResult = null;
                }
            }, 300);
        }
    }, 8000);
}

/**
 * Resume movement after combat (for attacker who won or tied)
 * @param {HTMLElement} mountEl
 * @param {string} direction
 * @param {string} targetRoomId
 */
function handleMoveAfterCombat(mountEl, direction, targetRoomId) {
    if (!currentGameState || !mySocketId) return;

    const playerId = mySocketId;

    // Get current room before moving
    const currentRoomId = currentGameState.playerState?.playerPositions?.[playerId];

    // Clear completed combat flag when leaving current room
    if (currentRoomId) {
        clearCompletedCombatForPlayer(playerId, currentRoomId);
    }

    // Move player to target room
    if (!currentGameState.playerState.playerPositions) {
        currentGameState.playerState.playerPositions = {};
    }
    currentGameState.playerState.playerPositions[playerId] = targetRoomId;

    // Consume 1 move
    if (currentGameState.playerMoves[playerId] > 0) {
        currentGameState.playerMoves[playerId]--;
    }

    // Check for room tokens
    const revealedRooms = currentGameState.map?.revealedRooms || {};
    const targetRoom = revealedRooms[targetRoomId];

    if (targetRoom && targetRoom.tokens && targetRoom.tokens.length > 0) {
        if (!currentGameState.playerState.drawnRooms) {
            currentGameState.playerState.drawnRooms = [];
        }
        if (!currentGameState.playerState.drawnRooms.includes(targetRoomId)) {
            currentGameState.playerState.drawnRooms.push(targetRoomId);
            initTokenDrawing(mountEl, targetRoom.tokens);
            syncGameStateToServer();
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }
    }

    syncGameStateToServer();
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Open damage distribution modal - for distributing combat/event damage across stats
 * @param {HTMLElement} mountEl
 * @param {number} totalDamage - Total damage to distribute
 * @param {'combat' | 'event'} source - Source of damage
 * @param {'physical' | 'mental' | null} preselectedType - If type is already known (skip selection)
 */
function openDamageDistributionModal(mountEl, totalDamage, source, preselectedType = null) {
    damageDistributionModal = {
        isOpen: true,
        totalDamage: totalDamage,
        damageType: preselectedType,
        stat1: null,
        stat2: null,
        stat1Damage: 0,
        stat2Damage: 0,
        source: source
    };

    // If type preselected, set the stats
    if (preselectedType === 'physical') {
        damageDistributionModal.stat1 = 'speed';
        damageDistributionModal.stat2 = 'might';
    } else if (preselectedType === 'mental') {
        damageDistributionModal.stat1 = 'sanity';
        damageDistributionModal.stat2 = 'knowledge';
    }

    console.log('[DamageDistribution] Opened modal - damage:', totalDamage, 'type:', preselectedType);
    skipMapCentering = true;
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Open event result notification modal
 * @param {HTMLElement} mountEl
 * @param {string} title - Modal title
 * @param {string} message - Result message
 * @param {'success' | 'neutral' | 'danger'} type - Type for styling
 */
function openEventResultModal(mountEl, title, message, type = 'neutral') {
    eventResultModal = {
        isOpen: true,
        title: title,
        message: message,
        type: type
    };
    console.log('[EventResult] Opened modal -', title, message);
    skipMapCentering = true;
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Close event result notification modal
 * @param {HTMLElement} mountEl
 */
function closeEventResultModal(mountEl) {
    eventResultModal = null;

    const playerId = mySocketId;

    // Check if turn ended (no more moves) - advance to next player
    if (currentGameState && currentGameState.playerMoves[playerId] <= 0) {
        console.log('[Turn] Player', playerId, 'moves depleted after event result, advancing turn');
        advanceToNextTurn();
    }

    updateGameUI(mountEl, currentGameState, mySocketId);
    syncGameStateToServer();
}

/**
 * Close damage distribution modal and apply damage
 * @param {HTMLElement} mountEl
 */
function closeDamageDistributionModal(mountEl) {
    if (!damageDistributionModal) return;

    const { stat1, stat2, stat1Damage, stat2Damage } = damageDistributionModal;
    const playerId = mySocketId;

    // Apply damage to stats
    if (stat1Damage > 0 && stat1) {
        applyStatChange(playerId, stat1, -stat1Damage);
        console.log(`[DamageDistribution] Applied ${stat1Damage} damage to ${stat1}`);
    }
    if (stat2Damage > 0 && stat2) {
        applyStatChange(playerId, stat2, -stat2Damage);
        console.log(`[DamageDistribution] Applied ${stat2Damage} damage to ${stat2}`);
    }

    damageDistributionModal = null;

    // Check for death AFTER applying damage
    const died = checkPlayerDeath(mountEl, playerId);

    // Sync to server
    syncGameStateToServer();

    // Check if there's pending mental damage to distribute (after physical damage was done)
    if (!died && pendingMentalDamage !== null && pendingMentalDamage > 0) {
        const mentalDamage = pendingMentalDamage;
        pendingMentalDamage = null; // Clear pending
        console.log('[DamageDistribution] Opening modal for pending mental damage:', mentalDamage);
        openDamageDistributionModal(mountEl, mentalDamage, 'event', 'mental');
        return; // Don't update UI yet, let the new modal handle it
    }

    pendingMentalDamage = null; // Clear any pending

    if (!died) {
        updateGameUI(mountEl, currentGameState, mySocketId);
    }
}

/**
 * Check if a player is dead (any stat at 0 after receiving damage)
 * Death only applies when haunt has been triggered
 * @param {HTMLElement} mountEl
 * @param {string} playerId
 * @returns {boolean} - true if player died
 */
function checkPlayerDeath(mountEl, playerId) {
    if (!currentGameState || !isHauntTriggered(currentGameState)) {
        return false; // No death before haunt
    }

    const charData = currentGameState.playerState?.characterData?.[playerId];
    if (!charData || !charData.stats) {
        return false;
    }

    // Check if any stat is at 0
    const stats = charData.stats;
    const isDead = stats.speed === 0 || stats.might === 0 ||
                   stats.sanity === 0 || stats.knowledge === 0;

    if (isDead && !charData.isDead) {
        // Mark player as dead
        charData.isDead = true;

        const player = currentGameState.players?.find(p => p.id === playerId);
        const characterName = getCharacterName(player?.characterId);
        const faction = getFaction(currentGameState, playerId);

        console.log('[Death] Player died:', playerId, characterName, 'faction:', faction);

        // Sync death to server
        syncGameStateToServer();

        // Check win condition
        checkWinCondition(mountEl);
        return true;
    }

    return false;
}

/**
 * Check win conditions and show victory modal if game is over
 * Win conditions:
 * - Traitor wins: All survivors are dead
 * - Survivors win: Traitor is dead
 * @param {HTMLElement} mountEl
 */
function checkWinCondition(mountEl) {
    if (!currentGameState || !isHauntTriggered(currentGameState)) {
        return;
    }

    const traitorId = currentGameState.hauntState?.traitorId;
    if (!traitorId) return; // No traitor assigned yet

    // Check if traitor is dead
    const traitorData = currentGameState.playerState?.characterData?.[traitorId];
    const traitorIsDead = traitorData?.isDead === true;

    // Check if all survivors are dead
    const survivors = currentGameState.players?.filter(p =>
        getFaction(currentGameState, p.id) === 'survivor'
    ) || [];

    const aliveSurvivors = survivors.filter(p => {
        const charData = currentGameState.playerState?.characterData?.[p.id];
        return charData?.isDead !== true;
    });

    let winnerFaction = null;

    if (traitorIsDead) {
        winnerFaction = 'survivor';
        console.log('[Victory] Survivors win! Traitor is dead.');
    } else if (aliveSurvivors.length === 0) {
        winnerFaction = 'traitor';
        console.log('[Victory] Traitor wins! All survivors are dead.');
    }

    if (winnerFaction) {
        // Collect dead players for display
        const deadPlayers = currentGameState.players?.filter(p => {
            const charData = currentGameState.playerState?.characterData?.[p.id];
            return charData?.isDead === true;
        }).map(p => ({
            id: p.id,
            name: getCharacterName(p.characterId),
            faction: getFaction(currentGameState, p.id)
        })) || [];

        // Set game over state
        currentGameState.gameOver = {
            winner: winnerFaction,
            deadPlayers: deadPlayers
        };

        // Sync to server for multiplayer
        syncGameStateToServer();

        // Show victory modal
        showVictoryModal(mountEl, winnerFaction, deadPlayers);
    }
}

/**
 * Show victory modal when game ends
 * @param {HTMLElement} mountEl
 * @param {'traitor' | 'survivor'} winnerFaction
 * @param {Array<{id: string, name: string, faction: string}>} deadPlayers
 */
function showVictoryModal(mountEl, winnerFaction, deadPlayers) {
    // Remove existing modal if any
    const existing = document.querySelector('.victory-overlay');
    if (existing) existing.remove();

    const isTraitorWin = winnerFaction === 'traitor';
    const myFaction = getFaction(currentGameState, mySocketId);
    const didIWin = myFaction === winnerFaction;

    const headerText = isTraitorWin ? 'KE PHAN BOI THANG!' : 'NGUOI SONG SOT THANG!';
    const subText = didIWin ? 'Chuc mung! Ban da CHIEN THANG!' : 'Ban da THAT BAI...';

    const deadListHtml = deadPlayers.length > 0
        ? `
            <div class="victory-modal__dead-list">
                <h4>Nhung nguoi da nga:</h4>
                <ul>
                    ${deadPlayers.map(p => `
                        <li class="victory-modal__dead-player victory-modal__dead-player--${p.faction}">
                            ${p.name} <span class="victory-modal__faction">(${getFactionLabel(p.faction)})</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `
        : '';

    const modal = document.createElement('div');
    modal.className = `victory-overlay victory-overlay--${winnerFaction}`;
    modal.innerHTML = `
        <div class="victory-modal victory-modal--${winnerFaction}">
            <div class="victory-modal__icon">${isTraitorWin ? '💀' : '🏆'}</div>
            <h2 class="victory-modal__title victory-modal__title--${winnerFaction}">${headerText}</h2>
            <p class="victory-modal__subtitle victory-modal__subtitle--${didIWin ? 'win' : 'lose'}">${subText}</p>
            ${deadListHtml}
            <button class="victory-modal__btn action-button" type="button" data-action="victory-close">
                Ve Trang Chu
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // Handle close button
    modal.querySelector('[data-action="victory-close"]')?.addEventListener('click', () => {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            modal.remove();
            // Navigate to home
            window.location.hash = '#/';
        }, 300);
    });
}

/**
 * Calculate combat result
 * @param {number} attackerRoll
 * @param {number} defenderRoll
 * @returns {{ winner: 'attacker' | 'defender' | 'tie'; damage: number; loserId: string | null }}
 */
function calculateCombatResult(attackerRoll, defenderRoll) {
    if (!combatModal) return { winner: 'tie', damage: 0, loserId: null };

    if (attackerRoll > defenderRoll) {
        return {
            winner: 'attacker',
            damage: attackerRoll - defenderRoll,
            loserId: combatModal.defenderId
        };
    } else if (defenderRoll > attackerRoll) {
        return {
            winner: 'defender',
            damage: defenderRoll - attackerRoll,
            loserId: combatModal.attackerId
        };
    } else {
        return { winner: 'tie', damage: 0, loserId: null };
    }
}

/**
 * Generate a unique key for tracking completed combats
 * @param {string} roomId - Room where combat occurred
 * @param {string} playerId1 - First player ID
 * @param {string} playerId2 - Second player ID
 * @returns {string} Unique combat key
 */
function getCombatKey(roomId, playerId1, playerId2) {
    // Sort player IDs to ensure consistent key regardless of who is attacker/defender
    const sortedIds = [playerId1, playerId2].sort();
    return `${roomId}:${sortedIds[0]}:${sortedIds[1]}`;
}

/**
 * Check if combat was already completed between two players in a room
 * @param {string} roomId - Room ID
 * @param {string} playerId1 - First player ID
 * @param {string} playerId2 - Second player ID
 * @returns {boolean} True if combat was already completed
 */
function isCombatCompleted(roomId, playerId1, playerId2) {
    const key = getCombatKey(roomId, playerId1, playerId2);
    return completedCombats.has(key);
}

/**
 * Mark combat as completed between two players in a room
 * @param {string} roomId - Room ID
 * @param {string} playerId1 - First player ID
 * @param {string} playerId2 - Second player ID
 */
function markCombatCompleted(roomId, playerId1, playerId2) {
    const key = getCombatKey(roomId, playerId1, playerId2);
    completedCombats.set(key, true);
    console.log('[Combat] Marked combat as completed:', key);

    // Mark that this player has attacked this turn (cannot attack again)
    // Only the current turn player gets flagged
    if (currentGameState) {
        const currentTurnPlayer = currentGameState.turnOrder?.[currentGameState.currentTurnIndex];
        console.log('[Combat] markCombatCompleted - playerId1:', playerId1, 'playerId2:', playerId2, 'currentTurnPlayer:', currentTurnPlayer);
        if (playerId1 === currentTurnPlayer || playerId2 === currentTurnPlayer) {
            hasAttackedThisTurn = true;
            console.log('[Combat] hasAttackedThisTurn SET TO TRUE - player cannot attack again this turn');
        } else {
            console.log('[Combat] markCombatCompleted - neither player is current turn player, NOT setting hasAttackedThisTurn');
        }
    } else {
        console.log('[Combat] markCombatCompleted - no currentGameState, NOT setting hasAttackedThisTurn');
    }
}

/**
 * Clear completed combat flags for a player leaving a room
 * This allows combat to trigger again when they re-enter
 * @param {string} playerId - Player who is leaving
 * @param {string} roomId - Room they are leaving
 */
function clearCompletedCombatForPlayer(playerId, roomId) {
    // Remove all combat keys involving this player and room
    for (const key of completedCombats.keys()) {
        if (key.startsWith(`${roomId}:`) && key.includes(playerId)) {
            completedCombats.delete(key);
            console.log('[Combat] Cleared completed combat flag:', key);
        }
    }
}

/**
 * Get enemy player in a specific room (if any)
 * @param {string} roomId - Target room ID
 * @param {string} currentPlayerId - The player moving (excluded from check)
 * @returns {object|null} Enemy player object or null
 */
function getEnemyInRoom(roomId, currentPlayerId) {
    if (!currentGameState || !isHauntTriggered(currentGameState)) {
        console.log('[Combat] getEnemyInRoom - haunt not triggered or no state');
        return null;
    }

    // Check if current player already attacked this turn (1 attack per turn rule)
    const currentTurnPlayer = currentGameState.turnOrder?.[currentGameState.currentTurnIndex];
    console.log('[Combat] getEnemyInRoom - hasAttackedThisTurn:', hasAttackedThisTurn, 'currentPlayerId:', currentPlayerId, 'currentTurnPlayer:', currentTurnPlayer);

    if (hasAttackedThisTurn) {
        if (currentPlayerId === currentTurnPlayer) {
            console.log('[Combat] getEnemyInRoom - already attacked this turn, BLOCKING combat');
            return null;
        }
    }

    const playerPositions = currentGameState.playerState?.playerPositions || {};
    console.log('[Combat] getEnemyInRoom - checking roomId:', roomId, 'positions:', playerPositions);

    // Find players in the target room (excluding current player)
    for (const player of currentGameState.players || []) {
        if (player.id === currentPlayerId) continue;

        const playerRoomId = playerPositions[player.id];
        console.log('[Combat] Player', player.id, 'is at', playerRoomId, 'target:', roomId, 'match:', playerRoomId === roomId);
        if (playerRoomId === roomId) {
            // Check if this player is an enemy
            const isEnemyPlayer = isEnemy(currentGameState, currentPlayerId, player.id);
            console.log('[Combat] Found player in room, isEnemy:', isEnemyPlayer);
            if (isEnemyPlayer) {
                // Check if combat was already completed between these players in this room
                if (isCombatCompleted(roomId, currentPlayerId, player.id)) {
                    console.log('[Combat] Combat already completed in this room, skipping');
                    continue; // Skip this enemy, combat already done
                }
                return player;
            }
        }
    }

    return null;
}

/**
 * Map server combat phase to local modal phase
 * @param {string} serverPhase - Server phase ('waiting_attacker', 'waiting_defender', 'result')
 * @param {boolean} isDefender - Whether current player is the defender
 * @returns {string} Local phase for combat modal
 */
function mapServerPhaseToLocal(serverPhase, isDefender) {
    switch (serverPhase) {
        case 'waiting_attacker':
            return isDefender ? 'waiting_defender' : 'attacker_roll';
        case 'waiting_defender':
            return isDefender ? 'defender_roll' : 'waiting_defender';
        case 'result':
            return 'result';
        default:
            return 'confirm';
    }
}

/**
 * Open room effect dice modal
 * @param {HTMLElement} mountEl
 * @param {string} roomName - Room English name
 * @param {object} pendingMovement - Movement info to resume after roll
 */
function openRoomEffectDiceModal(mountEl, roomName, pendingMovement) {
    const roomEffect = ROOM_EFFECTS[roomName];
    if (!roomEffect) {
        console.error('[RoomEffect] No effect found for room:', roomName);
        return;
    }

    const playerId = mySocketId;
    const diceCount = getPlayerStatForDice(playerId, roomEffect.rollStat);

    roomEffectDiceModal = {
        isOpen: true,
        roomName: roomName,
        roomEffect: roomEffect,
        diceCount: diceCount,
        inputValue: '',
        result: null,
        resultsApplied: false,
        pendingMovement: pendingMovement
    };

    console.log('[RoomEffect] Opened modal for:', roomName, 'stat:', roomEffect.rollStat, 'diceCount:', diceCount);
    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Apply room effect dice result
 * @param {HTMLElement} mountEl
 * @param {number} result - Dice result
 */
function applyRoomEffectDiceResult(mountEl, result) {
    if (!roomEffectDiceModal || !roomEffectDiceModal.roomEffect) return;

    const { roomEffect, pendingMovement, roomName } = roomEffectDiceModal;
    const isSuccess = result >= roomEffect.target;
    const playerId = mySocketId;

    console.log('[RoomEffect] Result:', result, 'Target:', roomEffect.target, 'Success:', isSuccess);

    if (isSuccess) {
        // Success - close modal and resume movement
        roomEffectDiceModal = null;
        continueMovementAfterRoomEffect(mountEl, pendingMovement, true, roomName);
    } else {
        // Fail - apply consequences
        const failEffect = roomEffect.failEffect;

        switch (failEffect.type) {
            case 'stopMoving':
                // Player stops - consume remaining moves and advance turn
                currentGameState.playerMoves[playerId] = 0;
                showToast(`That bai! Ban dung lai o ${roomName}.`, 'error');
                roomEffectDiceModal = null;
                console.log('[Turn] Player', playerId, 'failed room effect, advancing turn');
                advanceToNextTurn();
                syncGameStateToServer();
                updateGameUI(mountEl, currentGameState, mySocketId);
                break;

            case 'statLoss':
                applyStatChange(playerId, failEffect.stat, -failEffect.amount);
                showToast(`That bai! Mat ${failEffect.amount} ${failEffect.stat}.`, 'error');
                roomEffectDiceModal = null;
                // Continue moving if continueOnFail is true
                if (roomEffect.continueOnFail) {
                    continueMovementAfterRoomEffect(mountEl, pendingMovement, false, roomName);
                } else {
                    updateGameUI(mountEl, currentGameState, mySocketId);
                    // Sync stat loss to server for multiplayer
                    syncGameStateToServer();
                }
                break;

            case 'fallToBasement':
                // Special case: Collapsed Room - for now just show message and stop
                showToast(`That bai! Ban roi xuong tang ham va chiu ${failEffect.dice} dice physical damage.`, 'error');
                roomEffectDiceModal = null;
                // Open damage modal for physical damage
                openDamageDiceModal(mountEl, failEffect.dice, 0);
                break;

            default:
                roomEffectDiceModal = null;
                updateGameUI(mountEl, currentGameState, mySocketId);
        }
    }
}

/**
 * Continue movement after room effect roll
 * @param {HTMLElement} mountEl
 * @param {object} pendingMovement
 * @param {boolean} rollSuccess
 * @param {string} roomName - Room that was checked
 */
function continueMovementAfterRoomEffect(mountEl, pendingMovement, rollSuccess, roomName) {
    if (!pendingMovement) {
        updateGameUI(mountEl, currentGameState, mySocketId);
        return;
    }

    const playerId = mySocketId;

    // Mark this room+trigger as rolled for this turn
    if (!currentGameState.playerState) {
        currentGameState.playerState = {};
    }
    if (!currentGameState.playerState.roomEffectRolls) {
        currentGameState.playerState.roomEffectRolls = {};
    }
    if (!currentGameState.playerState.roomEffectRolls[playerId]) {
        currentGameState.playerState.roomEffectRolls[playerId] = [];
    }

    const roomEffect = ROOM_EFFECTS[roomName];
    const rollKey = `${roomName}_${roomEffect?.trigger || 'enter'}`;
    if (!currentGameState.playerState.roomEffectRolls[playerId].includes(rollKey)) {
        currentGameState.playerState.roomEffectRolls[playerId].push(rollKey);
    }

    console.log('[RoomEffect] Continuing movement after roll, success:', rollSuccess);

    // Re-trigger movement in the same direction
    const { direction } = pendingMovement;
    handleDebugMovement(mountEl, direction);
}

/**
 * Get room effect if exists
 * @param {string} roomName - Room name
 * @param {'enter' | 'exit'} trigger - Trigger type
 * @returns {object | null}
 */
function getRoomEffect(roomName, trigger) {
    const effect = ROOM_EFFECTS[roomName];
    if (!effect) return null;
    if (effect.trigger === trigger) return effect;
    return null;
}

/**
 * Check if player needs to roll for room effect
 * @param {string} roomName - Room name
 * @param {'enter' | 'exit'} trigger - Trigger type
 * @param {string} playerId - Player ID
 * @returns {boolean}
 */
function needsRoomEffectRoll(roomName, trigger, playerId) {
    const effect = getRoomEffect(roomName, trigger);
    if (!effect) return false;

    // Check if player already rolled for this room this turn
    const rolledRooms = currentGameState?.playerState?.roomEffectRolls?.[playerId] || [];
    const rollKey = `${roomName}_${trigger}`;

    return !rolledRooms.includes(rollKey);
}

/**
 * Apply stat change to player
 * @param {string} playerId - Player ID
 * @param {string} stat - Stat name
 * @param {number} amount - Amount to change (positive to gain, negative to lose)
 */
function applyStatChange(playerId, stat, amount) {
    if (!currentGameState || !playerId || !stat) return;

    const player = currentGameState.players?.find(p => p.id === playerId);
    if (!player) {
        console.warn(`[StatChange] Player not found: ${playerId}`);
        return;
    }

    // Initialize playerState if needed
    if (!currentGameState.playerState) {
        currentGameState.playerState = {};
    }

    // Initialize characterData if needed
    if (!currentGameState.playerState.characterData) {
        currentGameState.playerState.characterData = {};
    }

    if (!currentGameState.playerState.characterData[playerId]) {
        const char = CHARACTER_BY_ID[player.characterId];
        if (!char || !char.traits) {
            console.warn(`[StatChange] Character data not found for: ${player.characterId}`);
            // Use default values if character not found
            currentGameState.playerState.characterData[playerId] = {
                characterId: player.characterId,
                stats: { speed: 3, might: 3, sanity: 3, knowledge: 3 }
            };
        } else {
            currentGameState.playerState.characterData[playerId] = {
                characterId: player.characterId,
                stats: {
                    speed: char.traits.speed?.startIndex ?? 3,
                    might: char.traits.might?.startIndex ?? 3,
                    sanity: char.traits.sanity?.startIndex ?? 3,
                    knowledge: char.traits.knowledge?.startIndex ?? 3,
                }
            };
        }
    }

    const charData = currentGameState.playerState.characterData[playerId];
    if (!charData || !charData.stats) {
        console.warn(`[StatChange] Character data invalid for player: ${playerId}`);
        return;
    }

    const currentIndex = charData.stats[stat] ?? 0;
    const newIndex = Math.max(0, Math.min(7, currentIndex + amount));
    charData.stats[stat] = newIndex;

    console.log(`[StatChange] Player ${playerId} ${stat}: ${currentIndex} -> ${newIndex} (${amount > 0 ? '+' : ''}${amount})`);
}

/**
 * Destination name mapping from event data (snake_case) to room names
 */
const DESTINATION_TO_ROOM_NAME = {
    'entrance_hall': 'Entrance Hall',
    'foyer': 'Foyer',
    'grand_staircase': 'Grand Staircase',
    'chapel': 'Chapel',
    'graveyard': 'Graveyard',
    'patio': 'Patio',
    'gardens': 'Gardens',
    'tower': 'Tower',
    'balcony': 'Balcony',
    'basement_landing': 'Basement Landing',
};

/**
 * Find room ID by destination name (from event card data)
 * @param {string} destination - Destination name from event (e.g., 'entrance_hall')
 * @returns {string|null} - Room ID if found, null otherwise
 */
function findRoomIdByDestination(destination) {
    if (!currentGameState?.map?.revealedRooms) {
        console.warn('[findRoomIdByDestination] No revealed rooms in game state');
        return null;
    }

    const revealedRooms = currentGameState.map.revealedRooms;
    const targetRoomName = DESTINATION_TO_ROOM_NAME[destination];

    if (!targetRoomName) {
        console.warn('[findRoomIdByDestination] Unknown destination:', destination);
        return null;
    }

    // Search for room by name (supports both English name and Vietnamese name with English in parentheses)
    for (const [roomId, room] of Object.entries(revealedRooms)) {
        if (room.name === targetRoomName ||
            room.name?.includes(`(${targetRoomName})`) ||
            room.name?.en === targetRoomName) {
            console.log(`[findRoomIdByDestination] Found ${destination} at room ID: ${roomId}`);
            return roomId;
        }
    }

    console.warn(`[findRoomIdByDestination] Room not found for destination: ${destination} (${targetRoomName})`);
    return null;
}

/**
 * Get all adjacent room IDs from current room (connected via doors)
 * @param {string} currentRoomId - Current room ID
 * @returns {string[]} Array of adjacent room IDs
 */
function getAdjacentRoomIds(currentRoomId) {
    if (!currentGameState?.map?.revealedRooms) return [];

    const revealedRooms = currentGameState.map.revealedRooms;
    const currentRoom = revealedRooms[currentRoomId];
    if (!currentRoom || !currentRoom.doors) return [];

    const directionOffsets = {
        'north': { x: 0, y: 1 },
        'south': { x: 0, y: -1 },
        'east': { x: 1, y: 0 },
        'west': { x: -1, y: 0 }
    };

    const adjacentRoomIds = [];

    for (const doorDir of currentRoom.doors) {
        const offset = directionOffsets[doorDir];
        if (!offset) continue;

        const adjacentX = currentRoom.x + offset.x;
        const adjacentY = currentRoom.y + offset.y;

        // Find room at adjacent position
        for (const [roomId, room] of Object.entries(revealedRooms)) {
            if (room.x === adjacentX && room.y === adjacentY && room.floor === currentRoom.floor) {
                adjacentRoomIds.push(roomId);
                break;
            }
        }
    }

    return adjacentRoomIds;
}

/**
 * Get players in a specific room
 * @param {string} roomId - Room ID
 * @param {string} excludePlayerId - Player ID to exclude (optional)
 * @returns {Object[]} Array of player objects in the room
 */
function getPlayersInRoom(roomId, excludePlayerId = null) {
    if (!currentGameState?.players || !currentGameState?.playerState?.playerPositions) return [];

    const playerPositions = currentGameState.playerState.playerPositions;

    return currentGameState.players.filter(player => {
        if (excludePlayerId && player.id === excludePlayerId) return false;
        return playerPositions[player.id] === roomId;
    });
}

/**
 * Find player with lowest Might in adjacent rooms
 * @param {string} currentPlayerId - Current player ID
 * @returns {{ player: Object, roomId: string } | null} Player with lowest Might and their room ID
 */
function findAdjacentPlayerWithLowestMight(currentPlayerId) {
    const playerPositions = currentGameState?.playerState?.playerPositions;
    if (!playerPositions) return null;

    const currentRoomId = playerPositions[currentPlayerId];
    if (!currentRoomId) return null;

    const adjacentRoomIds = getAdjacentRoomIds(currentRoomId);

    let lowestMightPlayer = null;
    let lowestMight = Infinity;
    let targetRoomId = null;

    for (const roomId of adjacentRoomIds) {
        const playersInRoom = getPlayersInRoom(roomId, currentPlayerId);

        for (const player of playersInRoom) {
            const playerMight = getCharacterMight(
                player.characterId,
                currentGameState.playerState?.characterData?.[player.id]
            );

            if (playerMight < lowestMight) {
                lowestMight = playerMight;
                lowestMightPlayer = player;
                targetRoomId = roomId;
            }
        }
    }

    if (lowestMightPlayer) {
        return { player: lowestMightPlayer, roomId: targetRoomId };
    }

    return null;
}

/**
 * Execute forced attack - move to adjacent room and attack target
 * @param {HTMLElement} mountEl
 * @param {string} attackerId - Attacker player ID
 * @param {string} targetType - Target type ('adjacentLowestMight', 'rightPlayer', etc.)
 */
function executeForcedAttack(mountEl, attackerId, targetType) {
    let target = null;

    if (targetType === 'adjacentLowestMight') {
        target = findAdjacentPlayerWithLowestMight(attackerId);
    }
    // Add more target types as needed

    if (!target) {
        // No valid target found
        openEventResultModal(
            mountEl,
            'KHÔNG CÓ MỤC TIÊU',
            'Không có người chơi nào ở phòng liền kề để tấn công.',
            'neutral'
        );
        return;
    }

    const { player: targetPlayer, roomId: targetRoomId } = target;

    // Move attacker to target room
    if (!currentGameState.playerState.playerPositions) {
        currentGameState.playerState.playerPositions = {};
    }
    currentGameState.playerState.playerPositions[attackerId] = targetRoomId;

    console.log(`[ForcedAttack] Moving ${attackerId} to room ${targetRoomId} to attack ${targetPlayer.id}`);

    // Sync movement
    syncGameStateToServer();
    renderGameScreen(currentGameState, mySocketId);

    // Open combat modal - no pending movement since we already moved, isForced = true
    openCombatModal(mountEl, attackerId, targetPlayer.id, null, true);
}

/**
 * Apply multiple stat changes
 * @param {string} playerId - Player ID
 * @param {object} stats - Object with stat names as keys and amounts as values
 */
function applyMultipleStatChanges(playerId, stats) {
    if (!stats) return;
    for (const [stat, amount] of Object.entries(stats)) {
        applyStatChange(playerId, stat, -amount); // negative because "lose" means subtract
    }
}

/**
 * Apply damage to player (reduces physical or mental stats)
 * @param {string} playerId - Player ID
 * @param {number} physicalDamage - Physical damage amount
 * @param {number} mentalDamage - Mental damage amount
 * @param {string} [physicalStat] - Selected physical stat ('speed' or 'might')
 * @param {string} [mentalStat] - Selected mental stat ('knowledge' or 'sanity')
 */
function applyDamageToPlayer(playerId, physicalDamage, mentalDamage, physicalStat, mentalStat) {
    // Physical damage reduces the selected stat (Speed or Might)
    if (physicalDamage > 0 && physicalStat) {
        applyStatChange(playerId, physicalStat, -physicalDamage);
        console.log(`[Damage] Physical ${physicalDamage} applied to ${physicalStat}`);
    }

    // Mental damage reduces the selected stat (Knowledge or Sanity)
    if (mentalDamage > 0 && mentalStat) {
        applyStatChange(playerId, mentalStat, -mentalDamage);
        console.log(`[Damage] Mental ${mentalDamage} applied to ${mentalStat}`);
    }

    console.log(`[Damage] Applied to ${playerId} - physical: ${physicalDamage} (${physicalStat}), mental: ${mentalDamage} (${mentalStat})`);
}

/**
 * Apply event dice result effect
 * @param {HTMLElement} mountEl
 * @param {number} result - Dice result
 * @param {string} stat - Stat that was rolled (for 'rolled' stat effects)
 */
function applyEventDiceResult(mountEl, result, stat) {
    if (!eventDiceModal || !eventDiceModal.eventCard) return;

    const { eventCard } = eventDiceModal;
    const outcome = findMatchingOutcome(eventCard.rollResults, result);

    console.log('[EventDice] Result:', result, 'Outcome:', outcome);

    if (!outcome) {
        console.warn('[EventDice] No matching outcome found for result:', result);
        closeEventDiceModal(mountEl);
        return;
    }

    const playerId = mySocketId;

    // Stat labels for display
    const statLabels = {
        speed: 'Toc do (Speed)',
        might: 'Suc manh (Might)',
        knowledge: 'Kien thuc (Knowledge)',
        sanity: 'Tam tri (Sanity)'
    };

    // Handle different effect types
    switch (outcome.effect) {
        case 'nothing':
            console.log('[EventDice] Effect: nothing');
            eventDiceModal = null; // Close event modal
            openEventResultModal(mountEl, 'KHONG CO GI XAY RA', 'Ban da vuot qua thu thach!', 'neutral');
            break;

        case 'gainStat': {
            const gainStatName = outcome.stat === 'rolled' ? stat : outcome.stat;
            const amount = outcome.amount || 1;
            // Get current value before change
            const oldValue = getPlayerStatForDice(playerId, gainStatName);
            applyStatChange(playerId, gainStatName, amount);
            const newValue = getPlayerStatForDice(playerId, gainStatName);
            eventDiceModal = null; // Close event modal
            openEventResultModal(
                mountEl,
                'TANG CHI SO',
                `${statLabels[gainStatName]}: ${oldValue} → ${newValue} (+${amount})`,
                'success'
            );
            break;
        }

        case 'loseStat': {
            const loseStatName = outcome.stat === 'rolled' ? stat : outcome.stat;
            const amount = outcome.amount || 1;
            const oldValue = getPlayerStatForDice(playerId, loseStatName);
            applyStatChange(playerId, loseStatName, -amount);
            const newValue = getPlayerStatForDice(playerId, loseStatName);
            eventDiceModal = null; // Close event modal
            openEventResultModal(
                mountEl,
                'GIAM CHI SO',
                `${statLabels[loseStatName]}: ${oldValue} → ${newValue} (-${amount})`,
                'danger'
            );
            break;
        }

        case 'loseStats':
            applyMultipleStatChanges(playerId, outcome.stats);
            eventDiceModal = null; // Close event modal
            // Build message for multiple stats
            const loseStatsMsg = Object.entries(outcome.stats)
                .map(([s, amt]) => `${statLabels[s]} -${amt}`)
                .join(', ');
            openEventResultModal(mountEl, 'GIAM CHI SO', loseStatsMsg, 'danger');
            break;

        case 'mentalDamage':
            // Need to roll damage dice
            eventDiceModal.pendingEffect = outcome;
            eventDiceModal = null; // Close event modal first
            openDamageDiceModal(mountEl, 0, outcome.dice);
            break;

        case 'physicalDamage':
            eventDiceModal.pendingEffect = outcome;
            eventDiceModal = null;
            openDamageDiceModal(mountEl, outcome.dice, 0);
            break;

        case 'damage':
            eventDiceModal.pendingEffect = outcome;
            eventDiceModal = null;
            openDamageDiceModal(mountEl, outcome.physicalDice || 0, outcome.mentalDice || 0);
            break;

        case 'teleport': {
            console.log('[EventDice] Effect: teleport to', outcome.destination);
            const destinationRoomId = findRoomIdByDestination(outcome.destination);
            if (destinationRoomId) {
                // Move player to destination
                if (!currentGameState.playerState.playerPositions) {
                    currentGameState.playerState.playerPositions = {};
                }
                currentGameState.playerState.playerPositions[playerId] = destinationRoomId;

                // Get room name for display
                const revealedRooms = currentGameState.map?.revealedRooms || {};
                const destRoom = revealedRooms[destinationRoomId];
                const roomName = destRoom?.name || outcome.destination;

                // Sync state to server and re-render
                syncGameStateToServer();
                renderGameScreen(currentGameState, mySocketId);

                eventDiceModal = null;
                openEventResultModal(
                    mountEl,
                    'DỊCH CHUYỂN',
                    `Bạn đã được dịch chuyển đến ${roomName}`,
                    'neutral'
                );
            } else {
                console.warn('[EventDice] Could not find destination room:', outcome.destination);
                eventDiceModal = null;
                openEventResultModal(
                    mountEl,
                    'LỖI',
                    `Không tìm thấy phòng ${outcome.destination}. Phòng này chưa được khám phá.`,
                    'danger'
                );
            }
            break;
        }

        case 'drawItem':
            console.log('[EventDice] Effect: drawItem');
            // TODO: Implement draw item
            closeEventDiceModal(mountEl);
            break;

        case 'attack':
            console.log('[EventDice] Effect: attack with', outcome.attackerDice, 'dice');
            // TODO: Implement attack flow
            closeEventDiceModal(mountEl);
            break;

        case 'forcedAttack': {
            console.log('[EventDice] Effect: forced attack on', outcome.target);
            eventDiceModal = null;
            // Execute forced attack - find target and initiate combat
            executeForcedAttack(mountEl, playerId, outcome.target);
            break;
        }

        default:
            console.log('[EventDice] Unknown effect:', outcome.effect);
            closeEventDiceModal(mountEl);
    }
}

/**
 * Close event dice modal
 * @param {HTMLElement} mountEl
 */
function closeEventDiceModal(mountEl) {
    eventDiceModal = null;

    const playerId = mySocketId;

    // Check if turn ended (no more moves) - advance to next player
    if (currentGameState && currentGameState.playerMoves[playerId] <= 0) {
        console.log('[Turn] Player', playerId, 'moves depleted after event dice, advancing turn');
        advanceToNextTurn();
    }

    updateGameUI(mountEl, currentGameState, mySocketId);

    // Sync stat changes to server for multiplayer
    syncGameStateToServer();
}

/**
 * Close damage dice modal and apply damage
 * @param {HTMLElement} mountEl
 */
function closeDamageDiceModal(mountEl) {
    if (!damageDiceModal) return;

    const physicalDamage = damageDiceModal.physicalResult || 0;
    const mentalDamage = damageDiceModal.mentalResult || 0;
    const physicalStat = damageDiceModal.selectedPhysicalStat;
    const mentalStat = damageDiceModal.selectedMentalStat;

    applyDamageToPlayer(mySocketId, physicalDamage, mentalDamage, physicalStat, mentalStat);

    damageDiceModal = null;

    const playerId = mySocketId;

    // Check if turn ended (no more moves) - advance to next player
    if (currentGameState && currentGameState.playerMoves[playerId] <= 0) {
        console.log('[Turn] Player', playerId, 'moves depleted after damage dice, advancing turn');
        advanceToNextTurn();
    }

    updateGameUI(mountEl, currentGameState, mySocketId);

    // Sync damage stats to server for multiplayer
    syncGameStateToServer();
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
    const iNeedToRoll = mySocketId && needsRoll.includes(mySocketId);

    // Get current player who needs to roll (for debug mode display)
    const currentRollingPlayer = needsRoll.length > 0 
        ? players.find(p => p.id === needsRoll[0])
        : null;

    const playersRollsHtml = players.map(p => {
        const charName = getCharacterName(p.characterId);
        const roll = diceRolls[p.id];
        const isMe = p.id === myId;
        const isCurrentRoller = false;
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
 * Render end turn confirmation modal
 * @returns {string} HTML string
 */
function renderEndTurnModal() {
    if (!endTurnModal?.isOpen) return '';

    const movesLeft = currentGameState?.playerMoves?.[mySocketId] ?? 0;

    return `
        <div class="end-turn-overlay" data-action="close-end-turn">
            <div class="end-turn-modal" data-modal-content="true">
                <header class="end-turn-modal__header">
                    <h3 class="end-turn-modal__title">Ket thuc luot</h3>
                    <button class="end-turn-modal__close" type="button" data-action="close-end-turn">×</button>
                </header>
                <div class="end-turn-modal__body">
                    <p class="end-turn-modal__message">Ban con <strong>${movesLeft}</strong> buoc di.</p>
                    <p class="end-turn-modal__question">Ban muon lam gi?</p>
                    <div class="end-turn-modal__actions">
                        <button class="end-turn-modal__btn end-turn-modal__btn--continue"
                                type="button"
                                data-action="continue-turn">
                            Tiep tuc di
                        </button>
                        <button class="end-turn-modal__btn end-turn-modal__btn--end"
                                type="button"
                                data-action="confirm-end-turn">
                            Ket thuc luot
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render reset game confirmation modal (debug mode only)
 * @returns {string} HTML string
 */
function renderResetGameModal() {
    if (!resetGameModal?.isOpen) return '';

    return `
        <div class="reset-game-overlay" data-action="close-reset-game">
            <div class="reset-game-modal" data-modal-content="true">
                <header class="reset-game-modal__header">
                    <span class="reset-game-modal__icon">🔄</span>
                    <h3 class="reset-game-modal__title">Reset Game</h3>
                    <button class="reset-game-modal__close" type="button" data-action="close-reset-game">×</button>
                </header>
                <div class="reset-game-modal__body">
                    <p class="reset-game-modal__message">
                        Ca 2 nguoi choi se quay lai trang thai ban dau.
                    </p>
                    <p class="reset-game-modal__warning">
                        ⚠️ Tien trinh game hien tai se bi mat!
                    </p>
                </div>
                <div class="reset-game-modal__actions">
                    <button class="reset-game-modal__btn reset-game-modal__btn--cancel"
                            type="button"
                            data-action="close-reset-game">
                        Huy bo
                    </button>
                    <button class="reset-game-modal__btn reset-game-modal__btn--confirm"
                            type="button"
                            data-action="confirm-reset-game">
                        Reset Game
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render dice event modal - allows manual input or random roll (0-16)
 * @returns {string} HTML string
 */
function renderDiceEventModal() {
    if (!diceEventModal?.isOpen) return '';

    const { inputValue, result } = diceEventModal;
    const hasResult = result !== null;

    return `
        <div class="dice-event-overlay" data-action="close-dice-event">
            <div class="dice-event-modal" data-modal-content="true">
                <header class="dice-event-modal__header">
                    <h3 class="dice-event-modal__title">Tung xuc xac</h3>
                    <button class="dice-event-modal__close" type="button" data-action="close-dice-event">×</button>
                </header>
                <div class="dice-event-modal__body">
                    ${hasResult ? `
                        <div class="dice-event-modal__result">
                            <span class="dice-event-modal__result-label">Ket qua:</span>
                            <span class="dice-event-modal__result-value">${result}</span>
                        </div>
                    ` : `
                        <div class="dice-event-modal__input-group">
                            <label class="dice-event-modal__label">Nhap ket qua xuc xac:</label>
                            <input
                                type="number"
                                class="dice-event-modal__input"
                                min="0"
                                value="${inputValue}"
                                data-input="dice-event-value"
                                placeholder="Nhap so"
                            />
                        </div>
                        <div class="dice-event-modal__actions">
                            <button class="dice-event-modal__btn dice-event-modal__btn--confirm"
                                    type="button"
                                    data-action="dice-event-confirm">
                                Xac nhan
                            </button>
                            <button class="dice-event-modal__btn dice-event-modal__btn--random"
                                    type="button"
                                    data-action="dice-event-random">
                                Ngau nhien
                            </button>
                        </div>
                    `}
                    ${hasResult ? `
                        <button class="dice-event-modal__btn dice-event-modal__btn--close"
                                type="button"
                                data-action="close-dice-event">
                            Dong
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render event dice modal - for immediate roll events (mandatory, no close button)
 * @returns {string} HTML string
 */
function renderEventDiceModal() {
    if (!eventDiceModal?.isOpen) return '';

    const { eventCard, rollStat, selectedStat, diceCount, inputValue, result, currentRollIndex, allResults } = eventDiceModal;
    const hasResult = result !== null;
    const cardName = eventCard?.name?.vi || 'Event';

    // Check if this is a multi-roll event (nguoi_treo_co)
    const isMultiRoll = eventCard?.rollStats && Array.isArray(eventCard.rollStats);
    const totalRolls = isMultiRoll ? eventCard.rollStats.length : 1;
    const currentStat = isMultiRoll ? eventCard.rollStats[currentRollIndex] : (selectedStat || rollStat);

    // Check if rollStat is an array (player choice, e.g., con_nhen)
    const isStatChoice = Array.isArray(rollStat) && !isMultiRoll;
    const needsStatSelection = isStatChoice && !selectedStat;

    // Stat labels
    const statLabels = {
        speed: 'Toc do (Speed)',
        might: 'Suc manh (Might)',
        sanity: 'Tam tri (Sanity)',
        knowledge: 'Kien thuc (Knowledge)'
    };

    // Get current stat label
    const currentStatLabel = currentStat ? statLabels[currentStat] : '';

    // Build results history for multi-roll
    let resultsHistoryHtml = '';
    if (isMultiRoll && allResults.length > 0) {
        resultsHistoryHtml = `
            <div class="event-dice-modal__history">
                <h4>Ket qua da do:</h4>
                <ul>
                    ${allResults.map(r => `<li>${statLabels[r.stat]}: ${r.result}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    return `
        <div class="event-dice-overlay">
            <div class="event-dice-modal" data-modal-content="true">
                <header class="event-dice-modal__header">
                    <h3 class="event-dice-modal__title">${cardName}</h3>
                    ${isMultiRoll ? `<span class="event-dice-modal__progress">Lan ${currentRollIndex + 1}/${totalRolls}</span>` : ''}
                </header>
                <div class="event-dice-modal__body">
                    <p class="event-dice-modal__description">${eventCard?.text?.vi || ''}</p>

                    ${resultsHistoryHtml}

                    ${needsStatSelection ? `
                        <div class="event-dice-modal__stat-select">
                            <label class="event-dice-modal__label">Chon chi so de do:</label>
                            <select class="event-dice-modal__select" data-input="event-stat-select">
                                <option value="">-- Chon --</option>
                                ${rollStat.map(s => `<option value="${s}">${statLabels[s]}</option>`).join('')}
                            </select>
                            <button class="event-dice-modal__btn event-dice-modal__btn--confirm event-dice-modal__btn--stat-confirm"
                                    type="button"
                                    data-action="event-stat-confirm"
                                    disabled>
                                Xac nhan lua chon
                            </button>
                        </div>
                    ` : hasResult ? `
                        <div class="event-dice-modal__result">
                            <span class="event-dice-modal__result-label">Ket qua ${currentStatLabel}:</span>
                            <span class="event-dice-modal__result-value">${result}</span>
                        </div>
                    ` : `
                        <div class="event-dice-modal__roll-info">
                            <p>Do ${eventCard?.fixedDice || diceCount} vien xuc xac ${currentStatLabel}</p>
                        </div>
                        <div class="event-dice-modal__input-group">
                            <label class="event-dice-modal__label">Nhap ket qua xuc xac:</label>
                            <input
                                type="number"
                                class="event-dice-modal__input"
                                min="0"
                                value="${inputValue}"
                                data-input="event-dice-value"
                                placeholder="Nhap so"
                            />
                        </div>
                        <div class="event-dice-modal__actions">
                            <button class="event-dice-modal__btn event-dice-modal__btn--confirm"
                                    type="button"
                                    data-action="event-dice-confirm">
                                Xac nhan
                            </button>
                            <button class="event-dice-modal__btn event-dice-modal__btn--random"
                                    type="button"
                                    data-action="event-dice-random">
                                Ngau nhien
                            </button>
                        </div>
                    `}

                    ${hasResult ? `
                        <button class="event-dice-modal__btn event-dice-modal__btn--continue"
                                type="button"
                                data-action="event-dice-continue">
                            ${isMultiRoll && currentRollIndex < totalRolls - 1 ? 'Tiep theo' : 'Ap dung ket qua'}
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render room effect dice modal - for room-triggered dice rolls
 * @returns {string} HTML string
 */
function renderRoomEffectDiceModal() {
    if (!roomEffectDiceModal?.isOpen) return '';

    const { roomName, roomEffect, diceCount, inputValue, result } = roomEffectDiceModal;
    const hasResult = result !== null;

    const statLabels = {
        speed: 'Toc do (Speed)',
        might: 'Suc manh (Might)',
        sanity: 'Tam tri (Sanity)',
        knowledge: 'Kien thuc (Knowledge)'
    };

    const statLabel = statLabels[roomEffect.rollStat];
    const targetDisplay = `${roomEffect.target}+`;
    const maxDiceValue = diceCount * 2;

    // Determine result status
    let resultStatusHtml = '';
    if (hasResult) {
        const isSuccess = result >= roomEffect.target;
        resultStatusHtml = `
            <div class="room-effect-dice-modal__result-status room-effect-dice-modal__result-status--${isSuccess ? 'success' : 'fail'}">
                ${isSuccess ? 'THANH CONG!' : 'THAT BAI!'}
            </div>
        `;
    }

    return `
        <div class="room-effect-dice-overlay">
            <div class="room-effect-dice-modal" data-modal-content="true">
                <header class="room-effect-dice-modal__header">
                    <h3 class="room-effect-dice-modal__title">${roomName}</h3>
                </header>
                <div class="room-effect-dice-modal__body">
                    <p class="room-effect-dice-modal__description">${roomEffect.description.vi}</p>

                    <div class="room-effect-dice-modal__requirement">
                        <span class="room-effect-dice-modal__stat-label">${statLabel}</span>
                        <span class="room-effect-dice-modal__target">${targetDisplay}</span>
                    </div>

                    ${hasResult ? `
                        <div class="room-effect-dice-modal__result">
                            <span class="room-effect-dice-modal__result-label">Ket qua:</span>
                            <span class="room-effect-dice-modal__result-value">${result}</span>
                        </div>
                        ${resultStatusHtml}
                        <button class="room-effect-dice-modal__btn room-effect-dice-modal__btn--continue"
                                type="button"
                                data-action="room-effect-dice-continue">
                            Tiep tuc
                        </button>
                    ` : `
                        <div class="room-effect-dice-modal__roll-info">
                            <p>Do ${diceCount} vien xuc xac ${statLabel}</p>
                        </div>
                        <div class="room-effect-dice-modal__input-group">
                            <label class="room-effect-dice-modal__label">Nhap ket qua xuc xac:</label>
                            <input
                                type="number"
                                class="room-effect-dice-modal__input"
                                min="0"
                                value="${inputValue}"
                                data-input="room-effect-dice-value"
                                placeholder="Nhap so"
                            />
                        </div>
                        <div class="room-effect-dice-modal__actions">
                            <button class="room-effect-dice-modal__btn room-effect-dice-modal__btn--confirm"
                                    type="button"
                                    data-action="room-effect-dice-confirm">
                                Xac nhan
                            </button>
                            <button class="room-effect-dice-modal__btn room-effect-dice-modal__btn--random"
                                    type="button"
                                    data-action="room-effect-dice-random">
                                Ngau nhien
                            </button>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render damage dice modal - for rolling damage dice after event effect
 * Flow: selectPhysicalStat -> physical (roll) -> selectMentalStat -> mental (roll) -> done
 * @returns {string} HTML string
 */
function renderDamageDiceModal() {
    if (!damageDiceModal?.isOpen) return '';

    const {
        damageType, physicalDice, mentalDice, inputValue, currentPhase,
        physicalResult, mentalResult
    } = damageDiceModal;

    // Build results display (for showing what's been rolled so far)
    let resultsHtml = '';
    if (physicalResult !== null) {
        resultsHtml += `<p class="damage-dice-modal__result-item">Sat thuong vat li: <strong>${physicalResult}</strong></p>`;
    }
    if (mentalResult !== null) {
        resultsHtml += `<p class="damage-dice-modal__result-item">Sat thuong tinh than: <strong>${mentalResult}</strong></p>`;
    }

    // Determine what to render based on phase
    let bodyContent = '';

    // NEW FLOW: Roll dice first, then distribute damage
    if (currentPhase === 'rollPhysical') {
        // Roll physical damage dice
        bodyContent = `
            <div class="damage-dice-modal__roll-info">
                <p class="damage-dice-modal__instruction">Do <strong>${physicalDice}</strong> xuc xac sat thuong vat li</p>
                <p class="damage-dice-modal__hint">(Sat thuong se duoc phan bo vao Speed hoac Might)</p>
            </div>
            <div class="damage-dice-modal__input-group">
                <label class="damage-dice-modal__label">Nhap ket qua xuc xac:</label>
                <input
                    type="number"
                    class="damage-dice-modal__input"
                    min="0"
                    value="${inputValue}"
                    data-input="damage-dice-value"
                    placeholder="Nhap so"
                />
            </div>
            <div class="damage-dice-modal__actions">
                <button class="damage-dice-modal__btn damage-dice-modal__btn--confirm"
                        type="button"
                        data-action="damage-dice-confirm">
                    Xac nhan
                </button>
                <button class="damage-dice-modal__btn damage-dice-modal__btn--random"
                        type="button"
                        data-action="damage-dice-random">
                    Ngau nhien
                </button>
            </div>
        `;
    } else if (currentPhase === 'rollMental') {
        // Roll mental damage dice
        bodyContent = `
            ${resultsHtml ? `<div class="damage-dice-modal__results">${resultsHtml}</div>` : ''}
            <div class="damage-dice-modal__roll-info">
                <p class="damage-dice-modal__instruction">Do <strong>${mentalDice}</strong> xuc xac sat thuong tinh than</p>
                <p class="damage-dice-modal__hint">(Sat thuong se duoc phan bo vao Knowledge hoac Sanity)</p>
            </div>
            <div class="damage-dice-modal__input-group">
                <label class="damage-dice-modal__label">Nhap ket qua xuc xac:</label>
                <input
                    type="number"
                    class="damage-dice-modal__input"
                    min="0"
                    value="${inputValue}"
                    data-input="damage-dice-value"
                    placeholder="Nhap so"
                />
            </div>
            <div class="damage-dice-modal__actions">
                <button class="damage-dice-modal__btn damage-dice-modal__btn--confirm"
                        type="button"
                        data-action="damage-dice-confirm">
                    Xac nhan
                </button>
                <button class="damage-dice-modal__btn damage-dice-modal__btn--random"
                        type="button"
                        data-action="damage-dice-random">
                    Ngau nhien
                </button>
            </div>
        `;
    }

    // Note: 'done' phase is no longer used - we transition to damageDistributionModal instead

    return `
        <div class="damage-dice-overlay">
            <div class="damage-dice-modal" data-modal-content="true">
                <header class="damage-dice-modal__header">
                    <h3 class="damage-dice-modal__title">Do xuc xac sat thuong</h3>
                </header>
                <div class="damage-dice-modal__body">
                    ${bodyContent}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render event result notification modal
 * @returns {string} HTML string
 */
function renderEventResultModal() {
    if (!eventResultModal?.isOpen) return '';

    const { title, message, type } = eventResultModal;

    // Type-based styling
    const typeClass = type === 'success' ? 'event-result-modal--success'
        : type === 'danger' ? 'event-result-modal--danger'
        : 'event-result-modal--neutral';

    const icon = type === 'success' ? '✓'
        : type === 'danger' ? '✗'
        : 'ℹ';

    return `
        <div class="event-result-overlay" data-action="close-event-result">
            <div class="event-result-modal ${typeClass}" data-modal-content="true">
                <div class="event-result-modal__icon">${icon}</div>
                <h3 class="event-result-modal__title">${title}</h3>
                <p class="event-result-modal__message">${message}</p>
                <p class="event-result-modal__hint">Tap de dong</p>
            </div>
        </div>
    `;
}

/**
 * Render damage distribution modal - for distributing combat/event damage across stats
 * @returns {string} HTML string
 */
function renderDamageDistributionModal() {
    if (!damageDistributionModal?.isOpen) return '';

    const { totalDamage, damageType, stat1, stat2, stat1Damage, stat2Damage } = damageDistributionModal;

    const statLabels = {
        speed: 'Toc do (Speed)',
        might: 'Suc manh (Might)',
        knowledge: 'Kien thuc (Knowledge)',
        sanity: 'Tam tri (Sanity)'
    };

    // Phase 1: Type selection (if damageType is null)
    if (!damageType) {
        return `
            <div class="damage-dist-overlay">
                <div class="damage-dist-modal" data-modal-content="true">
                    <header class="damage-dist-modal__header">
                        <h3 class="damage-dist-modal__title">CHIU SAT THUONG</h3>
                    </header>
                    <div class="damage-dist-modal__body">
                        <p class="damage-dist-modal__damage-total">
                            Ban chiu <strong>${totalDamage}</strong> sat thuong
                        </p>
                        <p class="damage-dist-modal__instruction">Chon loai sat thuong:</p>
                        <div class="damage-dist-modal__type-buttons">
                            <button class="damage-dist-modal__btn damage-dist-modal__btn--physical"
                                    type="button" data-action="damage-type-select" data-type="physical">
                                Vat ly<br/><small>(Speed / Might)</small>
                            </button>
                            <button class="damage-dist-modal__btn damage-dist-modal__btn--mental"
                                    type="button" data-action="damage-type-select" data-type="mental">
                                Tinh than<br/><small>(Sanity / Knowledge)</small>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Phase 2: Distribution
    const remainingDamage = totalDamage - stat1Damage - stat2Damage;

    // Get current stat indices and values
    const playerId = mySocketId;
    const charData = currentGameState?.playerState?.characterData?.[playerId];
    const characterId = charData?.characterId;
    const stat1Index = charData?.stats?.[stat1] ?? 0;
    const stat2Index = charData?.stats?.[stat2] ?? 0;

    // Get actual stat values from character trait tracks
    const stat1Value = characterId ? getStatValue(characterId, stat1, stat1Index) : 0;
    const stat2Value = characterId ? getStatValue(characterId, stat2, stat2Index) : 0;

    // Calculate new values after applying damage
    const stat1NewIndex = Math.max(0, stat1Index - stat1Damage);
    const stat2NewIndex = Math.max(0, stat2Index - stat2Damage);
    const stat1NewValue = characterId ? getStatValue(characterId, stat1, stat1NewIndex) : 0;
    const stat2NewValue = characterId ? getStatValue(characterId, stat2, stat2NewIndex) : 0;

    // Check for death warning (index reaches 0)
    const stat1IsDead = stat1NewIndex === 0;
    const stat2IsDead = stat2NewIndex === 0;

    // Calculate how much more damage can be assigned to each stat
    // A stat can only absorb damage up to its current index (reaching 0)
    const stat1CanAbsorb = stat1Index - stat1Damage; // How much more stat1 can take
    const stat2CanAbsorb = stat2Index - stat2Damage; // How much more stat2 can take
    const totalCanAbsorb = Math.max(0, stat1CanAbsorb) + Math.max(0, stat2CanAbsorb);

    // Can confirm when:
    // 1. All damage has been distributed (remainingDamage === 0), OR
    // 2. Both stats are at/will be at 0 and can't absorb more (totalCanAbsorb === 0)
    //    This handles cases where damage exceeds total stat capacity
    const canConfirm = remainingDamage === 0 || (remainingDamage > 0 && totalCanAbsorb === 0);

    console.log('[DamageDistModal] totalDamage:', totalDamage, 'stat1Damage:', stat1Damage, 'stat2Damage:', stat2Damage,
        'remaining:', remainingDamage, 'stat1CanAbsorb:', stat1CanAbsorb, 'stat2CanAbsorb:', stat2CanAbsorb,
        'totalCanAbsorb:', totalCanAbsorb, 'canConfirm:', canConfirm);

    return `
        <div class="damage-dist-overlay">
            <div class="damage-dist-modal" data-modal-content="true">
                <header class="damage-dist-modal__header">
                    <h3 class="damage-dist-modal__title">PHAN BO SAT THUONG</h3>
                </header>
                <div class="damage-dist-modal__body">
                    <div class="damage-dist-modal__remaining ${remainingDamage === 0 ? 'damage-dist-modal__remaining--done' : ''}">
                        Sat thuong con lai: <strong>${remainingDamage}</strong>
                    </div>

                    <div class="damage-dist-modal__stat-row ${stat1IsDead ? 'damage-dist-modal__stat-row--dead' : ''}">
                        <div class="damage-dist-modal__stat-info">
                            <label class="damage-dist-modal__stat-label">${statLabels[stat1]}</label>
                            <div class="damage-dist-modal__stat-preview">
                                <span class="damage-dist-modal__stat-current">${stat1Value}</span>
                                ${stat1Damage > 0 ? `<span class="damage-dist-modal__stat-arrow">→</span>
                                <span class="damage-dist-modal__stat-new ${stat1IsDead ? 'damage-dist-modal__stat-new--dead' : ''}">${stat1NewValue}</span>` : ''}
                                ${stat1IsDead ? '<span class="damage-dist-modal__death-warning">☠ CHET</span>' : ''}
                            </div>
                        </div>
                        <div class="damage-dist-modal__stat-input">
                            <button class="damage-dist-modal__btn damage-dist-modal__btn--minus"
                                    type="button" data-action="damage-adjust" data-stat="1" data-delta="-1"
                                    ${stat1Damage <= 0 ? 'disabled' : ''}>-</button>
                            <span class="damage-dist-modal__stat-value">${stat1Damage}</span>
                            <button class="damage-dist-modal__btn damage-dist-modal__btn--plus"
                                    type="button" data-action="damage-adjust" data-stat="1" data-delta="1"
                                    ${remainingDamage <= 0 ? 'disabled' : ''}>+</button>
                        </div>
                    </div>

                    <div class="damage-dist-modal__stat-row ${stat2IsDead ? 'damage-dist-modal__stat-row--dead' : ''}">
                        <div class="damage-dist-modal__stat-info">
                            <label class="damage-dist-modal__stat-label">${statLabels[stat2]}</label>
                            <div class="damage-dist-modal__stat-preview">
                                <span class="damage-dist-modal__stat-current">${stat2Value}</span>
                                ${stat2Damage > 0 ? `<span class="damage-dist-modal__stat-arrow">→</span>
                                <span class="damage-dist-modal__stat-new ${stat2IsDead ? 'damage-dist-modal__stat-new--dead' : ''}">${stat2NewValue}</span>` : ''}
                                ${stat2IsDead ? '<span class="damage-dist-modal__death-warning">☠ CHET</span>' : ''}
                            </div>
                        </div>
                        <div class="damage-dist-modal__stat-input">
                            <button class="damage-dist-modal__btn damage-dist-modal__btn--minus"
                                    type="button" data-action="damage-adjust" data-stat="2" data-delta="-1"
                                    ${stat2Damage <= 0 ? 'disabled' : ''}>-</button>
                            <span class="damage-dist-modal__stat-value">${stat2Damage}</span>
                            <button class="damage-dist-modal__btn damage-dist-modal__btn--plus"
                                    type="button" data-action="damage-adjust" data-stat="2" data-delta="1"
                                    ${remainingDamage <= 0 ? 'disabled' : ''}>+</button>
                        </div>
                    </div>

                    <button class="damage-dist-modal__btn damage-dist-modal__btn--confirm"
                            type="button" data-action="damage-dist-confirm"
                            ${!canConfirm ? 'disabled' : ''}>
                        ${remainingDamage === 0 ? 'Xac nhan' :
                          (canConfirm ? `Xac nhan (${remainingDamage} sat thuong bi bo qua)` :
                           `Phan bo het ${remainingDamage} sat thuong`)}
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render combat modal - for player vs player combat
 * @returns {string} HTML string
 */
function renderCombatModal() {
    if (!combatModal?.isOpen) return '';

    const {
        phase, attackerId, defenderId, attackerName, defenderName,
        defenderFactionLabel, attackStat, attackerDiceCount, defenderDiceCount,
        attackerRoll, defenderRoll, inputValue, winner, damage, loserId, isForced
    } = combatModal;

    const isAttacker = mySocketId === attackerId;
    const isDefender = mySocketId === defenderId;

    let bodyContent = '';
    let headerTitle = 'CHIEN DAU';
    let headerClass = 'combat-modal__header';

    // Phase 1: Confirm (only attacker sees this)
    if (phase === 'confirm' && isAttacker) {
        headerTitle = isForced ? 'HOA DIEN - TAN CONG BAT BUOC' : 'GAP KE DICH';
        const questionText = isForced
            ? 'Ban bi hoa dien va PHAI tan cong!'
            : 'Ban muon tan cong?';
        const skipButton = isForced
            ? ''
            : `<button class="combat-modal__btn combat-modal__btn--skip"
                        type="button" data-action="combat-skip">
                    BO QUA
                </button>`;
        bodyContent = `
            <div class="combat-modal__encounter">
                <p class="combat-modal__text">Ban gap <strong>${defenderName}</strong></p>
                <p class="combat-modal__faction">(${defenderFactionLabel})</p>
                <p class="combat-modal__question">${questionText}</p>
            </div>
            <div class="combat-modal__actions">
                <button class="combat-modal__btn combat-modal__btn--attack"
                        type="button" data-action="combat-attack">
                    TAN CONG
                </button>
                ${skipButton}
            </div>
        `;
    }
    // Phase 2: Attacker rolling
    else if (phase === 'attacker_roll' && isAttacker) {
        headerTitle = 'TAN CONG';
        bodyContent = `
            <div class="combat-modal__roll-info">
                <p>Do <strong>${attackerDiceCount}</strong> xuc xac Suc manh (Might)</p>
                <p class="combat-modal__target">Tan cong ${defenderName}</p>
            </div>
            <div class="combat-modal__input-group">
                <label class="combat-modal__label">Nhap ket qua xuc xac:</label>
                <input
                    type="number"
                    class="combat-modal__input"
                    id="combat-roll-input"
                    min="0"
                    value="${inputValue}"
                    placeholder="Nhap so"
                />
            </div>
            <div class="combat-modal__actions">
                <button class="combat-modal__btn combat-modal__btn--confirm"
                        type="button" data-action="combat-attacker-confirm">
                    Xac nhan
                </button>
                <button class="combat-modal__btn combat-modal__btn--random"
                        type="button" data-action="combat-attacker-random">
                    Ngau nhien
                </button>
            </div>
        `;
    }
    // Attacker waiting for defender
    else if (phase === 'waiting_defender' && isAttacker) {
        headerTitle = 'CHO DOI';
        bodyContent = `
            <div class="combat-modal__waiting">
                <p>Ket qua tan cong cua ban: <strong>${attackerRoll}</strong></p>
                <p class="combat-modal__waiting-text">Dang cho ${defenderName} phan don...</p>
                <div class="combat-modal__spinner"></div>
            </div>
        `;
    }
    // Defender being attacked - waiting for attacker to roll or ready to defend
    else if ((phase === 'waiting_defender' || phase === 'defender_roll') && isDefender) {
        headerTitle = 'BI TAN CONG!';
        headerClass = 'combat-modal__header combat-modal__header--danger';

        if (phase === 'waiting_defender') {
            // Waiting for attacker to finish rolling
            bodyContent = `
                <div class="combat-modal__attacked">
                    <p class="combat-modal__warning">${attackerName} dang tan cong ban!</p>
                    <p class="combat-modal__waiting-text">Dang cho ket qua tan cong...</p>
                    <div class="combat-modal__spinner"></div>
                </div>
            `;
        } else {
            // Defender's turn to roll (phase === 'defender_roll')
            bodyContent = `
                <div class="combat-modal__attacked">
                    <p class="combat-modal__warning">${attackerName} tan cong ban!</p>
                    <p>Ket qua tan cong: <strong>${attackerRoll}</strong></p>
                </div>
                <div class="combat-modal__roll-info">
                    <p>Tung xuc xac phan don!</p>
                    <p>Do <strong>${defenderDiceCount}</strong> xuc xac Suc manh (Might)</p>
                </div>
                <div class="combat-modal__input-group">
                    <label class="combat-modal__label">Nhap ket qua xuc xac:</label>
                    <input
                        type="number"
                        class="combat-modal__input"
                        id="combat-roll-input"
                        min="0"
                        value="${inputValue}"
                        placeholder="Nhap so"
                    />
                </div>
                <div class="combat-modal__actions">
                    <button class="combat-modal__btn combat-modal__btn--confirm"
                            type="button" data-action="combat-defender-confirm">
                        Xac nhan
                    </button>
                    <button class="combat-modal__btn combat-modal__btn--random"
                            type="button" data-action="combat-defender-random">
                        Ngau nhien
                    </button>
                </div>
            `;
        }
    }
    // Phase 4: Result (both see this)
    else if (phase === 'result') {
        headerTitle = 'KET QUA';
        const loserName = loserId === attackerId ? attackerName : defenderName;
        const winnerName = winner === 'attacker' ? attackerName : defenderName;
        const isLoser = loserId === mySocketId;

        let resultText = '';
        if (winner === 'tie') {
            resultText = `<p class="combat-modal__result-tie">HOA! Khong ai chiu sat thuong.</p>`;
        } else if (winner === 'defender') {
            resultText = `
                <p class="combat-modal__result-winner">${winnerName} PHAN DON THANH CONG!</p>
                <p class="combat-modal__result-damage">${loserName} chiu <strong>${damage}</strong> sat thuong</p>
            `;
        } else {
            resultText = `
                <p class="combat-modal__result-winner">${winnerName} TAN CONG THANH CONG!</p>
                <p class="combat-modal__result-damage">${loserName} chiu <strong>${damage}</strong> sat thuong</p>
            `;
        }

        bodyContent = `
            <div class="combat-modal__result">
                <div class="combat-modal__scores">
                    <div class="combat-modal__score">
                        <span class="combat-modal__score-label">Tan cong</span>
                        <span class="combat-modal__score-value">${attackerRoll}</span>
                    </div>
                    <span class="combat-modal__vs">VS</span>
                    <div class="combat-modal__score">
                        <span class="combat-modal__score-label">Phan don</span>
                        <span class="combat-modal__score-value">${defenderRoll}</span>
                    </div>
                </div>
                ${resultText}
            </div>
            <div class="combat-modal__actions">
                <button class="combat-modal__btn combat-modal__btn--continue"
                        type="button" data-action="combat-continue">
                    ${isLoser && damage > 0 ? 'Chiu sat thuong' : 'Tiep tuc'}
                </button>
            </div>
        `;
    }
    // Fallback - shouldn't happen
    else {
        return '';
    }

    return `
        <div class="combat-overlay">
            <div class="combat-modal" data-modal-content="true">
                <header class="${headerClass}">
                    <h3 class="combat-modal__title">${headerTitle}</h3>
                </header>
                <div class="combat-modal__body">
                    ${bodyContent}
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

    // Get faction info - before haunt everyone is survivor
    const hauntActive = isHauntTriggered(gameState);
    const myFaction = hauntActive ? getFaction(gameState, myId) : 'survivor';
    const factionLabel = hauntActive ? getFactionLabel(myFaction) : 'Survivor';
    const factionClass = `sidebar-faction--${myFaction}`;
    const factionIcon = myFaction === 'traitor' ? '☠' : '◆';

    return `
        <aside class="game-sidebar ${openClass} ${myTurn ? 'is-my-turn' : ''} ${hauntActive ? 'is-haunt-active' : ''}">
            <div class="sidebar-header">
                <span class="sidebar-title">${charName}</span>
                <button class="sidebar-close" type="button" data-action="close-sidebar">&times;</button>
            </div>
            <div class="sidebar-faction ${factionClass}">
                <span class="sidebar-faction__icon">${factionIcon}</span>
                <span class="sidebar-faction__label">${factionLabel}</span>
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
            ${gameState.isDebug ? `
                <div class="sidebar-debug">
                    <button class="sidebar-reset-btn" type="button" data-action="reset-debug-game">
                        🔄 Reset Game
                    </button>
                </div>
            ` : ''}
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

    const hauntActive = isHauntTriggered(gameState);

    const orderedPlayers = turnOrder.map((socketId, idx) => {
        const player = players.find(p => p.id === socketId);
        if (!player) return null;
        const charName = getCharacterName(player.characterId);
        const isMe = socketId === myId;
        const isCurrent = idx === currentIndex;
        const isDisconnected = player.status === 'disconnected';

        const position = playerPositions[socketId] || 'Unknown';

        // In debug mode, make turn indicators clickable to switch player
        const clickableAttr = '';
        const clickableClass = '';

        // Faction classes (only after haunt)
        const playerFaction = getFaction(gameState, socketId);
        const factionClass = playerFaction ? `faction-${playerFaction}` : '';
        const isMyEnemy = hauntActive ? isEnemy(gameState, myId, socketId) : false;
        const isMyAlly = hauntActive ? isAlly(gameState, myId, socketId) && !isMe : false;
        const relationClass = isMyEnemy ? 'is-enemy' : (isMyAlly ? 'is-ally' : '');
        const disconnectedClass = isDisconnected ? 'is-disconnected' : '';

        return `
            <div class="turn-indicator ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${clickableClass} ${factionClass} ${relationClass} ${disconnectedClass}" ${clickableAttr}>
                <span class="turn-indicator__order">${idx + 1}</span>
                <div class="turn-indicator__info">
                    <span class="turn-indicator__name">${charName}${isMe ? ' (You)' : ''}${playerFaction === 'traitor' ? ' ☠' : ''}${isDisconnected ? ' ⚠' : ''}</span>
                    <span class="turn-indicator__room">${isDisconnected ? 'Mat ket noi...' : position}</span>
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

        // Foyer doesn't have stairsTo property - only can go DOWN to Stairs From Basement
        if (stairsFromBasementId) {
            return {
                canGoUp: false,
                canGoDown: true,
                targetRoom: stairsFromBasementId, // DOWN goes to Stairs From Basement
                isMysticElevator: false,
                availableFloors: []
            };
        }
    }

    // Check room's stairsTo property (e.g., Grand Staircase -> Upper Landing)
    if (!currentRoom.stairsTo) {
        return defaultResult;
    }

    const targetRoomId = currentRoom.stairsTo;
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
 * Render haunt trigger button (before haunt, for both debug and multiplayer modes)
 * @param {Object} gameState
 * @returns {string}
 */
function renderHauntButton(gameState) {
    if (isHauntTriggered(gameState)) return '';
    if (gameState?.gamePhase !== 'playing') return '';

    const buttonClass = 'haunt-btn';
    const action = 'trigger-haunt';
    const title = 'Kich hoat Haunt - Chon ngau nhien Traitor';

    return `
        <button class="${buttonClass}" type="button" data-action="${action}" title="${title}">
            <span class="${buttonClass}__icon">👻</span>
            <span class="${buttonClass}__label">Haunt</span>
        </button>
    `;
}

/**
 * Render game controls (movement arrows + dice + stairs)
 */
function renderGameControls(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return '';

    // Block all controls when event dice or damage dice modal is open
    const isBlocked = eventDiceModal?.isOpen || damageDiceModal?.isOpen;

    const myTurn = isMyTurn(gameState, myId);
    const movesLeft = gameState.playerMoves?.[myId] ?? 0;
    const canMove = myTurn && movesLeft > 0 && !isBlocked;

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

    console.log('[Controls] myTurn:', myTurn, 'movesLeft:', movesLeft, 'canMove:', canMove, 'availableDirs:', availableDirs);
    console.log('[Controls] stairs:', stairs, 'showUpBtn:', showUpBtn, 'showDownBtn:', showDownBtn);
    
    // Elevator floor buttons - sorted: upper on top, ground middle, basement bottom
    const floorNames = { upper: 'Tang tren', ground: 'Tang tret', basement: 'Tang ham' };
    const floorOrder = ['upper', 'ground', 'basement'];
    const sortedFloors = showElevator ? floorOrder.filter(f => stairs.availableFloors.includes(f)) : [];
    const elevatorButtons = sortedFloors.map(floor => {
        return `<button class="stairs-btn stairs-btn--elevator stairs-btn--floor-${floor}" type="button" data-action="use-elevator" data-floor="${floor}" title="${floorNames[floor]}">
            <span class="stairs-btn__label">${floorNames[floor]}</span>
        </button>`;
    }).join('');

    // Check if current room requires dice roll
    const diceEventActive = roomRequiresDiceRoll(gameState, myId);

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
                    <div class="move-center" data-action="open-end-turn" title="Click de ket thuc luot">
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
            <button class="dice-event-btn" type="button" data-action="dice-event" title="Tung xuc xac (0-16)" ${!diceEventActive ? 'disabled' : ''}>
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
            ${renderHauntButton(gameState)}
            ${roomDiscoveryHtml}
            ${renderTokenDrawingModal()}
            ${renderCardsViewModal()}
            ${renderDiceEventModal()}
            ${renderEventDiceModal()}
            ${renderDamageDiceModal()}
            ${renderRoomEffectDiceModal()}
            ${renderCombatModal()}
            ${renderDamageDistributionModal()}
            ${renderEventResultModal()}
            ${renderEndTurnModal()}
            ${renderResetGameModal()}
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
 * Attach event listeners
 */
function attachEventListeners(mountEl, roomId) {
    // Prevent attaching listeners multiple times
    if (eventListenersAttached) {
        console.log('[EventListeners] Already attached, skipping');
        return;
    }
    eventListenersAttached = true;

    // Roll dice manually
    mountEl.addEventListener('click', async (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const actionEl = target.closest('[data-action]');
        const action = target.dataset.action || actionEl?.dataset.action;
        console.log('[EventListeners] Click - action:', action, 'target:', target.tagName, target.className);

        // Check if click is inside any modal overlay
        const isInsideModal = target.closest('.combat-overlay') ||
                              target.closest('.damage-dice-overlay') ||
                              target.closest('.room-effect-dice-overlay') ||
                              target.closest('.event-dice-overlay');

        // Click outside sidebar to close it (but not if inside modal)
        if (sidebarOpen && !isInsideModal) {
            const sidebar = mountEl.querySelector('.game-sidebar');
            const toggleBtn = mountEl.querySelector('.sidebar-toggle');
            const cardsViewModal = mountEl.querySelector('.cards-view-overlay');
            const isClickInsideSidebar = sidebar?.contains(target);
            const isClickOnToggle = toggleBtn?.contains(target);
            const isClickInsideCardsView = cardsViewModal?.contains(target);

            if (!isClickInsideSidebar && !isClickOnToggle && !isClickInsideCardsView) {
                closeSidebar(mountEl);
            }
        }

        // Click outside turn order to collapse it (but not if inside modal)
        if (turnOrderExpanded && !isInsideModal) {
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

        // === COMBAT MODAL HANDLERS (in async block) ===

        // Combat: Attack button clicked
        if (action === 'combat-attack') {
            console.log('[Combat] Attack clicked - combatModal:', combatModal?.phase, 'isOpen:', combatModal?.isOpen);
            if (!combatModal || combatModal.phase !== 'confirm') {
                console.log('[Combat] Attack blocked - combatModal null or phase not confirm');
                return;
            }

            // Start attack - move to attacker roll phase
            combatModal.phase = 'attacker_roll';
            combatModal.inputValue = '';

            // Sync combat state to server for multiplayer
            if (currentGameState) {
                currentGameState.combatState = {
                    isActive: true,
                    attackerId: combatModal.attackerId,
                    defenderId: combatModal.defenderId,
                    phase: 'waiting_attacker',
                    attackerRoll: null,
                    defenderRoll: null,
                    attackStat: 'might',
                    winner: null,
                    damage: 0,
                    loserId: null
                };
                syncGameStateToServer();
            }

            console.log('[Combat] Attack initiated');
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Combat: Skip button clicked
        if (action === 'combat-skip') {
            console.log('[Combat] Skip clicked - combatModal:', combatModal?.phase, 'isOpen:', combatModal?.isOpen);
            if (!combatModal || combatModal.phase !== 'confirm') {
                console.log('[Combat] Skip blocked - combatModal null or phase not confirm');
                return;
            }

            console.log('[Combat] Skipped combat');
            closeCombatModal(mountEl, false); // false = don't skip move, continue
            return;
        }

        // Combat: Confirm attacker roll
        if (action === 'combat-attacker-confirm') {
            if (!combatModal || combatModal.phase !== 'attacker_roll') return;

            const inputEl = /** @type {HTMLInputElement} */ (
                mountEl.querySelector('#combat-roll-input')
            );
            const value = parseInt(inputEl?.value || '0', 10);

            if (isNaN(value) || value < 0) return;

            combatModal.attackerRoll = value;
            combatModal.phase = 'waiting_defender';
            combatModal.inputValue = '';

            // Sync to server - defender will see the attacker's roll
            if (currentGameState && currentGameState.combatState) {
                currentGameState.combatState.attackerRoll = value;
                currentGameState.combatState.phase = 'waiting_defender';
                syncGameStateToServer();
            }

            console.log('[Combat] Attacker rolled:', value);
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Combat: Random attacker roll
        if (action === 'combat-attacker-random') {
            if (!combatModal || combatModal.phase !== 'attacker_roll') return;

            const diceCount = combatModal.attackerDiceCount || 1;
            let total = 0;
            for (let i = 0; i < diceCount; i++) {
                total += Math.floor(Math.random() * 3); // 0, 1, or 2
            }

            combatModal.attackerRoll = total;
            combatModal.phase = 'waiting_defender';
            combatModal.inputValue = '';

            // Sync to server
            if (currentGameState && currentGameState.combatState) {
                currentGameState.combatState.attackerRoll = total;
                currentGameState.combatState.phase = 'waiting_defender';
                syncGameStateToServer();
            }

            console.log('[Combat] Attacker random roll:', total);
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Combat: Confirm defender roll
        if (action === 'combat-defender-confirm') {
            if (!combatModal || combatModal.phase !== 'defender_roll') return;

            const inputEl = /** @type {HTMLInputElement} */ (
                mountEl.querySelector('#combat-roll-input')
            );
            const value = parseInt(inputEl?.value || '0', 10);

            if (isNaN(value) || value < 0) return;

            combatModal.defenderRoll = value;

            // Calculate result
            const result = calculateCombatResult(combatModal.attackerRoll, value);
            combatModal.winner = result.winner;
            combatModal.damage = result.damage;
            combatModal.loserId = result.loserId;
            combatModal.phase = 'result';
            combatModal.inputValue = '';

            // Sync to server
            if (currentGameState && currentGameState.combatState) {
                currentGameState.combatState.defenderRoll = value;
                currentGameState.combatState.phase = 'result';
                currentGameState.combatState.winner = result.winner;
                currentGameState.combatState.damage = result.damage;
                currentGameState.combatState.loserId = result.loserId;
                syncGameStateToServer();
            }

            console.log('[Combat] Defender rolled:', value, 'Result:', result);
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Combat: Random defender roll
        if (action === 'combat-defender-random') {
            if (!combatModal || combatModal.phase !== 'defender_roll') return;

            const diceCount = combatModal.defenderDiceCount || 1;
            let total = 0;
            for (let i = 0; i < diceCount; i++) {
                total += Math.floor(Math.random() * 3); // 0, 1, or 2
            }

            combatModal.defenderRoll = total;

            // Calculate result
            const result = calculateCombatResult(combatModal.attackerRoll, total);
            combatModal.winner = result.winner;
            combatModal.damage = result.damage;
            combatModal.loserId = result.loserId;
            combatModal.phase = 'result';
            combatModal.inputValue = '';

            // Sync to server
            if (currentGameState && currentGameState.combatState) {
                currentGameState.combatState.defenderRoll = total;
                currentGameState.combatState.phase = 'result';
                currentGameState.combatState.winner = result.winner;
                currentGameState.combatState.damage = result.damage;
                currentGameState.combatState.loserId = result.loserId;
                syncGameStateToServer();
            }

            console.log('[Combat] Defender random roll:', total, 'Result:', result);
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Combat: Continue after result (loser takes damage)
        if (action === 'combat-continue') {
            if (!combatModal || combatModal.phase !== 'result') return;

            const loserId = combatModal.loserId;
            const isLoser = loserId === mySocketId;
            const attackerLost = combatModal.winner === 'defender';
            const damage = combatModal.damage;
            const isForced = combatModal.isForced;

            // If there's damage and a loser exists
            if (damage > 0 && loserId) {
                console.log('[Combat] Combat result - loser:', loserId, 'damage:', damage, 'isForced:', isForced, 'isDebugMode:', isDebugMode);

                // In debug mode or forced attack, apply damage directly to loser
                // since all players are controlled by same user
                if (isDebugMode || isForced) {
                    console.log('[Combat] Debug/Forced mode - applying physical damage to loser:', loserId, 'damage:', damage);
                    closeCombatModal(mountEl, attackerLost);

                    // Apply physical damage to loser (combat uses Might, so physical damage)
                    // In debug mode, damage goes directly to might stat
                    applyStatChange(loserId, 'might', -damage);
                    syncGameStateToServer();
                    updateGameUI(mountEl, currentGameState, mySocketId);
                } else if (isLoser) {
                    // Multiplayer - loser clicks, open damage distribution modal
                    // Combat damage is always physical (Might vs Might)
                    console.log('[Combat] Opening damage distribution modal for loser:', loserId);
                    closeCombatModal(mountEl, attackerLost);
                    openDamageDistributionModal(mountEl, damage, 'combat', 'physical');
                } else {
                    // Multiplayer - winner clicks, just close and wait for loser
                    closeCombatModal(mountEl, attackerLost);
                }
            } else {
                // No damage (tie) or no loser, just close
                closeCombatModal(mountEl, attackerLost);
            }
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

        // Reset debug game - open confirmation modal
        if (action === 'reset-debug-game') {
            resetGameModal = { isOpen: true };
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Close reset game modal
        if (action === 'close-reset-game') {
            resetGameModal = null;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Confirm reset game
        if (action === 'confirm-reset-game') {
            resetGameModal = null;
            await socketClient.resetDebugGame();
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
            // Get already used dice values to avoid duplicates
            const usedValues = new Set(Object.values(currentGameState?.diceRolls || {}));

            // Build array of available values (1-16 excluding used ones)
            const availableValues = [];
            for (let i = 1; i <= 16; i++) {
                if (!usedValues.has(i)) {
                    availableValues.push(i);
                }
            }

            // Pick random from available values (fallback to 1-16 if all used somehow)
            const randomValue = availableValues.length > 0
                ? availableValues[Math.floor(Math.random() * availableValues.length)]
                : Math.floor(Math.random() * 16) + 1;

            await socketClient.rollDice(randomValue);
            return;
        }

        // Trigger haunt (multiplayer mode) - random traitor selection
        if (action === 'trigger-haunt') {
            if (currentGameState && !isHauntTriggered(currentGameState)) {
                const players = currentGameState.players || [];
                if (players.length > 0) {
                    // Random select traitor from all players
                    const randomIndex = Math.floor(Math.random() * players.length);
                    const traitorId = players[randomIndex].id;
                    const traitorPlayer = players[randomIndex];
                    const traitorName = getCharacterName(traitorPlayer.characterId);

                    // Random haunt number (1-50)
                    const hauntNumber = Math.floor(Math.random() * 50) + 1;

                    // Apply haunt state locally
                    applyHauntState(currentGameState, {
                        hauntNumber: hauntNumber,
                        traitorId: traitorId,
                        triggeredByPlayerId: mySocketId,
                        triggerOmen: 'random',
                        triggerRoom: 'Unknown',
                    });

                    console.log('[Haunt] Triggered! Traitor:', traitorId, 'Haunt #:', hauntNumber);

                    // Sync haunt state to server for multiplayer
                    await socketClient.syncGameState({
                        hauntState: currentGameState.hauntState,
                        playerState: {
                            characterData: currentGameState.playerState?.characterData || currentGameState.characterData
                        }
                    });

                    // Show haunt announcement modal
                    const myFaction = getFaction(currentGameState, mySocketId);
                    const amITraitor = myFaction === 'traitor';
                    showHauntAnnouncementModal(mountEl, hauntNumber, traitorName, amITraitor);

                    updateGameUI(mountEl, currentGameState, mySocketId);
                }
            }
            return;
        }

        // Move - use same logic as debug mode for consistency
        if (action === 'move') {
            const moveTarget = target.closest('[data-direction]');
            const uiDirection = moveTarget?.dataset.direction;
            // Convert UI direction (up/down/left/right) to cardinal direction (north/south/west/east)
            const directionMap = { up: 'north', down: 'south', left: 'west', right: 'east' };
            const direction = directionMap[uiDirection];
            console.log('[Move] Action:', action, 'UI Direction:', uiDirection, 'Cardinal:', direction);
            if (direction) {
                // Use same logic as debug mode - handleMove will check for room discovery, tokens, etc.
                handleMove(mountEl, direction);
            }
            return;
        }

        // === Room Discovery Modal Actions (same as debug mode) ===

        // Select room and go to rotation step (matches button action)
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

        // Confirm room selection (go to rotation step) - legacy action name
        if (action === 'confirm-room-select') {
            const hiddenInput = mountEl.querySelector('#room-select-value');
            const selectedRoom = hiddenInput?.value;
            if (selectedRoom && roomDiscoveryModal) {
                // Find first valid rotation
                const roomDef = ROOMS.find(r => r.name.en === selectedRoom);
                if (roomDef) {
                    const initialRotation = findFirstValidRotation(roomDef, roomDiscoveryModal.doorSide);
                    roomDiscoveryModal.selectedRoom = selectedRoom;
                    roomDiscoveryModal.currentRotation = initialRotation;
                    updateGameUI(mountEl, currentGameState, mySocketId);
                }
            } else {
                alert('Vui long chon mot phong');
            }
            return;
        }

        // Rotate room preview
        if (action === 'rotate-room') {
            if (roomDiscoveryModal && roomDiscoveryModal.selectedRoom) {
                roomDiscoveryModal.currentRotation = (roomDiscoveryModal.currentRotation + 90) % 360;
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
            return;
        }

        // Confirm room placement with rotation
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

        // Select room from list
        if (target.closest('.room-discovery__item') && target.closest('#room-list')) {
            const item = /** @type {HTMLElement} */ (target.closest('.room-discovery__item'));
            const roomName = item.dataset.roomName;
            const searchInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#room-search-input'));
            const hiddenInput = /** @type {HTMLInputElement} */ (mountEl.querySelector('#room-select-value'));

            if (searchInput) searchInput.value = item.textContent || '';
            if (hiddenInput) hiddenInput.value = roomName || '';

            mountEl.querySelectorAll('#room-list .room-discovery__item').forEach(el => el.classList.remove('is-selected'));
            item.classList.add('is-selected');
            return;
        }

        // Random room selection
        if (action === 'random-room') {
            handleRandomRoomDiscovery(mountEl);
            return;
        }

        // Cancel room discovery
        if (action === 'cancel-room-discovery') {
            cancelRoomDiscovery(mountEl);
            return;
        }

        // === Token Drawing Actions (same as debug mode) ===

        if (action === 'token-draw-random') {
            handleRandomCardDraw(mountEl);
            return;
        }

        if (action === 'token-draw-next') {
            handleTokenDrawNext(mountEl);
            return;
        }

        // Select card from token list
        if (target.closest('.token-card__item') && target.closest('#token-card-list')) {
            const item = /** @type {HTMLElement} */ (target.closest('.token-card__item'));
            const cardId = item.dataset.cardId;
            if (cardId && tokenDrawingModal) {
                const current = tokenDrawingModal.tokensToDrawn[tokenDrawingModal.currentIndex];
                if (current) {
                    current.selectedCard = cardId;
                    current.drawn = true;
                    updateGameUI(mountEl, currentGameState, mySocketId);
                }
            }
            return;
        }

        // === Stairs/Elevator Actions (same as debug mode) ===

        if (action === 'use-stairs') {
            const stairsEl = target.closest('[data-action="use-stairs"]');
            const targetRoom = stairsEl?.dataset.target;
            if (targetRoom) {
                handleDebugUseStairs(mountEl, targetRoom);
            }
            return;
        }

        if (action === 'use-elevator') {
            const elevatorEl = target.closest('[data-action="use-elevator"]');
            const targetFloor = elevatorEl?.dataset.floor;
            if (targetFloor) {
                handleDebugUseElevator(mountEl, targetFloor);
            }
            return;
        }

        // === Event Dice Modal Actions (immediate roll for event cards) ===

        // Event dice - stat selection confirmed (for events with choice like "con_nhen")
        if (action === 'event-stat-confirm') {
            console.log('[EventDice] event-stat-confirm clicked, eventDiceModal:', eventDiceModal);
            if (!eventDiceModal) return;
            const selectedStat = eventDiceModal.tempSelectedStat;
            console.log('[EventDice] selectedStat:', selectedStat);
            if (selectedStat) {
                eventDiceModal.selectedStat = selectedStat;
                eventDiceModal.diceCount = getPlayerStatForDice(mySocketId, selectedStat);
                console.log('[EventDice] Updated - selectedStat:', eventDiceModal.selectedStat, 'diceCount:', eventDiceModal.diceCount);
                skipMapCentering = true;
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
            return;
        }

        // Event dice confirm (manual input)
        if (action === 'event-dice-confirm') {
            if (!eventDiceModal) return;
            const input = mountEl.querySelector('[data-input="event-dice-value"]');
            const value = parseInt(input?.value, 10);
            // Accept any non-negative number (no max limit for dice results)
            if (!isNaN(value) && value >= 0) {
                eventDiceModal.result = value;
                eventDiceModal.inputValue = value.toString();
                skipMapCentering = true;
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
            return;
        }

        // Event dice random roll
        if (action === 'event-dice-random') {
            if (!eventDiceModal) return;
            const diceCount = eventDiceModal.eventCard?.fixedDice || eventDiceModal.diceCount || 1;
            // Roll diceCount dice (each 0-2) and sum
            let total = 0;
            for (let i = 0; i < diceCount; i++) {
                total += Math.floor(Math.random() * 3); // 0, 1, or 2
            }
            eventDiceModal.result = total;
            eventDiceModal.inputValue = total.toString();
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Event dice continue/apply result
        if (action === 'event-dice-continue') {
            if (!eventDiceModal) return;

            const { eventCard, result, currentRollIndex, selectedStat } = eventDiceModal;
            const isMultiRoll = eventCard?.rollStats && Array.isArray(eventCard.rollStats);
            const currentStat = isMultiRoll ? eventCard.rollStats[currentRollIndex] : (selectedStat || eventCard.rollStat);

            if (isMultiRoll) {
                // Save current result
                eventDiceModal.allResults.push({ stat: currentStat, result: result });

                // Check if more rolls needed
                if (currentRollIndex < eventCard.rollStats.length - 1) {
                    // Move to next roll
                    const nextStat = eventCard.rollStats[currentRollIndex + 1];
                    eventDiceModal.currentRollIndex++;
                    eventDiceModal.diceCount = getPlayerStatForDice(mySocketId, nextStat);
                    eventDiceModal.inputValue = '';
                    eventDiceModal.result = null;
                    skipMapCentering = true;
                    updateGameUI(mountEl, currentGameState, mySocketId);
                    return;
                }

                // All rolls done - apply multi-roll results
                console.log('[EventDice] Multi-roll complete:', eventDiceModal.allResults);
                const allRollResults = [...eventDiceModal.allResults, { stat: currentStat, result: result }];

                // Apply results for each stat
                allRollResults.forEach(r => {
                    const outcome = findMatchingOutcome(eventCard.rollResults, r.result);
                    if (outcome && outcome.effect === 'loseStat') {
                        applyStatChange(mySocketId, r.stat, -(outcome.amount || 1));
                    }
                });

                // Close modal
                eventDiceModal = null;
                skipMapCentering = true;

                // Sync state with server in multiplayer mode
                syncGameStateToServer();

                updateGameUI(mountEl, currentGameState, mySocketId);
                return;
            }

            // Single roll - apply result using the same function as debug mode
            applyEventDiceResult(mountEl, result, currentStat);
            return;
        }

        // Event dice stat selection (for con_nhen)
        if (action === 'event-dice-select-stat') {
            if (!eventDiceModal) return;
            const stat = actionEl?.dataset.stat;
            if (stat) {
                eventDiceModal.selectedStat = stat;
                eventDiceModal.diceCount = getPlayerStatForDice(mySocketId, stat);
                skipMapCentering = true;
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
            return;
        }

        // === Damage Dice Modal Actions ===

        // Damage dice stat selection
        // Damage dice confirm (manual input) - NEW FLOW: roll first, then distribute
        if (action === 'damage-dice-confirm') {
            if (!damageDiceModal) return;
            const input = mountEl.querySelector('[data-input="damage-dice-value"]');
            const value = parseInt(input?.value, 10);

            // Accept any non-negative number (no max limit for dice results)
            if (!isNaN(value) && value >= 0) {
                if (damageDiceModal.currentPhase === 'rollPhysical') {
                    damageDiceModal.physicalResult = value;
                    // Check if mental damage also needed
                    if (damageDiceModal.mentalDice > 0) {
                        damageDiceModal.currentPhase = 'rollMental';
                        damageDiceModal.inputValue = '';
                        skipMapCentering = true;
                        updateGameUI(mountEl, currentGameState, mySocketId);
                    } else {
                        // Only physical damage - open distribution modal
                        const physicalDamage = damageDiceModal.physicalResult;
                        damageDiceModal = null; // Close dice modal
                        openDamageDistributionModal(mountEl, physicalDamage, 'event', 'physical');
                    }
                } else if (damageDiceModal.currentPhase === 'rollMental') {
                    damageDiceModal.mentalResult = value;
                    // Done rolling - open distribution modal for mental damage
                    // If there was physical damage too, we need to handle both
                    const physicalDamage = damageDiceModal.physicalResult || 0;
                    const mentalDamage = damageDiceModal.mentalResult;
                    damageDiceModal = null; // Close dice modal

                    if (physicalDamage > 0) {
                        // Both damages - open physical first, then mental after
                        // For now, open physical first
                        openDamageDistributionModal(mountEl, physicalDamage, 'event', 'physical');
                        // Store pending mental damage to apply after physical
                        pendingMentalDamage = mentalDamage;
                    } else {
                        // Only mental damage
                        openDamageDistributionModal(mountEl, mentalDamage, 'event', 'mental');
                    }
                }
            }
            return;
        }

        // Damage dice random roll - NEW FLOW
        if (action === 'damage-dice-random') {
            if (!damageDiceModal) return;
            const isPhysical = damageDiceModal.currentPhase === 'rollPhysical';
            const currentDice = isPhysical ? damageDiceModal.physicalDice : damageDiceModal.mentalDice;

            // Roll dice (each 0-2) and sum
            let total = 0;
            for (let i = 0; i < currentDice; i++) {
                total += Math.floor(Math.random() * 3);
            }

            if (isPhysical) {
                damageDiceModal.physicalResult = total;
                if (damageDiceModal.mentalDice > 0) {
                    damageDiceModal.currentPhase = 'rollMental';
                    damageDiceModal.inputValue = '';
                    skipMapCentering = true;
                    updateGameUI(mountEl, currentGameState, mySocketId);
                } else {
                    // Only physical damage - open distribution modal
                    const physicalDamage = damageDiceModal.physicalResult;
                    damageDiceModal = null;
                    openDamageDistributionModal(mountEl, physicalDamage, 'event', 'physical');
                }
            } else {
                damageDiceModal.mentalResult = total;
                const physicalDamage = damageDiceModal.physicalResult || 0;
                const mentalDamage = damageDiceModal.mentalResult;
                damageDiceModal = null;

                if (physicalDamage > 0) {
                    openDamageDistributionModal(mountEl, physicalDamage, 'event', 'physical');
                    pendingMentalDamage = mentalDamage;
                } else {
                    openDamageDistributionModal(mountEl, mentalDamage, 'event', 'mental');
                }
            }
            return;
        }

        // Dice event - open modal
        if (action === 'dice-event') {
            diceEventModal = {
                isOpen: true,
                inputValue: '',
                result: null
            };
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Dice event confirm (manual input)
        if (action === 'dice-event-confirm') {
            const input = mountEl.querySelector('[data-input="dice-event-value"]');
            const value = parseInt(input?.value, 10);
            // Accept any non-negative number (no max limit for dice results)
            if (!isNaN(value) && value >= 0) {
                diceEventModal = {
                    ...diceEventModal,
                    result: value
                };
                skipMapCentering = true;
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
            return;
        }

        // Dice event random roll
        if (action === 'dice-event-random') {
            const randomValue = Math.floor(Math.random() * 17); // 0-16
            diceEventModal = {
                ...diceEventModal,
                result: randomValue
            };
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Close dice event modal
        if (action === 'close-dice-event') {
            // Don't close if clicking inside modal content (except close button)
            const isInsideModalContent = target.closest('[data-modal-content="true"]');
            const isCloseButton = target.closest('.dice-event-modal__close') || target.closest('.dice-event-modal__btn--close');
            if (isInsideModalContent && !isCloseButton) {
                return;
            }
            diceEventModal = null;
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Open end turn modal
        if (action === 'open-end-turn') {
            const myTurn = isMyTurn(currentGameState, mySocketId);
            const movesLeft = currentGameState?.playerMoves?.[mySocketId] ?? 0;
            // Only show modal if it's my turn and I have moves left
            if (myTurn && movesLeft > 0) {
                endTurnModal = { isOpen: true };
                skipMapCentering = true;
                updateGameUI(mountEl, currentGameState, mySocketId);
            }
            return;
        }

        // Close end turn modal
        if (action === 'close-end-turn') {
            // Don't close if clicking inside modal content (except close button)
            const isInsideModalContent = target.closest('[data-modal-content="true"]');
            const isCloseButton = target.closest('.end-turn-modal__close');
            if (isInsideModalContent && !isCloseButton) {
                return;
            }
            endTurnModal = null;
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Continue turn (close modal and continue playing)
        if (action === 'continue-turn') {
            endTurnModal = null;
            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Confirm end turn (skip remaining moves)
        if (action === 'confirm-end-turn') {
            endTurnModal = null;
            handleEndTurn(mountEl);
            return;
        }

        // View character detail
        if (action === 'view-character-detail') {
            const actionEl = target.closest('[data-action]');
            const charId = actionEl?.dataset.characterId;
            if (charId && currentGameState) {
                // Find the player who owns this character
                const player = currentGameState.players?.find(p => p.characterId === charId);
                const playerId = player?.id;
                // Get current stats for this character's owner
                const characterData = playerId
                    ? (currentGameState.playerState?.characterData?.[playerId] || currentGameState.characterData?.[playerId])
                    : null;
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

        // ===== DAMAGE DISTRIBUTION MODAL HANDLERS (multiplayer mode) =====

        // Damage distribution: Type selection
        if (action === 'damage-type-select') {
            if (!damageDistributionModal) return;

            const type = actionEl?.dataset?.type; // 'physical' or 'mental'
            damageDistributionModal.damageType = type;

            if (type === 'physical') {
                damageDistributionModal.stat1 = 'speed';
                damageDistributionModal.stat2 = 'might';
            } else {
                damageDistributionModal.stat1 = 'sanity';
                damageDistributionModal.stat2 = 'knowledge';
            }

            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Damage distribution: Adjust damage allocation (+/- buttons)
        if (action === 'damage-adjust') {
            if (!damageDistributionModal) return;

            const statNum = actionEl?.dataset?.stat; // '1' or '2'
            const delta = parseInt(actionEl?.dataset?.delta || '0', 10); // +1 or -1

            const remaining = damageDistributionModal.totalDamage -
                damageDistributionModal.stat1Damage - damageDistributionModal.stat2Damage;

            console.log('[DamageAdjust] statNum:', statNum, 'delta:', delta, 'remaining:', remaining,
                'stat1Damage:', damageDistributionModal.stat1Damage, 'stat2Damage:', damageDistributionModal.stat2Damage);

            if (statNum === '1') {
                const newValue = damageDistributionModal.stat1Damage + delta;
                // Allow assigning damage even if it exceeds current stat index (stats will clamp to 0)
                // Player can assign all damage to one stat - stats will just stop at 0
                if (newValue >= 0 && (delta < 0 || remaining > 0)) {
                    damageDistributionModal.stat1Damage = newValue;
                    console.log('[DamageAdjust] Updated stat1Damage to:', newValue);
                }
            } else if (statNum === '2') {
                const newValue = damageDistributionModal.stat2Damage + delta;
                if (newValue >= 0 && (delta < 0 || remaining > 0)) {
                    damageDistributionModal.stat2Damage = newValue;
                    console.log('[DamageAdjust] Updated stat2Damage to:', newValue);
                }
            }

            skipMapCentering = true;
            updateGameUI(mountEl, currentGameState, mySocketId);
            return;
        }

        // Damage distribution: Confirm and apply
        if (action === 'damage-dist-confirm') {
            if (!damageDistributionModal) return;

            const { stat1, stat2, stat1Damage, stat2Damage, totalDamage } = damageDistributionModal;
            const remaining = totalDamage - stat1Damage - stat2Damage;

            // Check if stats can absorb more damage
            const charData = currentGameState?.playerState?.characterData?.[mySocketId];
            const stat1Index = charData?.stats?.[stat1] ?? 0;
            const stat2Index = charData?.stats?.[stat2] ?? 0;
            const stat1CanAbsorb = Math.max(0, stat1Index - stat1Damage);
            const stat2CanAbsorb = Math.max(0, stat2Index - stat2Damage);
            const totalCanAbsorb = stat1CanAbsorb + stat2CanAbsorb;

            // Allow confirm if all damage distributed OR stats can't absorb more
            if (remaining !== 0 && totalCanAbsorb > 0) {
                console.log('[DamageDistConfirm] Cannot confirm - remaining:', remaining, 'totalCanAbsorb:', totalCanAbsorb);
                return;
            }

            if (remaining > 0) {
                console.log('[DamageDistConfirm] Confirming with wasted damage:', remaining, '(stats at max capacity)');
            }

            closeDamageDistributionModal(mountEl);
            return;
        }

        // ===== EVENT RESULT MODAL HANDLER =====
        if (action === 'close-event-result') {
            if (!eventResultModal) return;
            closeEventResultModal(mountEl);
            return;
        }
    });

    // Change event for select elements (dropdowns)
    mountEl.addEventListener('change', (e) => {
        const target = /** @type {HTMLSelectElement} */ (e.target);

        // Event dice - stat selection changed (enable/disable confirm button)
        if (target.matches('[data-input="event-stat-select"]')) {
            if (!eventDiceModal) return;
            const selectedStat = target.value;
            // Store temp selection but don't confirm yet
            eventDiceModal.tempSelectedStat = selectedStat;
            // Enable/disable confirm button based on selection
            const confirmBtn = mountEl.querySelector('[data-action="event-stat-confirm"]');
            if (confirmBtn) {
                /** @type {HTMLButtonElement} */ (confirmBtn).disabled = !selectedStat;
            }
            return;
        }

        // Damage dice - stat selection for physical damage
        if (target.matches('[data-input="damage-physical-stat-select"]')) {
            if (!damageDiceModal) return;
            const selectedStat = target.value;
            damageDiceModal.tempPhysicalStat = selectedStat;
            const confirmBtn = mountEl.querySelector('[data-action="damage-physical-stat-confirm"]');
            if (confirmBtn) {
                /** @type {HTMLButtonElement} */ (confirmBtn).disabled = !selectedStat;
            }
            return;
        }

        // Damage dice - stat selection for mental damage
        if (target.matches('[data-input="damage-mental-stat-select"]')) {
            if (!damageDiceModal) return;
            const selectedStat = target.value;
            damageDiceModal.tempMentalStat = selectedStat;
            const confirmBtn = mountEl.querySelector('[data-action="damage-mental-stat-confirm"]');
            if (confirmBtn) {
                /** @type {HTMLButtonElement} */ (confirmBtn).disabled = !selectedStat;
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

    // Save scroll position before re-render if we need to preserve it
    let savedScrollLeft = 0;
    let savedScrollTop = 0;
    if (skipMapCentering) {
        const gameMap = mountEl.querySelector('.game-map');
        if (gameMap) {
            savedScrollLeft = gameMap.scrollLeft;
            savedScrollTop = gameMap.scrollTop;
        }
    }

    const html = renderGameScreen(gameState, myId);
    mountEl.innerHTML = html;

    // Skip centering if flag is set (e.g., when toggling turn order, closing modals)
    if (skipMapCentering) {
        skipMapCentering = false;
        // Restore scroll position after DOM update
        requestAnimationFrame(() => {
            const gameMap = mountEl.querySelector('.game-map');
            if (gameMap) {
                gameMap.scrollLeft = savedScrollLeft;
                gameMap.scrollTop = savedScrollTop;
            }
        });
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
 * Handle move - unified logic for both debug and multiplayer modes
 * @param {HTMLElement} mountEl
 * @param {string} direction - cardinal direction (north/south/east/west)
 */
function handleMove(mountEl, direction) {
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

    // === CHECK EXIT ROOM EFFECT ===
    // Check if current room has EXIT effect that needs dice roll
    if (currentRoom && currentRoom.name) {
        const currentRoomName = currentRoom.name;
        if (needsRoomEffectRoll(currentRoomName, 'exit', playerId)) {
            console.log('[RoomEffect] EXIT effect triggered for room:', currentRoomName);
            openRoomEffectDiceModal(mountEl, currentRoomName, {
                direction: direction,
                targetRoomId: null,
                targetRoomName: null
            });
            return; // Wait for dice roll
        }
    }

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
                    // === CHECK ENTER ROOM EFFECT ===
                    // Check if target room has ENTER effect that needs dice roll
                    const targetRoomName = existingRoom.name;
                    if (targetRoomName && needsRoomEffectRoll(targetRoomName, 'enter', playerId)) {
                        console.log('[RoomEffect] ENTER effect triggered for room:', targetRoomName);
                        openRoomEffectDiceModal(mountEl, targetRoomName, {
                            direction: direction,
                            targetRoomId: existingRoomId,
                            targetRoomName: targetRoomName
                        });
                        return; // Wait for dice roll
                    }

                    // Create connection FIRST
                    if (!mapConnections[currentRoomId]) mapConnections[currentRoomId] = {};
                    if (!mapConnections[existingRoomId]) mapConnections[existingRoomId] = {};
                    mapConnections[currentRoomId][doorDirection] = existingRoomId;
                    mapConnections[existingRoomId][oppositeDir] = currentRoomId;

                    // Clear completed combat flag when leaving current room
                    clearCompletedCombatForPlayer(playerId, currentRoomId);

                    // Move player FIRST (before combat check)
                    currentGameState.playerState.playerPositions[playerId] = existingRoomId;
                    currentGameState.playerMoves[playerId] = moves - 1;

                    // Track entry direction (opposite of door direction = which side player entered from)
                    if (!currentGameState.playerState.playerEntryDirections) {
                        currentGameState.playerState.playerEntryDirections = {};
                    }
                    currentGameState.playerState.playerEntryDirections[playerId] = oppositeDir;

                    // === CHECK COMBAT TRIGGER (after player has moved into room) ===
                    // If haunt is triggered and enemy is in target room, open combat modal
                    const enemyInExistingRoom = getEnemyInRoom(existingRoomId, playerId);
                    if (enemyInExistingRoom) {
                        console.log('[Combat] Enemy detected in room:', existingRoomId, 'enemy:', enemyInExistingRoom.id);
                        // Sync position first so all players see both characters in the same room
                        syncGameStateToServer();
                        // Then open combat modal (player is already in the room)
                        openCombatModal(mountEl, playerId, enemyInExistingRoom.id, null);
                        return; // Wait for combat resolution
                    }

                    // Apply Vault spawn position if entering Vault room
                    applyVaultSpawnPosition(playerId, existingRoom, currentGameState);

                    // Check if target room has tokens and hasn't been drawn yet
                    if (existingRoom.tokens && existingRoom.tokens.length > 0) {
                        if (!currentGameState.playerState.drawnRooms) {
                            currentGameState.playerState.drawnRooms = [];
                        }
                        if (!currentGameState.playerState.drawnRooms.includes(existingRoomId)) {
                            currentGameState.playerState.drawnRooms.push(existingRoomId);
                            // Sync state BEFORE token drawing (so other players see position update)
                            syncGameStateToServer();
                            initTokenDrawing(mountEl, existingRoom.tokens);
                            updateGameUI(mountEl, currentGameState, mySocketId);
                            return; // Don't end turn yet
                        }
                    }

                    // Check if turn ended - advance to next player
                    if (currentGameState.playerMoves[playerId] <= 0) {
                        console.log('[Turn] Player', playerId, 'moves depleted after elevator move, advancing turn');
                        advanceToNextTurn();
                    }

                    // Sync state with server in multiplayer mode
                    syncGameStateToServer();

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

    // === CHECK ENTER ROOM EFFECT (for rooms with existing connection) ===
    const targetRoom = revealedRooms[targetRoomId];
    if (targetRoom && targetRoom.name) {
        const targetRoomName = targetRoom.name;
        if (needsRoomEffectRoll(targetRoomName, 'enter', playerId)) {
            console.log('[RoomEffect] ENTER effect triggered for room:', targetRoomName);
            openRoomEffectDiceModal(mountEl, targetRoomName, {
                direction: direction,
                targetRoomId: targetRoomId,
                targetRoomName: targetRoomName
            });
            return; // Wait for dice roll
        }
    }

    // Clear completed combat flag when leaving current room
    // This allows combat to trigger again if player re-enters
    clearCompletedCombatForPlayer(playerId, currentRoomId);

    // Move to target room FIRST (before combat check)
    currentGameState.playerState.playerPositions[playerId] = targetRoomId;

    // Track entry direction (opposite of door direction = which side player entered from)
    if (!currentGameState.playerState.playerEntryDirections) {
        currentGameState.playerState.playerEntryDirections = {};
    }
    const oppositeDir = getOppositeDoor(doorDirection);
    currentGameState.playerState.playerEntryDirections[playerId] = oppositeDir;

    // Decrease moves
    currentGameState.playerMoves[playerId] = moves - 1;

    // === CHECK COMBAT TRIGGER (after player has moved into room) ===
    // If haunt is triggered and enemy is in the same room, open combat modal
    const enemyInTargetRoom = getEnemyInRoom(targetRoomId, playerId);
    if (enemyInTargetRoom) {
        console.log('[Combat] Enemy detected in room:', targetRoomId, 'enemy:', enemyInTargetRoom.id);

        // Sync position first so all players see both characters in the same room
        syncGameStateToServer();

        // Then open combat modal (player is already in the room)
        openCombatModal(mountEl, playerId, enemyInTargetRoom.id, null);
        return; // Wait for combat resolution
    }

    // Apply Vault spawn position if entering Vault room
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

            // Sync state BEFORE token drawing (so other players see position update)
            syncGameStateToServer();

            // Trigger token drawing
            initTokenDrawing(mountEl, targetRoom.tokens);
            updateGameUI(mountEl, currentGameState, mySocketId);
            return; // Don't end turn yet
        }
    }

    // Check if turn ended - auto advance to next player
    if (currentGameState.playerMoves[playerId] <= 0) {
        console.log('[Turn] Player', playerId, 'moves depleted after movement, advancing turn');
        advanceToNextTurn();
    }

    // Sync state with server in multiplayer mode
    syncGameStateToServer();

    updateGameUI(mountEl, currentGameState, mySocketId);
}

/**
 * Sync local game state changes to server (multiplayer mode)
 */
async function syncGameStateToServer() {

    try {
        // Send updated state to server (including characterData for stat changes, combatState, gameOver, combatResult)
        const result = await socketClient.syncGameState({
            playerMoves: currentGameState.playerMoves,
            playerPositions: currentGameState.playerState?.playerPositions,
            map: currentGameState.map,
            drawnRooms: currentGameState.playerState?.drawnRooms,
            playerCards: currentGameState.playerState?.playerCards,
            playerState: {
                characterData: currentGameState.playerState?.characterData
            },
            currentTurnIndex: currentGameState.currentTurnIndex,
            combatState: currentGameState.combatState || null,
            combatResult: currentGameState.combatResult || null,
            gameOver: currentGameState.gameOver || null
        });
        console.log('[Sync] Game state synced to server:', result);
    } catch (error) {
        console.error('[Sync] Failed to sync game state:', error);
    }
}



/**
 * Advance to next player's turn
 * Updates currentTurnIndex and sets next player's moves
 */
function advanceToNextTurn() {
    if (!currentGameState || !currentGameState.turnOrder?.length) {
        console.log('[Turn] Cannot advance - no game state or turn order');
        return;
    }

    const prevIndex = currentGameState.currentTurnIndex;
    const prevPlayerId = currentGameState.turnOrder[prevIndex];

    // Advance turn index
    currentGameState.currentTurnIndex = (currentGameState.currentTurnIndex + 1) % currentGameState.turnOrder.length;

    const nextIndex = currentGameState.currentTurnIndex;
    const nextPlayerId = currentGameState.turnOrder[nextIndex];
    const nextPlayer = currentGameState.players.find(p => p.id === nextPlayerId);

    // Set moves for next player based on their speed
    if (nextPlayer) {
        const nextCharData = currentGameState.playerState?.characterData?.[nextPlayerId];
        const speed = getCharacterSpeed(nextPlayer.characterId, nextCharData);
        currentGameState.playerMoves[nextPlayerId] = speed;

        console.log('[Turn] === TURN ADVANCED ===');
        console.log('[Turn] Previous: Player', prevPlayerId, 'Index:', prevIndex);
        console.log('[Turn] Next: Player', nextPlayerId, 'Index:', nextIndex, 'Speed:', speed);
        console.log('[Turn] TurnOrder:', currentGameState.turnOrder);
        console.log('[Turn] PlayerMoves:', currentGameState.playerMoves);
    } else {
        console.log('[Turn] ERROR: Next player not found:', nextPlayerId);
    }

    // Reset attack flag for new turn (1 attack per turn rule)
    hasAttackedThisTurn = false;
    console.log('[Turn] Reset hasAttackedThisTurn flag');
}

/**
 * Handle end turn early - skip remaining moves (unified for debug and multiplayer)
 * @param {HTMLElement} mountEl
 */
function handleEndTurn(mountEl) {
    if (!currentGameState || currentGameState.gamePhase !== 'playing') return;

    const playerId = mySocketId;
    const currentTurnPlayer = currentGameState.turnOrder[currentGameState.currentTurnIndex];

    // Only allow if it's this player's turn
    if (playerId !== currentTurnPlayer) {
        console.log('[Turn] Cannot end turn - not your turn. You:', playerId, 'Current:', currentTurnPlayer);
        return;
    }

    console.log('[Turn] Player', playerId, 'ending turn early');

    // Set remaining moves to 0
    currentGameState.playerMoves[playerId] = 0;

    // Advance to next player
    advanceToNextTurn();

    // Sync state with server
    syncGameStateToServer();

    // Update UI
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

    // Clear completed combat flag when leaving current room
    clearCompletedCombatForPlayer(playerId, currentRoomId);

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

        // Sync state BEFORE token drawing (so other players see position update)
        syncGameStateToServer();

        initTokenDrawing(mountEl, newRoom.tokens);
        // Don't end turn yet, wait for token drawing to complete
        updateGameUI(mountEl, currentGameState, mySocketId);
        return;
    }
    
    // Check if turn ended (no more moves) - advance to next player
    if (currentGameState.playerMoves[playerId] <= 0) {
        console.log('[Turn] Player', playerId, 'moves depleted after room discovery, advancing turn');
        advanceToNextTurn();
    }

    // Sync state with server in multiplayer mode
    syncGameStateToServer();

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

    // Collect events that require immediate roll
    let immediateRollEvent = null;

    // Add drawn cards to player inventory
    tokenDrawingModal.tokensToDrawn.forEach(token => {
        if (token.drawn && token.selectedCard) {
            const cardType = token.type === 'omen' ? 'omens' : token.type === 'event' ? 'events' : 'items';
            currentGameState.playerState.playerCards[playerId][cardType].push(token.selectedCard);

            // Check if this event requires immediate dice roll
            if (token.type === 'event' && checkEventRequiresImmediateRoll(token.selectedCard)) {
                immediateRollEvent = token.selectedCard;
            }
        }
    });

    // Close token drawing modal
    tokenDrawingModal = null;

    // If there's an event requiring immediate roll, open event dice modal
    if (immediateRollEvent) {
        console.log('[TokenDrawing] Event requires immediate roll:', immediateRollEvent);
        // Sync state BEFORE opening event dice modal (so other players see cards update)
        syncGameStateToServer();
        openEventDiceModal(mountEl, immediateRollEvent);
        return; // Don't proceed to next turn yet
    }

    // Check if turn ended (no more moves) - advance to next player
    if (currentGameState.playerMoves[playerId] <= 0) {
        console.log('[Turn] Player', playerId, 'moves depleted after token drawing, advancing turn');
        advanceToNextTurn();
    }

    // Sync state with server in multiplayer mode
    syncGameStateToServer();

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
 * @param {{ mountEl: HTMLElement; onNavigate: (hash: string) => void; roomId: string | null }} options
 */
export function renderGameView({ mountEl, onNavigate, roomId }) {
    // Clone and replace mountEl to remove all existing event listeners from previous views
    const newMountEl = mountEl.cloneNode(false);
    mountEl.parentNode?.replaceChild(newMountEl, mountEl);
    mountEl = /** @type {HTMLElement} */ (newMountEl);

    // Reset event listener flag since we have a fresh element
    eventListenersAttached = false;

    // Set debug mode flag based on roomId
    isDebugMode = roomId === 'debug';

    // Reset state for fresh game
    sidebarOpen = false;
    introShown = false;
    movesInitializedForTurn = -1;
    expandedPlayers.clear();
    activePlayers.clear();
    endTurnModal = null;
    
    // Normal mode - connect socket
    socketClient.connect();
    mySocketId = socketClient.getSocketId();

    // Initial loading state
    mountEl.innerHTML = renderGameScreen(null, mySocketId);

    // Loading timeout - redirect to home if stuck too long
    const LOADING_TIMEOUT = 10000; // 10 seconds
    let loadingTimeoutId = setTimeout(() => {
        if (!currentGameState) {
            console.log('[GameView] Loading timeout - room may not exist');
            socketClient.clearSession();
            showToast('Phong khong ton tai hoac da het han', 'error', 3000);
            setTimeout(() => {
                onNavigate('#/');
            }, 1500);
        }
    }, LOADING_TIMEOUT);

    // Clear loading timeout when game state is received
    const clearLoadingTimeout = () => {
        if (loadingTimeoutId) {
            clearTimeout(loadingTimeoutId);
            loadingTimeoutId = null;
        }
    };

    // Track if haunt announcement has been shown
    let hauntAnnouncementShown = false;

    // Subscribe to game state updates
    unsubscribeGameState = socketClient.onGameState((state) => {
        clearLoadingTimeout();

        // Handle debug room waiting state
        if (state?.isDebug) {
            if (state.gamePhase === 'lobby' && state.players?.length < 2) {
                // Waiting for second player in debug mode
                showDebugWaitingPopup();
                currentGameState = state;
                return; // Don't render game UI yet
            } else if (state.gamePhase === 'playing') {
                // Game started - hide waiting popup and skip intro
                hideDebugWaitingPopup();
                introShown = true; // Skip intro in debug mode
            }
        }

        // Check if haunt was just triggered (compare old vs new state)
        const wasHauntTriggered = currentGameState?.hauntState?.hauntTriggered;
        const isHauntTriggeredNow = state?.hauntState?.hauntTriggered;

        // Check if combat result is new (save old value before updating currentGameState)
        const hadCombatResult = currentGameState?.combatResult;
        const newCombatResult = state?.combatResult;

        // Check if game over is new (save old value before updating currentGameState)
        const hadGameOver = currentGameState?.gameOver;
        const newGameOver = state?.gameOver;

        // Check if turn changed - reset attack flag (1 attack per turn rule)
        const oldTurnPlayer = currentGameState?.turnOrder?.[currentGameState?.currentTurnIndex];
        const newTurnPlayer = state?.turnOrder?.[state?.currentTurnIndex];
        console.log('[Turn] onGameState - oldTurnPlayer:', oldTurnPlayer, 'newTurnPlayer:', newTurnPlayer, 'hasAttackedThisTurn before:', hasAttackedThisTurn);
        if (oldTurnPlayer !== newTurnPlayer && oldTurnPlayer !== undefined) {
            hasAttackedThisTurn = false;
            console.log('[Turn] Turn changed via server sync, RESET hasAttackedThisTurn to false');
        }

        currentGameState = state;
        mySocketId = socketClient.getSocketId();

        // Initialize characterData for all players if missing
        ensureCharacterDataInitialized(currentGameState);

        // Debug: Log turn info on state update
        const currentTurnPlayer = state.turnOrder?.[state.currentTurnIndex];
        const myMoves = state.playerMoves?.[mySocketId] ?? 0;
        const currentPlayerMoves = state.playerMoves?.[currentTurnPlayer] ?? 0;
        console.log('[GameState] Update received - currentTurnIndex:', state.currentTurnIndex,
            'currentTurnPlayer:', currentTurnPlayer,
            'mySocketId:', mySocketId,
            'isMyTurn:', currentTurnPlayer === mySocketId,
            'myMoves:', myMoves,
            'currentPlayerMoves:', currentPlayerMoves);

        // Show haunt announcement if haunt was just triggered and we haven't shown it yet
        if (!wasHauntTriggered && isHauntTriggeredNow && !hauntAnnouncementShown) {
            hauntAnnouncementShown = true;
            const hauntNumber = state.hauntState?.hauntNumber || 0;
            const traitorId = state.hauntState?.traitorId;
            const traitorPlayer = state.players?.find(p => p.id === traitorId);
            const traitorName = traitorPlayer ? getCharacterName(traitorPlayer.characterId) : 'Unknown';
            const myFaction = getFaction(state, mySocketId);
            const amITraitor = myFaction === 'traitor';

            console.log('[GameState] Haunt detected! Showing announcement modal. MyFaction:', myFaction);
            showHauntAnnouncementModal(mountEl, hauntNumber, traitorName, amITraitor);
        }

        // Handle combat state from server (for multiplayer sync)
        if (state.combatState?.isActive) {
            const serverCombat = state.combatState;
            const isDefender = serverCombat.defenderId === mySocketId;
            const isAttacker = serverCombat.attackerId === mySocketId;
            const expectedLocalPhase = mapServerPhaseToLocal(serverCombat.phase, isDefender);

            // Only sync from server if:
            // 1. We don't have a combat modal yet (defender receiving attack)
            // 2. OR we're the defender and need to update our view
            // 3. OR the server phase moved forward (result phase)
            // Don't overwrite attacker's local phase when they just updated it
            if (isDefender || isAttacker) {
                const shouldSync = !combatModal ||
                    (isDefender && combatModal.phase !== expectedLocalPhase) ||
                    serverCombat.phase === 'result';

                if (shouldSync) {
                    const attacker = state.players?.find(p => p.id === serverCombat.attackerId);
                    const defender = state.players?.find(p => p.id === serverCombat.defenderId);

                    if (attacker && defender) {
                        const attackerName = getCharacterName(attacker.characterId);
                        const defenderName = getCharacterName(defender.characterId);
                        const defenderFaction = getFaction(state, serverCombat.defenderId);
                        const attackerMight = getCharacterMight(attacker.characterId,
                            state.playerState?.characterData?.[serverCombat.attackerId]);
                        const defenderMight = getCharacterMight(defender.characterId,
                            state.playerState?.characterData?.[serverCombat.defenderId]);

                        combatModal = {
                            isOpen: true,
                            phase: expectedLocalPhase,
                            attackerId: serverCombat.attackerId,
                            defenderId: serverCombat.defenderId,
                            attackerName: attackerName,
                            defenderName: defenderName,
                            defenderFactionLabel: getFactionLabel(defenderFaction),
                            attackStat: 'might',
                            attackerDiceCount: attackerMight,
                            defenderDiceCount: defenderMight,
                            attackerRoll: serverCombat.attackerRoll,
                            defenderRoll: serverCombat.defenderRoll,
                            inputValue: '',
                            winner: serverCombat.winner,
                            damage: serverCombat.damage || 0,
                            loserId: serverCombat.loserId,
                            isForced: serverCombat.isForced || false
                        };

                        console.log('[Combat] Synced from server - phase:', combatModal.phase,
                            'isDefender:', isDefender, 'serverPhase:', serverCombat.phase);
                    }
                } else {
                    // Just update roll values without changing phase
                    if (combatModal && serverCombat.attackerRoll !== null) {
                        combatModal.attackerRoll = serverCombat.attackerRoll;
                    }
                    if (combatModal && serverCombat.defenderRoll !== null) {
                        combatModal.defenderRoll = serverCombat.defenderRoll;
                    }
                }
            }
        } else if (!state.combatState?.isActive && combatModal) {
            // Combat ended on server, close local modal
            // BUT: Don't close if we're the attacker who just opened the modal (race condition protection)
            const isAttackerWhoJustOpened = combatModal.attackerId === mySocketId && combatModal.phase === 'confirm';
            if (!isAttackerWhoJustOpened) {
                console.log('[Combat] Closing modal - server says combat is not active');

                // In debug mode or forced attack, apply damage to loser before closing
                const damage = combatModal.damage || 0;
                const loserId = combatModal.loserId;
                const isForced = combatModal.isForced;

                console.log('[Combat] Close check - isDebugMode:', isDebugMode, 'isForced:', isForced, 'damage:', damage, 'loserId:', loserId);

                // Check if I am the loser and need to distribute damage
                const iAmLoser = loserId === mySocketId;

                // Mark combat as completed before any other processing (1 attack per turn rule)
                const attackerId = combatModal.attackerId;
                const defenderId = combatModal.defenderId;
                if (attackerId && defenderId && state) {
                    const playerPositions = state.playerState?.playerPositions || {};
                    const combatRoomId = playerPositions[attackerId] || playerPositions[defenderId];
                    if (combatRoomId) {
                        markCombatCompleted(combatRoomId, attackerId, defenderId);
                    }
                }

                // In debug mode, always apply damage directly to loser's might
                if (isDebugMode && damage > 0 && loserId) {
                    console.log('[Combat] Debug mode - applying damage to loser:', loserId, 'damage:', damage);
                    applyStatChange(loserId, 'might', -damage);
                    syncGameStateToServer();
                } else if (isForced && damage > 0 && loserId) {
                    console.log('[Combat] Forced attack - applying damage to loser:', loserId, 'damage:', damage);
                    applyStatChange(loserId, 'might', -damage);
                    syncGameStateToServer();
                } else if (iAmLoser && damage > 0) {
                    // Multiplayer mode - loser needs to distribute damage
                    console.log('[Combat] Multiplayer - I am loser, opening damage distribution modal for damage:', damage);
                    // Close combat modal first, then open damage distribution
                    combatModal = null;
                    pendingCombatMovement = null;
                    openDamageDistributionModal(mountEl, damage, 'combat', 'physical');
                    // openDamageDistributionModal already calls updateGameUI, so we can return
                    return;
                }

                combatModal = null;
                pendingCombatMovement = null;
            } else {
                console.log('[Combat] Keeping modal open - attacker just opened it (race condition protection)');
            }
        }

        // Handle combat result notification from server (for all players to see)
        // Use saved old value (hadCombatResult) to detect new combat result
        if (newCombatResult && !hadCombatResult) {
            // Combat just ended - show result notification to both attacker and defender
            console.log('[GameState] Combat result received from server:', newCombatResult);
            showCombatResultNotification(mountEl, newCombatResult);
        }

        // Handle game over state from server (for multiplayer victory sync)
        // Use saved old value (hadGameOver) to detect new game over
        if (newGameOver && !hadGameOver) {
            // Game just ended - show victory modal for all players
            const { winner, deadPlayers } = newGameOver;
            console.log('[GameState] Game over received from server - winner:', winner);
            showVictoryModal(mountEl, winner, deadPlayers || []);
        }

        updateGameUI(mountEl, currentGameState, mySocketId);
    });

    // Subscribe to players active updates for intro logic
    unsubscribePlayersActive = socketClient.onPlayersActive((data) => {
        const activePlayerIds = data.activePlayers || [];
        const allPlayers = currentGameState?.players || [];
        checkAllPlayersActive(activePlayerIds, allPlayers, mountEl);
    });

    // Subscribe to reconnection events
    unsubscribeReconnectResult = socketClient.onReconnectResult((result) => {
        if (result.success) {
            showToast('Ket noi lai thanh cong!', 'success');
        } else if (!result.canRejoin) {
            // Room doesn't exist anymore - redirect to home
            clearLoadingTimeout();
            socketClient.clearSession();
            showToast('Phong da bi huy', 'error', 3000);
            setTimeout(() => {
                onNavigate('#/');
            }, 1500);
        }
    });

    unsubscribePlayerDisconnected = socketClient.onPlayerDisconnected(({ playerId, gracePeriod }) => {
        const player = currentGameState?.players?.find(p => p.id === playerId);
        const playerName = player?.name || 'Player';
        const minutes = Math.round(gracePeriod / 60000);
        showToast(`${playerName} mat ket noi. Cho ${minutes} phut de ket noi lai...`, 'warning', 5000);
    });

    unsubscribePlayerReconnected = socketClient.onPlayerReconnected(({ playerName }) => {
        showToast(`${playerName} da ket noi lai!`, 'success');
    });

    // Listen for debug reset event - redirect both players back to debug room
    unsubscribeDebugReset = socketClient.onDebugReset(() => {
        console.log('[GameView] Debug reset received, redirecting to debug room...');
        showToast('Game da duoc reset!', 'info', 2000);
        // Clear session and redirect to debug game page
        socketClient.clearSession();
        setTimeout(() => {
            onNavigate('#/game/debug');
        }, 500);
    });

    // Setup visibility tracking for active status
    setupVisibilityTracking();

    // Request game state and validate room exists
    socketClient.getGameState(roomId).then((response) => {
        if (!response.success) {
            // Room doesn't exist
            clearLoadingTimeout();
            console.log('[GameView] Room not found:', roomId);
            socketClient.clearSession();
            showToast('Phong khong ton tai', 'error', 3000);
            setTimeout(() => {
                onNavigate('#/');
            }, 1500);
        }
    });

    // Attach event listeners
    attachEventListeners(mountEl, roomId);

    // Cleanup on navigate away
    window.addEventListener('hashchange', () => {
        // Clear loading timeout
        clearLoadingTimeout();

        if (unsubscribeGameState) {
            unsubscribeGameState();
            unsubscribeGameState = null;
        }
        if (unsubscribePlayersActive) {
            unsubscribePlayersActive();
            unsubscribePlayersActive = null;
        }
        if (unsubscribeReconnectResult) {
            unsubscribeReconnectResult();
            unsubscribeReconnectResult = null;
        }
        if (unsubscribePlayerDisconnected) {
            unsubscribePlayerDisconnected();
            unsubscribePlayerDisconnected = null;
        }
        if (unsubscribePlayerReconnected) {
            unsubscribePlayerReconnected();
            unsubscribePlayerReconnected = null;
        }
        if (unsubscribeDebugReset) {
            unsubscribeDebugReset();
            unsubscribeDebugReset = null;
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
        endTurnModal = null;
        eventListenersAttached = false; // Reset listener flag for next game
    }, { once: true });
}
