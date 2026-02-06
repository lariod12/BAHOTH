// Reflection event (Anh Phan Chieu 2) - return item mechanic
import { state } from '../gameState.js';
import { EVENTS } from '../../../data/cardsData.js';
import { getPlayerItemIds, playerHasAnyItem, getPlayersWithItems, getCardData } from '../items/itemInventory.js';
import { getCharacterName, applyStatChange } from '../characters/characterManager.js';
import { queuePendingEvent, removePendingEvent } from './pendingEvents.js';
import { openEventResultModal } from './eventResult.js';
import { syncGameStateToServer } from '../turn/turnManager.js';
import { updateGameUI } from '../ui/mainRenderer.js';

export function openReturnItemModal(mountEl, playerId, eventCard) {
    const itemIds = getPlayerItemIds(playerId);
    if (itemIds.length === 0) return false;

    state.returnItemModal = {
        isOpen: true,
        playerId,
        eventId: eventCard.id,
        itemIds: [...itemIds],
        selectedItemId: null
    };

    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
    return true;
}

export function confirmReturnItemSelection(mountEl) {
    if (!state.returnItemModal || !state.currentGameState) return;

    const { playerId, selectedItemId, eventId } = state.returnItemModal;
    if (!selectedItemId) return;

    const playerCards = state.currentGameState.playerState?.playerCards?.[playerId];
    if (!playerCards || !playerCards.items) return;

    const itemIndex = playerCards.items.indexOf(selectedItemId);
    if (itemIndex === -1) return;

    playerCards.items.splice(itemIndex, 1);
    applyStatChange(playerId, 'knowledge', 1);
    removePendingEvent(playerId, eventId);

    const itemCard = getCardData('item', selectedItemId);
    const itemName = itemCard?.name?.vi || selectedItemId;

    state.returnItemModal = null;
    syncGameStateToServer();
    openEventResultModal(mountEl, 'ANH PHAN CHIEU (2)', `Ban da tra ve ${itemName} va +1 Kien thuc.`, 'success');
}

export function handleReflectionEvent(mountEl, eventCard, triggeringPlayerId) {
    if (!state.currentGameState || !eventCard) return false;

    if (playerHasAnyItem(triggeringPlayerId)) {
        if (triggeringPlayerId !== state.mySocketId) return false;
        return openReturnItemModal(mountEl, triggeringPlayerId, eventCard);
    }

    const eligiblePlayers = getPlayersWithItems();
    if (eligiblePlayers.length === 0) {
        if (triggeringPlayerId === state.mySocketId) {
            openEventResultModal(mountEl, 'ANH PHAN CHIEU (2)', 'Khong ai co Item. La event nay bi huy bo.', 'neutral');
        }
        return true;
    }

    const randomIndex = Math.floor(Math.random() * eligiblePlayers.length);
    const selectedPlayer = eligiblePlayers[randomIndex];

    if (selectedPlayer.id === triggeringPlayerId && triggeringPlayerId === state.mySocketId) {
        return openReturnItemModal(mountEl, triggeringPlayerId, eventCard);
    }

    queuePendingEvent(selectedPlayer.id, eventCard.id, triggeringPlayerId);
    syncGameStateToServer();

    if (triggeringPlayerId === state.mySocketId) {
        const selectedName = getCharacterName(selectedPlayer.characterId);
        openEventResultModal(mountEl, 'ANH PHAN CHIEU (2)', `Su kien se xay ra voi ${selectedName} khi den luot cua ho.`, 'neutral');
    }

    return true;
}

export function renderReturnItemModal() {
    if (!state.returnItemModal?.isOpen) return '';

    const eventCard = EVENTS.find(card => card.id === state.returnItemModal.eventId);
    const eventTitle = eventCard?.name?.vi || 'Anh phan chieu (2)';
    const eventText = eventCard?.text?.vi || 'Chon 1 Item de tra ve chong bai.';

    const itemsHtml = state.returnItemModal.itemIds.map(itemId => {
        const itemCard = getCardData('item', itemId);
        const itemName = itemCard?.name?.vi || itemId;
        const isSelected = state.returnItemModal.selectedItemId === itemId;
        return `
            <div class="token-card__item ${isSelected ? 'is-selected' : ''}" data-action="return-item-select" data-item-id="${itemId}">
                ${itemName}
            </div>
        `;
    }).join('');

    return `
        <div class="token-drawing-overlay">
            <div class="token-drawing-modal">
                <h2 class="token-drawing__title">${eventTitle}</h2>
                <p class="token-drawing__subtitle">${eventText}</p>
                <div class="token-drawing__options">
                    <div class="token-drawing__option">
                        <label class="token-drawing__label">Chon 1 Item de tra ve chong bai:</label>
                        <div class="token-card__list">${itemsHtml}</div>
                        <div class="token-drawing__buttons">
                            <button class="action-button action-button--primary" type="button" data-action="return-item-confirm" ${!state.returnItemModal.selectedItemId ? 'disabled' : ''}>
                                Xac nhan
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
