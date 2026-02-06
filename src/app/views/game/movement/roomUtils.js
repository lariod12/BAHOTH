// Room utility functions - adjacency, positions, door logic
import { state, ROOM_EFFECTS } from '../gameState.js';
import { ROOMS } from '../../../data/mapsData.js';

export function getAdjacentRoomIds(currentRoomId) {
    if (!state.currentGameState?.map?.revealedRooms) return [];
    const revealedRooms = state.currentGameState.map.revealedRooms;
    const currentRoom = revealedRooms[currentRoomId];
    if (!currentRoom || !currentRoom.doors) return [];

    const directionOffsets = {
        'north': { x: 0, y: 1 },
        'south': { x: 0, y: -1 },
        'east': { x: 1, y: 0 },
        'west': { x: -1, y: 0 }
    };
    const adjacentRoomIds = [];
    for (const doorDir of currentRoom.doors) {
        const offset = directionOffsets[doorDir];
        if (!offset) continue;
        const adjacentX = currentRoom.x + offset.x;
        const adjacentY = currentRoom.y + offset.y;
        for (const [roomId, room] of Object.entries(revealedRooms)) {
            if (room.x === adjacentX && room.y === adjacentY && room.floor === currentRoom.floor) {
                adjacentRoomIds.push(roomId);
                break;
            }
        }
    }
    return adjacentRoomIds;
}

export function getPlayersInRoom(roomId, excludePlayerId = null) {
    if (!state.currentGameState?.players || !state.currentGameState?.playerState?.playerPositions) return [];
    const playerPositions = state.currentGameState.playerState.playerPositions;
    return state.currentGameState.players.filter(player => {
        if (excludePlayerId && player.id === excludePlayerId) return false;
        return playerPositions[player.id] === roomId;
    });
}

export function mapDirectionToDoor(direction) {
    const mapping = { 'up': 'north', 'down': 'south', 'left': 'west', 'right': 'east' };
    return mapping[direction] || direction;
}

export function getOppositeDoor(doorDir) {
    const opposites = { 'north': 'south', 'south': 'north', 'east': 'west', 'west': 'east' };
    return opposites[doorDir] || doorDir;
}

export function doorDirToSide(doorDir) {
    const mapping = { 'north': 'top', 'south': 'bottom', 'east': 'right', 'west': 'left' };
    return mapping[doorDir] || doorDir;
}

export function convertDoorSide(side) {
    const mapping = { 'top': 'north', 'bottom': 'south', 'left': 'west', 'right': 'east' };
    return mapping[side] || side;
}

export function calculateNewRoomPosition(currentRoom, direction) {
    const offsets = {
        'north': { x: 0, y: 1 },
        'south': { x: 0, y: -1 },
        'east': { x: 1, y: 0 },
        'west': { x: -1, y: 0 }
    };
    const offset = offsets[direction] || { x: 0, y: 0 };
    return { x: currentRoom.x + offset.x, y: currentRoom.y + offset.y };
}

export function findRoomAtPosition(revealedRooms, x, y, floor) {
    for (const roomId in revealedRooms) {
        const room = revealedRooms[roomId];
        if (room.x === x && room.y === y && room.floor === floor) return room;
    }
    return null;
}

