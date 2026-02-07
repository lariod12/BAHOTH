// Event Conditional Module - handles events with inventory checks
import { state } from '../gameState.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { openEventResultModal } from './eventResult.js';
import { openDamageDiceModal } from './eventDice.js';
import { applyStatChange, getCharacterName } from '../characters/characterManager.js';

/**
 * Handle conditional event (e.g., luot_cua_jonah)
 */
export function handleConditionalEvent(mountEl, eventCard) {
    const playerId = state.mySocketId;
    const gs = state.currentGameState;

    if (eventCard.id === 'luot_cua_jonah') {
        handleJonahEvent(mountEl, eventCard);
        return;
    }

    // Generic conditional handling
    if (eventCard.condition?.anyPlayerHas) {
        const itemId = eventCard.condition.anyPlayerHas;
        const playerWithItem = findPlayerWithItem(itemId);

        if (playerWithItem) {
            // Condition true
            if (eventCard.ifTrue) {
                handleConditionalTrue(mountEl, eventCard, playerWithItem, playerId);
            }
        } else {
            // Condition false
            if (eventCard.ifFalse) {
                handleConditionalFalse(mountEl, eventCard, playerId);
            }
        }
        return;
    }

    // Fallback
    openEventResultModal(mountEl, eventCard.name?.vi || 'Event', 'Event da duoc xu ly.', 'neutral');
}

/**
 * Handle Jonah's Turn event specifically
 */
function handleJonahEvent(mountEl, eventCard) {
    const playerId = state.mySocketId;
    const playerWithPuzzleBox = findPlayerWithItem('hop_lac_ghep');

    if (playerWithPuzzleBox) {
        // Remove hop_lac_ghep from that player
        removeItemFromPlayer(playerWithPuzzleBox, 'hop_lac_ghep');

        // Current player gains 1 Sanity
        applyStatChange(playerId, 'sanity', 1);

        const ownerName = getPlayerCharacterName(playerWithPuzzleBox);
        syncGameStateToServer();

        // That player draws 1 Item
        if (playerWithPuzzleBox === playerId) {
            openEventResultModal(mountEl, 'LUOT CUA JONAH', `Ban da huy bo Hop lap ghep va rut 1 la Item moi. Tang 1 Sanity.`, 'success');
            // After closing this modal, initiate item draw
            setTimeout(() => {
                import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(mountEl, ['item']));
            }, 100);
        } else {
            openEventResultModal(mountEl, 'LUOT CUA JONAH', `${ownerName} da huy bo Hop lap ghep va rut 1 la Item moi. Ban tang 1 Sanity.`, 'success');
        }
    } else {
        // No one has hop_lac_ghep - current player takes 1 mental damage die
        syncGameStateToServer();
        openDamageDiceModal(mountEl, 0, 1);
    }
}

/**
 * Handle generic conditional true case
 */
function handleConditionalTrue(mountEl, eventCard, targetPlayerId, currentPlayerId) {
    const ifTrue = eventCard.ifTrue;

    if (ifTrue.targetPlayer) {
        const tp = ifTrue.targetPlayer;
        if (tp.effect === 'discardItem' && tp.item) {
            removeItemFromPlayer(targetPlayerId, tp.item);
            if (tp.then === 'drawItem') {
                // Target player draws item - handled via pending events or direct
            }
        }
    }

    if (ifTrue.currentPlayer) {
        const cp = ifTrue.currentPlayer;
        if (cp.effect === 'gainStat') {
            applyStatChange(currentPlayerId, cp.stat, cp.amount || 1);
        }
    }

    syncGameStateToServer();
    openEventResultModal(mountEl, eventCard.name?.vi || 'Event', 'Dieu kien da duoc kich hoat!', 'success');
}

/**
 * Handle generic conditional false case
 */
function handleConditionalFalse(mountEl, eventCard, playerId) {
    const ifFalse = eventCard.ifFalse;

    if (ifFalse.effect === 'mentalDamage') {
        syncGameStateToServer();
        openDamageDiceModal(mountEl, 0, ifFalse.dice || 1);
    } else if (ifFalse.effect === 'physicalDamage') {
        syncGameStateToServer();
        openDamageDiceModal(mountEl, ifFalse.dice || 1, 0);
    } else {
        openEventResultModal(mountEl, eventCard.name?.vi || 'Event', 'Dieu kien khong duoc dat.', 'neutral');
    }
}

/**
 * Find a player who has a specific item
 */
function findPlayerWithItem(itemId) {
    const gs = state.currentGameState;
    if (!gs?.playerState?.playerCards) return null;

    for (const [pid, cards] of Object.entries(gs.playerState.playerCards)) {
        if (cards.items?.includes(itemId)) return pid;
    }
    return null;
}

/**
 * Remove an item from a player's inventory
 */
function removeItemFromPlayer(playerId, itemId) {
    const cards = state.currentGameState?.playerState?.playerCards?.[playerId];
    if (!cards?.items) return;
    const idx = cards.items.indexOf(itemId);
    if (idx >= 0) cards.items.splice(idx, 1);
}

/**
 * Get character name for a player
 */
function getPlayerCharacterName(playerId) {
    const player = state.currentGameState?.players?.find(p => p.id === playerId);
    return player ? getCharacterName(player.characterId) : 'Player';
}
