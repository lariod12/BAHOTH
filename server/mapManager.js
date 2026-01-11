// Map Manager - Manages revealed rooms, connections, and map state
// Persists to server/data/maps.json

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, 'data');
const MAPS_FILE = join(DATA_DIR, 'maps.json');

/**
 * @typedef {'north' | 'south' | 'east' | 'west'} Direction
 *
 * @typedef {{
 *   id: string;
 *   name: string;
 *   x: number;
 *   y: number;
 *   doors: Direction[];
 *   floor: 'ground' | 'upper' | 'basement';
 * }} RevealedRoom
 *
 * @typedef {{
 *   revealedRooms: Record<string, RevealedRoom>;
 *   connections: Record<string, Record<Direction, string>>;
 * }} MapState
 *
 * @typedef {{
 *   maps: Record<string, MapState>;
 *   lastUpdated: string;
 * }} MapsData
 */

/** @type {Map<string, MapState>} */
const maps = new Map();

// Starting rooms configuration (based on game rules)
// Layout: Entrance Hall (bottom) -> Foyer (middle) -> Grand Staircase (top)
// Vertical line from south to north
const STARTING_ROOMS = {
    'entrance-hall': {
        id: 'entrance-hall',
        name: 'Entrance Hall',
        x: 0,
        y: 0,
        doors: ['north'],
        floor: 'ground',
    },
    'foyer': {
        id: 'foyer',
        name: 'Foyer',
        x: 0,
        y: 1,
        doors: ['south', 'north'],
        floor: 'ground',
    },
    'grand-staircase': {
        id: 'grand-staircase',
        name: 'Grand Staircase',
        x: 0,
        y: 2,
        doors: ['south', 'east', 'west'],
        floor: 'ground',
    },
};

// Pool of rooms that can be revealed (simplified for now)
const ROOM_POOL = [
    { id: 'chapel', name: 'Chapel', doors: ['north', 'south'], floor: 'ground' },
    { id: 'dining-room', name: 'Dining Room', doors: ['north', 'east', 'west'], floor: 'ground' },
    { id: 'kitchen', name: 'Kitchen', doors: ['south', 'east'], floor: 'ground' },
    { id: 'ballroom', name: 'Ballroom', doors: ['north', 'south', 'east', 'west'], floor: 'ground' },
    { id: 'conservatory', name: 'Conservatory', doors: ['north', 'west'], floor: 'ground' },
    { id: 'library', name: 'Library', doors: ['north', 'south'], floor: 'upper' },
    { id: 'master-bedroom', name: 'Master Bedroom', doors: ['south', 'west'], floor: 'upper' },
    { id: 'gallery', name: 'Gallery', doors: ['north', 'east', 'west'], floor: 'upper' },
    { id: 'attic', name: 'Attic', doors: ['south'], floor: 'upper' },
    { id: 'bedroom', name: 'Bedroom', doors: ['east', 'west'], floor: 'upper' },
    { id: 'crypt', name: 'Crypt', doors: ['north', 'south'], floor: 'basement' },
    { id: 'furnace-room', name: 'Furnace Room', doors: ['east', 'west'], floor: 'basement' },
    { id: 'wine-cellar', name: 'Wine Cellar', doors: ['north', 'east'], floor: 'basement' },
    { id: 'coal-chute', name: 'Coal Chute', doors: ['south', 'west'], floor: 'basement' },
    { id: 'pentagram-chamber', name: 'Pentagram Chamber', doors: ['north', 'south', 'east', 'west'], floor: 'basement' },
];

/**
 * Get opposite direction
 * @param {Direction} dir
 * @returns {Direction}
 */
function getOppositeDirection(dir) {
    const opposites = {
        north: 'south',
        south: 'north',
        east: 'west',
        west: 'east',
    };
    return opposites[dir];
}

/**
 * Get position offset for direction
 * @param {Direction} dir
 * @returns {{ dx: number; dy: number }}
 */
