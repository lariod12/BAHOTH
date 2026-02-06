// Combat modal rendering
import { state } from '../gameState.js';

export function renderCombatModal() {
    if (!state.combatModal || !state.combatModal.isOpen) return '';

    const {
        phase, attackerName, defenderName, defenderFactionLabel,
        attackerDiceCount, defenderDiceCount, attackerRoll, defenderRoll,
        inputValue, winner, damage, loserId, isForced
    } = state.combatModal;

    const isAttacker = state.combatModal.attackerId === state.mySocketId;
    const isDefender = state.combatModal.defenderId === state.mySocketId;
    const myRole = isAttacker ? 'attacker' : isDefender ? 'defender' : 'observer';

    let content = '';

    if (phase === 'confirm') {
        content = `
            <div class="combat-modal__header">
                <h2 class="combat-modal__title">CHIEN DAU${isForced ? ' (CUONG CHE)' : ''}</h2>
            </div>
            <div class="combat-modal__info">
                <p><strong>${attackerName}</strong> tan cong <strong>${defenderName}</strong> (${defenderFactionLabel})</p>
                <p>Su dung: Might</p>
                <p>${attackerName}: ${attackerDiceCount} dice | ${defenderName}: ${defenderDiceCount} dice</p>
            </div>
            <div class="combat-modal__actions">
                <button class="action-button action-button--primary" type="button" data-action="combat-start">BAT DAU</button>
            </div>
        `;
    } else if (phase === 'attacker_roll' && isAttacker) {
        content = `
            <div class="combat-modal__header">
                <h2 class="combat-modal__title">LUOT TAN CONG</h2>
            </div>
            <div class="combat-modal__info">
                <p>${attackerName} tung ${attackerDiceCount} dice</p>
            </div>
            <div class="combat-modal__input">
                <label>Nhap ket qua:</label>
                <input type="number" min="0" max="99" class="dice-input" data-action="combat-input" value="${inputValue}" placeholder="0" />
            </div>
            <div class="combat-modal__actions">
                <button class="action-button action-button--primary" type="button" data-action="combat-submit-attacker">XAC NHAN</button>
            </div>
        `;
    } else if (phase === 'defender_roll' && isDefender) {
        content = `
            <div class="combat-modal__header">
                <h2 class="combat-modal__title">LUOT PHONG THU</h2>
            </div>
            <div class="combat-modal__info">
                <p>${attackerName} da tung: ${attackerRoll}</p>
                <p>${defenderName} tung ${defenderDiceCount} dice</p>
            </div>
            <div class="combat-modal__input">
                <label>Nhap ket qua:</label>
                <input type="number" min="0" max="99" class="dice-input" data-action="combat-input" value="${inputValue}" placeholder="0" />
            </div>
            <div class="combat-modal__actions">
                <button class="action-button action-button--primary" type="button" data-action="combat-submit-defender">XAC NHAN</button>
            </div>
        `;
    } else if (phase === 'waiting_defender') {
        content = `
            <div class="combat-modal__header">
                <h2 class="combat-modal__title">CHO DOI</h2>
            </div>
            <div class="combat-modal__info">
                <p>${isAttacker ? `Ban da tung: ${attackerRoll}` : `${attackerName} da tung: ${attackerRoll}`}</p>
                <p>Dang cho ${defenderName} tung dice...</p>
            </div>
        `;
    } else if (phase === 'result') {
        let resultMsg = '';
        if (winner === 'tie') {
            resultMsg = 'HOA! Khong ai chiu sat thuong.';
        } else if (winner === 'attacker') {
            resultMsg = `${attackerName} thang! ${defenderName} chiu ${damage} sat thuong.`;
        } else {
            resultMsg = `${defenderName} thang! ${attackerName} chiu ${damage} sat thuong va mat luot.`;
        }
        content = `
            <div class="combat-modal__header">
                <h2 class="combat-modal__title">KET QUA</h2>
            </div>
            <div class="combat-modal__info">
                <p>${attackerName}: ${attackerRoll} | ${defenderName}: ${defenderRoll}</p>
                <p class="combat-modal__result">${resultMsg}</p>
            </div>
            <div class="combat-modal__actions">
                <button class="action-button action-button--primary" type="button" data-action="combat-close">DONG</button>
            </div>
        `;
    } else {
        content = `
            <div class="combat-modal__header">
                <h2 class="combat-modal__title">CHIEN DAU</h2>
            </div>
            <div class="combat-modal__info">
                <p>Dang cho doi thu...</p>
            </div>
        `;
    }

    return `
        <div class="combat-overlay">
            <div class="combat-modal">${content}</div>
        </div>
    `;
}

export function renderDamageDistributionModal() {
    if (!state.damageDistributionModal || !state.damageDistributionModal.isOpen) return '';

    const { totalDamage, damageType, stat1, stat2, stat1Damage, stat2Damage } = state.damageDistributionModal;
    const remaining = totalDamage - (stat1Damage || 0) - (stat2Damage || 0);
    const isComplete = remaining === 0;

    let typeLabel = '';
    if (damageType === 'physical') typeLabel = 'Physical (Speed/Might)';
    else if (damageType === 'mental') typeLabel = 'Mental (Sanity/Knowledge)';
    else typeLabel = 'Chon loai sat thuong';

    if (!damageType) {
        return `
            <div class="damage-dist-overlay">
                <div class="damage-dist-modal">
                    <h2 class="damage-dist__title">PHAN CHIA SAT THUONG</h2>
                    <p>Tong sat thuong: ${totalDamage}</p>
                    <p>${typeLabel}</p>
                    <div class="damage-dist__type-select">
                        <button class="action-button action-button--primary" type="button" data-action="damage-dist-type" data-type="physical">Physical (Speed/Might)</button>
                        <button class="action-button action-button--primary" type="button" data-action="damage-dist-type" data-type="mental">Mental (Sanity/Knowledge)</button>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="damage-dist-overlay">
            <div class="damage-dist-modal">
                <h2 class="damage-dist__title">PHAN CHIA SAT THUONG</h2>
                <p>Tong: ${totalDamage} | ${typeLabel} | Con lai: ${remaining}</p>
                <div class="damage-dist__stats">
                    <div class="damage-dist__stat">
                        <label>${stat1 || '?'}: ${stat1Damage || 0}</label>
                        <button type="button" data-action="damage-dist-inc" data-stat="stat1" ${remaining <= 0 ? 'disabled' : ''}>+</button>
                        <button type="button" data-action="damage-dist-dec" data-stat="stat1" ${(stat1Damage || 0) <= 0 ? 'disabled' : ''}>-</button>
                    </div>
                    <div class="damage-dist__stat">
                        <label>${stat2 || '?'}: ${stat2Damage || 0}</label>
                        <button type="button" data-action="damage-dist-inc" data-stat="stat2" ${remaining <= 0 ? 'disabled' : ''}>+</button>
                        <button type="button" data-action="damage-dist-dec" data-stat="stat2" ${(stat2Damage || 0) <= 0 ? 'disabled' : ''}>-</button>
                    </div>
                </div>
                <div class="damage-dist__actions">
                    <button class="action-button action-button--primary" type="button" data-action="damage-dist-confirm" ${!isComplete ? 'disabled' : ''}>XAC NHAN</button>
                </div>
            </div>
        </div>
    `;
}
