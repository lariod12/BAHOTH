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
 *
 * @typedef {{
 *   id: string;
 *   name: string;
 *   status: PlayerStatus;
 *   characterId: string | null;
 * }} Player
 *
 * @typedef {{
 *   id: string;
 *   hostId: string;
 *   players: Player[];
 *   maxPlayers: number;
 *   minPlayers: number;
 *   createdAt: string;
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
 * @returns {Room}
 */
export function createRoom(hostSocketId, hostName) {
    let roomId = generateRoomId();
    // Ensure unique
    while (rooms.has(roomId)) {
        roomId = generateRoomId();
    }

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
        maxPlayers: 6,
        minPlayers: 3,
        createdAt: new Date().toISOString(),
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

    const allReady = room.players.every((p) => p.status === 'ready');
    if (!allReady) {
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
