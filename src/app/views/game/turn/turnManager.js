// Turn management - advance, end turn, sync to server
import { state } from '../gameState.js';
import { getCharacterSpeed } from '../characters/characterManager.js';
import { tryPromptSecretPassageBeforeTurnEnd } from '../omens/omenSpecial.js';
import * as socketClient from '../../../services/socketClient.js';

export function isMyTurn(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return false;
    const currentPlayer = gameState.turnOrder[gameState.currentTurnIndex];
    return currentPlayer === myId;
}

export function needsToRoll(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'rolling') return false;
    return !gameState.diceRolls[myId] && gameState.needsRoll?.includes(myId);
}

export function advanceToNextTurn() {
    if (!state.currentGameState || !state.currentGameState.turnOrder?.length) {
        console.log('[Turn] Cannot advance - no game state or turn order');
        return;
    }

    if (tryPromptSecretPassageBeforeTurnEnd()) {
        console.log('[Turn] Secret Passage prompt opened before turn advance');
        return;
    }

    const prevIndex = state.currentGameState.currentTurnIndex;
    const prevPlayerId = state.currentGameState.turnOrder[prevIndex];

    state.currentGameState.currentTurnIndex = (state.currentGameState.currentTurnIndex + 1) % state.currentGameState.turnOrder.length;

    const nextIndex = state.currentGameState.currentTurnIndex;
    const nextPlayerId = state.currentGameState.turnOrder[nextIndex];
    const nextPlayer = state.currentGameState.players.find(p => p.id === nextPlayerId);

    if (nextPlayer) {
        const isTrapped = state.currentGameState.playerState?.trappedPlayers?.[nextPlayerId];
        const nextCharData = state.currentGameState.playerState?.characterData?.[nextPlayerId];
        const speed = getCharacterSpeed(nextPlayer.characterId, nextCharData);

        if (isTrapped) {
            state.currentGameState.playerMoves[nextPlayerId] = 0;
            console.log('[Turn] === TURN ADVANCED (TRAPPED PLAYER) ===');
            console.log('[Turn] Next player is trapped! turnsTrapped:', isTrapped.turnsTrapped);
        } else {
            // Check for movement restriction (den_tat)
            const persistentEffects = state.currentGameState.playerState?.persistentEffects?.[nextPlayerId] || [];
            const movementRestriction = persistentEffects.find(e => e.movementRestriction);
            if (movementRestriction) {
                const restrictedMoves = movementRestriction.movesPerTurn || 1;
                state.currentGameState.playerMoves[nextPlayerId] = Math.min(speed, restrictedMoves);
                console.log('[Turn] Movement restricted to', restrictedMoves, 'by', movementRestriction.eventName);

                // Check remove conditions
                checkMovementRestrictionRemoval(nextPlayerId, movementRestriction);
            } else {
                state.currentGameState.playerMoves[nextPlayerId] = speed;
            }
        }

        console.log('[Turn] === TURN ADVANCED ===');
        console.log('[Turn] Previous: Player', prevPlayerId, 'Index:', prevIndex);
        console.log('[Turn] Next: Player', nextPlayerId, 'Index:', nextIndex, 'Speed:', speed, 'Trapped:', !!isTrapped);
        console.log('[Turn] TurnOrder:', state.currentGameState.turnOrder);
        console.log('[Turn] PlayerMoves:', state.currentGameState.playerMoves);
    } else {
        console.log('[Turn] ERROR: Next player not found:', nextPlayerId);
    }

    state.hasAttackedThisTurn = false;
    state.secretPassagePromptedTurnIndex = null;
    state.secretPassagePromptedPlayerId = null;
    console.log('[Turn] Reset hasAttackedThisTurn flag');
}

function checkMovementRestrictionRemoval(playerId, restriction) {
    const gs = state.currentGameState;
    const conditions = restriction.removeConditions || [];
    const positions = gs?.playerState?.playerPositions || {};
    const rooms = gs?.map?.revealedRooms || {};
    const playerRoom = positions[playerId];

    for (const cond of conditions) {
        if (cond === 'sameRoomWithPlayer') {
            // Check if another player is in the same room
            for (const [pid, roomId] of Object.entries(positions)) {
                if (pid !== playerId && roomId === playerRoom) {
                    removeMovementRestriction(playerId, restriction);
                    console.log('[Turn] Movement restriction removed: same room with player');
                    return;
                }
            }
        }
        if (cond === 'hasCandle') {
            const cards = gs?.playerState?.playerCards?.[playerId];
            if (cards?.items?.includes('ngon_nen')) {
                removeMovementRestriction(playerId, restriction);
                console.log('[Turn] Movement restriction removed: has candle');
                return;
            }
        }
        if (cond === 'inFurnaceRoom') {
            const room = rooms[playerRoom];
            if (room && (room.name === 'Furnace Room' || room.name?.includes('(Furnace Room)'))) {
                removeMovementRestriction(playerId, restriction);
                console.log('[Turn] Movement restriction removed: in Furnace Room');
                return;
            }
        }
    }
}

