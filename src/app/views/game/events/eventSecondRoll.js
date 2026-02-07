// Event Second Roll Module - handles events with second roll on fail
import { state } from '../gameState.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { openEventResultModal } from './eventResult.js';
import { findMatchingOutcome, DESTINATION_TO_ROOM_NAME } from '../../../utils/eventEffects.js';

/**
 * Open second roll modal (triggered when first roll indicates secondRoll)
 */
export function openSecondRollModal(mountEl, eventCard, secondRollConfig) {
    state.secondRollModal = {
        isOpen: true,
        eventCard: eventCard,
        diceCount: secondRollConfig.dice || 3,
        rollResults: secondRollConfig.secondRollResults || [],
        result: null,
        inputValue: '',
    };

    console.log('[SecondRoll] Opened modal for:', eventCard.name?.vi, 'dice:', secondRollConfig.dice);
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Apply second roll result
 */
export function applySecondRollResult(mountEl) {
    if (!state.secondRollModal) return;

    const { rollResults, result, eventCard } = state.secondRollModal;
    if (result === null) return;

    const outcome = findMatchingOutcome(rollResults, result);
    state.secondRollModal = null;

    if (!outcome) {
        openEventResultModal(mountEl, 'KHONG CO GI', 'Khong co gi xay ra.', 'neutral');
        return;
    }

    const playerId = state.mySocketId;

    switch (outcome.effect) {
        case 'teleport': {
            const destination = outcome.destination;
            const rooms = state.currentGameState?.map?.revealedRooms || {};
            const targetName = DESTINATION_TO_ROOM_NAME[destination] || destination;
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
                syncGameStateToServer();
                openEventResultModal(mountEl, 'DICH CHUYEN', `Ban da bi dich chuyen den ${targetName}`, 'neutral');
            } else {
                openEventResultModal(mountEl, 'LOI', `Khong tim thay phong ${targetName}`, 'danger');
            }
            break;
        }

        case 'drawRoomTile': {
            // Draw a room tile for specified floor and teleport to it
            openEventResultModal(mountEl, 'RUT LAT PHONG', `Rut 1 lat phong tang ${outcome.floor} va dat nhan vat cua ban vao do.`, 'neutral');
            break;
        }

        default:
            openEventResultModal(mountEl, 'KET QUA', `Hieu ung: ${outcome.effect}`, 'neutral');
            break;
    }
}

// ============================================================
// RENDER FUNCTION
// ============================================================

export function renderSecondRollModal() {
    if (!state.secondRollModal?.isOpen) return '';

    const { eventCard, diceCount, result } = state.secondRollModal;
    const cardName = eventCard?.name?.vi || 'Event';
    const hasResult = result !== null;

    let bodyContent = '';
    if (hasResult) {
        bodyContent = `
            <div class="event-dice-modal__result">
                <span class="event-dice-modal__result-label">Ket qua lan 2:</span>
                <span class="event-dice-modal__result-value">${result}</span>
            </div>
            <div class="event-dice-modal__actions event-dice-modal__actions--result">
                <button class="event-dice-modal__btn event-dice-modal__btn--continue" type="button" data-action="second-roll-apply">Ap dung ket qua</button>
            </div>`;
    } else {
        bodyContent = `
            <div class="event-dice-modal__roll-info"><p>Do ${diceCount} vien xuc xac (lan 2)</p></div>
            <div class="event-dice-modal__input-group">
                <label class="event-dice-modal__label">Nhap ket qua xuc xac:</label>
                <input type="number" class="event-dice-modal__input" min="0" value="" data-input="second-roll-dice-value" placeholder="Nhap so" />
            </div>
            <div class="event-dice-modal__actions">
                <button class="event-dice-modal__btn event-dice-modal__btn--confirm" type="button" data-action="second-roll-confirm">Xac nhan</button>
                <button class="event-dice-modal__btn event-dice-modal__btn--random" type="button" data-action="second-roll-random">Ngau nhien</button>
            </div>`;
    }

    return `
        <div class="event-dice-overlay">
            <div class="event-dice-modal" data-modal-content="true">
                <header class="event-dice-modal__header">
                    <h3 class="event-dice-modal__title">${cardName} - LAN 2</h3>
                </header>
                <div class="event-dice-modal__body">
                    <p class="event-dice-modal__description">${eventCard?.text?.vi || ''}</p>
                    ${bodyContent}
                </div>
            </div>
        </div>
    `;
}
