// Event Choice Module - handles optional rolls and choice-based events
import { state } from '../gameState.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { openEventDiceModal } from './eventDice.js';
import { openEventResultModal } from './eventResult.js';
import { getPlayerStatForDice, applyStatChange, applyMultipleStatChanges } from '../characters/characterManager.js';

/**
 * Open optional roll modal - player can choose to roll or skip
 * Used by: thu_gi_do_an_giau
 */
export function openOptionalRollModal(mountEl, eventCard) {
    state.optionalRollModal = {
        isOpen: true,
        eventCard: eventCard,
    };
    console.log('[EventChoice] Opened optional roll modal for:', eventCard.name?.vi);
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Handle optional roll - player chose to roll
 */
export function handleOptionalRollAccept(mountEl) {
    if (!state.optionalRollModal?.eventCard) return;
    const eventCard = state.optionalRollModal.eventCard;
    state.optionalRollModal = null;
    // Open the dice modal for this event
    openEventDiceModal(mountEl, eventCard.id);
}

/**
 * Handle optional roll - player chose to skip
 */
export function handleOptionalRollSkip(mountEl) {
    state.optionalRollModal = null;
    const playerId = state.mySocketId;
    if (state.currentGameState?.playerMoves?.[playerId] <= 0) {
        advanceToNextTurn();
    }
    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Open choice modal - player must choose between options
 * Used by: lao_gia_an_xin, dinh_truoc_tuong_lai
 */
export function openChoiceModal(mountEl, eventCard) {
    const choices = eventCard.choices || [];
    const choiceOptions = choices.map((choice, idx) => {
        let label = '';
        if (choice.type === 'ignore') label = 'Bo qua (khong lam gi)';
        else if (choice.type === 'giveMoney') label = 'Cho tien (do xuc xac)';
        else if (choice.type === 'peek' && choice.target === 'roomTiles') label = 'Nhin truoc 3 lat phong';
        else if (choice.type === 'peek' && choice.target === 'cardDeck') label = 'Nhin truoc 3 la bai';
        else if (choice.type === 'storeDiceRoll') label = `Do ${choice.dice} xuc xac va luu ket qua`;
        else label = `Lua chon ${idx + 1}`;
        return { index: idx, label, choice };
    });

    state.choiceModal = {
        isOpen: true,
        eventCard: eventCard,
        options: choiceOptions,
        selectedIndex: null,
    };
    console.log('[EventChoice] Opened choice modal for:', eventCard.name?.vi, 'options:', choiceOptions.length);
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Handle choice selection
 */
export function handleChoiceSelect(mountEl, choiceIndex) {
    if (!state.choiceModal?.eventCard) return;
    const eventCard = state.choiceModal.eventCard;
    const choices = eventCard.choices || [];
    const choice = choices[choiceIndex];
    if (!choice) return;

    state.choiceModal = null;
    const playerId = state.mySocketId;

    if (choice.type === 'ignore' || choice.effect === 'nothing') {
        // Nothing happens
        openEventResultModal(mountEl, 'KHONG CO GI', 'Ban da chon bo qua.', 'neutral');
        return;
    }

    if (choice.type === 'giveMoney' && choice.rollStat) {
        // Open dice modal for this sub-roll
        // We need a temporary event-like structure
        const tempEvent = {
            ...eventCard,
            immediateRoll: true,
            rollStat: choice.rollStat,
            rollResults: choice.rollResults,
            fixedDice: undefined,
            rollDice: undefined,
        };
        // Store as event card and open dice modal
        state.eventDiceModal = {
            isOpen: true,
            eventCard: tempEvent,
            rollStat: choice.rollStat,
            selectedStat: null,
            diceCount: getPlayerStatForDice(playerId, choice.rollStat),
            inputValue: '',
            result: null,
            resultsApplied: false,
            currentRollIndex: 0,
            allResults: [],
            pendingEffect: null,
            tokenDrawingContext: null,
        };
        state.skipMapCentering = true;
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        return;
    }

    if (choice.type === 'peek') {
        // Peek at room tiles or card deck - show in private modal
        state.peekModal = {
            isOpen: true,
            target: choice.target,
            amount: choice.amount || 3,
            eventCard: eventCard,
        };
        state.skipMapCentering = true;
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        return;
    }

    if (choice.type === 'storeDiceRoll') {
        // Roll dice and store result for future use
        state.storeDiceModal = {
            isOpen: true,
            diceCount: choice.dice || 4,
            eventCard: eventCard,
            result: null,
            inputValue: '',
        };
        state.skipMapCentering = true;
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        return;
    }

    // Fallback - close and advance
    if (state.currentGameState?.playerMoves?.[playerId] <= 0) {
        advanceToNextTurn();
    }
    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Handle peek modal close
 */
export function closePeekModal(mountEl) {
    state.peekModal = null;
    const playerId = state.mySocketId;
    if (state.currentGameState?.playerMoves?.[playerId] <= 0) {
        advanceToNextTurn();
    }
    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Handle store dice modal - confirm stored result
 */
export function confirmStoreDice(mountEl, result) {
    if (!state.storeDiceModal) return;
    const playerId = state.mySocketId;

    // Store the dice result in player state
    if (!state.currentGameState.playerState.storedDice) {
        state.currentGameState.playerState.storedDice = {};
    }
    state.currentGameState.playerState.storedDice[playerId] = result;

    state.storeDiceModal = null;
    openEventResultModal(mountEl, 'DA LUU KET QUA', `Ket qua ${result} da duoc luu. Ban co the su dung no thay the cho lan do xuc xac tiep theo.`, 'success');
    syncGameStateToServer();
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================

export function renderOptionalRollModal() {
    if (!state.optionalRollModal?.isOpen) return '';
    const { eventCard } = state.optionalRollModal;
    const cardName = eventCard?.name?.vi || 'Event';

    return `
        <div class="event-choice-overlay">
            <div class="event-choice-modal" data-modal-content="true">
                <h3 class="event-choice-modal__title">${cardName}</h3>
                <p class="event-choice-modal__description">${eventCard?.text?.vi || ''}</p>
                <div class="event-choice-modal__actions">
                    <button class="event-choice-modal__btn event-choice-modal__btn--accept" type="button" data-action="optional-roll-accept">Tim kiem</button>
                    <button class="event-choice-modal__btn event-choice-modal__btn--skip" type="button" data-action="optional-roll-skip">Bo qua</button>
                </div>
            </div>
        </div>
    `;
}

export function renderChoiceModal() {
    if (!state.choiceModal?.isOpen) return '';
    const { eventCard, options } = state.choiceModal;
    const cardName = eventCard?.name?.vi || 'Event';

    const optionsHtml = options.map(opt =>
        `<button class="event-choice-modal__btn event-choice-modal__btn--option" type="button" data-action="choice-select" data-choice-index="${opt.index}">${opt.label}</button>`
    ).join('');

    return `
        <div class="event-choice-overlay">
            <div class="event-choice-modal" data-modal-content="true">
                <h3 class="event-choice-modal__title">${cardName}</h3>
                <p class="event-choice-modal__description">${eventCard?.text?.vi || ''}</p>
                <div class="event-choice-modal__options">${optionsHtml}</div>
            </div>
        </div>
    `;
}

export function renderPeekModal() {
    if (!state.peekModal?.isOpen) return '';
    const { target, amount } = state.peekModal;
    const targetLabel = target === 'roomTiles' ? 'lat phong' : 'la bai';

    return `
        <div class="event-choice-overlay">
            <div class="event-choice-modal" data-modal-content="true">
                <h3 class="event-choice-modal__title">NHIN TRUOC</h3>
                <p class="event-choice-modal__description">Ban da nhin truoc ${amount} ${targetLabel} tren cung. Khong duoc noi cho nguoi khac biet!</p>
                <p class="event-choice-modal__hint">(Trong phien ban dien tu, ban tu ghi nho ket qua)</p>
                <button class="event-choice-modal__btn event-choice-modal__btn--accept" type="button" data-action="close-peek">Da hieu</button>
            </div>
        </div>
    `;
}

export function renderStoreDiceModal() {
    if (!state.storeDiceModal?.isOpen) return '';
    const { diceCount, result, inputValue } = state.storeDiceModal;
    const hasResult = result !== null;

    let bodyContent = '';
    if (hasResult) {
        bodyContent = `
            <div class="event-dice-modal__result">
                <span class="event-dice-modal__result-label">Ket qua da luu:</span>
                <span class="event-dice-modal__result-value">${result}</span>
            </div>
            <div class="event-dice-modal__actions event-dice-modal__actions--result">
                <button class="event-dice-modal__btn event-dice-modal__btn--continue" type="button" data-action="store-dice-confirm">Luu ket qua</button>
            </div>`;
    } else {
        bodyContent = `
            <div class="event-dice-modal__roll-info"><p>Do ${diceCount} vien xuc xac va luu ket qua</p></div>
            <div class="event-dice-modal__input-group">
                <label class="event-dice-modal__label">Nhap ket qua xuc xac:</label>
                <input type="number" class="event-dice-modal__input" min="0" value="${inputValue}" data-input="store-dice-value" placeholder="Nhap so" />
            </div>
            <div class="event-dice-modal__actions">
                <button class="event-dice-modal__btn event-dice-modal__btn--confirm" type="button" data-action="store-dice-input">Xac nhan</button>
                <button class="event-dice-modal__btn event-dice-modal__btn--random" type="button" data-action="store-dice-random">Ngau nhien</button>
            </div>`;
    }

    return `
        <div class="event-dice-overlay">
            <div class="event-dice-modal" data-modal-content="true">
                <header class="event-dice-modal__header">
                    <h3 class="event-dice-modal__title">LUU KET QUA XUC XAC</h3>
                </header>
                <div class="event-dice-modal__body">${bodyContent}</div>
            </div>
        </div>
    `;
}
