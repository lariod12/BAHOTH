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

/** @type {((state: any) => void)[]} */
const gameStateListeners = [];

/** @type {((data: { activePlayers: string[] }) => void)[]} */
const playersActiveListeners = [];


// ============================================
// Session Management for Reconnection
// ============================================

const SESSION_KEY = 'bahoth_session';
const SESSION_BACKUP_KEY = 'bahoth_session_backup';
const SESSION_EXPIRY = 5 * 60 * 1000; // 5 minutes (matches server grace period)

/**
 * @typedef {{
 *   roomId: string;
 *   oldSocketId: string;
 *   playerName: string;
 *   characterId: string | null;
 *   timestamp: number;
 * }} SessionInfo
 */

/** @type {SessionInfo | null} */
let currentSession = null;

/** @type {((result: { success: boolean; canRejoin?: boolean; roomId?: string }) => void)[]} */
const reconnectResultListeners = [];

/** @type {((data: { playerId: string; gracePeriod: number }) => void)[]} */
const playerDisconnectedListeners = [];

/** @type {((data: { playerId: string; playerName: string }) => void)[]} */
const playerReconnectedListeners = [];

/** @type {((data: { message: string }) => void)[]} */
const debugResetListeners = [];

// Solo debug state - tracks which player is currently active
/** @type {string|null} */
let soloDebugActivePlayerId = null;
/** @type {boolean} */
let isSoloDebugMode = false;

/**
 * Save session info for reconnection
 * @param {string} roomId
 * @param {string} playerName
 * @param {string | null} [characterId]
 */
export function saveSession(roomId, playerName, characterId = null) {
    if (!socket?.id) return;

    const sessionInfo = {
        roomId,
        oldSocketId: socket.id,
        playerName,
        characterId,
        timestamp: Date.now()
    };

    currentSession = sessionInfo;

    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionInfo));
        localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(sessionInfo));
        console.log('[SocketClient] Session saved:', sessionInfo.roomId);
    } catch (e) {
        console.warn('[SocketClient] Failed to save session:', e);
    }
}

/**
 * Update session with character selection
 * @param {string} characterId
 */
export function updateSessionCharacter(characterId) {
    if (!currentSession) return;

    currentSession.characterId = characterId;
    saveSession(currentSession.roomId, currentSession.playerName, characterId);
}

/**
 * Load saved session info
 * @returns {SessionInfo | null}
 */
export function loadSession() {
    try {
        // Try sessionStorage first (current browser session)
        let data = sessionStorage.getItem(SESSION_KEY);

        if (!data) {
            // Fallback to localStorage (browser crash recovery)
            data = localStorage.getItem(SESSION_BACKUP_KEY);
        }

        if (!data) return null;

        const session = JSON.parse(data);

        // Check if session is expired
        if (Date.now() - session.timestamp > SESSION_EXPIRY) {
            clearSession();
            return null;
        }

        return session;
    } catch (e) {
        console.warn('[SocketClient] Failed to load session:', e);
        return null;
    }
}

/**
 * Clear saved session
 */
export function clearSession() {
    currentSession = null;
    try {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_BACKUP_KEY);
        console.log('[SocketClient] Session cleared');
    } catch (e) {
        console.warn('[SocketClient] Failed to clear session:', e);
    }
}

/**
 * Attempt to reconnect to a previous session
 * @returns {Promise<{ success: boolean; room?: any; error?: string; canRejoin?: boolean }>}
 */
export function attemptReconnect() {
    return new Promise((resolve) => {
        const session = loadSession();

        if (!session) {
            resolve({ success: false, error: 'No session found' });
            return;
        }

        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        console.log('[SocketClient] Attempting reconnect:', session.roomId, session.oldSocketId);

        socket.emit('room:reconnect', {
            roomId: session.roomId,
            oldSocketId: session.oldSocketId,
            playerName: session.playerName
        }, (response) => {
            if (response.success) {
                // Update session with new socket ID
                saveSession(session.roomId, session.playerName, session.characterId);
                console.log('[SocketClient] Reconnection successful');
            } else {
                // Clear invalid session
                clearSession();
                console.log('[SocketClient] Reconnection failed:', response.error);
            }
            resolve(response);
        });
    });
}

/**
 * Get current session info
 * @returns {SessionInfo | null}
 */
