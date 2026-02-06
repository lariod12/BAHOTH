// Movement handler - handleMove, handleMoveAfterStairs, handleMoveAfterElevator, handleMoveAfterCombat
import { state } from '../gameState.js';
import { ROOMS } from '../../../data/mapsData.js';
import { calculateVaultLayout } from '../../../utils/vaultLayout.js';
import { applyVaultSpawnPosition } from '../characters/characterManager.js';
import {
    mapDirectionToDoor, getOppositeDoor, isDoorBlocked, needsRoomEffectRoll,
    calculateNewRoomPosition, findRoomAtPosition, findElevatorPlacement,
    rotateRoomDoors, convertDoorSide, generateRoomId, removeDoorsToWalls,
    getAvailableRoomsForFloor, filterRoomsWithConnectingDoor, findFirstValidRotation,
    isRotationValid, doorDirToSide
} from './roomUtils.js';
import { openRoomEffectDiceModal } from './roomEffects.js';
import { getEnemyInRoom, clearCompletedCombatForPlayer } from '../combat/combatCalc.js';
import { openCombatModal } from '../combat/combatManager.js';
import { getTrappedAllyInRoom } from '../events/eventTrapped.js';
import { openRescueTrappedModal } from '../events/eventTrapped.js';
import { initTokenDrawing } from '../cards/tokenDrawing.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { updateGameUI } from '../ui/mainRenderer.js';