function removeMovementRestriction(playerId, restriction) {
    const effects = state.currentGameState?.playerState?.persistentEffects?.[playerId];
    if (!effects) return;
    const idx = effects.indexOf(restriction);
    if (idx >= 0) effects.splice(idx, 1);

    // Restore normal speed
    const player = state.currentGameState?.players?.find(p => p.id === playerId);
    if (player) {
        const charData = state.currentGameState?.playerState?.characterData?.[playerId];
        const speed = getCharacterSpeed(player.characterId, charData);
        state.currentGameState.playerMoves[playerId] = speed;
    }
}

export function handleEndTurn(mountEl) {
    if (!state.currentGameState || state.currentGameState.gamePhase !== 'playing') return;

    const playerId = state.mySocketId;
    const currentTurnPlayer = state.currentGameState.turnOrder[state.currentGameState.currentTurnIndex];

    if (playerId !== currentTurnPlayer) {
        console.log('[Turn] Cannot end turn - not your turn. You:', playerId, 'Current:', currentTurnPlayer);
        return;
    }

    console.log('[Turn] Player', playerId, 'ending turn early');
    state.currentGameState.playerMoves[playerId] = 0;
    advanceToNextTurn();
    syncGameStateToServer();

    // Dynamic import to avoid circular dependency at module level
    import('../ui/mainRenderer.js').then(m => m.updateGameUI(mountEl, state.currentGameState, state.mySocketId));
}

export async function syncGameStateToServer() {
    try {
        const result = await socketClient.syncGameState({
            playerMoves: state.currentGameState.playerMoves,
            playerPositions: state.currentGameState.playerState?.playerPositions,
            map: state.currentGameState.map,
            drawnRooms: state.currentGameState.playerState?.drawnRooms,
            playerCards: state.currentGameState.playerState?.playerCards,
            playerState: {
                characterData: state.currentGameState.playerState?.characterData,
                trappedPlayers: state.currentGameState.playerState?.trappedPlayers,
                pendingEvents: state.currentGameState.playerState?.pendingEvents,
                persistentEffects: state.currentGameState.playerState?.persistentEffects,
                storedDice: state.currentGameState.playerState?.storedDice,
                pendingStatChoices: state.currentGameState.playerState?.pendingStatChoices,
            },
            currentTurnIndex: state.currentGameState.currentTurnIndex,
            combatState: state.currentGameState.combatState || null,
            combatResult: state.currentGameState.combatResult || null,
            gameOver: state.currentGameState.gameOver || null,
            roomTokenEffects: state.currentGameState.roomTokenEffects || null,
            tokenInteractions: state.currentGameState.tokenInteractions || null,
        });
        console.log('[Sync] Game state synced to server:', result);
    } catch (error) {
        console.error('[Sync] Failed to sync game state:', error);
    }
}

export function centerMapOnPlayer(mountEl, smooth = false) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const gameMap = mountEl.querySelector('.game-map');
            const grid = mountEl.querySelector('.game-map__grid');
            if (!gameMap || !grid) return;

            const playerCol = parseInt(gameMap.dataset.playerCol) || 0;
            const playerRow = parseInt(gameMap.dataset.playerRow) || 0;
            if (playerCol === 0 && playerRow === 0) return;

            const cellSize = 96;
            const gridStyle = getComputedStyle(grid);
            const paddingLeft = parseFloat(gridStyle.paddingLeft) || 0;
            const paddingTop = parseFloat(gridStyle.paddingTop) || 0;

            const playerCellX = (playerCol - 1) * cellSize;
            const playerCellY = (playerRow - 1) * cellSize;
            const targetX = paddingLeft + playerCellX + (cellSize / 2);
            const targetY = paddingTop + playerCellY + (cellSize / 2);
            const scrollX = targetX - (gameMap.clientWidth / 2);
            const scrollY = targetY - (gameMap.clientHeight / 2);

            gameMap.scrollTo({
                left: Math.max(0, scrollX),
                top: Math.max(0, scrollY),
                behavior: smooth ? 'smooth' : 'instant'
            });
        });
    });
}

export function centerMapOnPreview(mountEl, smooth = false) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const gameMap = mountEl.querySelector('.game-map');
            const grid = mountEl.querySelector('.game-map__grid');
            if (!gameMap || !grid) return;

            const previewCol = parseInt(gameMap.dataset.previewCol) || 0;
            const previewRow = parseInt(gameMap.dataset.previewRow) || 0;
            if (previewCol === 0 && previewRow === 0) return;

            const cellSize = 96;
            const gridStyle = getComputedStyle(grid);
            const paddingLeft = parseFloat(gridStyle.paddingLeft) || 0;
            const paddingTop = parseFloat(gridStyle.paddingTop) || 0;

            const previewCellX = (previewCol - 1) * cellSize;
            const previewCellY = (previewRow - 1) * cellSize;
            const targetX = paddingLeft + previewCellX + (cellSize / 2);
            const targetY = paddingTop + previewCellY + (cellSize / 2);
            const scrollX = targetX - (gameMap.clientWidth / 2);
            const scrollY = targetY - (gameMap.clientHeight / 2);

            gameMap.scrollTo({
                left: Math.max(0, scrollX),
                top: Math.max(0, scrollY),
                behavior: smooth ? 'smooth' : 'instant'
            });
        });
    });
}
