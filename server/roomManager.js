// Room Manager - In-memory room storage and logic
// This module manages all room state for the Socket.IO server.

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
 *   createdAt: Date;
 * }} Room
 */

/** @type {Map<string, Room>} */
const rooms = new Map();

/** @type {Map<string, string>} */
const socketToRoom = new Map();

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
        createdAt: new Date(),
    };

    rooms.set(roomId, room);
    socketToRoom.set(hostSocketId, roomId);

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
        return { wasHost: false, roomDeleted: false };
    }

    const wasHost = room.hostId === socketId;

    // Remove player
    room.players = room.players.filter((p) => p.id !== socketId);
    socketToRoom.delete(socketId);

    // If room is empty, delete it
    if (room.players.length === 0) {
        rooms.delete(roomId);
        return { wasHost, roomDeleted: true };
    }

    // If host left, assign new host
    if (wasHost && room.players.length > 0) {
        room.hostId = room.players[0].id;
    }

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