export function generateRoomId(roomName) {
    return roomName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function getRoomByName(nameEn) {
    return ROOMS.find(r => r.name?.en === nameEn) || null;
}

export function getAvailableRoomsForFloor(floor, revealedRooms) {
    const revealedNames = new Set(Object.values(revealedRooms).map(r => r.name));
    return ROOMS.filter(room => {
        if (room.isStartingRoom) return false;
        if (!room.floorsAllowed.includes(floor)) return false;
        if (revealedNames.has(room.name.en)) return false;
        return true;
    });
}

export function rotateRoomDoors(doors, rotation) {
    if (rotation === 0) return doors;
    const rotationSteps = rotation / 90;
    const directionOrder = ['north', 'east', 'south', 'west'];
    return doors.map(door => {
        const currentIndex = directionOrder.indexOf(door);
        if (currentIndex === -1) return door;
        const newIndex = (currentIndex + rotationSteps) % 4;
        return directionOrder[newIndex];
    });
}

export function getPossibleRoomOrientations(roomDef, requiredConnectionSide) {
    const orientations = [];
    roomDef.doors.forEach(door => {
        if (door.kind !== 'door') return;
        const sides = ['top', 'right', 'bottom', 'left'];
        const fromIndex = sides.indexOf(door.side);
        const toIndex = sides.indexOf(requiredConnectionSide);
        if (fromIndex === -1 || toIndex === -1) return;
        const rotationSteps = (toIndex - fromIndex + 4) % 4;
        const rotation = rotationSteps * 90;
        if (!orientations.some(o => o.rotation === rotation)) {
            orientations.push({
                rotation,
                label: `Xoay ${rotation}° (cua ${door.side} -> ${requiredConnectionSide})`,
                doorSide: door.side
            });
        }
    });
    return orientations;
}

export function filterRoomsWithConnectingDoor(rooms, requiredDoorSide) {
    return rooms.filter(room => {
        const hasRegularDoor = room.doors.some(d => d.kind === 'door');
        if (!hasRegularDoor) return false;
        return getPossibleRoomOrientations(room, requiredDoorSide).length > 0;
    });
}

export function isRotationValid(roomDef, rotation, requiredDoorSide) {
    const originalDoors = roomDef.doors.filter(d => d.kind === 'door').map(d => convertDoorSide(d.side));
    const rotatedDoors = rotateRoomDoors(originalDoors, rotation);
    const requiredDoorDir = convertDoorSide(requiredDoorSide);
    return rotatedDoors.includes(requiredDoorDir);
}

export function findFirstValidRotation(roomDef, requiredDoorSide) {
    const rotations = [0, 90, 180, 270];
    for (const rotation of rotations) {
        if (isRotationValid(roomDef, rotation, requiredDoorSide)) return rotation;
    }
    return 0;
}

export function isDoorBlocked(roomName, doorDirection, targetRoomId) {
    if (roomName === 'Entrance Hall' && doorDirection === 'south') return true;
    if (targetRoomId) {
        const revealedRooms = state.currentGameState?.map?.revealedRooms || {};
        const targetRoom = revealedRooms[targetRoomId];
        if (targetRoom && targetRoom.isElevatorShaft && !targetRoom.elevatorPresent) return true;
    }
    return false;
}

export function isElevatorShaftBlocked(targetRoomId) {
    const revealedRooms = state.currentGameState?.map?.revealedRooms || {};
    const targetRoom = revealedRooms[targetRoomId];
    return targetRoom && targetRoom.isElevatorShaft && !targetRoom.elevatorPresent;
}

export function removeDoorsToWalls(newRoom, revealedRooms, excludeDirection) {
    const directionOffsets = {
        'north': { x: 0, y: 1 }, 'south': { x: 0, y: -1 },
        'east': { x: 1, y: 0 }, 'west': { x: -1, y: 0 }
    };
    return newRoom.doors.filter(doorDir => {
        if (doorDir === excludeDirection) return true;
        const offset = directionOffsets[doorDir];
        if (!offset) return true;
        const adjacentX = newRoom.x + offset.x;
        const adjacentY = newRoom.y + offset.y;
        const adjacentRoom = findRoomAtPosition(revealedRooms, adjacentX, adjacentY, newRoom.floor);
        if (!adjacentRoom) return true;
        const oppositeDir = getOppositeDoor(doorDir);
        return adjacentRoom.doors && adjacentRoom.doors.includes(oppositeDir);
    });
}

export function findElevatorPlacement(targetFloor, revealedRooms, mapConnections) {
    const allDirections = ['north', 'east', 'south', 'west'];
    const rotationMap = { 'north': 0, 'east': 90, 'south': 180, 'west': 270 };

    for (const roomId in revealedRooms) {
        const room = revealedRooms[roomId];
        if (room.floor !== targetFloor) continue;
        if (!room.doors || room.doors.length === 0) continue;
        const roomConnections = mapConnections[roomId] || {};
        for (const doorDir of room.doors) {
            if (roomConnections[doorDir]) continue;
            const adjacentPos = calculateNewRoomPosition(room, doorDir);
            const occupant = findRoomAtPosition(revealedRooms, adjacentPos.x, adjacentPos.y, targetFloor);
            if (occupant) continue;
            const elevatorFacingDir = getOppositeDoor(doorDir);
            const rotation = rotationMap[elevatorFacingDir];
            return { x: adjacentPos.x, y: adjacentPos.y, rotation, connectedRoomId: roomId, connectedDirection: elevatorFacingDir };
        }
    }

    const occupiedPositions = new Set();
    for (const roomId in revealedRooms) {
        const room = revealedRooms[roomId];
        if (room.floor === targetFloor) occupiedPositions.add(`${room.x},${room.y}`);
    }
    for (const roomId in revealedRooms) {
        const room = revealedRooms[roomId];
        if (room.floor !== targetFloor) continue;
        for (const dir of allDirections) {
            const pos = calculateNewRoomPosition(room, dir);
            const key = `${pos.x},${pos.y}`;
            if (!occupiedPositions.has(key)) return { x: pos.x, y: pos.y, rotation: 0, connectedRoomId: null, connectedDirection: null };
        }
    }
    return null;
}

export function getRoomEffect(roomName, trigger) {
    const effect = ROOM_EFFECTS[roomName];
    if (!effect) return null;
    if (effect.trigger === trigger) return effect;
    return null;
}

export function needsRoomEffectRoll(roomName, trigger, playerId) {
    const effect = getRoomEffect(roomName, trigger);
    if (!effect) return false;
    const rolledRooms = state.currentGameState?.playerState?.roomEffectRolls?.[playerId] || [];
    const rollKey = `${roomName}_${trigger}`;
    return !rolledRooms.includes(rollKey);
}

export function getFloorDisplayName(floor) {
    const names = { ground: 'Tang tret', upper: 'Tang tren', basement: 'Tang ham' };
    return names[floor] || floor;
}
