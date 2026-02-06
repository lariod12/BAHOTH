// Item inventory management
import { state } from '../gameState.js';
import { ITEMS, EVENTS, OMENS } from '../../../data/cardsData.js';

export function getCardData(type, cardId) {
    const deck = type === 'omen' ? OMENS : type === 'event' ? EVENTS : ITEMS;
    return deck.find(c => c.id === cardId);
}

export function getCardsByType(type) {
    return type === 'omen' ? OMENS : type === 'event' ? EVENTS : ITEMS;
}

export function getPlayerItemIds(playerId) {
    return state.currentGameState?.playerState?.playerCards?.[playerId]?.items || [];
}

export function playerHasAnyItem(playerId) {
    return getPlayerItemIds(playerId).length > 0;
}

export function getPlayersWithItems(excludeIds = []) {
    const exclude = new Set(excludeIds);
    const players = state.currentGameState?.players || [];
    return players.filter(player => !exclude.has(player.id) && playerHasAnyItem(player.id));
}
