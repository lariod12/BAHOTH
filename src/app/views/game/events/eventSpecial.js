// Event Special Module - handles special mechanics events
import { state } from '../gameState.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { openEventResultModal } from './eventResult.js';
import { getRightPlayer } from './eventDice.js';
import { getCharacterName } from '../characters/characterManager.js';

/**
 * Handle special events (shuffleItems, drawRoomTile, relocateCurrentRoom, persistent non-roll)
 */
export function handleSpecialEvent(mountEl, eventCard) {
    const playerId = state.mySocketId;

    switch (eventCard.effect) {
        case 'shuffleItems':
            handleShuffleItems(mountEl, eventCard);
            break;
        case 'drawRoomTile':
            handleDrawRoomTile(mountEl, eventCard);
            break;
        case 'relocateCurrentRoom':
            handleRelocateRoom(mountEl, eventCard);
            break;
        default:
            // Persistent non-roll events (e.g., den_tat)
            if (eventCard.persistent && eventCard.effect === 'movementRestriction') {
                handleMovementRestriction(mountEl, eventCard);
            } else {
                openEventResultModal(mountEl, eventCard.name?.vi || 'Event', 'Event da duoc xu ly.', 'neutral');
            }
            break;
    }
}

/**
 * Handle den_tat - movement restriction persistent effect
 */
function handleMovementRestriction(mountEl, eventCard) {
    const playerId = state.mySocketId;
    const gs = state.currentGameState;

    // Add persistent movement restriction
    if (!gs.playerState.persistentEffects) {
        gs.playerState.persistentEffects = {};
    }
    if (!gs.playerState.persistentEffects[playerId]) {
        gs.playerState.persistentEffects[playerId] = [];
    }

    gs.playerState.persistentEffects[playerId].push({
        eventId: eventCard.id,
        eventName: eventCard.name?.vi || 'Event',
        movementRestriction: true,
        movesPerTurn: eventCard.movesPerTurn || 1,
        removeConditions: eventCard.removeConditions || [],
    });

    // Immediately restrict current moves
    if (gs.playerMoves[playerId] > (eventCard.movesPerTurn || 1)) {
        gs.playerMoves[playerId] = eventCard.movesPerTurn || 1;
    }

    syncGameStateToServer();
    openEventResultModal(mountEl, 'DEN TAT!', `Ban chi co the di ${eventCard.movesPerTurn || 1} buoc moi luot. Tim dong doi, Ngon nen, hoac Lo than de huy hieu ung nay.`, 'danger');
}

/**
 * Handle shuffleItems (whoops) - shuffle items, right player discards one
 */
function handleShuffleItems(mountEl, eventCard) {
    const playerId = state.mySocketId;
    const gs = state.currentGameState;
    const playerCards = gs?.playerState?.playerCards?.[playerId];
    const items = playerCards?.items || [];

    if (items.length === 0) {
        openEventResultModal(mountEl, eventCard.name?.vi || 'Whoops!', 'Ban khong co Item nao de xao.', 'neutral');
        return;
    }

    const rightPlayerId = getRightPlayer(playerId);
    if (!rightPlayerId || items.length <= 1) {
        // If only 1 item or no right player, just discard a random one
        if (items.length > 0) {
            const randomIndex = Math.floor(Math.random() * items.length);
            const discardedItem = items.splice(randomIndex, 1)[0];
            syncGameStateToServer();
            openEventResultModal(mountEl, 'WHOOPS!', `La bai Item ngau nhien da bi huy bo.`, 'danger');
        } else {
            openEventResultModal(mountEl, 'WHOOPS!', 'Khong co Item nao bi anh huong.', 'neutral');
        }
        return;
    }

    // Shuffle and right player picks one to discard (random in digital version)
    const randomIndex = Math.floor(Math.random() * items.length);
    const discardedItem = items.splice(randomIndex, 1)[0];
    const rightPlayerName = getPlayerCharacterName(rightPlayerId);

    syncGameStateToServer();
    openEventResultModal(mountEl, 'WHOOPS!', `${rightPlayerName} da chon ngau nhien 1 la Item cua ban de huy bo.`, 'danger');
}

/**
 * Handle drawRoomTile (buc_tuong_thit) - draw room and teleport
 */
function handleDrawRoomTile(mountEl, eventCard) {
    openEventResultModal(mountEl, eventCard.name?.vi || 'Event',
        'Rut 1 lat phong moi va dat no o bat cu dau trong ngoi nha. Dat nhan vat cua ban vao do. (Su dung chuc nang kham pha phong de thuc hien)',
        'neutral');
}

/**
 * Handle relocateCurrentRoom (what_the_f) - move current room
 */
function handleRelocateRoom(mountEl, eventCard) {
    openEventResultModal(mountEl, eventCard.name?.vi || 'What the F...?',
        'Nhat len lat phong ma ban dang dung va dat no vao mot cho khac trong tang nay. (Thuc hien thu cong tren ban do)',
        'neutral');
}

function getPlayerCharacterName(playerId) {
    const player = state.currentGameState?.players?.find(p => p.id === playerId);
    return player ? getCharacterName(player.characterId) : 'Player';
}
