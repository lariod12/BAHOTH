// Event Multi-Player Module - handles events affecting all players
import { state } from '../gameState.js';
import { EVENTS } from '../../../data/cardsData.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { openEventResultModal } from './eventResult.js';
import { openDamageDiceModal } from './eventDice.js';
import { getPlayerStatForDice, applyStatChange, getCharacterName } from '../characters/characterManager.js';
import { findMatchingOutcome, DESTINATION_TO_ROOM_NAME } from '../../../utils/eventEffects.js';

/**
 * Open multi-player roll modal for events that affect all players
 */
export function openMultiPlayerRollModal(mountEl, eventCard) {
    const gs = state.currentGameState;
    if (!gs) return;

    // Filter eligible players based on event conditions
    const eligiblePlayers = getEligiblePlayers(eventCard);

    if (eligiblePlayers.length === 0) {
        openEventResultModal(mountEl, eventCard.name?.vi || 'Event', 'Khong co nguoi choi nao bi anh huong.', 'neutral');
        return;
    }

    const statLabels = { speed: 'Speed', might: 'Might', sanity: 'Sanity', knowledge: 'Knowledge' };

    state.multiPlayerRollModal = {
        isOpen: true,
        eventCard: eventCard,
        eligiblePlayers: eligiblePlayers,
        currentPlayerIndex: 0,
        currentDiceCount: getPlayerStatForDice(eligiblePlayers[0].id, eventCard.rollStat),
        currentResult: null,
        results: [],
        phase: 'rolling', // 'rolling' | 'summary'
        statLabel: statLabels[eventCard.rollStat] || '',
    };

    console.log('[MultiPlayer] Opened modal for:', eventCard.name?.vi, 'eligible:', eligiblePlayers.length);
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Get players eligible for this event
 */
function getEligiblePlayers(eventCard) {
    const gs = state.currentGameState;
    if (!gs?.players) return [];

    const positions = gs.playerState?.playerPositions || {};
    const rooms = gs.map?.revealedRooms || {};

    return gs.players.filter(player => {
        const roomId = positions[player.id];
        if (!roomId) return false;
        const room = rooms[roomId];
        if (!room) return false;

        // Filter by floor
        if (eventCard.affectedFloor) {
            if (room.floor !== eventCard.affectedFloor) return false;
        }

        // Filter by specific rooms
        if (eventCard.affectedRooms) {
            const roomNameLower = (room.name || '').toLowerCase();
            const isInAffectedRoom = eventCard.affectedRooms.some(rName => {
                const targetName = DESTINATION_TO_ROOM_NAME[rName] || rName;
                return roomNameLower.includes(targetName.toLowerCase()) || room.name === targetName;
            });

            // Also check room condition (e.g., hasOutdoorWindow)
            if (eventCard.affectedRoomCondition === 'hasOutdoorWindow') {
                const hasWindow = room.hasOutdoorWindow || false;
                if (!isInAffectedRoom && !hasWindow) return false;
            } else {
                if (!isInAffectedRoom) return false;
            }
        }

        return true;
    }).map(player => ({
        id: player.id,
        characterId: player.characterId,
        name: getCharacterName(player.characterId),
    }));
}

/**
 * Apply current player's roll result and move to next
 */
export function applyMultiPlayerRollResult(mountEl) {
    if (!state.multiPlayerRollModal) return;

    const { eventCard, eligiblePlayers, currentPlayerIndex, currentResult } = state.multiPlayerRollModal;
    if (currentResult === null) return;

    const currentPlayer = eligiblePlayers[currentPlayerIndex];
    const outcome = findMatchingOutcome(eventCard.rollResults, currentResult);

    // Store result
    state.multiPlayerRollModal.results.push({
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        result: currentResult,
        outcome: outcome,
    });

    // Apply effect for this player
    if (outcome) {
        applyEffectForPlayer(currentPlayer.id, outcome, eventCard);
    }

    // Move to next player or show summary
    const nextIndex = currentPlayerIndex + 1;
    if (nextIndex < eligiblePlayers.length) {
        state.multiPlayerRollModal.currentPlayerIndex = nextIndex;
        state.multiPlayerRollModal.currentDiceCount = getPlayerStatForDice(eligiblePlayers[nextIndex].id, eventCard.rollStat);
        state.multiPlayerRollModal.currentResult = null;
        state.skipMapCentering = true;
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
    } else {
        // Show summary
        state.multiPlayerRollModal.phase = 'summary';
        state.skipMapCentering = true;
        syncGameStateToServer();
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
    }
}

/**
 * Apply effect for a specific player from multi-player roll
 */
function applyEffectForPlayer(playerId, outcome, eventCard) {
    const statLabels = { speed: 'Speed', might: 'Might', sanity: 'Sanity', knowledge: 'Knowledge' };

    switch (outcome.effect) {
        case 'nothing':
            break;
        case 'gainStat':
            applyStatChange(playerId, outcome.stat, outcome.amount || 1);
            break;
        case 'loseStat':
            applyStatChange(playerId, outcome.stat, -(outcome.amount || 1));
            break;
        case 'loseStats':
            if (outcome.stats) {
                for (const [s, amt] of Object.entries(outcome.stats)) {
                    applyStatChange(playerId, s, -amt);
                }
            }
            break;
        case 'mentalDamage':
            // For multi-player, we apply a fixed damage based on dice count
            // In a real implementation, each player would roll their own damage dice
            // For now, we note it in the results
            break;
        case 'physicalDamage':
            break;
        case 'teleportToRoom': {
            const roomName = outcome.room;
            const rooms = state.currentGameState?.map?.revealedRooms || {};
            const targetName = DESTINATION_TO_ROOM_NAME[roomName] || roomName;
            let targetRoomId = null;
            for (const [rid, room] of Object.entries(rooms)) {
                if (room.name === targetName || room.name?.includes(`(${targetName})`)) {
                    targetRoomId = rid;
                    break;
                }
            }
            if (targetRoomId) {
                if (!state.currentGameState.playerState.playerPositions) {
                    state.currentGameState.playerState.playerPositions = {};
                }
                state.currentGameState.playerState.playerPositions[playerId] = targetRoomId;
            }
            break;
        }
        default:
            break;
    }
}

/**
 * Close multi-player roll modal
 */
export function closeMultiPlayerRollModal(mountEl) {
    const results = state.multiPlayerRollModal?.results || [];
    state.multiPlayerRollModal = null;

    // Check if any player needs damage dice
    const damageResults = results.filter(r => r.outcome && (r.outcome.effect === 'mentalDamage' || r.outcome.effect === 'physicalDamage' || r.outcome.effect === 'damage'));

    // For the current player, if they have pending damage, open damage modal
    const myDamage = damageResults.find(r => r.playerId === state.mySocketId);
    if (myDamage?.outcome) {
        const o = myDamage.outcome;
        const physDice = o.effect === 'physicalDamage' ? o.dice : (o.physicalDice || 0);
        const mentDice = o.effect === 'mentalDamage' ? o.dice : (o.mentalDice || 0);
        if (physDice > 0 || mentDice > 0) {
            openDamageDiceModal(mountEl, physDice, mentDice);
            return;
        }
    }

    const playerId = state.mySocketId;
    if (state.currentGameState?.playerMoves?.[playerId] <= 0) {
        advanceToNextTurn();
    }
    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

// ============================================================
// RENDER FUNCTION
// ============================================================

export function renderMultiPlayerRollModal() {
    if (!state.multiPlayerRollModal?.isOpen) return '';

    const { eventCard, eligiblePlayers, currentPlayerIndex, currentDiceCount, currentResult, results, phase, statLabel } = state.multiPlayerRollModal;
    const cardName = eventCard?.name?.vi || 'Event';

    if (phase === 'summary') {
        const statLabels = { speed: 'Speed', might: 'Might', sanity: 'Sanity', knowledge: 'Knowledge' };
        const resultsHtml = results.map(r => {
            const effectText = r.outcome ? getEffectDescription(r.outcome) : 'Khong ro';
            return `<li><strong>${r.playerName}</strong>: ${r.result} → ${effectText}</li>`;
        }).join('');

        return `
            <div class="event-dice-overlay">
                <div class="event-dice-modal" data-modal-content="true">
                    <header class="event-dice-modal__header">
                        <h3 class="event-dice-modal__title">${cardName} - KET QUA</h3>
                    </header>
                    <div class="event-dice-modal__body">
                        <ul class="multi-roll-modal__results">${resultsHtml}</ul>
                        <div class="event-dice-modal__actions event-dice-modal__actions--result">
                            <button class="event-dice-modal__btn event-dice-modal__btn--continue" type="button" data-action="multi-roll-close">Dong</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Rolling phase
    const currentPlayer = eligiblePlayers[currentPlayerIndex];
    const hasResult = currentResult !== null;

    let bodyContent = '';
    if (hasResult) {
        bodyContent = `
            <div class="event-dice-modal__result">
                <span class="event-dice-modal__result-label">Ket qua ${currentPlayer.name}:</span>
                <span class="event-dice-modal__result-value">${currentResult}</span>
            </div>
            <div class="event-dice-modal__actions event-dice-modal__actions--result">
                <button class="event-dice-modal__btn event-dice-modal__btn--continue" type="button" data-action="multi-roll-apply">${currentPlayerIndex < eligiblePlayers.length - 1 ? 'Nguoi tiep theo' : 'Xem ket qua'}</button>
            </div>`;
    } else {
        bodyContent = `
            <div class="event-dice-modal__roll-info"><p><strong>${currentPlayer.name}</strong> do ${currentDiceCount} vien xuc xac ${statLabel}</p></div>
            <div class="event-dice-modal__input-group">
                <label class="event-dice-modal__label">Nhap ket qua xuc xac:</label>
                <input type="number" class="event-dice-modal__input" min="0" value="" data-input="multi-roll-dice-value" placeholder="Nhap so" />
            </div>
            <div class="event-dice-modal__actions">
                <button class="event-dice-modal__btn event-dice-modal__btn--confirm" type="button" data-action="multi-roll-confirm">Xac nhan</button>
                <button class="event-dice-modal__btn event-dice-modal__btn--random" type="button" data-action="multi-roll-random">Ngau nhien</button>
            </div>`;
    }

    // Show previous results
    let historyHtml = '';
    if (results.length > 0) {
        historyHtml = `<div class="event-dice-modal__history"><h4>Da do:</h4><ul>${results.map(r => `<li>${r.playerName}: ${r.result}</li>`).join('')}</ul></div>`;
    }

    return `
        <div class="event-dice-overlay">
            <div class="event-dice-modal" data-modal-content="true">
                <header class="event-dice-modal__header">
                    <h3 class="event-dice-modal__title">${cardName}</h3>
                    <span class="event-dice-modal__progress">Nguoi ${currentPlayerIndex + 1}/${eligiblePlayers.length}</span>
                </header>
                <div class="event-dice-modal__body">
                    <p class="event-dice-modal__description">${eventCard?.text?.vi || ''}</p>
                    ${historyHtml}
                    ${bodyContent}
                </div>
            </div>
        </div>
    `;
}

function getEffectDescription(outcome) {
    const statLabels = { speed: 'Speed', might: 'Might', sanity: 'Sanity', knowledge: 'Knowledge' };
    switch (outcome.effect) {
        case 'nothing': return 'Khong bi gi';
        case 'gainStat': return `+${outcome.amount} ${statLabels[outcome.stat] || outcome.stat}`;
        case 'loseStat': return `-${outcome.amount} ${statLabels[outcome.stat] || outcome.stat}`;
        case 'mentalDamage': return `${outcome.dice} xuc xac sat thuong tinh than`;
        case 'physicalDamage': return `${outcome.dice} xuc xac sat thuong vat li`;
        case 'teleportToRoom': return `Dich chuyen den ${outcome.room}`;
        default: return outcome.effect;
    }
}
