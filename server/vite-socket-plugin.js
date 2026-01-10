// Vite plugin to attach Socket.IO server during development
import { Server as SocketIOServer } from 'socket.io';
import * as roomManager from './roomManager.js';

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

                    if (callback) {
                        callback({ success: true, hasTies: result.hasTies, allRolled: result.allRolled });
                    }

                    // Broadcast updated game state
                    io.to(result.room.id).emit('game:state', result.room);
                });

                // Move (direction)
                socket.on('game:move', ({ direction }, callback) => {
                    const result = roomManager.useMove(socket.id, direction);

                    if (!result.success) {
                        if (callback) {
                            callback({ success: false, error: result.error });
                        }
                        return;
                    }

                    if (callback) {
                        callback({ success: true, turnEnded: result.turnEnded });
                    }

                    // Broadcast updated game state
                    io.to(result.room.id).emit('game:state', result.room);
                });

                // Set player moves (called when turn starts to set speed-based moves)
                socket.on('game:set-moves', ({ moves }, callback) => {
                    const room = roomManager.setPlayerMoves(socket.id, moves);

                    if (callback) {
                        callback({ success: !!room });
                    }

                    if (room) {
                        io.to(room.id).emit('game:state', room);
                    }
                });

                // Get game state
                socket.on('game:get-state', ({ roomId }, callback) => {
                    const room = roomManager.getGameState(roomId);

                    if (callback) {
                        callback({ success: !!room, room });
                    }

                    if (room) {
                        socket.emit('game:state', room);
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
