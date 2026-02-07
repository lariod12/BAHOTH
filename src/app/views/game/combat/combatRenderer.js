// Combat modal rendering
import { state } from '../gameState.js';

export function renderCombatModal() {
    if (!state.combatModal || !state.combatModal.isOpen) return '';

    const {
        phase, attackerName, defenderName, defenderFactionLabel,
        attackerDiceCount, defenderDiceCount, attackerRoll, defenderRoll,
        inputValue, winner, damage, loserId, isForced,
        fixedAttackerDice, eventSource
    } = state.combatModal;

    const isAttacker = state.combatModal.attackerId === state.mySocketId;
    const isDefender = state.combatModal.defenderId === state.mySocketId;
    const myRole = isAttacker ? 'attacker' : isDefender ? 'defender' : 'observer';

    // Event-triggered combat: current player controls both attacker and defender rolls
    const isEventCombat = !!eventSource;
    const canInputAttacker = isAttacker || isEventCombat;
    const canInputDefender = isDefender || isEventCombat;

    const attackDiceLabel = fixedAttackerDice ? `${fixedAttackerDice} dice (su kien)` : `${attackerDiceCount} dice`;

    let content = '';

    if (phase === 'confirm') {
        content = `
            <div class="combat-modal__header">
                <h2 class="combat-modal__title">CHIEN DAU${isForced ? ' (SU KIEN)' : ''}</h2>
            </div>
            <div class="combat-modal__info">
                <p><strong>${attackerName}</strong> tan cong <strong>${defenderName}</strong>${defenderFactionLabel ? ` (${defenderFactionLabel})` : ''}</p>
                <p>Su dung: Might</p>
                <p>${attackerName}: ${attackDiceLabel} | ${defenderName}: ${defenderDiceCount} dice</p>
            </div>
            <div class="combat-modal__actions">
                <button class="action-button action-button--primary" type="button" data-action="combat-start">BAT DAU</button>
            </div>
        `;
    } else if (phase === 'attacker_roll' && canInputAttacker) {
        content = `
            <div class="combat-modal__header">
                <h2 class="combat-modal__title">${isEventCombat ? 'TAN CONG TU SU KIEN' : 'LUOT TAN CONG'}</h2>
            </div>
            <div class="combat-modal__info">
                <p>${attackerName} tung ${attackDiceLabel}</p>
                ${isEventCombat && !isAttacker ? `<p class="combat-modal__hint">Ban nhap ket qua xuc xac cua ${attackerName}</p>` : ''}
            </div>
            <div class="combat-modal__input">
                <label>Nhap ket qua:</label>
                <input type="number" min="0" max="99" class="dice-input" data-action="combat-input" value="${inputValue}" placeholder="0" />
            </div>
            <div class="combat-modal__actions">
                <button class="action-button action-button--primary" type="button" data-action="combat-submit-attacker">XAC NHAN</button>
            </div>
        `;
    } else if (phase === 'defender_roll' && canInputDefender) {
        content = `
            <div class="combat-modal__header">
                <h2 class="combat-modal__title">LUOT PHONG THU</h2>
            </div>
            <div class="combat-modal__info">
                <p>${attackerName} da tung: ${attackerRoll}</p>
                <p>${defenderName} tung ${defenderDiceCount} dice (Might)</p>
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

    const statLabels = { speed: 'Toc do', might: 'Suc manh', sanity: 'Tam tri', knowledge: 'Kien thuc' };

    // Type selection screen (when damageType not yet chosen)
    if (!damageType) {
        return `
            <div class="damage-dist-overlay">
                <div class="damage-dist-modal">
                    <header class="damage-dist-modal__header">
                        <h2 class="damage-dist-modal__title">PHAN CHIA SAT THUONG</h2>
                    </header>
                    <div class="damage-dist-modal__body">
                        <p class="damage-dist-modal__damage-total">Tong sat thuong: <strong>${totalDamage}</strong></p>
                        <p class="damage-dist-modal__instruction">Chon loai sat thuong</p>
                        <div class="damage-dist-modal__type-buttons">
                            <button class="damage-dist-modal__btn--physical" type="button" data-action="damage-dist-type" data-type="physical">Vat li<small>Toc do / Suc manh</small></button>
                            <button class="damage-dist-modal__btn--mental" type="button" data-action="damage-dist-type" data-type="mental">Tinh than<small>Tam tri / Kien thuc</small></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    const stat1Label = statLabels[stat1] || stat1 || '?';
    const stat2Label = statLabels[stat2] || stat2 || '?';
    const remainingClass = isComplete ? 'damage-dist-modal__remaining damage-dist-modal__remaining--done' : 'damage-dist-modal__remaining';

    return `
        <div class="damage-dist-overlay">
            <div class="damage-dist-modal">
                <header class="damage-dist-modal__header">
                    <h2 class="damage-dist-modal__title">PHAN CHIA SAT THUONG</h2>
                </header>
                <div class="damage-dist-modal__body">
                    <p class="damage-dist-modal__damage-total">Tong sat thuong: <strong>${totalDamage}</strong></p>
                    <div class="${remainingClass}">Con lai: <strong>${remaining}</strong></div>
                    <div class="damage-dist-modal__stat-row">
                        <div class="damage-dist-modal__stat-info">
                            <span class="damage-dist-modal__stat-label">${stat1Label}</span>
                        </div>
                        <div class="damage-dist-modal__stat-input">
                            <button class="damage-dist-modal__btn--minus" type="button" data-action="damage-dist-dec" data-stat="stat1" ${(stat1Damage || 0) <= 0 ? 'disabled' : ''}>-</button>
                            <span class="damage-dist-modal__stat-value">${stat1Damage || 0}</span>
                            <button class="damage-dist-modal__btn--plus" type="button" data-action="damage-dist-inc" data-stat="stat1" ${remaining <= 0 ? 'disabled' : ''}>+</button>
                        </div>
                    </div>
                    <div class="damage-dist-modal__stat-row">
                        <div class="damage-dist-modal__stat-info">
                            <span class="damage-dist-modal__stat-label">${stat2Label}</span>
                        </div>
                        <div class="damage-dist-modal__stat-input">
                            <button class="damage-dist-modal__btn--minus" type="button" data-action="damage-dist-dec" data-stat="stat2" ${(stat2Damage || 0) <= 0 ? 'disabled' : ''}>-</button>
                            <span class="damage-dist-modal__stat-value">${stat2Damage || 0}</span>
                            <button class="damage-dist-modal__btn--plus" type="button" data-action="damage-dist-inc" data-stat="stat2" ${remaining <= 0 ? 'disabled' : ''}>+</button>
                        </div>
                    </div>
                    <button class="damage-dist-modal__btn--confirm" type="button" data-action="damage-dist-confirm" ${!isComplete ? 'disabled' : ''}>XAC NHAN</button>
                </div>
            </div>
        </div>
    `;
}
