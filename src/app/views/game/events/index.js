// Events group - public API
export {
    checkEventRequiresImmediateRoll,
    getEventCardById,
    openEventDiceModal,
    openDamageDiceModal,
    applyEventDiceResult,
    closeEventDiceModal,
    closeDamageDiceModal,
    closeTeleportChoiceModal,
} from './eventDice.js';

export {
    openEventResultModal,
    closeEventResultModal,
    renderEventResultModal,
} from './eventResult.js';

export {
    handleReflectionEvent,
    openReturnItemModal,
    confirmReturnItemSelection,
    renderReturnItemModal,
} from './eventReflection.js';

export {
    applyTrappedEffect,
    getPlayerTrappedInfo,
    getTrappedAllyInRoom,
    openTrappedEscapeModal,
    openRescueTrappedModal,
    renderTrappedEscapeModal,
    renderRescueTrappedModal,
    handleTrappedEscapeResult,
    handleRescueResult,
} from './eventTrapped.js';

export {
    applyPersistentEffect,
    applyPersistentTurnEffect,
    openPersistentDamageModal,
    closePersistentDamageModal,
    renderPersistentDamageModal,
} from './eventPersistent.js';

export {
    ensurePendingEventsState,
    queuePendingEvent,
    removePendingEvent,
} from './pendingEvents.js';
