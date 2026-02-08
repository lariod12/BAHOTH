// Player Manager - Manages player turns, positions, and moves
// Persists to server/data/players.json

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { CHARACTER_BY_ID, TRAIT_KEYS } from './data/characterTraits.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, 'data');
const PLAYERS_FILE = join(DATA_DIR, 'players.json');

/**
 * @typedef {{
 *   speed: number;
 *   might: number;
 *   sanity: number;
 *   knowledge: number;
 * }} CharacterStatIndices - currentIndex for each trait (0-7)
 *
 * @typedef {{
 *   characterId: string;
 *   stats: CharacterStatIndices;
 *   isDead: boolean;
 * }} PlayerCharacterData
 *
 * @typedef {{
 *   omens: string[];
 *   events: string[];
 *   items: string[];
 * }} PlayerCards
 *
 * @typedef {{
 *   turnOrder: string[];
 *   currentTurnIndex: number;
 *   playerMoves: Record<string, number>;
 *   playerPositions: Record<string, string>;
 *   characterData: Record<string, PlayerCharacterData>;
 *   playerCards: Record<string, PlayerCards>;
 *   drawnRooms: string[];
 *   pendingEvents?: Record<string, Array<{ id: string; sourcePlayerId?: string }>>;
 * }} PlayerState
 *
 * @typedef {{
 *   games: Record<string, PlayerState>;
 *   lastUpdated: string;
 * }} PlayersData
 */

/** @type {Map<string, PlayerState>} */
const games = new Map();

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Load player data from JSON file
 */
function loadPlayers() {
    ensureDataDir();

    if (!existsSync(PLAYERS_FILE)) {
        console.log('[PlayerManager] No players.json found, starting fresh');
        return;
    }

    try {
        const data = readFileSync(PLAYERS_FILE, 'utf-8');
        const parsed = JSON.parse(data);

        if (parsed.games) {
            for (const [roomId, state] of Object.entries(parsed.games)) {
                games.set(roomId, state);
            }
        }

        console.log(`[PlayerManager] Loaded ${games.size} game states from players.json`);
    } catch (error) {
        console.error('[PlayerManager] Error loading players.json:', error);
    }
}

/**
 * Save player data to JSON file
 */
function savePlayers() {
    ensureDataDir();

    const data = {
        games: Object.fromEntries(games),
        lastUpdated: new Date().toISOString(),
    };

    try {
        writeFileSync(PLAYERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('[PlayerManager] Error saving players.json:', error);
    }
}

// Load on startup
loadPlayers();

/**
 * Initialize player state when game starts
 * @param {string} roomId
 * @param {Array<{id: string, characterId: string}>} players - Players with their character IDs
 * @param {string} startingRoom - Starting room ID (e.g., 'entrance-hall')
 * @returns {PlayerState}
 */
export function initializeGame(roomId, players, startingRoom = 'entrance-hall') {
    const state = {
        turnOrder: [],
        currentTurnIndex: 0,
        playerMoves: {},
        playerPositions: {},
        characterData: {},
        playerCards: {},
        drawnRooms: [],
        pendingEvents: {},
        pendingStatChoices: {},
        persistentEffects: {},
        storedDice: {},
        roomTokenEffects: {},
        tokenInteractions: {},
        wallSwitchConnections: {},
    };

    // Set all players to starting position and initialize character stats
    for (const player of players) {
        const playerId = typeof player === 'string' ? player : player.id;
        const characterId = typeof player === 'string' ? null : player.characterId;

        state.playerMoves[playerId] = 0;
        state.playerPositions[playerId] = startingRoom;

        // Initialize character stats if characterId provided
        if (characterId) {
            const character = CHARACTER_BY_ID[characterId];
            if (character) {
                state.characterData[playerId] = {
                    characterId,
                    stats: {
                        speed: character.traits.speed.startIndex,
                        might: character.traits.might.startIndex,
                        sanity: character.traits.sanity.startIndex,
                        knowledge: character.traits.knowledge.startIndex,
                    },
                    isDead: false,
                };
            }
        }
    }

    games.set(roomId, state);
    savePlayers();

    return state;
}

/**
 * Set turn order after dice rolling
 * @param {string} roomId
 * @param {string[]} turnOrder - Ordered list of player IDs (highest roll first)
 * @returns {PlayerState | undefined}
 */
export function setTurnOrder(roomId, turnOrder) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.turnOrder = turnOrder;
    state.currentTurnIndex = 0;
    savePlayers();

    return state;
}

