// Combat flow - open/close/result modal
import { state } from '../gameState.js';
import { getCharacterName, getCharacterMight } from '../characters/characterManager.js';
import { getFaction, getFactionLabel } from '../../../utils/factionUtils.js';
import { markCombatCompleted, clearCompletedCombatForPlayer } from './combatCalc.js';
import { advanceToNextTurn, syncGameStateToServer } from '../turn/turnManager.js';
import { updateGameUI } from '../ui/mainRenderer.js';

export function openCombatModal(mountEl, attackerId, defenderId, movement, isForced = false) {
    const attacker = state.currentGameState.players?.find(p => p.id === attackerId);
    const defender = state.currentGameState.players?.find(p => p.id === defenderId);
    if (!attacker || !defender) return;

    const attackerName = getCharacterName(attacker.characterId);
    const defenderName = getCharacterName(defender.characterId);
    const defenderFaction = getFaction(state.currentGameState, defenderId);
    const defenderFactionLabel = getFactionLabel(defenderFaction);
    const attackerMight = getCharacterMight(attacker.characterId, state.currentGameState.playerState?.characterData?.[attackerId]);
    const defenderMight = getCharacterMight(defender.characterId, state.currentGameState.playerState?.characterData?.[defenderId]);

    state.combatModal = {
        isOpen: true, phase: 'confirm',
        attackerId, defenderId, attackerName, defenderName, defenderFactionLabel,
        attackStat: 'might', attackerDiceCount: attackerMight, defenderDiceCount: defenderMight,
        attackerRoll: null, defenderRoll: null, inputValue: '',
        winner: null, damage: 0, loserId: null, isForced
    };
    state.pendingCombatMovement = movement;
    state.skipMapCentering = true;

    state.currentGameState.combatState = {
        isActive: true, phase: 'confirm', attackerId, defenderId,
        attackerRoll: null, defenderRoll: null, winner: null, damage: 0, loserId: null, isForced
    };
    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function closeCombatModal(mountEl, attackerLost = false, resultInfo = null) {
    const wasAttacker = state.combatModal?.attackerId === state.mySocketId;
    const attackerId = state.combatModal?.attackerId;
    const defenderId = state.combatModal?.defenderId;
    const movement = state.pendingCombatMovement;

    const combatResult = resultInfo || (state.combatModal ? {
        attackerName: state.combatModal.attackerName,
        defenderName: state.combatModal.defenderName,
        attackerRoll: state.combatModal.attackerRoll,
        defenderRoll: state.combatModal.defenderRoll,
        winner: state.combatModal.winner,
        damage: state.combatModal.damage
    } : null);

    if (attackerId && defenderId && state.currentGameState) {
        const playerPositions = state.currentGameState.playerState?.playerPositions || {};
        const combatRoomId = playerPositions[attackerId] || playerPositions[defenderId];
        if (combatRoomId) markCombatCompleted(combatRoomId, attackerId, defenderId);
    }

    state.combatModal = null;
    state.pendingCombatMovement = null;

    if (attackerLost && state.currentGameState && attackerId) {
        state.currentGameState.playerMoves[attackerId] = 0;
        const currentTurnPlayer = state.currentGameState.turnOrder[state.currentGameState.currentTurnIndex];
        if (currentTurnPlayer === attackerId) advanceToNextTurn();
    }

    if (combatResult && state.currentGameState) {
        state.currentGameState.combatResult = combatResult;
    }

    if (state.currentGameState) {
        state.currentGameState.combatState = null;
        syncGameStateToServer();
    }

    if (combatResult) showCombatResultNotification(mountEl, combatResult);

    if (!attackerLost && wasAttacker && movement) {
        import('../movement/moveHandler.js').then(m => m.handleMoveAfterCombat(mountEl, movement.direction, movement.targetRoomId));
    } else {
        if (state.currentGameState) {
            const currentTurnPlayer = state.currentGameState.turnOrder[state.currentGameState.currentTurnIndex];
            const currentPlayerMoves = state.currentGameState.playerMoves[currentTurnPlayer] || 0;
            if (currentPlayerMoves <= 0) {
                advanceToNextTurn();
                syncGameStateToServer();
            }
        }
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
    }
}

export function showCombatResultNotification(mountEl, result) {
    const existing = document.querySelector('.combat-result-notification');
    if (existing) existing.remove();

    const { attackerName, defenderName, attackerRoll, defenderRoll, winner, damage } = result;
    let resultText = '', resultClass = '';
    if (winner === 'tie') {
        resultText = 'HOA! Khong ai chiu sat thuong.';
        resultClass = 'combat-result-notification--tie';
    } else if (winner === 'attacker') {
        resultText = `${attackerName} tan cong thanh cong! ${defenderName} chiu ${damage} sat thuong.`;
        resultClass = 'combat-result-notification--attacker';
    } else {
        resultText = `${defenderName} phan don thanh cong! ${attackerName} chiu ${damage} sat thuong va mat luot.`;
        resultClass = 'combat-result-notification--defender';
    }

    const notification = document.createElement('div');
    notification.className = `combat-result-notification ${resultClass}`;
    notification.innerHTML = `
        <div class="combat-result-notification__content">
            <div class="combat-result-notification__header">KET QUA CHIEN DAU</div>
            <div class="combat-result-notification__scores">
                <span class="combat-result-notification__score">${attackerName}: ${attackerRoll ?? '?'}</span>
                <span class="combat-result-notification__vs">VS</span>
                <span class="combat-result-notification__score">${defenderName}: ${defenderRoll ?? '?'}</span>
            </div>
            <div class="combat-result-notification__result">${resultText}</div>
            <button class="combat-result-notification__btn" type="button" data-action="close-combat-result">OK</button>
        </div>
    `;

    document.body.appendChild(notification);
    notification.querySelector('[data-action="close-combat-result"]')?.addEventListener('click', () => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => { notification.remove(); if (state.currentGameState) state.currentGameState.combatResult = null; }, 300);
    });
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => { notification.remove(); if (state.currentGameState) state.currentGameState.combatResult = null; }, 300);
        }
    }, 8000);
}

