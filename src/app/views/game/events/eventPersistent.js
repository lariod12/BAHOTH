// Persistent effects handling + turn damage
import { state } from '../gameState.js';
import { applyPersistentEffect as applyPersistentEffectUtil } from '../../../utils/eventEffects.js';
import { applyStatChange, getCharacterSpeed } from '../characters/characterManager.js';
import { syncGameStateToServer } from '../turn/turnManager.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { openEventResultModal } from './eventResult.js';
import { checkPlayerDeath } from '../omens/omenHaunt.js';
import * as socketClient from '../../../services/socketClient.js';

export function applyPersistentEffect(mountEl, playerId, eventCard) {
    const persistentRecord = applyPersistentEffectUtil(state.currentGameState, playerId, eventCard);
    if (!persistentRecord) return;

    console.log('[Persistent] Player', playerId, 'now has persistent effect from', eventCard.name?.vi);
    syncGameStateToServer();

    let effectDesc = '';
    const { onTurnStart } = persistentRecord;
    if (onTurnStart) {
        if (onTurnStart.effect === 'loseStat' && onTurnStart.statType === 'physical') {
            effectDesc = 'Giam 1 chi so vat li (Speed/Might) moi luot.';
        } else if (onTurnStart.effect === 'loseStat' && onTurnStart.statType === 'mental') {
            effectDesc = 'Giam 1 chi so tinh than (Sanity/Knowledge) moi luot.';
        }
    }

    openEventResultModal(
        mountEl,
        'HIEU UNG DAI HAN',
        `${effectDesc} Huy bo khi ket thuc luot tai mot trong cac phong: Balcony, Gardens, Graveyard, Gymnasium, Larder, Patio, Tower.`,
        'danger'
    );
}

export function applyPersistentTurnEffect(mountEl, playerId, effect) {
    const { onTurnStart, eventName } = effect;

    if (onTurnStart.effect === 'loseStat') {
        const { statType, amount } = onTurnStart;
        if (statType === 'physical') {
            openPersistentDamageModal(mountEl, playerId, ['speed', 'might'], amount, eventName);
        } else if (statType === 'mental') {
            openPersistentDamageModal(mountEl, playerId, ['sanity', 'knowledge'], amount, eventName);
        }
    }
}

export function openPersistentDamageModal(mountEl, playerId, stats, amount, eventName) {
    state.persistentDamageModal = {
        isOpen: true,
        playerId,
        stats,
        amount,
        eventName,
        selectedStat: null
    };
    console.log('[PersistentDamage] Opened modal for', eventName, 'stats:', stats);
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function closePersistentDamageModal(mountEl, chosenStat) {
    if (!state.persistentDamageModal) return;

    const { playerId, amount } = state.persistentDamageModal;
    applyStatChange(playerId, chosenStat, -amount);
    console.log('[PersistentDamage] Applied -', amount, chosenStat);

    state.persistentDamageModal = null;
    checkPlayerDeath(mountEl, playerId);

    const me = state.currentGameState?.players?.find(p => p.id === playerId);
    if (me?.characterId) {
        const charData = state.currentGameState.playerState?.characterData?.[playerId];
        const speed = getCharacterSpeed(me.characterId, charData);
        socketClient.setMoves(speed);
    }

    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function renderPersistentDamageModal() {
    if (!state.persistentDamageModal?.isOpen) return '';

    const { stats, amount, eventName } = state.persistentDamageModal;
    const statLabels = {
        speed: 'Toc do (Speed)', might: 'Suc manh (Might)',
        sanity: 'Tam tri (Sanity)', knowledge: 'Kien thuc (Knowledge)'
    };

    const statButtons = stats.map(stat => `
        <button class="persistent-damage-modal__btn" type="button" data-action="persistent-damage-select" data-stat="${stat}">
            ${statLabels[stat]} -${amount}
        </button>
    `).join('');

    return `
        <div class="persistent-damage-overlay">
            <div class="persistent-damage-modal" data-modal-content="true">
                <header class="persistent-damage-modal__header"><h3 class="persistent-damage-modal__title">HIEU UNG DAI HAN</h3></header>
                <div class="persistent-damage-modal__body">
                    <p class="persistent-damage-modal__event-name">${eventName}</p>
                    <p class="persistent-damage-modal__description">Chon chi so de giam ${amount} nac:</p>
                    <div class="persistent-damage-modal__options">${statButtons}</div>
                </div>
            </div>
        </div>
    `;
}
