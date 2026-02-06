// Event result modal - shows outcome of event rolls
import { state } from '../gameState.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { advanceToNextTurn, syncGameStateToServer } from '../turn/turnManager.js';

export function openEventResultModal(mountEl, title, message, type = 'neutral') {
    state.eventResultModal = {
        isOpen: true,
        title: title,
        message: message,
        type: type
    };
    console.log('[EventResult] Opened modal -', title, message);
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function closeEventResultModal(mountEl) {
    state.eventResultModal = null;
    const playerId = state.mySocketId;

    if (state.currentGameState && state.currentGameState.playerMoves[playerId] <= 0) {
        console.log('[Turn] Player', playerId, 'moves depleted after event result, advancing turn');
        advanceToNextTurn();
    }

    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
    syncGameStateToServer();
}

export function renderEventResultModal() {
    if (!state.eventResultModal?.isOpen) return '';

    const { title, message, type } = state.eventResultModal;
    const typeClass = type === 'success' ? 'event-result-modal--success'
        : type === 'danger' ? 'event-result-modal--danger'
        : 'event-result-modal--neutral';
    const icon = type === 'success' ? '✓' : type === 'danger' ? '✗' : 'ℹ';

    return `
        <div class="event-result-overlay" data-action="close-event-result">
            <div class="event-result-modal ${typeClass}" data-modal-content="true">
                <div class="event-result-modal__icon">${icon}</div>
                <h3 class="event-result-modal__title">${title}</h3>
                <p class="event-result-modal__message">${message}</p>
                <p class="event-result-modal__hint">Tap de dong</p>
            </div>
        </div>
    `;
}
