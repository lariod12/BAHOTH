// Game view entry point - replaces the monolithic gameView.js
// All logic is delegated to domain modules under game/
import { state } from './gameState.js';
import * as socketClient from '../../services/socketClient.js';
import { isHauntTriggered, getFaction, getFactionLabel, applyHauntState } from '../../utils/factionUtils.js';
import { getCharacterName, getCharacterMight, ensureCharacterDataInitialized } from './characters/characterManager.js';
import { renderGameScreen, updateGameUI } from './ui/mainRenderer.js';
import { showToast, showDebugWaitingPopup, removeDebugWaitingPopup } from './ui/notifications.js';
import { showHauntAnnouncementModal } from './omens/omenHaunt.js';
import { showCombatResultNotification, openDamageDistributionModal } from './combat/combatManager.js';
import { mapServerPhaseToLocal, markCombatCompleted } from './combat/combatCalc.js';
import { showVictoryModal } from './omens/omenHaunt.js';
import { applyStatChange } from './characters/characterManager.js';
import { syncGameStateToServer } from './turn/turnManager.js';
import { attachEventListeners } from './ui/eventListeners.js';

function setupVisibilityTracking() {
    document.addEventListener('visibilitychange', () => {
        const isVisible = document.visibilityState === 'visible';
        socketClient.setActive(isVisible);
    });
    if (document.visibilityState === 'visible') socketClient.setActive(true);
}

function checkAllPlayersActive(activePlayerIds, allPlayers, mountEl) {
    state.activePlayers = new Set(activePlayerIds);
    const allActive = allPlayers.every(p => activePlayerIds.includes(p.id));
    if (allActive && !state.introShown) hideIntro(mountEl);
}

