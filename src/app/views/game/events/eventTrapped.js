// Trapped effect handling + escape modal
import { state } from '../gameState.js';
import { applyTrappedEffect as applyTrappedEffectUtil } from '../../../utils/eventEffects.js';
import { isAlly } from '../../../utils/factionUtils.js';
import { getPlayerStatForDice, getCharacterSpeed } from '../characters/characterManager.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { openEventResultModal } from './eventResult.js';
import * as socketClient from '../../../services/socketClient.js';

export function applyTrappedEffect(mountEl, playerId, eventCard) {
    const trappedRecord = applyTrappedEffectUtil(state.currentGameState, playerId, eventCard);
    if (!trappedRecord) return;

    console.log('[Trapped] Player', playerId, 'is now trapped by', eventCard.name?.vi);
    syncGameStateToServer();

    const { escapeRoll, autoEscapeAfter } = trappedRecord;
    openEventResultModal(
        mountEl,
        'BI MAC KET!',
        `Ban bi mac ket va khong the di chuyen! Luot sau phai do ${escapeRoll.stat.toUpperCase()} dat ${escapeRoll.threshold}+ de thoat. Tu dong thoat sau ${autoEscapeAfter} luot.`,
        'danger'
    );
}

export function getPlayerTrappedInfo(playerId) {
    return state.currentGameState?.playerState?.trappedPlayers?.[playerId] || null;
}

export function getTrappedAllyInRoom(roomId, currentPlayerId) {
    if (!state.currentGameState) return null;

    const playerPositions = state.currentGameState.playerState?.playerPositions || {};
    const trappedPlayers = state.currentGameState.playerState?.trappedPlayers || {};

    for (const [playerId, trappedInfo] of Object.entries(trappedPlayers)) {
        if (playerId === currentPlayerId) continue;
        if (playerPositions[playerId] !== roomId) continue;
        if (!trappedInfo.allyCanHelp) continue;
        if (!isAlly(state.currentGameState, currentPlayerId, playerId)) continue;

        const player = state.currentGameState.players?.find(p => p.id === playerId);
        const playerName = player?.name || playerId;

        console.log('[Rescue] Found trapped ally in room:', playerId, 'trapped by:', trappedInfo.eventName);
        return { playerId, playerName, trappedInfo };
    }
    return null;
}