/**
 * Get player state for a room
 * @param {string} roomId
 * @returns {PlayerState | undefined}
 */
export function getPlayerState(roomId) {
    return games.get(roomId);
}

/**
 * Get current player's turn
 * @param {string} roomId
 * @returns {string | undefined}
 */
export function getCurrentTurnPlayer(roomId) {
    const state = games.get(roomId);
    if (!state || state.turnOrder.length === 0) return undefined;

    return state.turnOrder[state.currentTurnIndex];
}

/**
 * Check if it's a player's turn
 * @param {string} roomId
 * @param {string} playerId
 * @returns {boolean}
 */
export function isPlayerTurn(roomId, playerId) {
    return getCurrentTurnPlayer(roomId) === playerId;
}

/**
 * Set player moves for a turn
 * @param {string} roomId
 * @param {string} playerId
 * @param {number} moves
 * @returns {PlayerState | undefined}
 */
export function setPlayerMoves(roomId, playerId, moves) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.playerMoves[playerId] = moves;
    savePlayers();

    return state;
}

/**
 * Get remaining moves for a player
 * @param {string} roomId
 * @param {string} playerId
 * @returns {number}
 */
export function getPlayerMoves(roomId, playerId) {
    const state = games.get(roomId);
    if (!state) return 0;

    return state.playerMoves[playerId] || 0;
}

/**
 * Use one move from a player
 * @param {string} roomId
 * @param {string} playerId
 * @returns {{ success: boolean; movesLeft: number; turnEnded: boolean }}
 */
export function useMove(roomId, playerId) {
    const state = games.get(roomId);
    if (!state) {
        return { success: false, movesLeft: 0, turnEnded: false };
    }

    const currentMoves = state.playerMoves[playerId] || 0;
    if (currentMoves <= 0) {
        return { success: false, movesLeft: 0, turnEnded: false };
    }

    state.playerMoves[playerId] = currentMoves - 1;
    const movesLeft = state.playerMoves[playerId];
    const turnEnded = movesLeft <= 0;

    savePlayers();

    return { success: true, movesLeft, turnEnded };
}

/**
 * Move to next player's turn
 * @param {string} roomId
 * @returns {PlayerState | undefined}
 */
export function nextTurn(roomId) {
    const state = games.get(roomId);
    if (!state || state.turnOrder.length === 0) return undefined;

    state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
    savePlayers();

    return state;
}

/**
 * Get player position
 * @param {string} roomId
 * @param {string} playerId
 * @returns {string | undefined}
 */
export function getPlayerPosition(roomId, playerId) {
    const state = games.get(roomId);
    if (!state) return undefined;

    return state.playerPositions[playerId];
}

/**
 * Set player position
 * @param {string} roomId
 * @param {string} playerId
 * @param {string} roomName - Room ID where player is now
 * @returns {PlayerState | undefined}
 */
export function setPlayerPosition(roomId, playerId, roomName) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.playerPositions[playerId] = roomName;
    savePlayers();

    return state;
}

/**
 * Get all player positions
 * @param {string} roomId
 * @returns {Record<string, string>}
 */
export function getAllPositions(roomId) {
    const state = games.get(roomId);
    if (!state) return {};

    return { ...state.playerPositions };
}

/**
 * Clean up game state when game ends or room is deleted
 * @param {string} roomId
 */
export function cleanupGame(roomId) {
    games.delete(roomId);
    savePlayers();
}

/**
 * Update player ID across all state (for reconnection handling)
 * @param {string} roomId
 * @param {string} oldId
 * @param {string} newId
 * @returns {PlayerState | undefined}
 */
