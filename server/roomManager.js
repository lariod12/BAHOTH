// Room Manager - JSON file-based room storage and logic
// This module manages all room state for the Socket.IO server.
// Rooms are persisted to server/data/rooms.json

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, 'data');
const ROOMS_FILE = join(DATA_DIR, 'rooms.json');

/**
 * @typedef {'joined' | 'selecting' | 'ready'} PlayerStatus
 * @typedef {'lobby' | 'rolling' | 'playing'} GamePhase
 *
 * @typedef {{
 *   id: string;
 *   name: string;
 *   status: PlayerStatus;
 *   characterId: string | null;
 *   isAutoPlayer?: boolean;
 * }} Player
 *
 * @typedef {{
 *   id: string;
 *   hostId: string;
 *   players: Player[];
 *   maxPlayers: number;
 *   minPlayers: number;
 *   createdAt: string;
 *   gamePhase: GamePhase;
 *   diceRolls: Record<string, number>;
 *   needsRoll: string[];
 *   turnOrder: string[];
 *   currentTurnIndex: number;
 *   playerMoves: Record<string, number>;
 *   isDebug?: boolean;
 *   selectionTurnOrder?: string[];
 *   currentSelectionTurn?: number;
 * }} Room
 *
 * @typedef {{
 *   rooms: Record<string, Room>;
 *   socketToRoom: Record<string, string>;
 *   lastUpdated: string;
 * }} RoomsData
 */

/** @type {Map<string, Room>} */
const rooms = new Map();

/** @type {Map<string, string>} */
const socketToRoom = new Map();

// Default player names for debug mode
const DEFAULT_PLAYER_NAMES = [
    'Player 1', 'Player 2', 'Player 3',
    'Player 4', 'Player 5', 'Player 6'
];

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param {any[]} array
 * @returns {any[]}
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Load rooms from JSON file
 */
function loadRooms() {
    ensureDataDir();

    if (!existsSync(ROOMS_FILE)) {
        console.log('[RoomManager] No rooms.json found, starting fresh');
        return;
    }

    try {
        const data = readFileSync(ROOMS_FILE, 'utf-8');
        const parsed = JSON.parse(data);

        // Load rooms
        if (parsed.rooms) {
            for (const [id, room] of Object.entries(parsed.rooms)) {
                rooms.set(id, room);
            }
        }

        // Load socket mappings
        if (parsed.socketToRoom) {
            for (const [socketId, roomId] of Object.entries(parsed.socketToRoom)) {
                socketToRoom.set(socketId, roomId);
            }
        }

        console.log(`[RoomManager] Loaded ${rooms.size} rooms from rooms.json`);
    } catch (error) {
        console.error('[RoomManager] Error loading rooms.json:', error);
    }
}

/**
 * Save rooms to JSON file
 */