export function openDamageDistributionModal(mountEl, totalDamage, source, preselectedType = null) {
    state.damageDistributionModal = {
        isOpen: true, totalDamage, damageType: preselectedType,
        stat1: null, stat2: null, stat1Damage: 0, stat2Damage: 0, source
    };
    if (preselectedType === 'physical') {
        state.damageDistributionModal.stat1 = 'speed';
        state.damageDistributionModal.stat2 = 'might';
    } else if (preselectedType === 'mental') {
        state.damageDistributionModal.stat1 = 'sanity';
        state.damageDistributionModal.stat2 = 'knowledge';
    }
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function closeDamageDistributionModal(mountEl) {
    if (!state.damageDistributionModal) return;
    const { stat1, stat2, stat1Damage, stat2Damage } = state.damageDistributionModal;
    const playerId = state.mySocketId;

    import('../characters/characterManager.js').then(charMod => {
        if (stat1Damage > 0 && stat1) charMod.applyStatChange(playerId, stat1, -stat1Damage);
        if (stat2Damage > 0 && stat2) charMod.applyStatChange(playerId, stat2, -stat2Damage);

        state.damageDistributionModal = null;

        import('../omens/omenHaunt.js').then(hauntMod => {
            const died = hauntMod.checkPlayerDeath(mountEl, playerId);
            syncGameStateToServer();

            if (!died && state.pendingMentalDamage !== null && state.pendingMentalDamage > 0) {
                const mentalDamage = state.pendingMentalDamage;
                state.pendingMentalDamage = null;
                openDamageDistributionModal(mountEl, mentalDamage, 'event', 'mental');
                return;
            }
            state.pendingMentalDamage = null;

            if (!died && state.pendingTrappedEffect) {
                const { eventCard } = state.pendingTrappedEffect;
                import('../events/eventTrapped.js').then(trappedMod => {
                    trappedMod.applyTrappedEffect(mountEl, state.mySocketId, eventCard);
                });
                state.pendingTrappedEffect = null;
                return;
            }
            state.pendingTrappedEffect = null;

            if (!died) updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        });
    });
}