export function updatePlayerId(roomId, oldId, newId) {
    const state = games.get(roomId);
    if (!state) return undefined;

    // Update turnOrder
    state.turnOrder = state.turnOrder.map(id => id === oldId ? newId : id);

    // Update playerMoves
    if (state.playerMoves[oldId] !== undefined) {
        state.playerMoves[newId] = state.playerMoves[oldId];
        delete state.playerMoves[oldId];
    }

    // Update playerPositions
    if (state.playerPositions[oldId]) {
        state.playerPositions[newId] = state.playerPositions[oldId];
        delete state.playerPositions[oldId];
    }

    // Update characterData
    if (state.characterData && state.characterData[oldId]) {
        state.characterData[newId] = state.characterData[oldId];
        delete state.characterData[oldId];
    }

    // Update playerCards
    if (state.playerCards && state.playerCards[oldId]) {
        state.playerCards[newId] = state.playerCards[oldId];
        delete state.playerCards[oldId];
    }

    // Update pendingEvents
    if (state.pendingEvents && state.pendingEvents[oldId]) {
        state.pendingEvents[newId] = state.pendingEvents[oldId];
        delete state.pendingEvents[oldId];
    }

    // Update pendingStatChoices
    if (state.pendingStatChoices && state.pendingStatChoices[oldId]) {
        state.pendingStatChoices[newId] = state.pendingStatChoices[oldId];
        delete state.pendingStatChoices[oldId];
    }

    // Update persistentEffects
    if (state.persistentEffects && state.persistentEffects[oldId]) {
        state.persistentEffects[newId] = state.persistentEffects[oldId];
        delete state.persistentEffects[oldId];
    }

    // Update storedDice
    if (state.storedDice && state.storedDice[oldId]) {
        state.storedDice[newId] = state.storedDice[oldId];
        delete state.storedDice[oldId];
    }

    savePlayers();
    console.log(`[PlayerManager] Updated player ID: ${oldId} -> ${newId}`);

    return state;
}

/**
 * Get combined player state for broadcasting
 * @param {string} roomId
 * @returns {PlayerState | null}
 */
export function getFullPlayerState(roomId) {
    const state = games.get(roomId);
    if (!state) return null;

    return {
        turnOrder: [...state.turnOrder],
        currentTurnIndex: state.currentTurnIndex,
        playerMoves: { ...state.playerMoves },
        playerPositions: { ...state.playerPositions },
        characterData: state.characterData ? { ...state.characterData } : {},
        playerCards: state.playerCards ? JSON.parse(JSON.stringify(state.playerCards)) : {},
        drawnRooms: state.drawnRooms ? [...state.drawnRooms] : [],
        trappedPlayers: state.trappedPlayers ? { ...state.trappedPlayers } : {},
        pendingEvents: state.pendingEvents ? JSON.parse(JSON.stringify(state.pendingEvents)) : {},
        pendingStatChoices: state.pendingStatChoices ? JSON.parse(JSON.stringify(state.pendingStatChoices)) : {},
        persistentEffects: state.persistentEffects ? JSON.parse(JSON.stringify(state.persistentEffects)) : {},
        storedDice: state.storedDice ? JSON.parse(JSON.stringify(state.storedDice)) : {},
        roomTokenEffects: state.roomTokenEffects ? JSON.parse(JSON.stringify(state.roomTokenEffects)) : {},
        tokenInteractions: state.tokenInteractions ? JSON.parse(JSON.stringify(state.tokenInteractions)) : {},
        wallSwitchConnections: state.wallSwitchConnections ? JSON.parse(JSON.stringify(state.wallSwitchConnections)) : {},
    };
}

// ============================================
// Character Stats Functions
// ============================================

/**
 * Initialize character stats for a player based on their selected character
 * @param {string} roomId
 * @param {string} playerId
 * @param {string} characterId
 * @returns {PlayerCharacterData | undefined}
 */
export function initializeCharacterStats(roomId, playerId, characterId) {
    const state = games.get(roomId);
    if (!state) return undefined;

    const character = CHARACTER_BY_ID[characterId];
    if (!character) {
        console.warn(`[PlayerManager] Unknown characterId: ${characterId}`);
        return undefined;
    }

    // Initialize characterData if not exists
    if (!state.characterData) {
        state.characterData = {};
    }

    // Create stats with startIndex for each trait
    const stats = {
        speed: character.traits.speed.startIndex,
        might: character.traits.might.startIndex,
        sanity: character.traits.sanity.startIndex,
        knowledge: character.traits.knowledge.startIndex,
    };

    const playerCharData = {
        characterId,
        stats,
        isDead: false,
    };

    state.characterData[playerId] = playerCharData;
    savePlayers();

    return playerCharData;
}

/**
 * Get character stats for a player
 * @param {string} roomId
 * @param {string} playerId
 * @returns {PlayerCharacterData | undefined}
 */
export function getCharacterStats(roomId, playerId) {
    const state = games.get(roomId);
    if (!state || !state.characterData) return undefined;

    return state.characterData[playerId];
}

/**
 * Update a character stat by delta (positive or negative)
 * @param {string} roomId
 * @param {string} playerId
 * @param {'speed' | 'might' | 'sanity' | 'knowledge'} trait
 * @param {number} delta
 * @returns {{ success: boolean; newIndex: number; newValue: number; isDead: boolean } | undefined}
 */
