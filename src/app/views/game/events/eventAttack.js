// Event Attack Module - handles events that trigger combat
import { state } from '../gameState.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { openEventResultModal } from './eventResult.js';
import { getRightPlayer } from './eventDice.js';
import { getCharacterName } from '../characters/characterManager.js';

/**
 * Handle attack event (e.g., con_bup_be_kinh_di)
 */
export function handleAttackEvent(mountEl, eventCard) {
    const playerId = state.mySocketId;
    const gs = state.currentGameState;

    if (eventCard.attackerIsRightPlayer) {
        const rightPlayerId = getRightPlayer(playerId);
        if (!rightPlayerId) {
            openEventResultModal(mountEl, eventCard.name?.vi || 'Event', 'Khong tim thay nguoi choi ben phai.', 'neutral');
            return;
        }

        const rightPlayerName = getPlayerCharacterName(rightPlayerId);
        const attackerDice = eventCard.attackerDice || 4;
        const defenderStat = eventCard.defenderStat || 'might';

        // Initiate combat via combat modal
        state.combatModal = {
            isOpen: true,
            phase: 'attacker_roll',
            attackerId: rightPlayerId,
            defenderId: playerId,
            attackerName: rightPlayerName,
            defenderName: getPlayerCharacterName(playerId),
            attackerRoll: null,
            defenderRoll: null,
            winner: null,
            damage: 0,
            loserId: null,
            isForced: true,
            inputValue: '',
            eventSource: eventCard.id,
            fixedAttackerDice: attackerDice,
            defenderStat: defenderStat,
        };

        if (gs?.combatState === undefined || gs?.combatState === null) {
            gs.combatState = {};
        }
        gs.combatState = {
            isActive: true,
            attackerId: rightPlayerId,
            defenderId: playerId,
            phase: 'waiting_attacker',
            attackerRoll: null,
            defenderRoll: null,
            attackStat: 'event',
            winner: null,
            damage: 0,
            loserId: null,
        };

        syncGameStateToServer();
        state.skipMapCentering = true;
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        return;
    }

    // Fallback for other attack types
    openEventResultModal(mountEl, eventCard.name?.vi || 'Event', 'Su kien tan cong da duoc xu ly.', 'neutral');
}

function getPlayerCharacterName(playerId) {
    const player = state.currentGameState?.players?.find(p => p.id === playerId);
    return player ? getCharacterName(player.characterId) : 'Player';
}
