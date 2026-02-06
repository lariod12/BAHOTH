// Combat calculations, tracking, forced attack
import { state } from '../gameState.js';
import { isHauntTriggered, isEnemy } from '../../../utils/factionUtils.js';
import { getCharacterMight, getCharacterName } from '../characters/characterManager.js';
import { getPlayersInRoom, getAdjacentRoomIds } from '../movement/roomUtils.js';
import { syncGameStateToServer } from '../turn/turnManager.js';
import { renderGameScreen } from '../ui/mainRenderer.js';
import { openEventResultModal } from '../events/eventResult.js';

export function calculateCombatResult(attackerRoll, defenderRoll) {
    if (!state.combatModal) return { winner: 'tie', damage: 0, loserId: null };
    if (attackerRoll > defenderRoll) {
        return { winner: 'attacker', damage: attackerRoll - defenderRoll, loserId: state.combatModal.defenderId };
    } else if (defenderRoll > attackerRoll) {
        return { winner: 'defender', damage: defenderRoll - attackerRoll, loserId: state.combatModal.attackerId };
    } else {
        return { winner: 'tie', damage: 0, loserId: null };
    }
}

export function getCombatKey(roomId, playerId1, playerId2) {
    const sortedIds = [playerId1, playerId2].sort();
    return `${roomId}:${sortedIds[0]}:${sortedIds[1]}`;
}

export function isCombatCompleted(roomId, playerId1, playerId2) {
    const key = getCombatKey(roomId, playerId1, playerId2);
    return state.completedCombats.has(key);
}

export function markCombatCompleted(roomId, playerId1, playerId2) {
    const key = getCombatKey(roomId, playerId1, playerId2);
    state.completedCombats.set(key, true);
    console.log('[Combat] Marked combat as completed:', key);
    if (state.currentGameState) {
        const currentTurnPlayer = state.currentGameState.turnOrder?.[state.currentGameState.currentTurnIndex];
        if (playerId1 === currentTurnPlayer || playerId2 === currentTurnPlayer) {
            state.hasAttackedThisTurn = true;
            console.log('[Combat] hasAttackedThisTurn SET TO TRUE');
        }
    }
}

export function clearCompletedCombatForPlayer(playerId, roomId) {
    for (const key of state.completedCombats.keys()) {
        if (key.startsWith(`${roomId}:`) && key.includes(playerId)) {
            state.completedCombats.delete(key);
            console.log('[Combat] Cleared completed combat flag:', key);
        }
    }
}

export function getEnemyInRoom(roomId, currentPlayerId) {
    if (!state.currentGameState || !isHauntTriggered(state.currentGameState)) return null;

    const currentTurnPlayer = state.currentGameState.turnOrder?.[state.currentGameState.currentTurnIndex];
    if (state.hasAttackedThisTurn && currentPlayerId === currentTurnPlayer) return null;

    const playerPositions = state.currentGameState.playerState?.playerPositions || {};
    for (const player of state.currentGameState.players || []) {
        if (player.id === currentPlayerId) continue;
        if (playerPositions[player.id] === roomId) {
            if (isEnemy(state.currentGameState, currentPlayerId, player.id)) {
                if (isCombatCompleted(roomId, currentPlayerId, player.id)) continue;
                return player;
            }
        }
    }
    return null;
}

export function mapServerPhaseToLocal(serverPhase, isDefender) {
    switch (serverPhase) {
        case 'waiting_attacker': return isDefender ? 'waiting_defender' : 'attacker_roll';
        case 'waiting_defender': return isDefender ? 'defender_roll' : 'waiting_defender';
        case 'result': return 'result';
        default: return 'confirm';
    }
}

export function executeForcedAttack(mountEl, attackerId, targetType) {
    let target = null;
    if (targetType === 'adjacentLowestMight') {
        target = findAdjacentPlayerWithLowestMight(attackerId);
    }
    if (!target) {
        openEventResultModal(mountEl, 'KHÔNG CÓ MỤC TIÊU', 'Không có người chơi nào ở phòng liền kề để tấn công.', 'neutral');
        return;
    }
    const { player: targetPlayer, roomId: targetRoomId } = target;
    if (!state.currentGameState.playerState.playerPositions) {
        state.currentGameState.playerState.playerPositions = {};
    }
    state.currentGameState.playerState.playerPositions[attackerId] = targetRoomId;
    syncGameStateToServer();
    renderGameScreen(state.currentGameState, state.mySocketId);
    import('./combatManager.js').then(m => m.openCombatModal(mountEl, attackerId, targetPlayer.id, null, true));
}

function findAdjacentPlayerWithLowestMight(currentPlayerId) {
    const playerPositions = state.currentGameState?.playerState?.playerPositions;
    if (!playerPositions) return null;
    const currentRoomId = playerPositions[currentPlayerId];
    if (!currentRoomId) return null;
    const adjacentRoomIds = getAdjacentRoomIds(currentRoomId);
    let lowestMightPlayer = null;
    let lowestMight = Infinity;
    let targetRoomId = null;

    for (const roomId of adjacentRoomIds) {
        const playersInRoom = getPlayersInRoom(roomId, currentPlayerId);
        for (const player of playersInRoom) {
            const playerMight = getCharacterMight(player.characterId, state.currentGameState.playerState?.characterData?.[player.id]);
            if (playerMight < lowestMight) {
                lowestMight = playerMight;
                lowestMightPlayer = player;
                targetRoomId = roomId;
            }
        }
    }
    return lowestMightPlayer ? { player: lowestMightPlayer, roomId: targetRoomId } : null;
}
