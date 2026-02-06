// Room effect dice logic
import { state, ROOM_EFFECTS } from '../gameState.js';
import { getPlayerStatForDice } from '../characters/characterManager.js';
import { needsRoomEffectRoll } from './roomUtils.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { applyStatChange } from '../characters/characterManager.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { showToast } from '../ui/notifications.js';

export function openRoomEffectDiceModal(mountEl, roomName, pendingMovement) {
    const roomEffect = ROOM_EFFECTS[roomName];
    if (!roomEffect) {
        console.error('[RoomEffect] No effect found for room:', roomName);
        return;
    }
    const playerId = state.mySocketId;
    const diceCount = getPlayerStatForDice(playerId, roomEffect.rollStat);

    state.roomEffectDiceModal = {
        isOpen: true,
        roomName,
        roomEffect,
        diceCount,
        inputValue: '',
        result: null,
        resultsApplied: false,
        pendingMovement
    };
    console.log('[RoomEffect] Opened modal for:', roomName, 'stat:', roomEffect.rollStat, 'diceCount:', diceCount);
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function applyRoomEffectDiceResult(mountEl, result) {
    if (!state.roomEffectDiceModal || !state.roomEffectDiceModal.roomEffect) return;

    const { roomEffect, pendingMovement, roomName } = state.roomEffectDiceModal;
    const isSuccess = result >= roomEffect.target;
    const playerId = state.mySocketId;

    console.log('[RoomEffect] Result:', result, 'Target:', roomEffect.target, 'Success:', isSuccess);

    if (isSuccess) {
        state.roomEffectDiceModal = null;
        continueMovementAfterRoomEffect(mountEl, pendingMovement, true, roomName);
    } else {
        const failEffect = roomEffect.failEffect;
        switch (failEffect.type) {
            case 'stopMoving':
                state.currentGameState.playerMoves[playerId] = 0;
                showToast(`That bai! Ban dung lai o ${roomName}.`, 'error');
                state.roomEffectDiceModal = null;
                console.log('[Turn] Player', playerId, 'failed room effect, advancing turn');
                advanceToNextTurn();
                syncGameStateToServer();
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
                break;
            case 'statLoss':
                applyStatChange(playerId, failEffect.stat, -failEffect.amount);
                showToast(`That bai! Mat ${failEffect.amount} ${failEffect.stat}.`, 'error');
                state.roomEffectDiceModal = null;
                if (roomEffect.continueOnFail) {
                    continueMovementAfterRoomEffect(mountEl, pendingMovement, false, roomName);
                } else {
                    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
                    syncGameStateToServer();
                }
                break;
            case 'fallToBasement':
                showToast(`That bai! Ban roi xuong tang ham va chiu ${failEffect.dice} dice physical damage.`, 'error');
                state.roomEffectDiceModal = null;
                import('../events/eventDice.js').then(m => m.openDamageDiceModal(mountEl, failEffect.dice, 0));
                break;
            default:
                state.roomEffectDiceModal = null;
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        }
    }
}

function continueMovementAfterRoomEffect(mountEl, pendingMovement, rollSuccess, roomName) {
    if (!pendingMovement) {
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        return;
    }
    const playerId = state.mySocketId;
    if (!state.currentGameState.playerState) state.currentGameState.playerState = {};
    if (!state.currentGameState.playerState.roomEffectRolls) state.currentGameState.playerState.roomEffectRolls = {};
    if (!state.currentGameState.playerState.roomEffectRolls[playerId]) state.currentGameState.playerState.roomEffectRolls[playerId] = [];

    const roomEffect = ROOM_EFFECTS[roomName];
    const rollKey = `${roomName}_${roomEffect?.trigger || 'enter'}`;
    if (!state.currentGameState.playerState.roomEffectRolls[playerId].includes(rollKey)) {
        state.currentGameState.playerState.roomEffectRolls[playerId].push(rollKey);
    }
    console.log('[RoomEffect] Continuing movement after roll, success:', rollSuccess);
    syncGameStateToServer();
    const { direction } = pendingMovement;
    import('./moveHandler.js').then(m => m.handleMove(mountEl, direction));
}