export function updateCharacterStat(roomId, playerId, trait, delta) {
    const state = games.get(roomId);
    if (!state || !state.characterData) return undefined;

    const playerData = state.characterData[playerId];
    if (!playerData) return undefined;

    if (!TRAIT_KEYS.includes(trait)) {
        console.warn(`[PlayerManager] Invalid trait: ${trait}`);
        return undefined;
    }

    const currentIndex = playerData.stats[trait];
    // Clamp new index between 0 and 7
    const newIndex = Math.max(0, Math.min(7, currentIndex + delta));
    playerData.stats[trait] = newIndex;

    // Check death condition: any stat at index 0 means death
    if (newIndex === 0) {
        playerData.isDead = true;
    }

    savePlayers();

    // Get actual value for the new index
    const newValue = getStatValue(playerData.characterId, trait, newIndex);

    return {
        success: true,
        newIndex,
        newValue,
        isDead: playerData.isDead,
    };
}

/**
 * Get actual stat value from character's trait track at given index
 * @param {string} characterId
 * @param {'speed' | 'might' | 'sanity' | 'knowledge'} trait
 * @param {number} currentIndex
 * @returns {number}
 */
export function getStatValue(characterId, trait, currentIndex) {
    const character = CHARACTER_BY_ID[characterId];
    if (!character) return 0;

    const traitData = character.traits[trait];
    if (!traitData) return 0;

    // Clamp index to valid range
    const idx = Math.max(0, Math.min(7, currentIndex));
    return traitData.track[idx];
}

/**
 * Get all stat values for a player (computed from indices)
 * @param {string} roomId
 * @param {string} playerId
 * @returns {{ speed: number; might: number; sanity: number; knowledge: number } | undefined}
 */
export function getAllStatValues(roomId, playerId) {
    const playerData = getCharacterStats(roomId, playerId);
    if (!playerData) return undefined;

    const { characterId, stats } = playerData;

    // If stats is undefined, return undefined (character data may exist but without stats yet)
    if (!stats) {
        console.warn(`[PlayerManager] No stats found for player ${playerId} in room ${roomId}`);
        return undefined;
    }

    return {
        speed: getStatValue(characterId, 'speed', stats.speed),
        might: getStatValue(characterId, 'might', stats.might),
        sanity: getStatValue(characterId, 'sanity', stats.sanity),
        knowledge: getStatValue(characterId, 'knowledge', stats.knowledge),
    };
}

/**
 * Get starting speed value for a character (from character definition)
 * @param {string} characterId
 * @returns {number | null}
 */
export function getStartingSpeed(characterId) {
    const character = CHARACTER_BY_ID[characterId];
    if (!character) return null;

    const startIndex = character.traits.speed.startIndex;
    return character.traits.speed.track[startIndex];
}

// ============================================
// Player Cards Functions
// ============================================

/**
 * Get player cards for a player
 * @param {string} roomId
 * @param {string} playerId
 * @returns {PlayerCards | undefined}
 */
export function getPlayerCards(roomId, playerId) {
    const state = games.get(roomId);
    if (!state || !state.playerCards) return undefined;

    return state.playerCards[playerId];
}

/**
 * Set player cards for a player
 * @param {string} roomId
 * @param {string} playerId
 * @param {PlayerCards} cards
 * @returns {PlayerState | undefined}
 */
export function setPlayerCards(roomId, playerId, cards) {
    const state = games.get(roomId);
    if (!state) return undefined;

    // Initialize playerCards if not exists
    if (!state.playerCards) {
        state.playerCards = {};
    }

    state.playerCards[playerId] = cards;
    savePlayers();

    return state;
}

/**
 * Update all player cards (batch update)
 * @param {string} roomId
 * @param {Record<string, PlayerCards>} allPlayerCards
 * @returns {PlayerState | undefined}
 */
export function updateAllPlayerCards(roomId, allPlayerCards) {
    const state = games.get(roomId);
    if (!state) return undefined;

    // Initialize playerCards if not exists
    if (!state.playerCards) {
        state.playerCards = {};
    }

    // Update each player's cards
    for (const [playerId, cards] of Object.entries(allPlayerCards)) {
        state.playerCards[playerId] = cards;
    }

    savePlayers();
    console.log(`[PlayerManager] Updated player cards for room ${roomId}`);

    return state;
}

// ============================================
// Drawn Rooms Functions
// ============================================

/**
 * Get drawn rooms list
 * @param {string} roomId
 * @returns {string[]}
 */
export function getDrawnRooms(roomId) {
    const state = games.get(roomId);
    if (!state || !state.drawnRooms) return [];

    return [...state.drawnRooms];
}

