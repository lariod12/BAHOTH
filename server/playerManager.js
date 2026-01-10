// Player Manager - Manages player turns, positions, and moves
// Persists to server/data/players.json

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, 'data');
const PLAYERS_FILE = join(DATA_DIR, 'players.json');

/**
 * @typedef {{
 *   turnOrder: string[];
 *   currentTurnIndex: number;
 *   playerMoves: Record<string, number>;
 *   playerPositions: Record<string, string>;
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
 * @param {string[]} playerIds - All player socket IDs
 * @param {string} startingRoom - Starting room ID (e.g., 'entrance-hall')
 * @returns {PlayerState}
 */
export function initializeGame(roomId, playerIds, startingRoom = 'entrance-hall') {
    const state = {
        turnOrder: [],
        currentTurnIndex: 0,
        playerMoves: {},
        playerPositions: {},
    };

    // Set all players to starting position
    for (const playerId of playerIds) {
        state.playerMoves[playerId] = 0;
        state.playerPositions[playerId] = startingRoom;
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
    };
}