export function getCurrentSession() {
    return currentSession || loadSession();
}

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
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
    });

    socket.on('connect', async () => {
        console.log('[SocketClient] Connected:', socket.id);

        // Check for saved session and attempt reconnect
        const session = loadSession();
        if (session) {
            console.log('[SocketClient] Found saved session, attempting reconnect...');
            const result = await attemptReconnect();

            // Notify listeners of reconnect result
            reconnectResultListeners.forEach(fn => fn({
                success: result.success,
                canRejoin: result.canRejoin,
                roomId: session.roomId
            }));
        }
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

    // Player disconnected with grace period
    socket.on('room:player-disconnected', (data) => {
        console.log('[SocketClient] Player disconnected (grace period):', data);
        playerDisconnectedListeners.forEach((fn) => fn(data));
    });

    // Player reconnected
    socket.on('room:player-reconnected', (data) => {
        console.log('[SocketClient] Player reconnected:', data);
        playerReconnectedListeners.forEach((fn) => fn(data));
    });

    socket.on('game:state', (state) => {
        console.log('[SocketClient] Game state update:', state);
        gameStateListeners.forEach((fn) => fn(state));
    });

    socket.on('game:players-active', (data) => {
        console.log('[SocketClient] Players active update:', data);
        playersActiveListeners.forEach((fn) => fn(data));
    });

    socket.on('debug:reset', (data) => {
        console.log('[SocketClient] Debug reset received:', data);
        debugResetListeners.forEach((fn) => fn(data));
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
 * Check if socket is connected
 * @returns {boolean}
 */
export function isConnected() {
    return socket?.connected ?? false;
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
 * @param {number} [maxPlayers=6]
 * @returns {Promise<{ success: boolean; room?: any; error?: string }>}
 */
export function createRoom(playerName, maxPlayers = 6) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('room:create', { playerName, maxPlayers }, (response) => {
            resolve(response);
        });
    });
}

/**
 * Check room status before joining
 * @param {string} roomId
 * @returns {Promise<{ success: boolean; room?: any; error?: string }>}
 */
export function checkRoom(roomId) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('room:check', { roomId }, (response) => {
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

/**
 * Subscribe to game state updates
 * @param {(state: any) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onGameState(callback) {
    gameStateListeners.push(callback);
    return () => {
        const index = gameStateListeners.indexOf(callback);
        if (index > -1) {
            gameStateListeners.splice(index, 1);
        }
    };
}

/**
 * Roll dice
 * @param {number} value
 * @returns {Promise<{ success: boolean; hasTies?: boolean; allRolled?: boolean; error?: string }>}
 */
export function rollDice(value) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('game:roll-dice', { value }, (response) => {
            resolve(response);
        });
    });
}

/**
 * Move in a direction
 * @param {string} direction - 'up' | 'down' | 'left' | 'right'
 * @returns {Promise<{ success: boolean; turnEnded?: boolean; error?: string }>}
 */
export function move(direction) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('game:move', { direction }, (response) => {
            resolve(response);
        });
    });
}

/**
 * Set player moves (for turn start)
 * In solo debug mode, includes asPlayerId to tell server which player
 * @param {number} moves
 * @returns {Promise<{ success: boolean }>}
 */
export function setMoves(moves) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false });
            return;
        }

        const payload = { moves };
        if (isSoloDebugMode && soloDebugActivePlayerId) {
            payload.asPlayerId = soloDebugActivePlayerId;
        }

        socket.emit('game:set-moves', payload, (response) => {
            resolve(response);
        });
    });
}

/**
 * Sync game state to server (client-authoritative for room discovery, token drawing)
 * @param {Object} stateUpdate - Partial state update to sync
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
export function syncGameState(stateUpdate) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('game:sync-state', stateUpdate, (response) => {
            resolve(response);
        });
    });
}

/**
 * Get game state
 * @param {string} roomId
 * @returns {Promise<{ success: boolean; room?: any }>}
 */
export function getGameState(roomId) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false });
            return;
        }

        socket.emit('game:get-state', { roomId }, (response) => {
            resolve(response);
        });
    });
}

/**
 * End turn early (skip remaining moves)
 * @returns {Promise<{ success: boolean }>}
 */
export function endTurn() {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false });
            return;
        }

        socket.emit('game:end-turn', {}, (response) => {
            resolve(response);
        });
    });
}

/**
 * Set player active status
 * @param {boolean} isActive
 * @returns {Promise<{ success: boolean }>}
 */