export function openTrappedEscapeModal(mountEl, trappedInfo) {
    state.trappedEscapeModal = {
        isOpen: true,
        trappedInfo: trappedInfo,
        inputValue: '',
        result: null
    };
    console.log('[TrappedEscape] Opened modal for', trappedInfo.eventName);
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function openRescueTrappedModal(mountEl, trappedPlayerId, trappedPlayerName, trappedInfo) {
    state.rescueTrappedModal = {
        isOpen: true,
        trappedPlayerId,
        trappedPlayerName,
        eventName: trappedInfo.eventName,
        escapeRoll: trappedInfo.escapeRoll,
        allyFailure: trappedInfo.allyFailure || 'nothing',
        phase: 'confirm',
        inputValue: '',
        result: null
    };
    console.log('[Rescue] Opened rescue modal for', trappedPlayerName);
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function renderTrappedEscapeModal() {
    if (!state.trappedEscapeModal?.isOpen) return '';

    const { trappedInfo, inputValue, result } = state.trappedEscapeModal;
    const { eventName, escapeRoll, turnsTrapped, autoEscapeAfter, allyCanHelp } = trappedInfo;
    const hasResult = result !== null;

    const statLabels = {
        speed: 'Toc do (Speed)',
        might: 'Suc manh (Might)',
        sanity: 'Tam tri (Sanity)',
        knowledge: 'Kien thuc (Knowledge)'
    };

    const statLabel = statLabels[escapeRoll.stat] || escapeRoll.stat;
    const diceCount = getPlayerStatForDice(state.mySocketId, escapeRoll.stat);
    const escapeAttempts = turnsTrapped;
    const attemptsRemaining = autoEscapeAfter - turnsTrapped + 1;

    let resultStatusHtml = '';
    let resultMessage = '';
    if (hasResult) {
        const isSuccess = result >= escapeRoll.threshold;
        resultStatusHtml = `
            <div class="trapped-escape-modal__result-status trapped-escape-modal__result-status--${isSuccess ? 'success' : 'fail'}">
                ${isSuccess ? 'THANH CONG!' : 'THAT BAI!'}
            </div>
        `;
        resultMessage = isSuccess
            ? 'Ban da thoat khoi bay!'
            : `Ban van bi mac ket. Con ${attemptsRemaining - 1} lan thu truoc khi tu dong thoat.`;
    }

    return `
        <div class="trapped-escape-overlay">
            <div class="trapped-escape-modal" data-modal-content="true">
                <header class="trapped-escape-modal__header">
                    <h3 class="trapped-escape-modal__title">BI MAC KET!</h3>
                    <span class="trapped-escape-modal__subtitle">${eventName}</span>
                </header>
                <div class="trapped-escape-modal__body">
                    <p class="trapped-escape-modal__description">
                        Ban dang bi mac ket! Do ${statLabel} dat ${escapeRoll.threshold}+ de thoat.
                    </p>
                    <p class="trapped-escape-modal__turns">
                        Lan thu: ${escapeAttempts}/${autoEscapeAfter}
                        ${attemptsRemaining > 0 ? `(Tu dong thoat sau ${attemptsRemaining} lan thu nua)` : ''}
                    </p>
                    ${allyCanHelp ? `
                        <p class="trapped-escape-modal__ally-help">Dong doi cung phong co the do ${statLabel} ${escapeRoll.threshold}+ de giai cuu ban.</p>
                    ` : ''}
                    ${hasResult ? `
                        <div class="trapped-escape-modal__result">
                            <span class="trapped-escape-modal__result-label">Ket qua:</span>
                            <span class="trapped-escape-modal__result-value">${result}</span>
                        </div>
                        ${resultStatusHtml}
                        <p class="trapped-escape-modal__message">${resultMessage}</p>
                        <button class="trapped-escape-modal__btn trapped-escape-modal__btn--continue"
                                type="button" data-action="trapped-escape-continue">Tiep tuc</button>
                    ` : `
                        <div class="trapped-escape-modal__roll-info"><p>Do ${diceCount} vien xuc xac ${statLabel}</p></div>
                        <div class="trapped-escape-modal__input-group">
                            <label class="trapped-escape-modal__label">Nhap ket qua xuc xac:</label>
                            <input type="number" class="trapped-escape-modal__input" min="0" value="${inputValue}" data-input="trapped-escape-value" placeholder="Nhap so" />
                        </div>
                        <div class="trapped-escape-modal__actions">
                            <button class="trapped-escape-modal__btn trapped-escape-modal__btn--confirm" type="button" data-action="trapped-escape-confirm">Xac nhan</button>
                            <button class="trapped-escape-modal__btn trapped-escape-modal__btn--random" type="button" data-action="trapped-escape-random">Ngau nhien</button>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

export function renderRescueTrappedModal() {
    if (!state.rescueTrappedModal?.isOpen) return '';

    const { trappedPlayerName, eventName, escapeRoll, phase, inputValue, result, allyFailure } = state.rescueTrappedModal;
    const statLabels = {
        speed: 'Toc do (Speed)', might: 'Suc manh (Might)',
        sanity: 'Tam tri (Sanity)', knowledge: 'Kien thuc (Knowledge)'
    };
    const statLabel = statLabels[escapeRoll.stat] || escapeRoll.stat;
    const threshold = escapeRoll.threshold;

    let bodyContent = '';

    if (phase === 'confirm') {
        bodyContent = `
            <p class="rescue-trapped-modal__description"><strong>${trappedPlayerName}</strong> dang bi mac ket boi <strong>${eventName}</strong>!</p>
            <p class="rescue-trapped-modal__info">Ban co muon giai cuu dong doi khong?</p>
            <p class="rescue-trapped-modal__warning">Do ${statLabel} dat ${threshold}+ de giai cuu.
                ${allyFailure === 'alsoTrapped' ? '<br><strong>Canh bao:</strong> Neu that bai, ban cung se bi mac ket!' : ''}</p>
            <div class="rescue-trapped-modal__actions">
                <button class="rescue-trapped-modal__btn rescue-trapped-modal__btn--rescue" type="button" data-action="rescue-trapped-yes">Giai cuu</button>
                <button class="rescue-trapped-modal__btn rescue-trapped-modal__btn--skip" type="button" data-action="rescue-trapped-no">Bo qua</button>
            </div>
        `;
    } else if (phase === 'roll') {
        const diceCount = getPlayerStatForDice(state.mySocketId, escapeRoll.stat);
        bodyContent = `
            <p class="rescue-trapped-modal__description">Giai cuu ${trappedPlayerName}</p>
            <div class="rescue-trapped-modal__roll-info">
                <p>Do <strong>${diceCount}</strong> xuc xac ${statLabel}</p>
                <p class="rescue-trapped-modal__target">Can dat: ${threshold}+</p>
            </div>
            <div class="rescue-trapped-modal__input-group">
                <label class="rescue-trapped-modal__label">Nhap ket qua xuc xac:</label>
                <input type="number" class="rescue-trapped-modal__input" min="0" value="${inputValue}" data-input="rescue-trapped-value" placeholder="Nhap so" />
            </div>
            <div class="rescue-trapped-modal__actions">
                <button class="rescue-trapped-modal__btn rescue-trapped-modal__btn--confirm" type="button" data-action="rescue-trapped-confirm">Xac nhan</button>
                <button class="rescue-trapped-modal__btn rescue-trapped-modal__btn--random" type="button" data-action="rescue-trapped-random">Ngau nhien</button>
            </div>
        `;
    } else if (phase === 'result') {
        const isSuccess = result >= threshold;
        bodyContent = `
            <p class="rescue-trapped-modal__description">Giai cuu ${trappedPlayerName}</p>
            <div class="rescue-trapped-modal__result">
                <span class="rescue-trapped-modal__result-label">Ket qua:</span>
                <span class="rescue-trapped-modal__result-value">${result}</span>
            </div>
            <div class="rescue-trapped-modal__status rescue-trapped-modal__status--${isSuccess ? 'success' : 'fail'}">
                ${isSuccess ? 'GIAI CUU THANH CONG!' : 'THAT BAI!'}
            </div>
            ${!isSuccess && allyFailure === 'alsoTrapped' ? `<p class="rescue-trapped-modal__fail-warning">Ban cung bi mac ket!</p>` : ''}
            <button class="rescue-trapped-modal__btn rescue-trapped-modal__btn--continue" type="button" data-action="rescue-trapped-continue">Tiep tuc</button>
        `;
    }

    return `
        <div class="rescue-trapped-overlay">
            <div class="rescue-trapped-modal" data-modal-content="true">
                <header class="rescue-trapped-modal__header"><h3 class="rescue-trapped-modal__title">GIAI CUU DONG DOI</h3></header>
                <div class="rescue-trapped-modal__body">${bodyContent}</div>
            </div>
        </div>
    `;
}

export function handleTrappedEscapeResult(mountEl) {
    if (!state.trappedEscapeModal) return;
    const { trappedInfo, result } = state.trappedEscapeModal;
    const isSuccess = result >= trappedInfo.escapeRoll.threshold;

    if (isSuccess) {
        console.log('[TrappedEscape] Player escaped!');
        delete state.currentGameState.playerState.trappedPlayers[state.mySocketId];
        state.trappedEscapeModal = null;
        syncGameStateToServer();

        const me = state.currentGameState.players?.find(p => p.id === state.mySocketId);
        if (me?.characterId) {
            const charData = state.currentGameState.playerState?.characterData?.[state.mySocketId];
            const speed = getCharacterSpeed(me.characterId, charData);
            socketClient.setMoves(speed);
        }
    } else {
        console.log('[TrappedEscape] Player still trapped, ending turn');

        const trappedData = state.currentGameState.playerState.trappedPlayers[state.mySocketId];
        if (trappedData) {
            trappedData.turnsTrapped = (trappedData.turnsTrapped || 1) + 1;
            console.log('[TrappedEscape] turnsTrapped now:', trappedData.turnsTrapped);
        }

        state.trappedEscapeModal = null;
        advanceToNextTurn();

        const newTurnIndex = state.currentGameState.currentTurnIndex;
        state.movesInitializedForTurn = newTurnIndex;
        console.log('[TrappedEscape] Set movesInitializedForTurn to:', newTurnIndex);

        syncGameStateToServer();
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
    }
}

export function handleRescueResult(mountEl) {
    if (!state.rescueTrappedModal) return;

    const { trappedPlayerId, result, escapeRoll, allyFailure } = state.rescueTrappedModal;
    const isSuccess = result >= escapeRoll.threshold;
    const rescuerId = state.mySocketId;

    if (isSuccess) {
        if (state.currentGameState.playerState?.trappedPlayers?.[trappedPlayerId]) {
            delete state.currentGameState.playerState.trappedPlayers[trappedPlayerId];
            console.log('[Rescue] Successfully rescued player:', trappedPlayerId);
        }
    } else {
        if (allyFailure === 'alsoTrapped') {
            const trappedInfo = state.currentGameState.playerState?.trappedPlayers?.[trappedPlayerId];
            if (trappedInfo) {
                if (!state.currentGameState.playerState.trappedPlayers) {
                    state.currentGameState.playerState.trappedPlayers = {};
                }
                state.currentGameState.playerState.trappedPlayers[rescuerId] = {
                    eventId: trappedInfo.eventId,
                    eventName: trappedInfo.eventName,
                    escapeRoll: trappedInfo.escapeRoll,
                    allyCanHelp: trappedInfo.allyCanHelp,
                    allyFailure: trappedInfo.allyFailure,
                    autoEscapeAfter: trappedInfo.autoEscapeAfter,
                    turnsTrapped: 1
                };
                if (state.currentGameState.playerMoves) {
                    state.currentGameState.playerMoves[rescuerId] = 0;
                }
                console.log('[Rescue] Rescuer also trapped:', rescuerId);
            }
        }
    }

    state.rescueTrappedModal = null;

    if (state.currentGameState.playerMoves[rescuerId] <= 0) {
        advanceToNextTurn();
        const newTurnIndex = state.currentGameState.currentTurnIndex;
        state.movesInitializedForTurn = newTurnIndex;
        console.log('[Rescue] Rescuer trapped - turn ended. Set movesInitializedForTurn to:', newTurnIndex);
    }

    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}
