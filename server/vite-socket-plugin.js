// Vite plugin to attach Socket.IO server during development
import { Server as SocketIOServer } from 'socket.io';
import * as roomManager from './roomManager.js';
import * as playerManager from './playerManager.js';
import * as mapManager from './mapManager.js';

/**
 * @returns {import('vite').Plugin}
 */
export function socketIOPlugin() {
    /** @type {SocketIOServer | null} */
    let io = null;

    return {
        name: 'vite-socket-io',
        configureServer(server) {
            if (!server.httpServer) {
                console.warn('[Socket.IO] No HTTP server available');
                return;
            }

            io = new SocketIOServer(server.httpServer, {
                cors: {
                    origin: '*',
                    methods: ['GET', 'POST'],
                },
            });

            console.log('[Socket.IO] Server attached to Vite dev server');

            io.on('connection', (socket) => {
                console.log(`[Socket.IO] Client connected: ${socket.id}`);

                // Create room
                socket.on('room:create', ({ playerName, maxPlayers }, callback) => {
                    const room = roomManager.createRoom(socket.id, playerName || 'Host', maxPlayers || 6);
                    socket.join(room.id);
                    console.log(`[Socket.IO] Room created: ${room.id} by ${socket.id} (max: ${room.maxPlayers})`);

                    if (callback) {
                        callback({ success: true, room });
                    }

                    // Broadcast room state
                    io.to(room.id).emit('room:state', room);
                });

                // Check room status (before joining)
                socket.on('room:check', ({ roomId }, callback) => {
                    const room = roomManager.getRoom(roomId);

                    if (!room) {
                        if (callback) {
                            callback({ success: false, error: 'Room not found' });
                        }
                        return;
                    }

                    const isFull = room.players.length >= room.maxPlayers;

                    if (callback) {
                        callback({
                            success: true,
                            room: {
                                id: room.id,
                                playerCount: room.players.length,
                                maxPlayers: room.maxPlayers,
                                isFull,
                            },
                        });
                    }
                });

                // Join room
                socket.on('room:join', ({ roomId, playerName }, callback) => {
                    const result = roomManager.joinRoom(roomId, socket.id, playerName || 'Player');

                    if (!result.success) {
                        if (callback) {
                            callback({ success: false, error: result.error });
                        }
                        socket.emit('room:error', { message: result.error });
                        return;
                    }

                    socket.join(roomId);
                    console.log(`[Socket.IO] Player ${socket.id} joined room: ${roomId}`);

                    if (callback) {
                        callback({ success: true, room: result.room });
                    }

                    // Broadcast updated room state to all players
                    io.to(roomId).emit('room:state', result.room);
                    // Notify others of new player
                    socket.to(roomId).emit('room:player-joined', {
                        playerId: socket.id,
                        playerName: playerName || 'Player',
                    });
                });

                // Leave room
                socket.on('room:leave', (_, callback) => {
                    const result = roomManager.leaveRoom(socket.id);

                    if (result.room) {
                        socket.leave(result.room.id);
                        console.log(`[Socket.IO] Player ${socket.id} left room: ${result.room.id}`);

                        // Broadcast updated room state
                        io.to(result.room.id).emit('room:state', result.room);
                        // Notify others
                        socket.to(result.room.id).emit('room:player-left', {
                            playerId: socket.id,
                            wasHost: result.wasHost,
                        });
                    }

                    if (callback) {
                        callback({ success: true });
                    }
                });

                // Update player status (when switching tabs)
                socket.on('room:update-status', ({ status }, callback) => {
                    const room = roomManager.updatePlayerStatus(socket.id, status);

                    if (room) {
                        io.to(room.id).emit('room:state', room);
                    }

                    if (callback) {
                        callback({ success: !!room });
                    }
                });

                // Select character
                socket.on('room:select-character', ({ characterId }, callback) => {
                    const result = roomManager.selectCharacter(socket.id, characterId);

                    if (!result.success) {
                        if (callback) {
                            callback({ success: false, error: result.error });
                        }
                        socket.emit('room:error', { message: result.error });
                        return;
                    }

                    if (callback) {
                        callback({ success: true });
                    }

                    // Broadcast updated room state
                    io.to(result.room.id).emit('room:state', result.room);
                });

                // Toggle ready
                socket.on('room:ready', (_, callback) => {
                    const result = roomManager.toggleReady(socket.id);

                    if (!result.success) {
                        if (callback) {
                            callback({ success: false, error: result.error });
                        }
                        socket.emit('room:error', { message: result.error });
                        return;
                    }

                    if (callback) {
                        callback({ success: true });
                    }

                    // Broadcast updated room state
                    io.to(result.room.id).emit('room:state', result.room);
                });

                // Start game (host only)
                socket.on('room:start', (_, callback) => {
                    const room = roomManager.getRoomBySocket(socket.id);

                    if (!room) {
                        if (callback) {
                            callback({ success: false, error: 'Not in a room' });
                        }
                        return;
                    }

                    if (room.hostId !== socket.id) {
                        if (callback) {
                            callback({ success: false, error: 'Only host can start the game' });
                        }
                        return;
                    }

                    const canStart = roomManager.canStartGame(room.id);
                    if (!canStart.canStart) {
                        if (callback) {
                            callback({ success: false, error: canStart.reason });
                        }
                        return;
                    }

                    // Start the game and transition to rolling phase
                    const result = roomManager.startGame(room.id);

                    if (!result.success) {
                        if (callback) {
                            callback({ success: false, error: result.error });
                        }
                        return;
                    }

                    // Initialize player state and map
                    const playerIds = room.players.map((p) => p.id);
                    playerManager.initializeGame(room.id, playerIds, 'entrance-hall');
                    mapManager.initializeMap(room.id);

                    if (callback) {
                        callback({ success: true });
                    }

                    // Broadcast game start and game state
                    io.to(room.id).emit('room:game-start', { roomId: room.id });
                    io.to(room.id).emit('game:state', result.room);
                });

                // Roll dice
                socket.on('game:roll-dice', ({ value }, callback) => {
                    const result = roomManager.rollDice(socket.id, value);

                    if (!result.success) {
                        if (callback) {
                            callback({ success: false, error: result.error });
                        }
                        return;
                    }

                    // If all rolled and game is now in playing phase, set turn order in playerManager
                    if (result.allRolled && result.room.gamePhase === 'playing') {
                        playerManager.setTurnOrder(result.room.id, result.room.turnOrder);
                    }

                    if (callback) {
                        callback({ success: true, hasTies: result.hasTies, allRolled: result.allRolled });
                    }

                    // Broadcast updated game state with map
                    const mapState = mapManager.getFullMapState(result.room.id);
                    const playerState = playerManager.getFullPlayerState(result.room.id);
                    const fullState = {
                        ...result.room,
                        map: mapState,
                        playerState: playerState,
                    };
                    io.to(result.room.id).emit('game:state', fullState);
                });

                // Move (direction)
                socket.on('game:move', ({ direction }, callback) => {
                    const room = roomManager.getRoomBySocket(socket.id);
                    if (!room) {
                        if (callback) {
                            callback({ success: false, error: 'Not in a room' });
                        }
                        return;
                    }

                    // Get current player position
                    const currentPosition = playerManager.getPlayerPosition(room.id, socket.id);
                    if (!currentPosition) {
                        if (callback) {
                            callback({ success: false, error: 'Player position not found' });
                        }
                        return;
                    }

                    // Check if can move in that direction
                    const moveCheck = mapManager.canMoveInDirection(room.id, currentPosition, direction);
                    if (!moveCheck.canMove) {
                        if (callback) {
                            callback({ success: false, error: 'No door in that direction' });
                        }
                        return;
                    }

                    // Use move from roomManager (deduct moves)
                    const moveResult = roomManager.useMove(socket.id, direction);
                    if (!moveResult.success) {
                        if (callback) {
                            callback({ success: false, error: moveResult.error });
                        }
                        return;
                    }

                    let targetRoom = moveCheck.targetRoom;
                    let newRoomRevealed = null;

                    // If needs reveal, reveal new room
                    if (moveCheck.needsReveal) {
                        const revealResult = mapManager.revealRoom(room.id, currentPosition, direction);
                        if (!revealResult.success) {
                            if (callback) {
                                callback({ success: false, error: revealResult.error });
                            }
                            return;
                        }
                        targetRoom = revealResult.newRoom.id;
                        newRoomRevealed = revealResult.newRoom;
                    }

                    // Update player position
                    playerManager.setPlayerPosition(room.id, socket.id, targetRoom);

                    // Also use playerManager to track move
                    playerManager.useMove(room.id, socket.id);

                    // If turn ended, move to next player
                    if (moveResult.turnEnded) {
                        playerManager.nextTurn(room.id);
                    }

                    if (callback) {
                        callback({ 
                            success: true, 
                            turnEnded: moveResult.turnEnded,
                            newRoom: newRoomRevealed,
                            movedTo: targetRoom,
                        });
                    }

                    // Broadcast updated game state with map and player state
                    const mapState = mapManager.getFullMapState(room.id);
                    const playerState = playerManager.getFullPlayerState(room.id);
                    const fullState = {
                        ...moveResult.room,
                        map: mapState,
                        playerState: playerState,
                    };
                    io.to(room.id).emit('game:state', fullState);
                });

                // Set player moves (called when turn starts to set speed-based moves)
                socket.on('game:set-moves', ({ moves }, callback) => {
                    const room = roomManager.setPlayerMoves(socket.id, moves);

                    if (callback) {
                        callback({ success: !!room });
                    }

                    if (room) {
                        // Also set in playerManager
                        playerManager.setPlayerMoves(room.id, socket.id, moves);

                        const mapState = mapManager.getFullMapState(room.id);
                        const playerState = playerManager.getFullPlayerState(room.id);
                        const fullState = {
                            ...room,
                            map: mapState,
                            playerState: playerState,
                        };
                        io.to(room.id).emit('game:state', fullState);
                    }
                });

                // Get game state
                socket.on('game:get-state', ({ roomId }, callback) => {
                    const room = roomManager.getGameState(roomId);

                    if (callback) {
                        callback({ success: !!room, room });
                    }

                    if (room) {
                        const mapState = mapManager.getFullMapState(roomId);
                        const playerState = playerManager.getFullPlayerState(roomId);
                        const fullState = {
                            ...room,
                            map: mapState,
                            playerState: playerState,
                        };
                        socket.emit('game:state', fullState);
                    }
                });

                // Update player name
                socket.on('room:update-name', ({ name }, callback) => {
                    const room = roomManager.updatePlayerName(socket.id, name);

                    if (room) {
                        io.to(room.id).emit('room:state', room);
                    }

                    if (callback) {
                        callback({ success: !!room });
                    }
                });

                // Sync game state (client-authoritative for room discovery, token drawing)
                socket.on('game:sync-state', (stateUpdate, callback) => {
                    const room = roomManager.getRoomBySocket(socket.id);

                    if (!room) {
                        if (callback) {
                            callback({ success: false, error: 'Not in a room' });
                        }
                        return;
                    }

                    console.log(`[Socket.IO] Game state sync from ${socket.id}:`, Object.keys(stateUpdate));

                    // Update player positions if provided
                    if (stateUpdate.playerPositions) {
                        for (const [playerId, position] of Object.entries(stateUpdate.playerPositions)) {
                            playerManager.setPlayerPosition(room.id, playerId, position);
                        }
                    }

                    // Update player moves if provided
                    if (stateUpdate.playerMoves) {
                        for (const [playerId, moves] of Object.entries(stateUpdate.playerMoves)) {
                            playerManager.setPlayerMoves(room.id, playerId, moves);
                        }
                    }

                    // Update map if provided
                    if (stateUpdate.map) {
                        mapManager.updateMapState(room.id, stateUpdate.map);
                    }

                    if (callback) {
                        callback({ success: true });
                    }

                    // Broadcast updated game state to all players in the room
                    const mapState = mapManager.getFullMapState(room.id);
                    const playerState = playerManager.getFullPlayerState(room.id);
                    const fullState = {
                        ...room,
                        map: mapState,
                        playerState: playerState,
                    };
                    io.to(room.id).emit('game:state', fullState);
                });

                // ============================================
                // Debug Mode Events
                // ============================================

                // Create debug room with auto-generated players
                socket.on('create-debug-room', ({ playerCount }, callback) => {
                    const room = roomManager.createDebugRoom(socket.id, playerCount || 3);
                    socket.join(room.id);
                    console.log(`[Socket.IO] Debug room created: ${room.id} by ${socket.id} (players: ${room.players.length})`);

                    if (callback) {
                        callback({ success: true, room });
                    }

                    // Emit debug room state
                    io.to(room.id).emit('debug-room-state', room);
                    io.to(room.id).emit('room:state', room);
                });

                // Select character for a player in debug mode
                socket.on('debug-select-character', ({ playerId, characterId }, callback) => {
                    const room = roomManager.getRoomBySocket(socket.id);

                    if (!room) {
                        if (callback) {
                            callback({ success: false, error: 'Not in a room' });
                        }
                        return;
                    }

                    if (!room.isDebug) {
                        if (callback) {
                            callback({ success: false, error: 'Not a debug room' });
                        }
                        return;
                    }

                    const result = roomManager.debugSelectCharacter(room.id, playerId, characterId);

                    if (!result.success) {
                        if (callback) {
                            callback({ success: false, error: result.error });
                        }
                        return;
                    }

                    console.log(`[Socket.IO] Debug character selected: ${characterId} for player ${playerId} in room ${room.id}`);

                    if (callback) {
                        callback({ success: true, room: result.room });
                    }

                    // Emit updated debug room state
                    io.to(room.id).emit('debug-room-state', result.room);
                    io.to(room.id).emit('room:state', result.room);
                });

                // Get current room state
                socket.on('room:get-state', ({ roomId }, callback) => {
                    const room = roomManager.getRoom(roomId);

                    if (callback) {
                        callback({ success: !!room, room });
                    }
                });

                // Disconnect
                socket.on('disconnect', () => {
                    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
                    const result = roomManager.leaveRoom(socket.id);

                    if (result.room) {
                        io.to(result.room.id).emit('room:state', result.room);
                        io.to(result.room.id).emit('room:player-left', {
                            playerId: socket.id,
                            wasHost: result.wasHost,
                        });
                    }
                });
            });
        },
    };
}