/**
 * Update drawn rooms list (rooms where tokens have been drawn)
 * @param {string} roomId
 * @param {string[]} drawnRooms
 * @returns {PlayerState | undefined}
 */
export function updateDrawnRooms(roomId, drawnRooms) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.drawnRooms = drawnRooms;
    savePlayers();
    console.log(`[PlayerManager] Updated drawn rooms for room ${roomId}:`, drawnRooms.length);

    return state;
}

// ============================================
// Character Data Update (for faction changes)
// ============================================

/**
 * Update character data (stats, factions) for all players
 * @param {string} roomId
 * @param {Record<string, PlayerCharacterData>} characterData
 * @returns {PlayerState | undefined}
 */
export function updateCharacterData(roomId, characterData) {
    const state = games.get(roomId);
    if (!state) return undefined;

    // Merge character data - preserving existing data and updating with new data
    if (!state.characterData) {
        state.characterData = {};
    }

    for (const [playerId, data] of Object.entries(characterData)) {
        if (state.characterData[playerId]) {
            // Merge existing with new (new data takes precedence)
            state.characterData[playerId] = {
                ...state.characterData[playerId],
                ...data,
            };
        } else {
            state.characterData[playerId] = data;
        }
    }

    savePlayers();
    console.log(`[PlayerManager] Updated character data for room ${roomId}`);

    return state;
}

/**
 * Update trapped players state for a room
 * @param {string} roomId
 * @param {Record<string, object> | null} trappedPlayers
 * @returns {PlayerState | undefined}
 */
export function updateTrappedPlayers(roomId, trappedPlayers) {
    const state = games.get(roomId);
    if (!state) return undefined;

    // Replace entire trapped players state
    state.trappedPlayers = trappedPlayers || {};

    savePlayers();
    console.log(`[PlayerManager] Updated trapped players for room ${roomId}:`, Object.keys(state.trappedPlayers));

    return state;
}

/**
 * Update pending events for a room
 * @param {string} roomId
 * @param {Record<string, Array<{ id: string; sourcePlayerId?: string }>> | null} pendingEvents
 * @returns {PlayerState | undefined}
 */
export function updatePendingEvents(roomId, pendingEvents) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.pendingEvents = pendingEvents || {};
    savePlayers();
    console.log(`[PlayerManager] Updated pending events for room ${roomId}:`, Object.keys(state.pendingEvents));

    return state;
}

/**
 * Update pending stat choices for a room (from allPlayersLoseStat events)
 * @param {string} roomId
 * @param {Record<string, object> | null} pendingStatChoices
 * @returns {PlayerState | undefined}
 */
export function updatePendingStatChoices(roomId, pendingStatChoices) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.pendingStatChoices = pendingStatChoices || {};
    savePlayers();

    return state;
}

/**
 * Update persistent effects for a room
 * @param {string} roomId
 * @param {Record<string, Array> | null} persistentEffects
 * @returns {PlayerState | undefined}
 */
export function updatePersistentEffects(roomId, persistentEffects) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.persistentEffects = persistentEffects || {};
    savePlayers();

    return state;
}

/**
 * Update stored dice for a room
 * @param {string} roomId
 * @param {Record<string, object> | null} storedDice
 * @returns {PlayerState | undefined}
 */
export function updateStoredDice(roomId, storedDice) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.storedDice = storedDice || {};
    savePlayers();

    return state;
}

/**
 * Update room token effects for a room
 * @param {string} roomId
 * @param {Record<string, object> | null} roomTokenEffects
 * @returns {PlayerState | undefined}
 */
export function updateRoomTokenEffects(roomId, roomTokenEffects) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.roomTokenEffects = roomTokenEffects || {};
    savePlayers();

    return state;
}

/**
 * Update token interactions for a room
 * @param {string} roomId
 * @param {Record<string, object> | null} tokenInteractions
 * @returns {PlayerState | undefined}
 */
export function updateTokenInteractions(roomId, tokenInteractions) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.tokenInteractions = tokenInteractions || {};
    savePlayers();

    return state;
}

/**
 * Update wall switch connections
 * @param {string} roomId
 * @param {Record<string, object> | null} wallSwitchConnections
 * @returns {PlayerState | undefined}
 */
export function updateWallSwitchConnections(roomId, wallSwitchConnections) {
    const state = games.get(roomId);
    if (!state) return undefined;

    state.wallSwitchConnections = wallSwitchConnections || {};
    savePlayers();

    return state;
}