function hideIntro(mountEl) {
    if (state.introShown) return;
    state.introShown = true;
    if (state.introTimeout) { clearTimeout(state.introTimeout); state.introTimeout = null; }
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function renderGameView({ mountEl, onNavigate, roomId, soloDebug = false }) {
    // Clone and replace mountEl to remove all existing event listeners
    const newMountEl = mountEl.cloneNode(false);
    mountEl.parentNode?.replaceChild(newMountEl, mountEl);
    mountEl = newMountEl;
    state.mountElRef = mountEl;

    // Reset state
    state.eventListenersAttached = false;
    state.isDebugMode = roomId === 'debug';
    state.isSoloDebug = soloDebug;
    state.soloDebugPlayerIds = [];
    state.sidebarOpen = false;
    state.introShown = false;
    state.movesInitializedForTurn = -1;
    state.expandedPlayers.clear();
    state.activePlayers.clear();
    state.endTurnModal = null;

    // Connect socket
    socketClient.connect();
    state.mySocketId = socketClient.getSocketId();

    // Initial loading state
    mountEl.innerHTML = renderGameScreen(null, state.mySocketId);

    // Loading timeout
    const LOADING_TIMEOUT = 10000;
    let loadingTimeoutId = setTimeout(() => {
        if (!state.currentGameState) {
            console.log('[GameView] Loading timeout - room may not exist');
            socketClient.clearSession();
            showToast('Phong khong ton tai hoac da het han', 'error', 3000);
            setTimeout(() => onNavigate('#/'), 1500);
        }
    }, LOADING_TIMEOUT);

    const clearLoadingTimeout = () => {
        if (loadingTimeoutId) { clearTimeout(loadingTimeoutId); loadingTimeoutId = null; }
    };

    let hauntAnnouncementShown = false;

    // Subscribe to game state updates
    state.unsubscribeGameState = socketClient.onGameState((serverState) => {
        clearLoadingTimeout();

        if (serverState?.isDebug) {
            // Solo debug: skip waiting, always in playing phase
            if (serverState.isSoloDebug) {
                removeDebugWaitingPopup();
                state.introShown = true;

                // Initialize solo debug player IDs on first state
                if (state.soloDebugPlayerIds.length === 0 && serverState.players?.length >= 2) {
                    state.soloDebugPlayerIds = serverState.players.map(p => p.id);
                    state.mySocketId = state.soloDebugPlayerIds[0];
                    socketClient.setSoloDebugActivePlayer(state.soloDebugPlayerIds[0]);
                    console.log('[GameView] Solo debug initialized, players:', state.soloDebugPlayerIds);
                }
            } else if (serverState.gamePhase === 'lobby' && serverState.players?.length < 2) {
                showDebugWaitingPopup();
                state.currentGameState = serverState;
                return;
            } else if (serverState.gamePhase === 'playing') {
                removeDebugWaitingPopup();
                state.introShown = true;
            }
        }

        const wasHauntTriggered = state.currentGameState?.hauntState?.hauntTriggered;
        const isHauntTriggeredNow = serverState?.hauntState?.hauntTriggered;
        const hadCombatResult = state.currentGameState?.combatResult;
        const newCombatResult = serverState?.combatResult;
        const hadGameOver = state.currentGameState?.gameOver;
        const newGameOver = serverState?.gameOver;

        const oldTurnPlayer = state.currentGameState?.turnOrder?.[state.currentGameState?.currentTurnIndex];
        const newTurnPlayer = serverState?.turnOrder?.[serverState?.currentTurnIndex];
        if (oldTurnPlayer !== newTurnPlayer && oldTurnPlayer !== undefined) {
            state.hasAttackedThisTurn = false;
            state.movesInitializedForTurn = -1;
        }

        state.currentGameState = serverState;
        if (state.isSoloDebug) {
            // Auto-switch to current turn player when turn changes
            if (newTurnPlayer && newTurnPlayer !== state.mySocketId && state.soloDebugPlayerIds.includes(newTurnPlayer)) {
                state.mySocketId = newTurnPlayer;
                socketClient.setSoloDebugActivePlayer(newTurnPlayer);
            }
        } else {
            state.mySocketId = socketClient.getSocketId();
        }
        ensureCharacterDataInitialized(state.currentGameState);

        // Show haunt announcement
        if (!wasHauntTriggered && isHauntTriggeredNow && !hauntAnnouncementShown) {
            hauntAnnouncementShown = true;
            const hauntNumber = serverState.hauntState?.hauntNumber || 0;
            const traitorId = serverState.hauntState?.traitorId;
            const traitorPlayer = serverState.players?.find(p => p.id === traitorId);
            const traitorName = traitorPlayer ? getCharacterName(traitorPlayer.characterId) : 'Unknown';
            const myFaction = getFaction(serverState, state.mySocketId);
            const amITraitor = myFaction === 'traitor';
            showHauntAnnouncementModal(mountEl, hauntNumber, traitorName, amITraitor);
        }

        // Handle combat state sync from server
        if (serverState.combatState?.isActive) {
            const sc = serverState.combatState;
            const isDefender = sc.defenderId === state.mySocketId;
            const isAttacker = sc.attackerId === state.mySocketId;
            const expectedLocalPhase = mapServerPhaseToLocal(sc.phase, isDefender);

            if (isDefender || isAttacker) {
                const shouldSync = !state.combatModal ||
                    (isDefender && state.combatModal.phase !== expectedLocalPhase) ||
                    sc.phase === 'result';

                if (shouldSync) {
                    const attacker = serverState.players?.find(p => p.id === sc.attackerId);
                    const defender = serverState.players?.find(p => p.id === sc.defenderId);
                    if (attacker && defender) {
                        const defenderFaction = getFaction(serverState, sc.defenderId);
                        state.combatModal = {
                            isOpen: true, phase: expectedLocalPhase,
                            attackerId: sc.attackerId, defenderId: sc.defenderId,
                            attackerName: getCharacterName(attacker.characterId),
                            defenderName: getCharacterName(defender.characterId),
                            defenderFactionLabel: getFactionLabel(defenderFaction),
                            attackStat: 'might',
                            attackerDiceCount: getCharacterMight(attacker.characterId, serverState.playerState?.characterData?.[sc.attackerId]),
                            defenderDiceCount: getCharacterMight(defender.characterId, serverState.playerState?.characterData?.[sc.defenderId]),
                            attackerRoll: sc.attackerRoll, defenderRoll: sc.defenderRoll,
                            inputValue: '',
                            winner: sc.winner, damage: sc.damage || 0, loserId: sc.loserId,
                            isForced: sc.isForced || false
                        };
                    }
                } else {
                    if (state.combatModal && sc.attackerRoll !== null) state.combatModal.attackerRoll = sc.attackerRoll;
                    if (state.combatModal && sc.defenderRoll !== null) state.combatModal.defenderRoll = sc.defenderRoll;
                }
            }
        } else if (!serverState.combatState?.isActive && state.combatModal) {
            const isAttackerWhoJustOpened = state.combatModal.attackerId === state.mySocketId && state.combatModal.phase === 'confirm';
            if (!isAttackerWhoJustOpened) {
                const damage = state.combatModal.damage || 0;
                const loserId = state.combatModal.loserId;
                const isForced = state.combatModal.isForced;
                const iAmLoser = loserId === state.mySocketId;

                const attackerId = state.combatModal.attackerId;
                const defenderId = state.combatModal.defenderId;
                if (attackerId && defenderId && serverState) {
                    const combatRoomId = serverState.playerState?.playerPositions?.[attackerId] || serverState.playerState?.playerPositions?.[defenderId];
                    if (combatRoomId) markCombatCompleted(combatRoomId, attackerId, defenderId);
                }

                if (state.isDebugMode && damage > 0 && loserId) {
                    applyStatChange(loserId, 'might', -damage); syncGameStateToServer();
                } else if (isForced && damage > 0 && loserId) {
                    applyStatChange(loserId, 'might', -damage); syncGameStateToServer();
                } else if (iAmLoser && damage > 0) {
                    state.combatModal = null;
                    state.pendingCombatMovement = null;
                    openDamageDistributionModal(mountEl, damage, 'combat', 'physical');
                    return;
                }
                state.combatModal = null;
                state.pendingCombatMovement = null;
            }
        }

        if (newCombatResult && !hadCombatResult) showCombatResultNotification(mountEl, newCombatResult);
        if (newGameOver && !hadGameOver) showVictoryModal(mountEl, newGameOver.winner, newGameOver.deadPlayers || []);

        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
    });

    // Subscribe to other socket events
    state.unsubscribePlayersActive = socketClient.onPlayersActive((data) => {
        checkAllPlayersActive(data.activePlayers || [], state.currentGameState?.players || [], mountEl);
    });

    state.unsubscribeReconnectResult = socketClient.onReconnectResult((result) => {
        if (result.success) { showToast('Ket noi lai thanh cong!', 'success'); }
        else if (!result.canRejoin) {
            clearLoadingTimeout(); socketClient.clearSession();
            showToast('Phong da bi huy', 'error', 3000);
            setTimeout(() => onNavigate('#/'), 1500);
        }
    });

    state.unsubscribePlayerDisconnected = socketClient.onPlayerDisconnected(({ playerId, gracePeriod }) => {
        const player = state.currentGameState?.players?.find(p => p.id === playerId);
        const playerName = player?.name || 'Player';
        const minutes = Math.round(gracePeriod / 60000);
        showToast(`${playerName} mat ket noi. Cho ${minutes} phut de ket noi lai...`, 'warning', 5000);
    });

    state.unsubscribePlayerReconnected = socketClient.onPlayerReconnected(({ playerName }) => {
        showToast(`${playerName} da ket noi lai!`, 'success');
    });

    state.unsubscribeDebugReset = socketClient.onDebugReset(() => {
        console.log('[GameView] Debug reset received, redirecting...');
        showToast('Game da duoc reset!', 'info', 2000);
        socketClient.clearSession();
        if (state.isSoloDebug) {
            setTimeout(() => onNavigate('#/game/solo-debug'), 500);
        } else {
            setTimeout(() => onNavigate('#/game/debug'), 500);
        }
    });

    setupVisibilityTracking();

    socketClient.getGameState(roomId).then((response) => {
        if (!response.success) {
            clearLoadingTimeout();
            socketClient.clearSession();
            showToast('Phong khong ton tai', 'error', 3000);
            setTimeout(() => onNavigate('#/'), 1500);
        }
    });

    attachEventListeners(mountEl, roomId);

    // Cleanup on navigate away
    window.addEventListener('hashchange', () => {
        clearLoadingTimeout();
        if (state.unsubscribeGameState) { state.unsubscribeGameState(); state.unsubscribeGameState = null; }
        if (state.unsubscribePlayersActive) { state.unsubscribePlayersActive(); state.unsubscribePlayersActive = null; }
        if (state.unsubscribeReconnectResult) { state.unsubscribeReconnectResult(); state.unsubscribeReconnectResult = null; }
        if (state.unsubscribePlayerDisconnected) { state.unsubscribePlayerDisconnected(); state.unsubscribePlayerDisconnected = null; }
        if (state.unsubscribePlayerReconnected) { state.unsubscribePlayerReconnected(); state.unsubscribePlayerReconnected = null; }
        if (state.unsubscribeDebugReset) { state.unsubscribeDebugReset(); state.unsubscribeDebugReset = null; }
        if (state.introTimeout) { clearTimeout(state.introTimeout); state.introTimeout = null; }
        state.sidebarOpen = false;
        state.introShown = false;
        state.turnOrderExpanded = false;
        state.movesInitializedForTurn = -1;
        state.expandedPlayers.clear();
        state.activePlayers.clear();
        state.endTurnModal = null;
        state.eventListenersAttached = false;
        // Clean up solo debug state
        if (state.isSoloDebug) {
            state.isSoloDebug = false;
            state.soloDebugPlayerIds = [];
            state.soloDebugPendingDamage = null;
            socketClient.setIsSoloDebug(false);
        }
    }, { once: true });
}
