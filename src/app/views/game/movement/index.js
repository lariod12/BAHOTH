// Movement group - public API
export {
    getAdjacentRoomIds, getPlayersInRoom, mapDirectionToDoor, getOppositeDoor,
    doorDirToSide, convertDoorSide, calculateNewRoomPosition, findRoomAtPosition,
    generateRoomId, getRoomByName, getAvailableRoomsForFloor, rotateRoomDoors,
    getPossibleRoomOrientations, filterRoomsWithConnectingDoor, isRotationValid,
    findFirstValidRotation, isDoorBlocked, isElevatorShaftBlocked,
    removeDoorsToWalls, findElevatorPlacement, getRoomEffect, needsRoomEffectRoll,
    getFloorDisplayName
} from './roomUtils.js';

export { openRoomEffectDiceModal, applyRoomEffectDiceResult } from './roomEffects.js';

export {
    handleMove, handleMoveAfterCombat, handleMoveAfterStairs,
    handleMoveAfterElevator, handleRoomDiscovery, handleRandomRoomDiscovery,
    cancelRoomDiscovery
} from './moveHandler.js';