export function handleMove(mountEl, direction) {
    if (!state.currentGameState || state.currentGameState.gamePhase !== 'playing') return;

    const playerId = state.mySocketId;
    const currentTurnPlayer = state.currentGameState.turnOrder[state.currentGameState.currentTurnIndex];
    if (playerId !== currentTurnPlayer) {
        console.log(`Not ${playerId}'s turn, current turn: ${currentTurnPlayer}`);
        return;
    }
    const moves = state.currentGameState.playerMoves[playerId] || 0;
    if (moves <= 0) {
        console.log(`No moves left for ${playerId}`);
        return;
    }

    const currentRoomId = state.currentGameState.playerState.playerPositions[playerId];
    const mapConnections = state.currentGameState.map?.connections || {};
    const revealedRooms = state.currentGameState.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    const doorDirection = mapDirectionToDoor(direction);

    // Check exit room effect
    if (currentRoom && currentRoom.name) {
        if (needsRoomEffectRoll(currentRoom.name, 'exit', playerId)) {
            console.log('[RoomEffect] EXIT effect triggered for room:', currentRoom.name);
            openRoomEffectDiceModal(mountEl, currentRoom.name, { direction, targetRoomId: null, targetRoomName: null });
            return;
        }
    }

    const roomConnections = mapConnections[currentRoomId] || {};
    let targetRoomId = roomConnections[doorDirection];

    if (targetRoomId) {
        const connectedRoom = revealedRooms[targetRoomId];
        console.log('[Move] Found existing connection to', targetRoomId, 'room:', connectedRoom?.name, 'floor:', connectedRoom?.floor, 'current floor:', currentRoom.floor);
        if (connectedRoom && connectedRoom.floor !== currentRoom.floor) {
            console.log('[Move] WARNING: Connected room is on different floor! Clearing now.');
            delete mapConnections[currentRoomId][doorDirection];
            targetRoomId = null;
        } else if (!connectedRoom) {
            console.log('[Move] WARNING: Connected room not found! Clearing invalid connection.');
            delete mapConnections[currentRoomId][doorDirection];
            targetRoomId = null;
        }
    }

    if (!targetRoomId) {
        if (currentRoom && currentRoom.doors.includes(doorDirection)) {
            if (isDoorBlocked(currentRoom.name, doorDirection)) {
                console.log(`Door to ${doorDirection} from ${currentRoom.name} is blocked`);
                return;
            }

            const dirOffsets = { north: { x: 0, y: 1 }, south: { x: 0, y: -1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };
            const offset = dirOffsets[doorDirection];
            const targetX = currentRoom.x + offset.x;
            const targetY = currentRoom.y + offset.y;

            let existingRoom = null;
            let existingRoomId = null;

            for (const [roomId, room] of Object.entries(revealedRooms)) {
                if (room.floor === currentRoom.floor && room.x === targetX && room.y === targetY) {
                    if (!room.isElevatorShaft && room.name !== 'Mystic Elevator') {
                        existingRoom = room;
                        existingRoomId = roomId;
                        break;
                    }
                }
            }

            // Check reserved elevator positions
            const posKey = `${currentRoom.floor},${targetX},${targetY}`;
            const reservedElevatorId = state.mysticElevatorPositions.get(posKey);
            if (reservedElevatorId) {
                const elevatorRoom = revealedRooms[reservedElevatorId];
                if (elevatorRoom && elevatorRoom.floor !== currentRoom.floor) {
                    console.log('[Move] Target position is reserved for Mystic Elevator on floor:', elevatorRoom.floor, '- BLOCKING movement');
                    return;
                }
            }

            if (existingRoom && existingRoomId) {
                const oppositeDir = getOppositeDoor(doorDirection);
                if (existingRoom.doors && existingRoom.doors.includes(oppositeDir)) {
                    // Check enter room effect
                    if (existingRoom.name && needsRoomEffectRoll(existingRoom.name, 'enter', playerId)) {
                        openRoomEffectDiceModal(mountEl, existingRoom.name, { direction, targetRoomId: existingRoomId, targetRoomName: existingRoom.name });
                        return;
                    }

                    if (!mapConnections[currentRoomId]) mapConnections[currentRoomId] = {};
                    if (!mapConnections[existingRoomId]) mapConnections[existingRoomId] = {};
                    mapConnections[currentRoomId][doorDirection] = existingRoomId;
                    mapConnections[existingRoomId][oppositeDir] = currentRoomId;

                    clearCompletedCombatForPlayer(playerId, currentRoomId);
                    state.currentGameState.playerState.playerPositions[playerId] = existingRoomId;
                    state.currentGameState.playerMoves[playerId] = moves - 1;

                    if (!state.currentGameState.playerState.playerEntryDirections) state.currentGameState.playerState.playerEntryDirections = {};
                    state.currentGameState.playerState.playerEntryDirections[playerId] = oppositeDir;

                    const enemyInExistingRoom = getEnemyInRoom(existingRoomId, playerId);
                    if (enemyInExistingRoom) {
                        syncGameStateToServer();
                        openCombatModal(mountEl, playerId, enemyInExistingRoom.id, null);
                        return;
                    }

                    const trappedAlly = getTrappedAllyInRoom(existingRoomId, playerId);
                    if (trappedAlly) {
                        syncGameStateToServer();
                        openRescueTrappedModal(mountEl, trappedAlly.playerId, trappedAlly.playerName, trappedAlly.trappedInfo);
                        return;
                    }

                    applyVaultSpawnPosition(playerId, existingRoom, state.currentGameState);

                    if (existingRoom.tokens && existingRoom.tokens.length > 0) {
                        if (!state.currentGameState.playerState.drawnRooms) state.currentGameState.playerState.drawnRooms = [];
                        if (!state.currentGameState.playerState.drawnRooms.includes(existingRoomId)) {
                            state.currentGameState.playerState.drawnRooms.push(existingRoomId);
                            syncGameStateToServer();
                            initTokenDrawing(mountEl, existingRoom.tokens);
                            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
                            return;
                        }
                    }

                    if (state.currentGameState.playerMoves[playerId] <= 0) {
                        console.log('[Turn] Player', playerId, 'moves depleted, advancing turn');
                        advanceToNextTurn();
                    }

                    syncGameStateToServer();
                    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
                    return;
                }
            }

            // No existing room - show room discovery modal
            const currentFloor = currentRoom.floor;
            const requiredDoorSide = doorDirToSide(getOppositeDoor(doorDirection));

            state.roomDiscoveryModal = {
                isOpen: true, direction: doorDirection, floor: currentFloor, doorSide: requiredDoorSide,
                selectedRoom: null, currentRotation: 0, selectedFloor: null, needsFloorSelection: false
            };
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        console.log(`No door to ${doorDirection} from ${currentRoomId}`);
        return;
    }

    // Move to connected room
    const targetRoom = revealedRooms[targetRoomId];
    if (targetRoom && targetRoom.name) {
        if (needsRoomEffectRoll(targetRoom.name, 'enter', playerId)) {
            openRoomEffectDiceModal(mountEl, targetRoom.name, { direction, targetRoomId, targetRoomName: targetRoom.name });
            return;
        }
    }

    clearCompletedCombatForPlayer(playerId, currentRoomId);
    state.currentGameState.playerState.playerPositions[playerId] = targetRoomId;
    if (!state.currentGameState.playerState.playerEntryDirections) state.currentGameState.playerState.playerEntryDirections = {};
    const oppositeDir = getOppositeDoor(doorDirection);
    state.currentGameState.playerState.playerEntryDirections[playerId] = oppositeDir;
    state.currentGameState.playerMoves[playerId] = moves - 1;

    const enemyInTargetRoom = getEnemyInRoom(targetRoomId, playerId);
    if (enemyInTargetRoom) {
        syncGameStateToServer();
        openCombatModal(mountEl, playerId, enemyInTargetRoom.id, null);
        return;
    }

    const trappedAllyInTarget = getTrappedAllyInRoom(targetRoomId, playerId);
    if (trappedAllyInTarget) {
        syncGameStateToServer();
        openRescueTrappedModal(mountEl, trappedAllyInTarget.playerId, trappedAllyInTarget.playerName, trappedAllyInTarget.trappedInfo);
        return;
    }

    applyVaultSpawnPosition(playerId, targetRoom, state.currentGameState);

    if (targetRoom && targetRoom.tokens && targetRoom.tokens.length > 0) {
        if (!state.currentGameState.playerState.drawnRooms) state.currentGameState.playerState.drawnRooms = [];
        if (!state.currentGameState.playerState.drawnRooms.includes(targetRoomId)) {
            state.currentGameState.playerState.drawnRooms.push(targetRoomId);
            syncGameStateToServer();
            initTokenDrawing(mountEl, targetRoom.tokens);
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
    }

    if (state.currentGameState.playerMoves[playerId] <= 0) {
        console.log('[Turn] Player', playerId, 'moves depleted after movement, advancing turn');
        advanceToNextTurn();
    }

    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function handleMoveAfterCombat(mountEl, direction, targetRoomId) {
    if (!state.currentGameState || state.currentGameState.gamePhase !== 'playing') return;
    const playerId = state.mySocketId;
    const currentTurnPlayer = state.currentGameState.turnOrder[state.currentGameState.currentTurnIndex];
    if (playerId !== currentTurnPlayer) return;

    const moves = state.currentGameState.playerMoves[playerId] || 0;
    if (moves <= 0) {
        advanceToNextTurn();
        syncGameStateToServer();
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        return;
    }

    const revealedRooms = state.currentGameState.map?.revealedRooms || {};
    const targetRoom = revealedRooms[targetRoomId];
    if (targetRoom && targetRoom.tokens && targetRoom.tokens.length > 0) {
        if (!state.currentGameState.playerState.drawnRooms) state.currentGameState.playerState.drawnRooms = [];
        if (!state.currentGameState.playerState.drawnRooms.includes(targetRoomId)) {
            state.currentGameState.playerState.drawnRooms.push(targetRoomId);
            syncGameStateToServer();
            initTokenDrawing(mountEl, targetRoom.tokens);
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
    }

    if (state.currentGameState.playerMoves[playerId] <= 0) {
        advanceToNextTurn();
    }
    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function handleMoveAfterStairs(mountEl, targetRoomId) {
    if (!state.currentGameState || state.currentGameState.gamePhase !== 'playing') return;
    const playerId = state.mySocketId;
    const currentTurnPlayer = state.currentGameState.turnOrder[state.currentGameState.currentTurnIndex];
    if (playerId !== currentTurnPlayer) return;

    const moves = state.currentGameState.playerMoves[playerId] || 0;
    if (moves <= 0) return;

    const currentRoomId = state.currentGameState.playerState.playerPositions[playerId];
    const mapConnections = state.currentGameState.map?.connections || {};
    const revealedRooms = state.currentGameState.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    const targetRoom = revealedRooms[targetRoomId];
    if (!targetRoom) return;

    // Check exit/enter room effects
    if (currentRoom?.name && needsRoomEffectRoll(currentRoom.name, 'exit', playerId)) {
        openRoomEffectDiceModal(mountEl, currentRoom.name, { direction: 'stairs', targetRoomId, targetRoomName: targetRoom.name });
        return;
    }
    if (targetRoom?.name && needsRoomEffectRoll(targetRoom.name, 'enter', playerId)) {
        openRoomEffectDiceModal(mountEl, targetRoom.name, { direction: 'stairs', targetRoomId, targetRoomName: targetRoom.name });
        return;
    }

    if (!mapConnections[currentRoomId]) mapConnections[currentRoomId] = {};
    if (!mapConnections[targetRoomId]) mapConnections[targetRoomId] = {};
    mapConnections[currentRoomId]['stairs'] = targetRoomId;
    mapConnections[targetRoomId]['stairs'] = currentRoomId;

    clearCompletedCombatForPlayer(playerId, currentRoomId);
    state.currentGameState.playerState.playerPositions[playerId] = targetRoomId;
    state.currentGameState.playerMoves[playerId] = moves - 1;
    if (!state.currentGameState.playerState.playerEntryDirections) state.currentGameState.playerState.playerEntryDirections = {};
    state.currentGameState.playerState.playerEntryDirections[playerId] = 'stairs';

    const enemy = getEnemyInRoom(targetRoomId, playerId);
    if (enemy) { syncGameStateToServer(); openCombatModal(mountEl, playerId, enemy.id, null); return; }

    const trapped = getTrappedAllyInRoom(targetRoomId, playerId);
    if (trapped) { syncGameStateToServer(); openRescueTrappedModal(mountEl, trapped.playerId, trapped.playerName, trapped.trappedInfo); return; }

    applyVaultSpawnPosition(playerId, targetRoom, state.currentGameState);

    if (targetRoom.tokens && targetRoom.tokens.length > 0) {
        if (!state.currentGameState.playerState.drawnRooms) state.currentGameState.playerState.drawnRooms = [];
        if (!state.currentGameState.playerState.drawnRooms.includes(targetRoomId)) {
            state.currentGameState.playerState.drawnRooms.push(targetRoomId);
            syncGameStateToServer();
            initTokenDrawing(mountEl, targetRoom.tokens);
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
    }

    if (state.currentGameState.playerMoves[playerId] <= 0) advanceToNextTurn();
    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function handleMoveAfterElevator(mountEl, targetFloor) {
    if (!state.currentGameState || state.currentGameState.gamePhase !== 'playing') return;
    const playerId = state.mySocketId;
    const currentTurnPlayer = state.currentGameState.turnOrder[state.currentGameState.currentTurnIndex];
    if (playerId !== currentTurnPlayer) return;

    const moves = state.currentGameState.playerMoves[playerId] || 0;
    if (moves <= 0) return;

    const currentRoomId = state.currentGameState.playerState.playerPositions[playerId];
    const mapConnections = state.currentGameState.map?.connections || {};
    const revealedRooms = state.currentGameState.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    if (!currentRoom) return;

    const isMysticElevator = currentRoom.name === 'Mystic Elevator' || currentRoom.name?.vi?.includes('Thang máy huyền bí');

    if (isMysticElevator) {
        // Mystic Elevator - moves entire room to target floor
        if (currentRoom.name && needsRoomEffectRoll(currentRoom.name, 'exit', playerId)) {
            openRoomEffectDiceModal(mountEl, currentRoom.name, { direction: 'elevator', targetFloor, targetRoomId: null });
            return;
        }

        const originalFloor = currentRoom.floor;
        const originalX = currentRoom.x;
        const originalY = currentRoom.y;

        // Clear old connections
        if (mapConnections[currentRoomId]) {
            Object.entries(mapConnections[currentRoomId]).forEach(([dir, connectedRoomId]) => {
                if (mapConnections[connectedRoomId]) {
                    const opp = getOppositeDoor(dir);
                    delete mapConnections[connectedRoomId][opp];
                }
            });
            mapConnections[currentRoomId] = {};
        }

        const placement = findElevatorPlacement(targetFloor, revealedRooms, mapConnections);
        if (placement) {
            currentRoom.x = placement.x;
            currentRoom.y = placement.y;
            currentRoom.floor = targetFloor;
            currentRoom.rotation = placement.rotation;
            currentRoom.doors = rotateRoomDoors(['north'], placement.rotation);

            if (placement.connectedRoomId && placement.connectedDirection) {
                if (!mapConnections[currentRoomId]) mapConnections[currentRoomId] = {};
                if (!mapConnections[placement.connectedRoomId]) mapConnections[placement.connectedRoomId] = {};
                mapConnections[currentRoomId][placement.connectedDirection] = placement.connectedRoomId;
                const targetDoorDir = getOppositeDoor(placement.connectedDirection);
                mapConnections[placement.connectedRoomId][targetDoorDir] = currentRoomId;
            }
        } else {
            currentRoom.floor = targetFloor;
        }

        const oldPosKey = `${originalFloor},${originalX},${originalY}`;
        state.mysticElevatorPositions.delete(oldPosKey);
        const newPosKey = `${targetFloor},${currentRoom.x},${currentRoom.y}`;
        state.mysticElevatorPositions.set(newPosKey, currentRoomId);

        clearCompletedCombatForPlayer(playerId, currentRoomId);
        syncGameStateToServer();
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        return;
    }

    // Regular elevator shafts
    if (currentRoom?.name && needsRoomEffectRoll(currentRoom.name, 'exit', playerId)) {
        openRoomEffectDiceModal(mountEl, currentRoom.name, { direction: 'elevator', targetFloor, targetRoomId: null });
        return;
    }

    const elevatorShafts = state.currentGameState.map?.elevatorShafts || {};
    const currentShaftId = elevatorShafts[currentRoom.floor];
    if (!currentShaftId) return;

    const elevatorShaftRoom = revealedRooms[currentShaftId];
    if (!elevatorShaftRoom?.elevatorPresent) return;

    const targetShaftId = elevatorShafts[targetFloor];
    if (!targetShaftId) return;

    const targetShaftRoom = revealedRooms[targetShaftId];
    if (!targetShaftRoom?.elevatorPresent) return;

    if (targetShaftRoom.name && needsRoomEffectRoll(targetShaftRoom.name, 'enter', playerId)) {
        openRoomEffectDiceModal(mountEl, targetShaftRoom.name, { direction: 'elevator', targetFloor, targetRoomId: targetShaftId });
        return;
    }

    if (!mapConnections[currentRoomId]) mapConnections[currentRoomId] = {};
    if (!mapConnections[targetShaftId]) mapConnections[targetShaftId] = {};
    mapConnections[currentRoomId]['elevator'] = targetShaftId;
    mapConnections[targetShaftId]['elevator'] = currentRoomId;

    clearCompletedCombatForPlayer(playerId, currentRoomId);
    state.currentGameState.playerState.playerPositions[playerId] = targetShaftId;
    state.currentGameState.playerMoves[playerId] = moves - 1;
    if (!state.currentGameState.playerState.playerEntryDirections) state.currentGameState.playerState.playerEntryDirections = {};
    state.currentGameState.playerState.playerEntryDirections[playerId] = 'elevator';

    const enemy = getEnemyInRoom(targetShaftId, playerId);
    if (enemy) { syncGameStateToServer(); openCombatModal(mountEl, playerId, enemy.id, null); return; }

    const trapped = getTrappedAllyInRoom(targetShaftId, playerId);
    if (trapped) { syncGameStateToServer(); openRescueTrappedModal(mountEl, trapped.playerId, trapped.playerName, trapped.trappedInfo); return; }

    applyVaultSpawnPosition(playerId, targetShaftRoom, state.currentGameState);

    if (targetShaftRoom.tokens && targetShaftRoom.tokens.length > 0) {
        if (!state.currentGameState.playerState.drawnRooms) state.currentGameState.playerState.drawnRooms = [];
        if (!state.currentGameState.playerState.drawnRooms.includes(targetShaftId)) {
            state.currentGameState.playerState.drawnRooms.push(targetShaftId);
            syncGameStateToServer();
            initTokenDrawing(mountEl, targetShaftRoom.tokens);
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
    }

    if (state.currentGameState.playerMoves[playerId] <= 0) advanceToNextTurn();
    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function handleRoomDiscovery(mountEl, roomNameEn, rotation = 0) {
    if (!state.currentGameState || !state.roomDiscoveryModal) return;
    const playerId = state.mySocketId;
    const currentRoomId = state.currentGameState.playerState.playerPositions[playerId];
    const revealedRooms = state.currentGameState.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    if (!currentRoom) return;

    const roomDef = ROOMS.find(r => r.name.en === roomNameEn);
    if (!roomDef) { console.log(`Room definition not found: ${roomNameEn}`); return; }

    const targetFloor = currentRoom.floor;
    const newRoomId = generateRoomId(roomNameEn);
    const newPosition = calculateNewRoomPosition(currentRoom, state.roomDiscoveryModal.direction);
    const originalDoors = roomDef.doors.filter(d => d.kind === 'door').map(d => convertDoorSide(d.side));
    const rotatedDoors = rotateRoomDoors(originalDoors, rotation);

    const newRoom = {
        id: newRoomId, name: roomDef.name.en, x: newPosition.x, y: newPosition.y,
        doors: rotatedDoors, floor: targetFloor, rotation, tokens: roomDef.tokens ? [...roomDef.tokens] : []
    };

    if (roomDef.name.en === 'Vault' && roomDef.specialLayout) {
        newRoom.vaultLayout = calculateVaultLayout(rotation);
    }

    const oppositeDir = getOppositeDoor(state.roomDiscoveryModal.direction);
    newRoom.doors = removeDoorsToWalls(newRoom, revealedRooms, oppositeDir);
    state.currentGameState.map.revealedRooms[newRoomId] = newRoom;

    if (roomDef.name.en === 'Mystic Elevator') {
        const posKey = `${targetFloor},${newRoom.x},${newRoom.y}`;
        state.mysticElevatorPositions.set(posKey, newRoomId);
    }

    const direction = state.roomDiscoveryModal.direction;
    if (!state.currentGameState.map.connections[currentRoomId]) state.currentGameState.map.connections[currentRoomId] = {};
    state.currentGameState.map.connections[currentRoomId][direction] = newRoomId;
    if (!state.currentGameState.map.connections[newRoomId]) state.currentGameState.map.connections[newRoomId] = {};
    state.currentGameState.map.connections[newRoomId][oppositeDir] = currentRoomId;

    clearCompletedCombatForPlayer(playerId, currentRoomId);
    state.currentGameState.playerState.playerPositions[playerId] = newRoomId;
    if (!state.currentGameState.playerState.playerEntryDirections) state.currentGameState.playerState.playerEntryDirections = {};
    state.currentGameState.playerState.playerEntryDirections[playerId] = oppositeDir;

    applyVaultSpawnPosition(playerId, newRoom, state.currentGameState);
    const curMoves = state.currentGameState.playerMoves[playerId] || 0;
    state.currentGameState.playerMoves[playerId] = curMoves - 1;
    state.roomDiscoveryModal = null;

    if (newRoom.tokens && newRoom.tokens.length > 0) {
        if (!state.currentGameState.playerState.drawnRooms) state.currentGameState.playerState.drawnRooms = [];
        state.currentGameState.playerState.drawnRooms.push(newRoomId);
        syncGameStateToServer();
        initTokenDrawing(mountEl, newRoom.tokens);
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        return;
    }

    if (state.currentGameState.playerMoves[playerId] <= 0) advanceToNextTurn();
    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function handleRandomRoomDiscovery(mountEl) {
    if (!state.currentGameState || !state.roomDiscoveryModal) return;
    const revealedRooms = state.currentGameState.map?.revealedRooms || {};
    const availableRooms = getAvailableRoomsForFloor(state.roomDiscoveryModal.floor, revealedRooms);
    const validRooms = filterRoomsWithConnectingDoor(availableRooms, state.roomDiscoveryModal.doorSide);
    if (validRooms.length === 0) { console.log('No valid rooms available'); return; }

    const randomIndex = Math.floor(Math.random() * validRooms.length);
    const selectedRoom = validRooms[randomIndex];
    const initialRotation = findFirstValidRotation(selectedRoom, state.roomDiscoveryModal.doorSide);
    state.roomDiscoveryModal.selectedRoom = selectedRoom.name.en;
    state.roomDiscoveryModal.currentRotation = initialRotation;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function cancelRoomDiscovery(mountEl) {
    if (state.roomDiscoveryModal) {
        state.roomDiscoveryModal.selectedRoom = null;
        state.roomDiscoveryModal.currentRotation = 0;
    }
    state.roomDiscoveryModal = null;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}
