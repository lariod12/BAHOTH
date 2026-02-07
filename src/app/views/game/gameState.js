// Centralized game state - shared across all game modules
// All modules import { state } from this file and access/mutate the same object

export const state = {
    // === CORE GAME STATE ===
    /** @type {any} */
    currentGameState: null,
    /** @type {string|null} */
    mySocketId: null,
    /** @type {HTMLElement|null} */
    mountElRef: null,

    // === UI FLAGS ===
    sidebarOpen: false,
    introShown: false,
    /** @type {any} */
    introTimeout: null,
    turnOrderExpanded: false,
    skipMapCentering: false,
    tutorialOpen: false,
    tokenDetailOpen: false,
    tokenPromptModal: null,
    lastTokenPromptKey: null,
    isDebugMode: false,
    isSoloDebug: false,
    /** @type {string[]} */
    soloDebugPlayerIds: [],
    /** @type {{ loserId: string; damage: number } | null} */
    soloDebugPendingDamage: null,
    eventListenersAttached: false,
    showingDiceResults: false,
    /** @type {any} */
    diceResultsTimeout: null,

    // === PLAYER TRACKING ===
    /** @type {Set<string>} */
    expandedPlayers: new Set(),
    /** @type {Set<string>} */
    activePlayers: new Set(),

    // === TURN TRACKING ===
    movesInitializedForTurn: -1,
    /** @type {number|null} */
    secretPassagePromptedTurnIndex: null,
    /** @type {string|null} */
    secretPassagePromptedPlayerId: null,

    // === COMBAT STATE ===
    /** @type {boolean} */
    hasAttackedThisTurn: false,
    /** @type {Map<string, boolean>} */
    completedCombats: new Map(),
    /** @type {{ direction: string; targetRoomId: string } | null} */
    pendingCombatMovement: null,
    /** @type {any} */
    pendingMentalDamage: null,
    /** @type {{ eventCard: object; outcome: object } | null} */
    pendingTrappedEffect: null,

    // === MYSTIC ELEVATOR ===
    /** @type {Map<string, string>} */
    mysticElevatorPositions: new Map(),

    // === MODAL STATES ===
    /** @type {any} */
    roomDiscoveryModal: null,
    /** @type {any} */
    tokenDrawingModal: null,
    /** @type {any} */
    cardsViewModal: null,
    /** @type {any} */
    returnItemModal: null,
    /** @type {any} */
    diceEventModal: null,
    /** @type {any} */
    endTurnModal: null,
    /** @type {any} */
    resetGameModal: null,
    /** @type {any} */
    eventDiceModal: null,
    /** @type {any} */
    damageDiceModal: null,
    /** @type {any} */
    roomEffectDiceModal: null,
    /** @type {any} */
    combatModal: null,
    /** @type {any} */
    damageDistributionModal: null,
    /** @type {any} */
    eventResultModal: null,
    /** @type {any} */
    statChoiceModal: null,
    /** @type {any} */
    roomSelectModal: null,
    /** @type {any} */
    statChangeNotification: null,
    /** @type {any} */
    multiRollSummary: null,
    /** @type {any} */
    trappedEscapeModal: null,
    /** @type {any} */
    teleportChoiceModal: null,
    /** @type {any} */
    rescueTrappedModal: null,
    /** @type {any} */
    persistentDamageModal: null,
    /** @type {any} */
    optionalRollModal: null,
    /** @type {any} */
    choiceModal: null,
    /** @type {any} */
    peekModal: null,
    /** @type {any} */
    storeDiceModal: null,
    /** @type {any} */
    tokenPlacementModal: null,
    /** @type {any} */
    tokenInteractionModal: null,
    /** @type {any} */
    multiPlayerRollModal: null,
    /** @type {any} */
    secondRollModal: null,
    /** @type {{ roomId: string; tokenType: string } | null} */
    pendingTokenPromptAfterDamage: null,

    // === SOCKET SUBSCRIPTIONS ===
    /** @type {(() => void)|null} */
    unsubscribeGameState: null,
    /** @type {(() => void)|null} */
    unsubscribePlayersActive: null,
    /** @type {(() => void)|null} */
    unsubscribeReconnectResult: null,
    /** @type {(() => void)|null} */
    unsubscribePlayerDisconnected: null,
    /** @type {(() => void)|null} */
    unsubscribePlayerReconnected: null,
    /** @type {(() => void)|null} */
    unsubscribeDebugReset: null,
};

