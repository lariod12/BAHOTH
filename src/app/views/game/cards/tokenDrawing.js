// Token drawing system - draw cards when entering rooms with tokens
import { state } from '../gameState.js';
import { EVENTS } from '../../../data/cardsData.js';
import { getAvailableCards } from '../omens/omenCount.js';
import { getCardsByType } from '../items/itemInventory.js';
import { getCardData } from '../items/itemInventory.js';
import { checkEventRequiresImmediateRoll, openEventDiceModal } from '../events/eventDice.js';
import { handleReflectionEvent } from '../events/eventReflection.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { removeDiacritics } from '../characters/characterManager.js';

export function initTokenDrawing(mountEl, tokens) {
    if (!tokens || tokens.length === 0) return;
    state.tokenDrawingModal = {
        isOpen: true,
        tokensToDrawn: tokens.map(type => ({ type, drawn: false, selectedCard: null })),
        currentIndex: 0
    };
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function handleCardSelect(mountEl, cardId) {
    if (!state.tokenDrawingModal) return;
    const current = state.tokenDrawingModal.tokensToDrawn[state.tokenDrawingModal.currentIndex];
    if (!current) return;
    current.selectedCard = cardId;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function handleRandomCardDraw(mountEl) {
    if (!state.tokenDrawingModal) return;
    const current = state.tokenDrawingModal.tokensToDrawn[state.tokenDrawingModal.currentIndex];
    if (!current) return;

    const cards = getAvailableCards(current.type);
    if (cards.length === 0) {
        console.log(`[Token] No available ${current.type} cards left`);
        return;
    }
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    current.selectedCard = randomCard.id;
    current.drawn = true;

    if (state.tokenDrawingModal.currentIndex < state.tokenDrawingModal.tokensToDrawn.length - 1) {
        state.tokenDrawingModal.currentIndex++;
    } else {
        confirmTokenDrawing(mountEl);
        return;
    }
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function handleTokenDrawNext(mountEl) {
    if (!state.tokenDrawingModal) return;
    const current = state.tokenDrawingModal.tokensToDrawn[state.tokenDrawingModal.currentIndex];
    if (!current || !current.selectedCard) return;
    current.drawn = true;

    if (state.tokenDrawingModal.currentIndex < state.tokenDrawingModal.tokensToDrawn.length - 1) {
        state.tokenDrawingModal.currentIndex++;
    } else {
        confirmTokenDrawing(mountEl);
        return;
    }
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function confirmTokenDrawing(mountEl) {
    if (!state.tokenDrawingModal || !state.currentGameState) return;

    const playerId = state.mySocketId;

    if (!state.currentGameState.playerState.playerCards) state.currentGameState.playerState.playerCards = {};
    if (!state.currentGameState.playerState.playerCards[playerId]) {
        state.currentGameState.playerState.playerCards[playerId] = { omens: [], events: [], items: [] };
    }

    let immediateRollEvent = null;
    let directEffectEvent = null;
    let conditionalEvent = null;
    let optionalRollEvent = null;
    let choiceEvent = null;
    let placeTokenEvent = null;
    let conditionalCheckEvent = null;
    let attackEvent = null;
    let specialEvent = null;

    state.tokenDrawingModal.tokensToDrawn.forEach(token => {
        if (token.drawn && token.selectedCard) {
            const cardType = token.type === 'omen' ? 'omens' : token.type === 'event' ? 'events' : 'items';
            state.currentGameState.playerState.playerCards[playerId][cardType].push(token.selectedCard);

            if (token.type === 'event') {
                if (checkEventRequiresImmediateRoll(token.selectedCard)) {
                    immediateRollEvent = token.selectedCard;
                } else {
                    const eventCard = EVENTS.find(e => e.id === token.selectedCard);
                    if (eventCard) {
                        if (eventCard.affectsAllPlayers && eventCard.rollStat) {
                            // Multi-player events take priority
                            immediateRollEvent = token.selectedCard;
                        } else if (eventCard.effect === 'placeToken') {
                            // Token placement takes priority (even if also optional)
                            placeTokenEvent = eventCard;
                        } else if (eventCard.effect === 'drawItem') directEffectEvent = eventCard;
                        else if (eventCard.effect === 'conditional' && eventCard.id === 'anh_phan_chieu_2') conditionalEvent = eventCard;
                        else if (eventCard.optional === true) optionalRollEvent = eventCard;
                        else if (eventCard.effect === 'choice') choiceEvent = eventCard;
                        else if (eventCard.effect === 'conditional' && eventCard.id !== 'anh_phan_chieu_2') conditionalCheckEvent = eventCard;
                        else if (eventCard.effect === 'attack') attackEvent = eventCard;
                        else if (eventCard.effect === 'shuffleItems' || eventCard.effect === 'drawRoomTile' || eventCard.effect === 'relocateCurrentRoom') specialEvent = eventCard;
                        else if (eventCard.persistent === true && !eventCard.immediateRoll && !eventCard.rollDice) specialEvent = eventCard;
                    }
                }
            }
        }
    });

    const tokenDrawingContext = immediateRollEvent ? {
        tokensToDrawn: JSON.parse(JSON.stringify(state.tokenDrawingModal.tokensToDrawn)),
        currentIndex: state.tokenDrawingModal.currentIndex,
        roomId: state.tokenDrawingModal.roomId
    } : null;

    state.tokenDrawingModal = null;

    if (immediateRollEvent) {
        // Check if this is a multi-player event
        const immediateCard = EVENTS.find(e => e.id === immediateRollEvent);
        if (immediateCard?.affectsAllPlayers) {
            console.log('[TokenDrawing] Multi-player event:', immediateRollEvent);
            syncGameStateToServer();
            import('../events/eventMultiPlayer.js').then(m => m.openMultiPlayerRollModal(mountEl, immediateCard));
            return;
        }
        console.log('[TokenDrawing] Event requires immediate roll:', immediateRollEvent);
        syncGameStateToServer();
        openEventDiceModal(mountEl, immediateRollEvent, tokenDrawingContext);
        return;
    }

    if (directEffectEvent) {
        const drawCount = directEffectEvent.amount || 1;
        const itemTokens = Array(drawCount).fill('item');
        console.log('[TokenDrawing] Direct effect event:', directEffectEvent.id, 'drawItem count:', drawCount);
        syncGameStateToServer();
        initTokenDrawing(mountEl, itemTokens);
        return;
    }

    if (conditionalEvent) {
        syncGameStateToServer();
        const handled = handleReflectionEvent(mountEl, conditionalEvent, playerId);
        if (handled) return;
    }

    // Optional roll events (e.g., thu_gi_do_an_giau)
    if (optionalRollEvent) {
        console.log('[TokenDrawing] Optional roll event:', optionalRollEvent.id);
        syncGameStateToServer();
        import('../events/eventChoice.js').then(m => m.openOptionalRollModal(mountEl, optionalRollEvent));
        return;
    }

    // Choice events (e.g., lao_gia_an_xin, dinh_truoc_tuong_lai)
    if (choiceEvent) {
        console.log('[TokenDrawing] Choice event:', choiceEvent.id);
        syncGameStateToServer();
        import('../events/eventChoice.js').then(m => m.openChoiceModal(mountEl, choiceEvent));
        return;
    }

    // Place token events
    if (placeTokenEvent) {
        console.log('[TokenDrawing] Place token event:', placeTokenEvent.id);
        syncGameStateToServer();
        import('../events/eventToken.js').then(m => m.handlePlaceTokenEvent(mountEl, placeTokenEvent));
        return;
    }

    // Conditional check events (e.g., luot_cua_jonah)
    if (conditionalCheckEvent) {
        console.log('[TokenDrawing] Conditional check event:', conditionalCheckEvent.id);
        syncGameStateToServer();
        import('../events/eventConditional.js').then(m => m.handleConditionalEvent(mountEl, conditionalCheckEvent));
        return;
    }

    // Attack events (e.g., con_bup_be_kinh_di)
    if (attackEvent) {
        console.log('[TokenDrawing] Attack event:', attackEvent.id);
        syncGameStateToServer();
        import('../events/eventAttack.js').then(m => m.handleAttackEvent(mountEl, attackEvent));
        return;
    }

    // Special events (shuffleItems, drawRoomTile, relocateCurrentRoom, persistent non-roll)
    if (specialEvent) {
        console.log('[TokenDrawing] Special event:', specialEvent.id);
        syncGameStateToServer();
        import('../events/eventSpecial.js').then(m => m.handleSpecialEvent(mountEl, specialEvent));
        return;
    }

    if (state.currentGameState.playerMoves[playerId] <= 0) {
        console.log('[Turn] Player', playerId, 'moves depleted after token drawing, advancing turn');
        advanceToNextTurn();
    }

    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function renderTokenDrawingModal() {
    if (!state.tokenDrawingModal || !state.tokenDrawingModal.isOpen) return '';

    const current = state.tokenDrawingModal.tokensToDrawn[state.tokenDrawingModal.currentIndex];
    if (!current) return '';

    const typeLabels = { omen: 'Omen', event: 'Event', item: 'Item' };
    const typeLabel = typeLabels[current.type];
    const totalTokens = state.tokenDrawingModal.tokensToDrawn.length;
    const currentNum = state.tokenDrawingModal.currentIndex + 1;
    const cards = getAvailableCards(current.type);

    const cardListHtml = cards.map(card => {
        const cardName = card.name?.vi || card.id;
        const isSelected = current.selectedCard === card.id;
        const searchText = `${cardName.toLowerCase()} ${removeDiacritics(cardName).toLowerCase()}`;
        return `<div class="token-card__item ${isSelected ? 'is-selected' : ''}" data-card-id="${card.id}" data-search-text="${searchText}">${cardName}</div>`;
    }).join('');

    return `
        <div class="token-drawing-overlay">
            <div class="token-drawing-modal">
                <h2 class="token-drawing__title">Rut bai ${typeLabel}</h2>
                <p class="token-drawing__subtitle">Token ${currentNum}/${totalTokens}</p>
                <div class="token-drawing__options">
                    <div class="token-drawing__option">
                        <label class="token-drawing__label">Chon bai:</label>
                        <div class="token-card__search-wrapper">
                            <input type="text" class="token-card__search" id="token-card-search-input" placeholder="Nhap ten bai de tim kiem..." autocomplete="off" />
                            <button class="token-card__clear-btn" type="button" data-action="clear-card-selection" title="Xoa lua chon">✕</button>
                            <div class="token-card__list" id="token-card-list">${cardListHtml}</div>
                        </div>
                        <div class="token-drawing__buttons">
                            ${current.selectedCard ? `<button class="action-button action-button--secondary" type="button" data-action="token-draw-back">Quay lai</button>` : ''}
                            <button class="action-button action-button--primary" type="button" data-action="token-draw-next" ${!current.selectedCard ? 'disabled' : ''}>
                                ${currentNum < totalTokens ? 'Tiep theo' : 'Xac nhan'}
                            </button>
                        </div>
                    </div>
                    <div class="token-drawing__divider"><span>hoac</span></div>
                    <div class="token-drawing__option">
                        <button class="action-button action-button--secondary token-drawing__random-btn" type="button" data-action="token-draw-random">Rut ngau nhien</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}
