// Client-side Socket.IO service wrapper
import { io } from 'socket.io-client';

/** @type {import('socket.io-client').Socket | null} */
let socket = null;

/** @type {((room: import('./types').Room) => void)[]} */
const roomStateListeners = [];

/** @type {((error: { message: string }) => void)[]} */
const errorListeners = [];

/** @type {((data: { roomId: string }) => void)[]} */
const gameStartListeners = [];

/**
 * Connect to Socket.IO server
 * @returns {import('socket.io-client').Socket}
 */
export function connect() {
    if (socket?.connected) {
        return socket;
    }

    // Connect to same origin (Vite dev server)
    socket = io({
        transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
        console.log('[SocketClient] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
        console.log('[SocketClient] Disconnected:', reason);
    });

    socket.on('room:state', (room) => {
        console.log('[SocketClient] Room state update:', room);
        roomStateListeners.forEach((fn) => fn(room));
    });

    socket.on('room:error', (error) => {
        console.error('[SocketClient] Error:', error);
        errorListeners.forEach((fn) => fn(error));
    });

    socket.on('room:game-start', (data) => {
        console.log('[SocketClient] Game starting:', data);
        gameStartListeners.forEach((fn) => fn(data));
    });

    socket.on('room:player-joined', (data) => {
        console.log('[SocketClient] Player joined:', data);
    });

    socket.on('room:player-left', (data) => {
        console.log('[SocketClient] Player left:', data);
    });

    return socket;
}

/**
 * Get socket instance
 * @returns {import('socket.io-client').Socket | null}
 */
export function getSocket() {
    return socket;
}

/**
 * Get socket ID
 * @returns {string | undefined}
 */
export function getSocketId() {
    return socket?.id;
}

/**
 * Disconnect from server
 */
export function disconnect() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

/**
 * Create a new room
 * @param {string} playerName
 * @returns {Promise<{ success: boolean; room?: any; error?: string }>}
 */
export function createRoom(playerName) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('room:create', { playerName }, (response) => {
            resolve(response);
        });
    });
}

/**
 * Join an existing room
 * @param {string} roomId
 * @param {string} playerName
 * @returns {Promise<{ success: boolean; room?: any; error?: string }>}
 */
export function joinRoom(roomId, playerName) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('room:join', { roomId, playerName }, (response) => {
            resolve(response);
        });
    });
}

/**
 * Leave current room
 * @returns {Promise<{ success: boolean }>}
 */
export function leaveRoom() {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false });
            return;
        }

        socket.emit('room:leave', {}, (response) => {
            resolve(response);
        });
    });
}

/**
 * Update player status
 * @param {'joined' | 'selecting' | 'ready'} status
 * @returns {Promise<{ success: boolean }>}
 */
export function updateStatus(status) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false });
            return;
        }

        socket.emit('room:update-status', { status }, (response) => {
            resolve(response);
        });
    });
}

/**
 * Select a character
 * @param {string | null} characterId
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
export function selectCharacter(characterId) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('room:select-character', { characterId }, (response) => {
            resolve(response);
        });
    });
}

/**
 * Toggle ready status
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
export function toggleReady() {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('room:ready', {}, (response) => {
            resolve(response);
        });
    });
}

/**
 * Start the game (host only)
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
export function startGame() {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('room:start', {}, (response) => {
            resolve(response);
        });
    });
}

/**
 * Update player name
 * @param {string} name
 * @returns {Promise<{ success: boolean }>}
 */
export function updateName(name) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false });
            return;
        }

        socket.emit('room:update-name', { name }, (response) => {
            resolve(response);
        });
    });
}

/**
 * Get room state
 * @param {string} roomId
 * @returns {Promise<{ success: boolean; room?: any }>}
 */
export function getRoomState(roomId) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false });
            return;
        }

        socket.emit('room:get-state', { roomId }, (response) => {
            resolve(response);
        });
    });
}

/**
 * Subscribe to room state updates
 * @param {(room: any) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onRoomState(callback) {
    roomStateListeners.push(callback);
    return () => {
        const index = roomStateListeners.indexOf(callback);
        if (index > -1) {
            roomStateListeners.splice(index, 1);
        }
    };
}

/**
 * Subscribe to error events
 * @param {(error: { message: string }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onError(callback) {
    errorListeners.push(callback);
    return () => {
        const index = errorListeners.indexOf(callback);
        if (index > -1) {
            errorListeners.splice(index, 1);
        }
    };
}

/**
 * Subscribe to game start event
 * @param {(data: { roomId: string }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onGameStart(callback) {
    gameStartListeners.push(callback);
    return () => {
        const index = gameStartListeners.indexOf(callback);
        if (index > -1) {
            gameStartListeners.splice(index, 1);
        }
    };
}