// Room constants
export const DICE_ROLL_ROOMS = new Set([
    'Catacombs',
    'Chasm',
    'Pentagram Chamber',
    'Collapsed Room',
    'Graveyard',
    'Junk Room',
    'Vault',
    'Tower',
    'Attic',
    'Mystic Elevator',
]);

export const ROOM_EFFECTS = {
    'Collapsed Room': {
        trigger: 'enter',
        rollStat: 'speed',
        target: 5,
        description: {
            vi: 'Phong sap! Ban phai roll Speed 5+ de tranh roi xuong.',
            en: 'Collapsed Room! Roll Speed 5+ to avoid falling.'
        },
        failEffect: { type: 'fallToBasement', damageType: 'physical', dice: 1 },
        continueOnFail: false
    },
    'Chasm': {
        trigger: 'enter',
        rollStat: 'speed',
        target: 3,
        description: {
            vi: 'Khe vuc! Roll Speed 3+ de bang qua.',
            en: 'Chasm! Roll Speed 3+ to cross.'
        },
        failEffect: { type: 'stopMoving' },
        continueOnFail: false
    },
    'Tower': {
        trigger: 'enter',
        rollStat: 'might',
        target: 3,
        description: {
            vi: 'Thap! Roll Might 3+ de bang qua.',
            en: 'Tower! Roll Might 3+ to cross.'
        },
        failEffect: { type: 'stopMoving' },
        continueOnFail: false
    },
    'Catacombs': {
        trigger: 'enter',
        rollStat: 'sanity',
        target: 6,
        description: {
            vi: 'Ham mo! Roll Sanity 6+ de bang qua.',
            en: 'Catacombs! Roll Sanity 6+ to cross.'
        },
        failEffect: { type: 'stopMoving' },
        continueOnFail: false
    },
    'Graveyard': {
        trigger: 'exit',
        rollStat: 'sanity',
        target: 4,
        description: {
            vi: 'Nghia dia! Roll Sanity 4+ khi roi di.',
            en: 'Graveyard! Roll Sanity 4+ when leaving.'
        },
        failEffect: { type: 'statLoss', stat: 'knowledge', amount: 1 },
        continueOnFail: true
    },
    'Pentagram Chamber': {
        trigger: 'exit',
        rollStat: 'knowledge',
        target: 4,
        description: {
            vi: 'Phong ngu giac! Roll Knowledge 4+ khi roi di.',
            en: 'Pentagram Chamber! Roll Knowledge 4+ when leaving.'
        },
        failEffect: { type: 'statLoss', stat: 'sanity', amount: 1 },
        continueOnFail: true
    },
    'Junk Room': {
        trigger: 'exit',
        rollStat: 'might',
        target: 3,
        description: {
            vi: 'Phong do dac! Roll Might 3+ khi roi di.',
            en: 'Junk Room! Roll Might 3+ when leaving.'
        },
        failEffect: { type: 'statLoss', stat: 'speed', amount: 1 },
        continueOnFail: true
    },
    'Attic': {
        trigger: 'exit',
        rollStat: 'speed',
        target: 3,
        description: {
            vi: 'Gac mai! Roll Speed 3+ khi roi di.',
            en: 'Attic! Roll Speed 3+ when leaving.'
        },
        failEffect: { type: 'statLoss', stat: 'might', amount: 1 },
        continueOnFail: true
    }
};

/**
 * Reset all modal states (for fresh game)
 */
export function resetAllModalStates() {
    state.roomDiscoveryModal = null;
    state.tokenDrawingModal = null;
    state.cardsViewModal = null;
    state.returnItemModal = null;
    state.diceEventModal = null;
    state.endTurnModal = null;
    state.resetGameModal = null;
    state.eventDiceModal = null;
    state.damageDiceModal = null;
    state.roomEffectDiceModal = null;
    state.combatModal = null;
    state.damageDistributionModal = null;
    state.eventResultModal = null;
    state.statChoiceModal = null;
    state.roomSelectModal = null;
    state.statChangeNotification = null;
    state.multiRollSummary = null;
    state.trappedEscapeModal = null;
    state.teleportChoiceModal = null;
    state.rescueTrappedModal = null;
    state.persistentDamageModal = null;
    state.pendingCombatMovement = null;
    state.pendingMentalDamage = null;
    state.pendingTrappedEffect = null;
    state.optionalRollModal = null;
    state.choiceModal = null;
    state.peekModal = null;
    state.storeDiceModal = null;
    state.tokenPlacementModal = null;
    state.tokenInteractionModal = null;
    state.multiPlayerRollModal = null;
    state.secondRollModal = null;
}
