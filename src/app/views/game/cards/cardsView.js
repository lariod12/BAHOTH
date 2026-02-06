// Cards view modal - view player's collected cards
import { state } from '../gameState.js';
import { getCardData } from '../items/itemInventory.js';
import { updateGameUI } from '../ui/mainRenderer.js';

export function openCardsViewModal(mountEl, cardType) {
    if (!state.currentGameState) return;
    const playerId = state.mySocketId;
    const playerCards = state.currentGameState.playerState?.playerCards?.[playerId];
    if (!playerCards) return;

    const cardIds = cardType === 'omen' ? playerCards.omens :
                    cardType === 'event' ? playerCards.events :
                    playerCards.items;
    if (!cardIds || cardIds.length === 0) return;

    state.cardsViewModal = {
        isOpen: true,
        cardType,
        cardIds,
        expandedCards: new Set()
    };
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function toggleCardExpansion(mountEl, cardId) {
    if (!state.cardsViewModal) return;
    if (state.cardsViewModal.expandedCards.has(cardId)) {
        state.cardsViewModal.expandedCards.delete(cardId);
    } else {
        state.cardsViewModal.expandedCards.add(cardId);
    }
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function closeCardsViewModal(mountEl) {
    state.cardsViewModal = null;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function renderCardsViewModal() {
    if (!state.cardsViewModal || !state.cardsViewModal.isOpen) return '';
    const typeLabels = { omen: 'Omen', event: 'Event', item: 'Item' };
    const typeLabel = typeLabels[state.cardsViewModal.cardType];

    const cardsHtml = state.cardsViewModal.cardIds.map(cardId => {
        const cardData = getCardData(state.cardsViewModal.cardType, cardId);
        if (!cardData) return '';
        const cardName = cardData.name?.vi || cardId;
        const cardText = cardData.text?.vi || '';
        const isExpanded = state.cardsViewModal.expandedCards.has(cardId);
        return `
            <div class="card-detail ${isExpanded ? 'is-expanded' : ''}">
                <div class="card-detail__header" data-action="toggle-card" data-card-id="${cardId}">
                    <h3 class="card-detail__name">${cardName}</h3>
                    <span class="card-detail__toggle">${isExpanded ? '−' : '+'}</span>
                </div>
                ${isExpanded ? `<p class="card-detail__text">${cardText}</p>` : ''}
            </div>
        `;
    }).join('');

    return `
        <div class="cards-view-overlay">
            <div class="cards-view-modal">
                <div class="cards-view__header">
                    <h2 class="cards-view__title">${typeLabel} (${state.cardsViewModal.cardIds.length})</h2>
                    <button class="cards-view__close" type="button" data-action="close-cards-view">&times;</button>
                </div>
                <div class="cards-view__content">${cardsHtml}</div>
            </div>
        </div>
    `;
}
