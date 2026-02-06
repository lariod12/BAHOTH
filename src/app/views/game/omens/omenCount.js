// Omen counting and available cards filtering
import { state } from '../gameState.js';
import { getCardsByType } from '../items/itemInventory.js';

export function getUsedCardIds() {
    const used = { omens: [], events: [], items: [] };
    if (!state.currentGameState) return used;

    const allPlayerCards = state.currentGameState.playerState?.playerCards || {};
    for (const playerId in allPlayerCards) {
        const playerCards = allPlayerCards[playerId];
        if (playerCards.omens) used.omens.push(...playerCards.omens);
        if (playerCards.events) used.events.push(...playerCards.events);
        if (playerCards.items) used.items.push(...playerCards.items);
    }

    if (state.tokenDrawingModal && state.tokenDrawingModal.tokensToDrawn) {
        state.tokenDrawingModal.tokensToDrawn.forEach((token, idx) => {
            if (idx < state.tokenDrawingModal.currentIndex && token.selectedCard) {
                const cardType = token.type === 'omen' ? 'omens' : token.type === 'event' ? 'events' : 'items';
                used[cardType].push(token.selectedCard);
            }
        });
    }

    return used;
}

export function getTotalOmenCount() {
    const used = getUsedCardIds();
    return used.omens.length;
}

export function getAvailableCards(type) {
    const allCards = getCardsByType(type);
    const usedCards = getUsedCardIds();
    const usedList = type === 'omen' ? usedCards.omens : type === 'event' ? usedCards.events : usedCards.items;

    const usedCount = {};
    usedList.forEach(cardId => {
        usedCount[cardId] = (usedCount[cardId] || 0) + 1;
    });

    return allCards.filter(card => {
        const count = usedCount[card.id] || 0;
        if (card.id === 'anh_phan_chieu' || card.id === 'anh_phan_chieu_2') {
            return count < 1;
        }
        return count < 1;
    });
}