function getDirectionOffset(dir) {
    const offsets = {
        north: { dx: 0, dy: 1 },
        south: { dx: 0, dy: -1 },
        east: { dx: 1, dy: 0 },
        west: { dx: -1, dy: 0 },
    };
    return offsets[dir];
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
 * Load maps from JSON file
 */
function loadMaps() {
    ensureDataDir();

    if (!existsSync(MAPS_FILE)) {
        console.log('[MapManager] No maps.json found, starting fresh');
        return;
    }

    try {
        const data = readFileSync(MAPS_FILE, 'utf-8');
        const parsed = JSON.parse(data);

        if (parsed.maps) {
            for (const [roomId, state] of Object.entries(parsed.maps)) {
                maps.set(roomId, state);
            }
        }

        console.log(`[MapManager] Loaded ${maps.size} map states from maps.json`);
    } catch (error) {
        console.error('[MapManager] Error loading maps.json:', error);
    }
}

/**
 * Save maps to JSON file
 */
function saveMaps() {
    ensureDataDir();

    const data = {
        maps: Object.fromEntries(maps),
        lastUpdated: new Date().toISOString(),
    };

    try {
        writeFileSync(MAPS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('[MapManager] Error saving maps.json:', error);
    }
}

// Load on startup
loadMaps();

/**
 * Initialize map with starting rooms
 * @param {string} gameId - Room ID
 * @returns {MapState}
 */
export function initializeMap(gameId) {
    const state = {
        revealedRooms: {},
        connections: {},
    };

    // Add starting rooms
    for (const [id, room] of Object.entries(STARTING_ROOMS)) {
        state.revealedRooms[id] = { ...room };
        state.connections[id] = {};
    }

    // Set up initial connections between starting rooms (vertical line)
    // Entrance Hall <-> Foyer <-> Grand Staircase
    state.connections['entrance-hall']['north'] = 'foyer';
    state.connections['foyer']['south'] = 'entrance-hall';
    state.connections['foyer']['north'] = 'grand-staircase';
    state.connections['grand-staircase']['south'] = 'foyer';

    maps.set(gameId, state);
    saveMaps();

    return state;
}

/**
 * Get map state for a game
 * @param {string} gameId
 * @returns {MapState | undefined}
 */
export function getMapState(gameId) {
    return maps.get(gameId);
}

/**
 * Check if room has a door in direction
 * @param {string} gameId
 * @param {string} roomId
 * @param {Direction} direction
 * @returns {boolean}
 */
export function hasDoor(gameId, roomId, direction) {
    const state = maps.get(gameId);
    if (!state) return false;

    const room = state.revealedRooms[roomId];
    if (!room) return false;

    return room.doors.includes(direction);
}

/**
 * Get connected room in direction (if exists)
 * @param {string} gameId
 * @param {string} roomId
 * @param {Direction} direction
 * @returns {string | null}
 */
export function getConnectedRoom(gameId, roomId, direction) {
    const state = maps.get(gameId);
    if (!state) return null;

    const connections = state.connections[roomId];
    if (!connections) return null;

    return connections[direction] || null;
}

/**
 * Reveal a new room in direction
 * @param {string} gameId
 * @param {string} fromRoomId
 * @param {Direction} direction
 * @returns {{ success: boolean; newRoom?: RevealedRoom; error?: string }}
 */
export function revealRoom(gameId, fromRoomId, direction) {
    const state = maps.get(gameId);
    if (!state) {
        return { success: false, error: 'Game not found' };
    }

    const fromRoom = state.revealedRooms[fromRoomId];
    if (!fromRoom) {
        return { success: false, error: 'Current room not found' };
    }

    // Check if fromRoom has door in that direction
    if (!fromRoom.doors.includes(direction)) {
        return { success: false, error: 'No door in that direction' };
    }

    // Check if already connected
    if (state.connections[fromRoomId]?.[direction]) {
        return { success: false, error: 'Room already exists in that direction' };
    }

    // Get already revealed room IDs
    const revealedIds = new Set(Object.keys(state.revealedRooms));

    // Filter available rooms (not yet revealed and has door for opposite direction)
    const oppositeDir = getOppositeDirection(direction);
    const availableRooms = ROOM_POOL.filter(
        (room) => !revealedIds.has(room.id) && room.doors.includes(oppositeDir)
    );

    if (availableRooms.length === 0) {
        return { success: false, error: 'No rooms available' };
    }

    // Pick random room
    const randomIndex = Math.floor(Math.random() * availableRooms.length);
    const newRoomTemplate = availableRooms[randomIndex];

    // Calculate position
    const offset = getDirectionOffset(direction);
    const newX = fromRoom.x + offset.dx;
    const newY = fromRoom.y + offset.dy;

    // Create new room
    const newRoom = {
        id: newRoomTemplate.id,
        name: newRoomTemplate.name,
        x: newX,
        y: newY,
        doors: [...newRoomTemplate.doors],
        floor: newRoomTemplate.floor,
    };

    // Add to revealed rooms
    state.revealedRooms[newRoom.id] = newRoom;

    // Set up connections
    if (!state.connections[fromRoomId]) {
        state.connections[fromRoomId] = {};
    }
    if (!state.connections[newRoom.id]) {
        state.connections[newRoom.id] = {};
    }

    state.connections[fromRoomId][direction] = newRoom.id;
    state.connections[newRoom.id][oppositeDir] = fromRoomId;

    saveMaps();

    return { success: true, newRoom };
}

/**
 * Get room info
 * @param {string} gameId
 * @param {string} roomId
 * @returns {RevealedRoom | undefined}
 */
export function getRoom(gameId, roomId) {
    const state = maps.get(gameId);
    if (!state) return undefined;

    return state.revealedRooms[roomId];
}

/**
 * Get all revealed rooms
 * @param {string} gameId
 * @returns {Record<string, RevealedRoom>}
 */
export function getAllRooms(gameId) {
    const state = maps.get(gameId);
    if (!state) return {};

    return { ...state.revealedRooms };
}

/**
 * Get all connections
 * @param {string} gameId
 * @returns {Record<string, Record<Direction, string>>}
 */
export function getAllConnections(gameId) {
    const state = maps.get(gameId);
    if (!state) return {};

    return { ...state.connections };
}

/**
 * Get full map state for broadcasting
 * @param {string} gameId
 * @returns {MapState | null}
 */
export function getFullMapState(gameId) {
    const state = maps.get(gameId);
    if (!state) return null;

    return {
        revealedRooms: { ...state.revealedRooms },
        connections: { ...state.connections },
    };
}

/**
 * Clean up map when game ends
 * @param {string} gameId
 */
export function cleanupMap(gameId) {
    maps.delete(gameId);
    saveMaps();
}

/**
 * Check if player can move in direction from current room
 * @param {string} gameId
 * @param {string} currentRoomId
 * @param {Direction} direction
 * @returns {{ canMove: boolean; needsReveal: boolean; targetRoom: string | null }}
 */
export function canMoveInDirection(gameId, currentRoomId, direction) {
    const state = maps.get(gameId);
    if (!state) {
        return { canMove: false, needsReveal: false, targetRoom: null };
    }

    const currentRoom = state.revealedRooms[currentRoomId];
    if (!currentRoom) {
        return { canMove: false, needsReveal: false, targetRoom: null };
    }

    // Check if there's a door in that direction
    if (!currentRoom.doors.includes(direction)) {
        return { canMove: false, needsReveal: false, targetRoom: null };
    }

    // Check if there's already a connection
    const existingConnection = state.connections[currentRoomId]?.[direction];
    if (existingConnection) {
        return { canMove: true, needsReveal: false, targetRoom: existingConnection };
    }

    // Door exists but no room revealed yet
    return { canMove: true, needsReveal: true, targetRoom: null };
}