function saveRooms() {
    ensureDataDir();

    const data = {
        rooms: Object.fromEntries(rooms),
        socketToRoom: Object.fromEntries(socketToRoom),
        lastUpdated: new Date().toISOString(),
    };

    try {
        writeFileSync(ROOMS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('[RoomManager] Error saving rooms.json:', error);
    }
}

// Load rooms on startup
loadRooms();

/**
 * Generate a random room ID like BAH-XXXXXX
 * @returns {string}
 */
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'BAH-';
    for (let i = 0; i < 6; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

/**
 * Create a new room
 * @param {string} hostSocketId
 * @param {string} hostName
 * @param {number} [maxPlayers=6]
 * @returns {Room}
 */
export function createRoom(hostSocketId, hostName, maxPlayers = 6) {
    let roomId = generateRoomId();
    // Ensure unique
    while (rooms.has(roomId)) {
        roomId = generateRoomId();
    }

    // Validate maxPlayers (3-6)
    const validMax = Math.max(3, Math.min(6, maxPlayers));

    const room = {
        id: roomId,
        hostId: hostSocketId,
        players: [
            {
                id: hostSocketId,
                name: hostName,
                status: 'joined',
                characterId: null,
            },
        ],
        maxPlayers: validMax,
        minPlayers: 3,
        createdAt: new Date().toISOString(),
        // Game state
        gamePhase: 'lobby',
        diceRolls: {},
        needsRoll: [],
        turnOrder: [],
        currentTurnIndex: 0,
        playerMoves: {},
    };

    rooms.set(roomId, room);
    socketToRoom.set(hostSocketId, roomId);
    saveRooms();

    return room;
}

/**
 * Create a debug room with auto-generated players
 * @param {string} hostSocketId
 * @param {number} playerCount
 * @returns {Room}
 */
export function createDebugRoom(hostSocketId, playerCount) {
    const validCount = Math.max(3, Math.min(6, playerCount));

    let roomId = generateRoomId();
    while (rooms.has(roomId)) {
        roomId = generateRoomId();
    }

    // Create players array with host first
    const players = [];
    for (let i = 0; i < validCount; i++) {
        const isHost = i === 0;
        const playerId = isHost ? hostSocketId : `debug-player-${roomId}-${i}`;
        players.push({
            id: playerId,
            name: DEFAULT_PLAYER_NAMES[i],
            status: 'joined',
            characterId: null,
            isAutoPlayer: !isHost
        });
    }

    // Generate selection turn order (random order for non-host, host last)
    const nonHostPlayerIds = players.filter(p => p.isAutoPlayer).map(p => p.id);
    const shuffledNonHost = shuffleArray(nonHostPlayerIds);
    const selectionTurnOrder = [...shuffledNonHost, hostSocketId];

    const room = {
        id: roomId,
        hostId: hostSocketId,
        players,
        maxPlayers: validCount,
        minPlayers: 3,
        createdAt: new Date().toISOString(),
        gamePhase: 'lobby',
        // Debug mode specific
        isDebug: true,
        selectionTurnOrder,
        currentSelectionTurn: 0,
        // Standard game state
        diceRolls: {},
        needsRoll: [],
        turnOrder: [],
        currentTurnIndex: 0,
        playerMoves: {}
    };

    rooms.set(roomId, room);
    socketToRoom.set(hostSocketId, roomId);
    saveRooms();

    return room;
}

/**
 * Join an existing room
 * @param {string} roomId
 * @param {string} socketId
 * @param {string} playerName
 * @returns {{ success: boolean; room?: Room; error?: string }}
 */
export function joinRoom(roomId, socketId, playerName) {
    const room = rooms.get(roomId);

    if (!room) {
        return { success: false, error: 'Room not found' };
    }

    if (room.players.length >= room.maxPlayers) {
        return { success: false, error: 'Room is full' };
    }

    // Check if player already in room
    const existingPlayer = room.players.find((p) => p.id === socketId);
    if (existingPlayer) {
        return { success: true, room };
    }

    room.players.push({
        id: socketId,
        name: playerName,
        status: 'joined',
        characterId: null,
    });

    socketToRoom.set(socketId, roomId);
    saveRooms();

    return { success: true, room };
}

/**
 * Leave a room
 * @param {string} socketId
 * @returns {{ room?: Room; wasHost: boolean; roomDeleted: boolean }}
 */
export function leaveRoom(socketId) {
    const roomId = socketToRoom.get(socketId);
    if (!roomId) {
        return { wasHost: false, roomDeleted: false };
    }

    const room = rooms.get(roomId);
    if (!room) {
        socketToRoom.delete(socketId);
        saveRooms();
        return { wasHost: false, roomDeleted: false };
    }

    const wasHost = room.hostId === socketId;

    // Remove player
    room.players = room.players.filter((p) => p.id !== socketId);
    socketToRoom.delete(socketId);

    // If room is empty, delete it
    if (room.players.length === 0) {
        rooms.delete(roomId);
        saveRooms();
        return { wasHost, roomDeleted: true };
    }

    // If host left, assign new host
    if (wasHost && room.players.length > 0) {
        room.hostId = room.players[0].id;
    }

    saveRooms();
    return { room, wasHost, roomDeleted: false };
}

/**
 * Get room by ID
 * @param {string} roomId
 * @returns {Room | undefined}
 */
export function getRoom(roomId) {
    return rooms.get(roomId);
}

/**
 * Get room by socket ID
 * @param {string} socketId
 * @returns {Room | undefined}
 */
export function getRoomBySocket(socketId) {
    const roomId = socketToRoom.get(socketId);
    return roomId ? rooms.get(roomId) : undefined;
}

/**
 * Update player status
 * @param {string} socketId
 * @param {PlayerStatus} status
 * @returns {Room | undefined}
 */
export function updatePlayerStatus(socketId, status) {
    const room = getRoomBySocket(socketId);
    if (!room) return undefined;

    const player = room.players.find((p) => p.id === socketId);
    if (player) {
        player.status = status;
        saveRooms();
    }

    return room;
}

/**
 * Select character for player
 * @param {string} socketId
 * @param {string | null} characterId
 * @returns {{ success: boolean; room?: Room; error?: string }}
 */
export function selectCharacter(socketId, characterId) {
    const room = getRoomBySocket(socketId);
    if (!room) {
        return { success: false, error: 'Not in a room' };
    }

    // Check if character is already taken by another player
    if (characterId) {
        const takenBy = room.players.find(
            (p) => p.id !== socketId && p.characterId === characterId
        );
        if (takenBy) {
            return { success: false, error: 'Character already taken' };
        }
    }

    const player = room.players.find((p) => p.id === socketId);
    if (player) {
        player.characterId = characterId;
        // If selecting a character, update status to 'selecting'
        if (characterId && player.status === 'joined') {
            player.status = 'selecting';
        }
        saveRooms();
    }

    return { success: true, room };
}

/**
 * Toggle ready status for player
 * @param {string} socketId
 * @returns {{ success: boolean; room?: Room; error?: string }}
 */
export function toggleReady(socketId) {
    const room = getRoomBySocket(socketId);
    if (!room) {
        return { success: false, error: 'Not in a room' };
    }

    const player = room.players.find((p) => p.id === socketId);
    if (!player) {
        return { success: false, error: 'Player not found' };
    }

    // Must have selected a character to be ready
    if (!player.characterId) {
        return { success: false, error: 'Select a character first' };
    }

    player.status = player.status === 'ready' ? 'selecting' : 'ready';
    saveRooms();

    return { success: true, room };
}

/**
 * Check if game can start
 * @param {string} roomId
 * @returns {{ canStart: boolean; reason?: string }}
 */
export function canStartGame(roomId) {
    const room = rooms.get(roomId);
    if (!room) {
        return { canStart: false, reason: 'Room not found' };
    }

    if (room.players.length < room.minPlayers) {
        return { canStart: false, reason: `Need at least ${room.minPlayers} players` };
    }

    // All players must have selected a character
    const allHaveCharacter = room.players.every((p) => p.characterId);
    if (!allHaveCharacter) {
        return { canStart: false, reason: 'Not all players have selected a character' };
    }

    // All non-host players must be ready
    const nonHostPlayers = room.players.filter((p) => p.id !== room.hostId);
    const allNonHostReady = nonHostPlayers.every((p) => p.status === 'ready');
    if (!allNonHostReady) {
        return { canStart: false, reason: 'Not all players are ready' };
    }

    return { canStart: true };
}

/**
 * Update player name
 * @param {string} socketId
 * @param {string} name
 * @returns {Room | undefined}
 */
export function updatePlayerName(socketId, name) {
    const room = getRoomBySocket(socketId);
    if (!room) return undefined;

    const player = room.players.find((p) => p.id === socketId);
    if (player) {
        player.name = name;
        saveRooms();
    }

    return room;
}

/**
 * Get all rooms (for debugging)
 * @returns {Room[]}
 */
export function getAllRooms() {
    return Array.from(rooms.values());
}

/**
 * Clean up old/stale rooms (rooms with no players or older than 24 hours)
 */
export function cleanupStaleRooms() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    let cleaned = 0;
    for (const [roomId, room] of rooms.entries()) {
        const createdAt = new Date(room.createdAt).getTime();
        const isOld = now - createdAt > maxAge;
        const isEmpty = room.players.length === 0;

        if (isOld || isEmpty) {
            // Clean up socket mappings
            for (const player of room.players) {
                socketToRoom.delete(player.id);
            }
            rooms.delete(roomId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`[RoomManager] Cleaned up ${cleaned} stale rooms`);
        saveRooms();
    }

    return cleaned;
}

/**
 * Reconnect a player to their room (for reconnection handling)
 * @param {string} oldSocketId
 * @param {string} newSocketId
 * @returns {Room | undefined}
 */
export function reconnectPlayer(oldSocketId, newSocketId) {
    const roomId = socketToRoom.get(oldSocketId);
    if (!roomId) return undefined;

    const room = rooms.get(roomId);
    if (!room) return undefined;

    const player = room.players.find((p) => p.id === oldSocketId);
    if (!player) return undefined;

    // Update player's socket ID
    player.id = newSocketId;

    // Update host if needed
    if (room.hostId === oldSocketId) {
        room.hostId = newSocketId;
    }

    // Update socket mapping
    socketToRoom.delete(oldSocketId);
    socketToRoom.set(newSocketId, roomId);

    saveRooms();
    return room;
}

/**
 * Start the game and transition to rolling phase
 * @param {string} roomId
 * @returns {{ success: boolean; room?: Room; error?: string }}
 */
export function startGame(roomId) {
    const room = rooms.get(roomId);
    if (!room) {
        return { success: false, error: 'Room not found' };
    }

    if (room.gamePhase !== 'lobby') {
        return { success: false, error: 'Game already started' };
    }

    // Transition to rolling phase
    room.gamePhase = 'rolling';
    room.diceRolls = {};
    room.needsRoll = room.players.map((p) => p.id);
    room.turnOrder = [];
    room.currentTurnIndex = 0;
    room.playerMoves = {};

    saveRooms();
    return { success: true, room };
}

/**
 * Submit dice roll for a player
 * @param {string} socketId
 * @param {number} value
 * @returns {{ success: boolean; room?: Room; allRolled?: boolean; hasTies?: boolean; error?: string }}
 */
export function rollDice(socketId, value) {
    const room = getRoomBySocket(socketId);
    if (!room) {
        return { success: false, error: 'Not in a room' };
    }

    if (room.gamePhase !== 'rolling') {
        return { success: false, error: 'Not in rolling phase' };
    }

    // Check if player needs to roll
    if (!room.needsRoll.includes(socketId)) {
        return { success: false, error: 'You do not need to roll' };
    }

    // Validate dice value (1-16)
    const diceValue = Math.max(1, Math.min(16, Math.floor(value)));
    room.diceRolls[socketId] = diceValue;

    // Remove from needsRoll
    room.needsRoll = room.needsRoll.filter((id) => id !== socketId);

    // Check if all have rolled
    const allRolled = room.needsRoll.length === 0;

    if (allRolled) {
        // Check for ties
        const rolls = Object.entries(room.diceRolls);
        const values = rolls.map(([, v]) => v);
        const uniqueValues = new Set(values);

        if (uniqueValues.size < values.length) {
            // There are ties - find tied players
            const valueCounts = {};
            for (const v of values) {
                valueCounts[v] = (valueCounts[v] || 0) + 1;
            }

            // Players with duplicate values need to re-roll
            const tiedPlayers = rolls
                .filter(([, v]) => valueCounts[v] > 1)
                .map(([id]) => id);

            // Clear their rolls
            for (const id of tiedPlayers) {
                delete room.diceRolls[id];
            }
            room.needsRoll = tiedPlayers;

            saveRooms();
            return { success: true, room, allRolled: false, hasTies: true };
        }

        // No ties - sort by descending order and start game
        const sorted = rolls.sort(([, a], [, b]) => b - a);
        room.turnOrder = sorted.map(([id]) => id);
        room.currentTurnIndex = 0;
        room.gamePhase = 'playing';

        // Initialize player moves - the first player needs moves set
        // We'll use a placeholder value (4) and let the client request proper speed-based value
        room.playerMoves = {};
        for (const p of room.players) {
            room.playerMoves[p.id] = 0; // Will be set by client based on character speed
        }

        saveRooms();
        return { success: true, room, allRolled: true, hasTies: false };
    }

    saveRooms();
    return { success: true, room, allRolled: false, hasTies: false };
}

/**
 * Initialize player moves for a turn
 * @param {string} roomId
 * @param {Record<string, number>} speedValues - Map of socketId to speed value
 * @returns {Room | undefined}
 */
export function initializePlayerMoves(roomId, speedValues) {
    const room = rooms.get(roomId);
    if (!room) return undefined;

    room.playerMoves = { ...speedValues };
    saveRooms();
    return room;
}

/**
 * Use a move (deduct 1 from player's remaining moves)
 * @param {string} socketId
 * @param {string} direction
 * @returns {{ success: boolean; room?: Room; turnEnded?: boolean; error?: string }}
 */
export function useMove(socketId, direction) {
    const room = getRoomBySocket(socketId);
    if (!room) {
        return { success: false, error: 'Not in a room' };
    }

    if (room.gamePhase !== 'playing') {
        return { success: false, error: 'Game not in playing phase' };
    }

    // Check if it's this player's turn
    const currentPlayer = room.turnOrder[room.currentTurnIndex];
    if (currentPlayer !== socketId) {
        return { success: false, error: 'Not your turn' };
    }

    // Check remaining moves
    const movesLeft = room.playerMoves[socketId] || 0;
    if (movesLeft <= 0) {
        return { success: false, error: 'No moves remaining' };
    }

    // Deduct move
    room.playerMoves[socketId] = movesLeft - 1;

    // Check if turn ended
    const turnEnded = room.playerMoves[socketId] <= 0;

    if (turnEnded) {
        // Move to next player
        room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;

        // Reset moves for next player (will be set by client with speed value)
        // For now, we don't reset here - the client should call initializePlayerMoves
    }

    saveRooms();
    return { success: true, room, turnEnded };
}

/**
 * Set player moves for next turn
 * @param {string} socketId
 * @param {number} moves
 * @returns {Room | undefined}
 */
export function setPlayerMoves(socketId, moves) {
    const room = getRoomBySocket(socketId);
    if (!room) return undefined;

    room.playerMoves[socketId] = moves;
    saveRooms();
    return room;
}

/**
 * Get game state for a room
 * @param {string} roomId
 * @returns {Room | undefined}
 */
export function getGameState(roomId) {
    return rooms.get(roomId);
}

// ============================================
// Debug Mode Functions
// ============================================

/**
 * Get current selection turn player in debug mode
 * @param {string} roomId
 * @returns {string | null}
 */
export function getCurrentSelectionPlayer(roomId) {
    const room = rooms.get(roomId);
    if (!room || !room.isDebug) return null;

    const turnIndex = room.currentSelectionTurn;
    if (turnIndex >= room.selectionTurnOrder.length) return null;

    return room.selectionTurnOrder[turnIndex];
}

/**
 * Select character for debug player and advance turn
 * @param {string} roomId
 * @param {string} playerId
 * @param {string} characterId
 * @returns {{ success: boolean; room?: Room; error?: string }}
 */
export function debugSelectCharacter(roomId, playerId, characterId) {
    const room = rooms.get(roomId);
    if (!room || !room.isDebug) {
        return { success: false, error: 'Not a debug room' };
    }

    // Check if it's this player's turn
    const currentPlayer = getCurrentSelectionPlayer(roomId);
    if (currentPlayer !== playerId) {
        return { success: false, error: "Not this player's turn" };
    }

    // Check if character is taken
    const isTaken = room.players.some(p => p.characterId === characterId);
    if (isTaken) {
        return { success: false, error: 'Character already taken' };
    }

    // Assign character
    const player = room.players.find(p => p.id === playerId);
    if (player) {
        player.characterId = characterId;
        player.status = 'ready';
    }

    // Advance turn
    room.currentSelectionTurn++;

    saveRooms();
    return { success: true, room };
}

/**
 * Check if all debug players have selected characters
 * @param {string} roomId
 * @returns {boolean}
 */
export function isDebugSelectionComplete(roomId) {
    const room = rooms.get(roomId);
    if (!room || !room.isDebug) return false;

    return room.players.every(p => p.characterId !== null);
}
