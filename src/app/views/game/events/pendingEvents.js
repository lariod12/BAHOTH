// Pending event queue management
import { state } from '../gameState.js';

export function ensurePendingEventsState() {
    if (!state.currentGameState.playerState) {
        state.currentGameState.playerState = {};
    }
    if (!state.currentGameState.playerState.pendingEvents) {
        state.currentGameState.playerState.pendingEvents = {};
    }
}

export function queuePendingEvent(playerId, eventId, sourcePlayerId) {
    ensurePendingEventsState();
    const pending = state.currentGameState.playerState.pendingEvents;
    if (!pending[playerId]) {
        pending[playerId] = [];
    }
    pending[playerId].push({ id: eventId, sourcePlayerId });
}

export function removePendingEvent(playerId, eventId) {
    const pending = state.currentGameState?.playerState?.pendingEvents?.[playerId];
    if (!pending || pending.length === 0) return null;
    const index = pending.findIndex(entry => entry.id === eventId);
    if (index === -1) return null;
    const [removed] = pending.splice(index, 1);
    if (pending.length === 0) {
        delete state.currentGameState.playerState.pendingEvents[playerId];
    }
    return removed;
}