export function setActive(isActive) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false });
            return;
        }
        socket.emit('game:set-active', { isActive }, (response) => {
            resolve(response);
        });
    });
}

/**
 * Subscribe to players active status updates
 * @param {(data: { activePlayers: string[] }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onPlayersActive(callback) {
    playersActiveListeners.push(callback);
    return () => {
        const index = playersActiveListeners.indexOf(callback);
        if (index > -1) {
            playersActiveListeners.splice(index, 1);
        }
    };
}


// ============================================
// Debug Mode Functions
// ============================================

/**
 * Join or create a debug room with fixed ID "DEBUG"
 * Used for quick multiplayer testing - auto-starts when 2 players join
 * @param {string} playerName - Player's name
 * @returns {Promise<{ success: boolean; room?: any; error?: string }>}
 */
export function joinOrCreateDebugRoom(playerName) {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('debug:join-or-create', { playerName }, (response) => {
            if (response.success && response.room) {
                saveSession(response.room.id, playerName);
            }
            resolve(response);
        });
    });
}

/**
 * Reset debug game - both players return to initial game state
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
export function resetDebugGame() {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('debug:reset', {}, (response) => {
            resolve(response);
        });
    });
}

/**
 * Subscribe to debug reset events (game reset notification)
 * @param {(data: { message: string }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onDebugReset(callback) {
    debugResetListeners.push(callback);
    return () => {
        const index = debugResetListeners.indexOf(callback);
        if (index > -1) {
            debugResetListeners.splice(index, 1);
        }
    };
}

// ============================================
// Solo Debug Mode Functions
// ============================================

/**
 * Create solo debug room - 1 socket, 2 virtual players, instant start
 * @returns {Promise<{ success: boolean; room?: any; player1Id?: string; player2Id?: string; error?: string }>}
 */
export function createSoloDebugRoom() {
    return new Promise((resolve) => {
        if (!socket) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        const doCreate = () => {
            socket.emit('debug:solo-create', {}, (response) => {
                if (response.success && response.room) {
                    saveSession(response.room.id, 'SoloDebug');
                    isSoloDebugMode = true;
                    soloDebugActivePlayerId = response.player1Id;
                }
                resolve(response);
            });
        };

        if (socket.connected) {
            doCreate();
        } else {
            socket.once('connect', doCreate);
        }
    });
}

/**
 * Reset solo debug game
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
export function resetSoloDebugRoom() {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: false, error: 'Not connected' });
            return;
        }

        socket.emit('debug:solo-reset', {}, (response) => {
            isSoloDebugMode = false;
            soloDebugActivePlayerId = null;
            resolve(response);
        });
    });
}

/**
 * Set the active player for solo debug mode
 * @param {string} playerId
 */
export function setSoloDebugActivePlayer(playerId) {
    soloDebugActivePlayerId = playerId;
}

/**
 * Get the current solo debug active player ID
 * @returns {string|null}
 */
export function getSoloDebugActivePlayer() {
    return soloDebugActivePlayerId;
}

/**
 * Check if in solo debug mode
 * @returns {boolean}
 */
export function getIsSoloDebug() {
    return isSoloDebugMode;
}

/**
 * Set solo debug mode flag
 * @param {boolean} value
 */
export function setIsSoloDebug(value) {
    isSoloDebugMode = value;
}

// ============================================
// Reconnection Event Subscriptions
// ============================================

/**
 * Subscribe to reconnect result events
 * @param {(result: { success: boolean; canRejoin?: boolean; roomId?: string }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onReconnectResult(callback) {
    reconnectResultListeners.push(callback);
    return () => {
        const index = reconnectResultListeners.indexOf(callback);
        if (index > -1) {
            reconnectResultListeners.splice(index, 1);
        }
    };
}

/**
 * Subscribe to player disconnected events (with grace period)
 * @param {(data: { playerId: string; gracePeriod: number }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onPlayerDisconnected(callback) {
    playerDisconnectedListeners.push(callback);
    return () => {
        const index = playerDisconnectedListeners.indexOf(callback);
        if (index > -1) {
            playerDisconnectedListeners.splice(index, 1);
        }
    };
}

/**
 * Subscribe to player reconnected events
 * @param {(data: { playerId: string; playerName: string }) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onPlayerReconnected(callback) {
    playerReconnectedListeners.push(callback);
    return () => {
        const index = playerReconnectedListeners.indexOf(callback);
        if (index > -1) {
            playerReconnectedListeners.splice(index, 1);
        }
    };
}
