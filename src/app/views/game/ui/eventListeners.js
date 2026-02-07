// Event listeners - central delegated click/input handler
// Routes actions to domain-specific handlers via imports
import { state } from '../gameState.js';
import { ROOMS } from '../../../data/mapsData.js';
import * as socketClient from '../../../services/socketClient.js';
import { isHauntTriggered, getFaction, applyHauntState } from '../../../utils/factionUtils.js';
import { findMatchingOutcome } from '../../../utils/eventEffects.js';
import { getCharacterName } from '../characters/characterManager.js';
import { applyStatChange } from '../characters/characterManager.js';
import { updateGameUI, openCharacterModal, closeCharacterModal } from './mainRenderer.js';
import { showToast } from './notifications.js';
import { syncGameStateToServer, advanceToNextTurn, centerMapOnPlayer, handleEndTurn } from '../turn/turnManager.js';
import { handleMove, handleMoveAfterStairs, handleMoveAfterElevator, handleRoomDiscovery, handleRandomRoomDiscovery, cancelRoomDiscovery } from '../movement/moveHandler.js';
import { findFirstValidRotation } from '../movement/roomUtils.js';
import { applyRoomEffectDiceResult } from '../movement/roomEffects.js';
import { handleCardSelect, handleRandomCardDraw, handleTokenDrawNext } from '../cards/tokenDrawing.js';
import { openCardsViewModal, toggleCardExpansion, closeCardsViewModal } from '../cards/cardsView.js';
import { calculateCombatResult } from '../combat/combatCalc.js';
import { closeCombatModal, openDamageDistributionModal, closeDamageDistributionModal } from '../combat/combatManager.js';
import { applyEventDiceResult, closeEventDiceModal, closeDamageDiceModal, closeTeleportChoiceModal } from '../events/eventDice.js';
import { getPlayerStatForDice } from '../characters/characterManager.js';
import { openEventResultModal, closeEventResultModal } from '../events/eventResult.js';
import { confirmReturnItemSelection } from '../events/eventReflection.js';
import { showHauntAnnouncementModal } from '../omens/omenHaunt.js';
import { openRoomSelectModal, handleRoomSelectChoice, placeSpecialToken, getRevealedRoomsByFloor, getRoomsWithSpecialToken, isRoomSelectableForRoomSelect } from '../omens/omenSpecial.js';

export function attachEventListeners(mountEl, roomId) {
    if (state.eventListenersAttached) {
        console.log('[EventListeners] Already attached, skipping');
        return;
    }
    state.eventListenersAttached = true;

    // Main click handler (delegated)
    mountEl.addEventListener('click', async (e) => {
        const target = e.target;
        const actionEl = target.closest('[data-action]');
        const action = target.dataset.action || actionEl?.dataset.action;

        // Block non-room-select actions when room select is active
        const roomSelectActive = state.roomSelectModal && (state.roomSelectModal.isOpen || state.roomSelectModal.selectionMode === 'map' || state.roomSelectModal.showConfirmModal);
        if (roomSelectActive && action && !['room-select-floor', 'room-select-choice', 'room-select-confirm', 'room-select-mode', 'room-select-confirm-map', 'room-select-cancel-map', 'room-select-skip', 'room-select-toggle', 'room-select-item'].includes(action)) {
            return;
        }

        const isInsideModal = target.closest('.combat-overlay') || target.closest('.damage-dice-overlay') || target.closest('.room-effect-dice-overlay') || target.closest('.event-dice-overlay');

        // Click outside sidebar to close
        if (state.sidebarOpen && !isInsideModal) {
            const sidebar = mountEl.querySelector('.game-sidebar');
            const toggleBtn = mountEl.querySelector('.sidebar-toggle');
            const cvModal = mountEl.querySelector('.cards-view-overlay');
            if (!sidebar?.contains(target) && !toggleBtn?.contains(target) && !cvModal?.contains(target)) {
                state.sidebarOpen = false;
                const sb = mountEl.querySelector('.game-sidebar');
                if (sb) sb.classList.remove('is-open');
            }
        }

        // Collapse turn order on outside click
        if (state.turnOrderExpanded && !isInsideModal) {
            const turnOrder = mountEl.querySelector('.turn-order');
            if (!turnOrder?.contains(target)) {
                state.turnOrderExpanded = false;
                state.skipMapCentering = true;
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
        }

        if (action === 'toggle-turn-order') { state.turnOrderExpanded = !state.turnOrderExpanded; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'skip-intro') { state.introShown = true; if (state.introTimeout) { clearTimeout(state.introTimeout); state.introTimeout = null; } updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'open-tutorial') { state.tutorialOpen = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'close-tutorial') { state.tutorialOpen = false; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'open-token-detail') { state.tokenDetailOpen = true; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'close-token-detail') { state.tokenDetailOpen = false; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }

        // === COMBAT HANDLERS ===
        if (action === 'combat-start') {
            if (!state.combatModal || state.combatModal.phase !== 'confirm') return;
            state.combatModal.phase = 'attacker_roll'; state.combatModal.inputValue = '';
            if (state.currentGameState) {
                state.currentGameState.combatState = { isActive: true, attackerId: state.combatModal.attackerId, defenderId: state.combatModal.defenderId, phase: 'waiting_attacker', attackerRoll: null, defenderRoll: null, attackStat: 'might', winner: null, damage: 0, loserId: null };
                syncGameStateToServer();
            }
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return;
        }
        if (action === 'combat-skip') { if (!state.combatModal || state.combatModal.phase !== 'confirm') return; closeCombatModal(mountEl, false); return; }
        if (action === 'combat-submit-attacker') {
            if (!state.combatModal || state.combatModal.phase !== 'attacker_roll') return;
            const input = mountEl.querySelector('.combat-modal .dice-input');
            const value = parseInt(input?.value || '0', 10);
            if (isNaN(value) || value < 0) return;
            state.combatModal.attackerRoll = value; state.combatModal.inputValue = '';
            // Event combat: current player controls both rolls, skip waiting_defender
            if (state.combatModal.eventSource) {
                state.combatModal.phase = 'defender_roll';
                if (state.currentGameState?.combatState) { state.currentGameState.combatState.attackerRoll = value; state.currentGameState.combatState.phase = 'waiting_defender'; syncGameStateToServer(); }
            } else {
                state.combatModal.phase = 'waiting_defender';
                if (state.currentGameState?.combatState) { state.currentGameState.combatState.attackerRoll = value; state.currentGameState.combatState.phase = 'waiting_defender'; syncGameStateToServer(); }
            }
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return;
        }
        if (action === 'combat-submit-defender') {
            if (!state.combatModal || state.combatModal.phase !== 'defender_roll') return;
            const input = mountEl.querySelector('.combat-modal .dice-input');
            const value = parseInt(input?.value || '0', 10);
            if (isNaN(value) || value < 0) return;
            state.combatModal.defenderRoll = value;
            const result = calculateCombatResult(state.combatModal.attackerRoll, value);
            state.combatModal.winner = result.winner; state.combatModal.damage = result.damage; state.combatModal.loserId = result.loserId; state.combatModal.phase = 'result'; state.combatModal.inputValue = '';
            if (state.currentGameState?.combatState) { Object.assign(state.currentGameState.combatState, { defenderRoll: value, phase: 'result', winner: result.winner, damage: result.damage, loserId: result.loserId }); syncGameStateToServer(); }
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return;
        }
        if (action === 'combat-close') {
            if (!state.combatModal || state.combatModal.phase !== 'result') return;
            const loserId = state.combatModal.loserId;
            const attackerLost = state.combatModal.winner === 'defender';
            const damage = state.combatModal.damage;
            const isForced = state.combatModal.isForced;
            const isEventCombat = !!state.combatModal.eventSource;
            if (damage > 0 && loserId) {
                if (isEventCombat) {
                    // Event combat: loser takes physical damage (distribute between Speed/Might)
                    closeCombatModal(mountEl, attackerLost);
                    if (loserId === state.mySocketId) {
                        openDamageDistributionModal(mountEl, damage, 'event-combat', 'physical');
                    } else {
                        // Loser is another player - apply directly to might in solo/debug
                        applyStatChange(loserId, 'might', -damage); syncGameStateToServer();
                        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
                    }
                } else if (state.isDebugMode || isForced) {
                    closeCombatModal(mountEl, attackerLost);
                    applyStatChange(loserId, 'might', -damage); syncGameStateToServer();
                    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
                } else if (loserId === state.mySocketId) {
                    // I am the loser - show damage distribution (same as main flow)
                    closeCombatModal(mountEl, attackerLost);
                    openDamageDistributionModal(mountEl, damage, 'combat', 'physical');
                } else if (state.isSoloDebug && state.soloDebugPlayerIds.includes(loserId)) {
                    // Solo debug: I'm the winner - let closeCombatModal handle movement/sync first,
                    // then defer switching to loser to avoid breaking async post-combat movement.
                    // Save pending damage and use setTimeout(0) so dynamic import in closeCombatModal
                    // resolves before we switch player perspective.
                    const savedLoserId = loserId;
                    const savedDamage = damage;
                    closeCombatModal(mountEl, attackerLost);
                    setTimeout(() => {
                        state.mySocketId = savedLoserId;
                        socketClient.setSoloDebugActivePlayer(savedLoserId);
                        openDamageDistributionModal(mountEl, savedDamage, 'combat', 'physical');
                        const player = state.currentGameState?.players?.find(p => p.id === savedLoserId);
                        const charName = player?.characterId ? getCharacterName(player.characterId) : 'Player';
                        showToast(`Switched to ${charName} (damage)`, 'info', 1500);
                    }, 100);
                } else { closeCombatModal(mountEl, attackerLost); }
            } else { closeCombatModal(mountEl, attackerLost); }
            return;
        }

        // Tutorial books
        if (target.closest('[data-tutorial-book]')) {
            const book = target.closest('[data-tutorial-book]')?.dataset.tutorialBook;
            if (book) {
                let url = '';
                if (book === 'rules') url = window.location.origin + '/#/tutorial/rulesbook';
                else if (book === 'traitors') url = window.location.origin + '/#/tutorial/traitors-tome';
                else if (book === 'survival') url = window.location.origin + '/#/tutorial/survival';
                if (url) window.open(url, '_blank');
            }
            return;
        }

        // Sidebar
        if (action === 'toggle-sidebar') { state.sidebarOpen = !state.sidebarOpen; const sb = mountEl.querySelector('.game-sidebar'); if (sb) sb.classList.toggle('is-open', state.sidebarOpen); centerMapOnPlayer(mountEl, true); return; }
        if (action === 'close-sidebar') { state.sidebarOpen = false; const sb = mountEl.querySelector('.game-sidebar'); if (sb) sb.classList.remove('is-open'); return; }
        if (action === 'reset-debug-game') { state.resetGameModal = { isOpen: true }; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'close-reset-game') { state.resetGameModal = null; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'confirm-reset-game') {
            state.resetGameModal = null;
            if (state.isSoloDebug) {
                await socketClient.resetSoloDebugRoom();
            } else {
                await socketClient.resetDebugGame();
            }
            return;
        }
        if (action === 'expand-player') { const pid = target.closest('[data-player-id]')?.dataset.playerId; if (pid) { if (state.expandedPlayers.has(pid)) state.expandedPlayers.delete(pid); else state.expandedPlayers.add(pid); updateGameUI(mountEl, state.currentGameState, state.mySocketId); } return; }

        // Dice rolling phase
        if (action === 'roll-manual') {
            const input = mountEl.querySelector('#dice-manual-input');
            const value = parseInt(input?.value || '0', 10);
            if (value >= 1 && value <= 16) await socketClient.rollDice(value);
            else alert('Vui long nhap so tu 1 den 16');
            return;
        }
        if (action === 'roll-random') {
            const usedValues = new Set(Object.values(state.currentGameState?.diceRolls || {}));
            const available = [];
            for (let i = 1; i <= 16; i++) { if (!usedValues.has(i)) available.push(i); }
            const val = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : Math.floor(Math.random() * 16) + 1;
            await socketClient.rollDice(val);
            return;
        }

        // Haunt trigger
        if (action === 'trigger-haunt') {
            if (state.currentGameState && !isHauntTriggered(state.currentGameState)) {
                const players = state.currentGameState.players || [];
                if (players.length > 0) {
                    const randomIndex = Math.floor(Math.random() * players.length);
                    const traitorId = players[randomIndex].id;
                    const traitorName = getCharacterName(players[randomIndex].characterId);
                    const hauntNumber = Math.floor(Math.random() * 50) + 1;
                    applyHauntState(state.currentGameState, { hauntNumber, traitorId, triggeredByPlayerId: state.mySocketId, triggerOmen: 'random', triggerRoom: 'Unknown' });
                    await socketClient.syncGameState({ hauntState: state.currentGameState.hauntState, playerState: { characterData: state.currentGameState.playerState?.characterData || state.currentGameState.characterData } });
                    const myFaction = getFaction(state.currentGameState, state.mySocketId);
                    showHauntAnnouncementModal(mountEl, hauntNumber, traitorName, myFaction === 'traitor');
                    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
                }
            }
            return;
        }

        // Movement
        if (action === 'move') {
            const dir = target.closest('[data-direction]')?.dataset.direction;
            const dirMap = { up: 'north', down: 'south', left: 'west', right: 'east' };
            if (dirMap[dir]) handleMove(mountEl, dirMap[dir]);
            return;
        }
        if (action === 'use-stairs') { const t = target.closest('[data-action="use-stairs"]')?.dataset.target; if (t) handleMoveAfterStairs(mountEl, t); return; }
        if (action === 'use-elevator') { const f = target.closest('[data-action="use-elevator"]')?.dataset.floor; if (f) handleMoveAfterElevator(mountEl, f); return; }

        // Secret Passage
        if (action === 'use-secret-passage') {
            const pid = state.mySocketId;
            const movesLeft = state.currentGameState?.playerMoves?.[pid] ?? 0;
            const roomId = state.currentGameState?.playerState?.playerPositions?.[pid];
            const room = roomId ? state.currentGameState?.map?.revealedRooms?.[roomId] : null;
            if (!room?.specialTokens?.includes('secretPassage') || movesLeft > 0) return;
            const rooms = getRoomsWithSpecialToken(state.currentGameState, 'secretPassage').filter(r => r.roomId !== roomId);
            if (rooms.length === 0) { openEventResultModal(mountEl, 'SECRET PASSAGE', 'Khong co phong nao khac.', 'neutral'); return; }
            const allowedFloors = [...new Set(rooms.map(r => r.floor))];
            const selectedFloor = allowedFloors.includes(room?.floor) ? room.floor : allowedFloors[0];
            openRoomSelectModal(mountEl, 'CHON SECRET PASSAGE', 'Chon phong de dich chuyen.', rooms, 'secretPassage', room?.name || roomId, { allowedFloors, selectedFloor, mode: 'teleport' });
            return;
        }

        // Room discovery
        if (action === 'select-room-next' || action === 'confirm-room-select') {
            const hiddenInput = mountEl.querySelector('#room-select-value');
            const selectedRoom = hiddenInput?.value;
            if (selectedRoom && state.roomDiscoveryModal) {
                const roomDef = ROOMS.find(r => r.name.en === selectedRoom);
                const initialRotation = roomDef ? findFirstValidRotation(roomDef, state.roomDiscoveryModal.doorSide) : 0;
                state.roomDiscoveryModal.selectedRoom = selectedRoom;
                state.roomDiscoveryModal.currentRotation = initialRotation;
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
            return;
        }
        if (action === 'rotate-room') { if (state.roomDiscoveryModal?.selectedRoom) { state.roomDiscoveryModal.currentRotation = (state.roomDiscoveryModal.currentRotation + 90) % 360; updateGameUI(mountEl, state.currentGameState, state.mySocketId); } return; }
        if (action === 'confirm-room-placement') { if (state.roomDiscoveryModal?.selectedRoom) handleRoomDiscovery(mountEl, state.roomDiscoveryModal.selectedRoom, state.roomDiscoveryModal.currentRotation || 0); return; }
        if (action === 'back-to-room-select') { if (state.roomDiscoveryModal) { state.roomDiscoveryModal.selectedRoom = null; state.roomDiscoveryModal.currentRotation = 0; updateGameUI(mountEl, state.currentGameState, state.mySocketId); } return; }
        if (action === 'random-room') { handleRandomRoomDiscovery(mountEl); return; }
        if (action === 'cancel-room-discovery') { cancelRoomDiscovery(mountEl); return; }

        // Room list selection
        if (target.closest('.room-discovery__item') && target.closest('#room-list')) {
            const item = target.closest('.room-discovery__item');
            const searchInput = mountEl.querySelector('#room-search-input');
            const hiddenInput = mountEl.querySelector('#room-select-value');
            if (searchInput) searchInput.value = item.textContent || '';
            if (hiddenInput) hiddenInput.value = item.dataset.roomName || '';
            mountEl.querySelectorAll('#room-list .room-discovery__item').forEach(el => el.classList.remove('is-selected'));
            item.classList.add('is-selected');
            return;
        }
        if (action === 'clear-room-selection') {
            const si = mountEl.querySelector('#room-search-input');
            const hi = mountEl.querySelector('#room-select-value');
            if (si) si.value = ''; if (hi) hi.value = '';
            mountEl.querySelectorAll('#room-list .room-discovery__item').forEach(el => { el.classList.remove('is-selected'); el.style.display = ''; });
            return;
        }

        // Token drawing
        if (action === 'token-draw-random') { handleRandomCardDraw(mountEl); return; }
        if (action === 'token-draw-next') { handleTokenDrawNext(mountEl); return; }
        if (action === 'token-draw-back') {
            if (state.tokenDrawingModal) {
                const current = state.tokenDrawingModal.tokensToDrawn[state.tokenDrawingModal.currentIndex];
                if (current) { current.selectedCard = null; current.drawn = false; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            }
            return;
        }
        if (action === 'clear-card-selection') {
            const si = mountEl.querySelector('#token-card-search-input');
            if (si) si.value = '';
            mountEl.querySelectorAll('#token-card-list .token-card__item').forEach(el => { el.classList.remove('is-selected'); el.style.display = ''; });
            if (state.tokenDrawingModal) { const c = state.tokenDrawingModal.tokensToDrawn[state.tokenDrawingModal.currentIndex]; if (c) { c.selectedCard = null; c.drawn = false; } }
            return;
        }
        if (target.closest('.token-card__item') && target.closest('#token-card-list')) {
            const item = target.closest('.token-card__item');
            const cardId = item.dataset.cardId;
            const si = mountEl.querySelector('#token-card-search-input');
            if (si) si.value = item.textContent || '';
            mountEl.querySelectorAll('#token-card-list .token-card__item').forEach(el => el.classList.remove('is-selected'));
            item.classList.add('is-selected');
            if (cardId && state.tokenDrawingModal) {
                const c = state.tokenDrawingModal.tokensToDrawn[state.tokenDrawingModal.currentIndex];
                if (c) { c.selectedCard = cardId; c.drawn = true; const btn = mountEl.querySelector('[data-action="token-draw-next"]'); if (btn) btn.removeAttribute('disabled'); }
            }
            return;
        }

        // Event dice modal
        if (action === 'event-stat-confirm') {
            if (!state.eventDiceModal) return;
            const ss = state.eventDiceModal.tempSelectedStat;
            if (ss) { state.eventDiceModal.selectedStat = ss; state.eventDiceModal.diceCount = getPlayerStatForDice(state.mySocketId, ss); state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }
        if (action === 'event-dice-confirm') {
            if (!state.eventDiceModal) return;
            const input = mountEl.querySelector('[data-input="event-dice-value"]');
            const val = parseInt(input?.value, 10);
            if (!isNaN(val) && val >= 0) { state.eventDiceModal.result = val; state.eventDiceModal.inputValue = val.toString(); state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }
        if (action === 'event-dice-random') {
            if (!state.eventDiceModal) return;
            const dc = state.eventDiceModal.eventCard?.fixedDice || state.eventDiceModal.eventCard?.rollDice || state.eventDiceModal.diceCount || 1;
            let total = 0; for (let i = 0; i < dc; i++) total += Math.floor(Math.random() * 3);
            state.eventDiceModal.result = total; state.eventDiceModal.inputValue = total.toString();
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'event-dice-continue') {
            if (!state.eventDiceModal) return;
            applyEventDiceResult(mountEl, state.eventDiceModal.result, state.eventDiceModal.selectedStat || state.eventDiceModal.eventCard?.rollStat);
            return;
        }
        if (action === 'event-dice-back') {
            if (!state.eventDiceModal) return;
            const isMultiRoll = state.eventDiceModal.eventCard?.rollStats && Array.isArray(state.eventDiceModal.eventCard.rollStats);
            if (isMultiRoll && state.eventDiceModal.allResults.length > 0) {
                state.eventDiceModal.allResults.pop();
                if (state.eventDiceModal.currentRollIndex > 0) state.eventDiceModal.currentRollIndex--;
            }
            state.eventDiceModal.result = null; state.eventDiceModal.inputValue = '';
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'event-dice-back-to-select') {
            if (!state.eventDiceModal?.tokenDrawingContext) return;
            const ctx = state.eventDiceModal.tokenDrawingContext;
            state.eventDiceModal = null;
            // Re-open token drawing modal with previous context
            const playerId = state.mySocketId;
            const playerCards = state.currentGameState?.playerState?.playerCards?.[playerId];
            if (playerCards) {
                const lastToken = ctx.tokensToDrawn[ctx.currentIndex];
                if (lastToken?.selectedCard) {
                    const cardType = lastToken.type === 'omen' ? 'omens' : lastToken.type === 'event' ? 'events' : 'items';
                    const idx = playerCards[cardType]?.indexOf(lastToken.selectedCard);
                    if (idx >= 0) playerCards[cardType].splice(idx, 1);
                }
            }
            state.tokenDrawingModal = { isOpen: true, tokensToDrawn: ctx.tokensToDrawn.map(t => ({ ...t, drawn: false, selectedCard: null })), currentIndex: ctx.currentIndex };
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }

        // Damage dice modal
        if (action === 'damage-dice-confirm') {
            if (!state.damageDiceModal) return;
            const input = mountEl.querySelector('[data-input="damage-dice-value"]');
            const val = parseInt(input?.value, 10);
            if (!isNaN(val) && val >= 0) {
                if (state.damageDiceModal.currentPhase === 'rollPhysical') {
                    state.damageDiceModal.physicalResult = val;
                    if (state.damageDiceModal.mentalDice > 0) { state.damageDiceModal.currentPhase = 'rollMental'; state.damageDiceModal.inputValue = ''; }
                    else { closeDamageDiceModal(mountEl); return; }
                } else if (state.damageDiceModal.currentPhase === 'rollMental') {
                    state.damageDiceModal.mentalResult = val;
                    closeDamageDiceModal(mountEl); return;
                }
                state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
            return;
        }
        if (action === 'damage-dice-random') {
            if (!state.damageDiceModal) return;
            const dc = state.damageDiceModal.currentPhase === 'rollPhysical' ? state.damageDiceModal.physicalDice : state.damageDiceModal.mentalDice;
            let total = 0; for (let i = 0; i < dc; i++) total += Math.floor(Math.random() * 3);
            if (state.damageDiceModal.currentPhase === 'rollPhysical') {
                state.damageDiceModal.physicalResult = total;
                if (state.damageDiceModal.mentalDice > 0) { state.damageDiceModal.currentPhase = 'rollMental'; state.damageDiceModal.inputValue = ''; }
                else { closeDamageDiceModal(mountEl); return; }
            } else { state.damageDiceModal.mentalResult = total; closeDamageDiceModal(mountEl); return; }
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }

        // Room effect dice modal
        if (action === 'room-effect-dice-confirm') {
            if (!state.roomEffectDiceModal) return;
            const input = mountEl.querySelector('[data-input="room-effect-dice-value"]');
            const val = parseInt(input?.value, 10);
            if (!isNaN(val) && val >= 0) { state.roomEffectDiceModal.result = val; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }
        if (action === 'room-effect-dice-random') {
            if (!state.roomEffectDiceModal) return;
            const dc = state.roomEffectDiceModal.diceCount || 1;
            let total = 0; for (let i = 0; i < dc; i++) total += Math.floor(Math.random() * 3);
            state.roomEffectDiceModal.result = total; state.skipMapCentering = true;
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'room-effect-dice-continue') {
            if (!state.roomEffectDiceModal) return;
            applyRoomEffectDiceResult(mountEl, state.roomEffectDiceModal.result);
            return;
        }

        // Damage distribution modal
        if (action === 'damage-dist-type') {
            if (!state.damageDistributionModal) return;
            const type = target.closest('[data-type]')?.dataset.type;
            if (type === 'physical') { state.damageDistributionModal.damageType = 'physical'; state.damageDistributionModal.stat1 = 'speed'; state.damageDistributionModal.stat2 = 'might'; }
            else if (type === 'mental') { state.damageDistributionModal.damageType = 'mental'; state.damageDistributionModal.stat1 = 'sanity'; state.damageDistributionModal.stat2 = 'knowledge'; }
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'damage-dist-inc') {
            if (!state.damageDistributionModal) return;
            const stat = target.closest('[data-stat]')?.dataset.stat;
            const dm = state.damageDistributionModal;
            const remaining = dm.totalDamage - (dm.stat1Damage || 0) - (dm.stat2Damage || 0);
            if (remaining <= 0) return;

            // Get current stat index to enforce max damage limit
            const playerId = state.mySocketId;
            const charData = state.currentGameState?.playerState?.characterData?.[playerId];
            const statName = stat === 'stat1' ? dm.stat1 : dm.stat2;
            const currentIndex = charData?.stats?.[statName] ?? 4;
            const currentDmg = stat === 'stat1' ? (dm.stat1Damage || 0) : (dm.stat2Damage || 0);

            // Don't allow damage beyond stat index (can't go below 0)
            if (currentDmg >= currentIndex) return;

            if (stat === 'stat1') dm.stat1Damage = (dm.stat1Damage || 0) + 1;
            else if (stat === 'stat2') dm.stat2Damage = (dm.stat2Damage || 0) + 1;
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'damage-dist-dec') {
            if (!state.damageDistributionModal) return;
            const stat = target.closest('[data-stat]')?.dataset.stat;
            if (stat === 'stat1' && (state.damageDistributionModal.stat1Damage || 0) > 0) state.damageDistributionModal.stat1Damage--;
            else if (stat === 'stat2' && (state.damageDistributionModal.stat2Damage || 0) > 0) state.damageDistributionModal.stat2Damage--;
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'damage-dist-confirm') { closeDamageDistributionModal(mountEl); return; }

        // Stat choice modal - direct select (click on stat button)
        if (action === 'stat-choice-select') {
            const stat = target.closest('[data-stat]')?.dataset.stat;
            if (stat && state.statChoiceModal) {
                const { effect, amount, isAllPlayers } = state.statChoiceModal;
                const playerId = state.mySocketId;
                // Apply the stat change
                if (effect === 'gainStat' || effect?.startsWith('+')) {
                    applyStatChange(playerId, stat, amount || 1);
                } else if (effect === 'loseStat' || effect?.startsWith('-')) {
                    applyStatChange(playerId, stat, -(amount || 1));
                }
                state.statChoiceModal = null;
                syncGameStateToServer();
                state.skipMapCentering = true;
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
            return;
        }

        // End turn
        if (action === 'open-end-turn') { state.endTurnModal = { isOpen: true }; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'close-end-turn') { state.endTurnModal = null; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'continue-turn') { state.endTurnModal = null; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'confirm-end-turn') { state.endTurnModal = null; handleEndTurn(mountEl); return; }

        // Dice event (general)
        if (action === 'dice-event') { state.diceEventModal = { isOpen: true, inputValue: '', result: null }; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'close-dice-event') { state.diceEventModal = null; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'dice-event-confirm') {
            if (!state.diceEventModal) return;
            const input = mountEl.querySelector('[data-input="dice-event-value"]');
            const val = parseInt(input?.value, 10);
            if (!isNaN(val) && val >= 0) { state.diceEventModal.result = val; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }
        if (action === 'dice-event-random') {
            if (!state.diceEventModal) return;
            const val = Math.floor(Math.random() * 17);
            state.diceEventModal.result = val; state.skipMapCentering = true;
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }

        // Cards view
        if (action === 'view-cards') { const type = target.closest('[data-card-type]')?.dataset.cardType; if (type) openCardsViewModal(mountEl, type); return; }
        if (action === 'close-cards-view') { closeCardsViewModal(mountEl); return; }
        if (action === 'toggle-card') { const cardId = target.closest('[data-card-id]')?.dataset.cardId; if (cardId) toggleCardExpansion(mountEl, cardId); return; }

        // Character modal
        if (action === 'view-character-detail') {
            const charId = target.closest('[data-character-id]')?.dataset.characterId;
            if (charId) {
                const currentStats = state.currentGameState?.playerState?.characterData?.[state.mySocketId]?.stats;
                openCharacterModal(mountEl, charId, currentStats);
            }
            return;
        }
        if (action === 'close-modal') { closeCharacterModal(mountEl); return; }

        // Event result modal
        if (action === 'close-event-result') { closeEventResultModal(mountEl); return; }

        // Return item modal (Anh Phan Chieu 2)
        if (action === 'return-item-select') { const itemId = target.closest('[data-item-id]')?.dataset.itemId; if (itemId && state.returnItemModal) state.returnItemModal.selectedItemId = itemId; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'return-item-confirm') { confirmReturnItemSelection(mountEl); return; }

        // Multi-roll summary
        if (action === 'close-multi-roll') {
            if (state.multiRollSummary?.bonusReward?.choice) {
                const reward = state.multiRollSummary.bonusReward;
                state.multiRollSummary = null;
                state.statChoiceModal = { isOpen: true, title: 'CHON CHI SO BONUS', effect: `+${reward.amount}`, amount: reward.amount, options: reward.stats || ['speed', 'might', 'sanity', 'knowledge'] };
                state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            } else {
                state.multiRollSummary = null; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
            return;
        }

        // Trapped escape modal actions
        if (action === 'trapped-escape-confirm') {
            if (!state.trappedEscapeModal) return;
            const input = mountEl.querySelector('[data-input="trapped-escape-value"]');
            const val = parseInt(input?.value, 10);
            if (!isNaN(val) && val >= 0) { state.trappedEscapeModal.result = val; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }
        if (action === 'trapped-escape-random') {
            if (!state.trappedEscapeModal) return;
            const dc = state.trappedEscapeModal.diceCount || 1;
            let total = 0; for (let i = 0; i < dc; i++) total += Math.floor(Math.random() * 3);
            state.trappedEscapeModal.result = total; state.skipMapCentering = true;
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'trapped-escape-continue') {
            if (!state.trappedEscapeModal) return;
            import('../events/eventTrapped.js').then(m => m.handleTrappedEscapeResult(mountEl));
            return;
        }

        // Rescue trapped modal
        if (action === 'rescue-trapped-yes') { if (state.rescueTrappedModal) { state.rescueTrappedModal.phase = 'roll'; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); } return; }
        if (action === 'rescue-trapped-no') { state.rescueTrappedModal = null; updateGameUI(mountEl, state.currentGameState, state.mySocketId); return; }
        if (action === 'rescue-trapped-confirm') {
            if (!state.rescueTrappedModal || state.rescueTrappedModal.phase !== 'roll') return;
            const input = mountEl.querySelector('.rescue-trapped-modal__input');
            const val = parseInt(input?.value, 10);
            if (!isNaN(val) && val >= 0) { state.rescueTrappedModal.result = val; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }
        if (action === 'rescue-trapped-random') {
            if (!state.rescueTrappedModal || state.rescueTrappedModal.phase !== 'roll') return;
            const dc = state.rescueTrappedModal.diceCount || 1;
            let total = 0; for (let i = 0; i < dc; i++) total += Math.floor(Math.random() * 3);
            state.rescueTrappedModal.result = total; state.skipMapCentering = true;
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'rescue-trapped-continue') {
            if (!state.rescueTrappedModal) return;
            import('../events/eventTrapped.js').then(m => m.handleRescueResult(mountEl));
            return;
        }

        // Persistent damage modal
        if (action === 'persistent-damage-select') {
            const stat = target.closest('[data-stat]')?.dataset.stat;
            if (stat) import('../events/eventPersistent.js').then(m => m.closePersistentDamageModal(mountEl, stat));
            return;
        }

        // Teleport choice
        if (action === 'teleport-choice') {
            const roomId = target.closest('[data-room-id]')?.dataset.roomId;
            if (roomId) closeTeleportChoiceModal(mountEl, roomId);
            return;
        }

        // Room select modal
        if (action === 'room-select-floor') {
            if (!state.roomSelectModal) return;
            const floor = target.closest('[data-floor]')?.dataset.floor;
            if (floor) { state.roomSelectModal.selectedFloor = floor; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }
        if (action === 'room-select-choice') {
            if (!state.roomSelectModal) return;
            const roomId = target.closest('[data-room-id]')?.dataset.roomId;
            if (roomId) { state.roomSelectModal.pendingRoomId = roomId; state.roomSelectModal.dropdownOpen = false; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }
        if (action === 'room-select-toggle') {
            if (!state.roomSelectModal) return;
            state.roomSelectModal.dropdownOpen = !state.roomSelectModal.dropdownOpen;
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'room-select-item') {
            if (!state.roomSelectModal) return;
            const roomId = target.closest('[data-room-id]')?.dataset.roomId;
            if (roomId) { state.roomSelectModal.pendingRoomId = roomId; state.roomSelectModal.dropdownOpen = false; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }
        if (action === 'room-select-confirm') {
            if (!state.roomSelectModal?.pendingRoomId) return;
            handleRoomSelectChoice(mountEl, state.roomSelectModal.pendingRoomId);
            return;
        }
        if (action === 'room-select-skip') {
            if (state.roomSelectModal) { state.roomSelectModal = null; advanceToNextTurn(); syncGameStateToServer(); updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }
        if (action === 'room-select-confirm-map') {
            if (!state.roomSelectModal?.pendingRoomId) return;
            handleRoomSelectChoice(mountEl, state.roomSelectModal.pendingRoomId);
            return;
        }
        if (action === 'room-select-cancel-map') {
            if (!state.roomSelectModal) return;
            state.roomSelectModal.showConfirmModal = false;
            state.roomSelectModal.pendingRoomId = null;
            state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'room-select-mode') {
            if (!state.roomSelectModal) return;
            const mode = target.closest('[data-mode]')?.dataset.mode;
            if (mode) { state.roomSelectModal.selectionMode = mode; state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId); }
            return;
        }

        // Map click selection when room select modal is in map mode
        if (!action && state.roomSelectModal?.selectionMode === 'map' && !state.roomSelectModal?.showConfirmModal) {
            const roomEl = target.closest('.map-room');
            const roomId = roomEl?.dataset?.roomId;
            if (roomId) {
                if (!isRoomSelectableForRoomSelect(roomId)) return;
                state.roomSelectModal.pendingRoomId = roomId;
                state.roomSelectModal.showConfirmModal = true;
                state.skipMapCentering = true; updateGameUI(mountEl, state.currentGameState, state.mySocketId);
                return;
            }
        }

        // Optional roll modal
        if (action === 'optional-roll-accept') {
            import('../events/eventChoice.js').then(m => m.handleOptionalRollAccept(mountEl));
            return;
        }
        if (action === 'optional-roll-skip') {
            import('../events/eventChoice.js').then(m => m.handleOptionalRollSkip(mountEl));
            return;
        }

        // Choice modal
        if (action === 'choice-select') {
            const choiceIndex = parseInt(target.closest('[data-choice-index]')?.dataset.choiceIndex, 10);
            if (!isNaN(choiceIndex)) {
                import('../events/eventChoice.js').then(m => m.handleChoiceSelect(mountEl, choiceIndex));
            }
            return;
        }

        // Peek modal
        if (action === 'close-peek') {
            import('../events/eventChoice.js').then(m => m.closePeekModal(mountEl));
            return;
        }

        // Store dice modal
        if (action === 'store-dice-input') {
            if (!state.storeDiceModal) return;
            const input = mountEl.querySelector('[data-input="store-dice-value"]');
            const val = parseInt(input?.value, 10);
            if (!isNaN(val) && val >= 0) {
                state.storeDiceModal.result = val;
                state.storeDiceModal.inputValue = val.toString();
                state.skipMapCentering = true;
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
            return;
        }
        if (action === 'store-dice-random') {
            if (!state.storeDiceModal) return;
            const dc = state.storeDiceModal.diceCount || 4;
            let total = 0;
            for (let i = 0; i < dc; i++) total += Math.floor(Math.random() * 3);
            state.storeDiceModal.result = total;
            state.storeDiceModal.inputValue = total.toString();
            state.skipMapCentering = true;
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'store-dice-confirm') {
            if (!state.storeDiceModal?.result === null) return;
            import('../events/eventChoice.js').then(m => m.confirmStoreDice(mountEl, state.storeDiceModal.result));
            return;
        }

        // Token placement modal
        if (action === 'token-placement-confirm') {
            import('../events/eventToken.js').then(m => m.confirmTokenPlacement(mountEl));
            return;
        }

        // Token interaction modal
        if (action === 'token-interact') {
            const tokenType = target.closest('[data-token-type]')?.dataset.tokenType;
            if (tokenType) {
                import('../events/eventToken.js').then(m => m.openTokenInteractionModal(mountEl, tokenType));
            }
            return;
        }
        if (action === 'token-interact-confirm') {
            if (!state.tokenInteractionModal) return;
            const input = mountEl.querySelector('[data-input="token-interact-dice-value"]');
            const val = parseInt(input?.value, 10);
            if (!isNaN(val) && val >= 0) {
                state.tokenInteractionModal.result = val;
                state.skipMapCentering = true;
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
            return;
        }
        if (action === 'token-interact-random') {
            if (!state.tokenInteractionModal) return;
            const dc = state.tokenInteractionModal.diceCount || 2;
            let total = 0;
            for (let i = 0; i < dc; i++) total += Math.floor(Math.random() * 3);
            state.tokenInteractionModal.result = total;
            state.skipMapCentering = true;
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'token-interact-apply') {
            import('../events/eventToken.js').then(m => m.applyTokenInteractionResult(mountEl));
            return;
        }

        // Token interaction prompt modal (generic for closet, safe, skeletons, wallSwitch)
        if (action === 'token-prompt-accept') {
            import('../events/eventToken.js').then(m => m.acceptTokenPrompt(mountEl));
            return;
        }
        if (action === 'token-prompt-decline') {
            import('../events/eventToken.js').then(m => m.declineTokenPrompt(mountEl));
            return;
        }

        // Multi-player roll modal
        if (action === 'multi-roll-confirm') {
            if (!state.multiPlayerRollModal) return;
            const input = mountEl.querySelector('[data-input="multi-roll-dice-value"]');
            const val = parseInt(input?.value, 10);
            if (!isNaN(val) && val >= 0) {
                state.multiPlayerRollModal.currentResult = val;
                state.skipMapCentering = true;
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
            return;
        }
        if (action === 'multi-roll-random') {
            if (!state.multiPlayerRollModal) return;
            const dc = state.multiPlayerRollModal.currentDiceCount || 1;
            let total = 0;
            for (let i = 0; i < dc; i++) total += Math.floor(Math.random() * 3);
            state.multiPlayerRollModal.currentResult = total;
            state.skipMapCentering = true;
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'multi-roll-apply') {
            import('../events/eventMultiPlayer.js').then(m => m.applyMultiPlayerRollResult(mountEl));
            return;
        }
        if (action === 'multi-roll-close') {
            import('../events/eventMultiPlayer.js').then(m => m.closeMultiPlayerRollModal(mountEl));
            return;
        }

        // Second roll modal
        if (action === 'second-roll-confirm') {
            if (!state.secondRollModal) return;
            const input = mountEl.querySelector('[data-input="second-roll-dice-value"]');
            const val = parseInt(input?.value, 10);
            if (!isNaN(val) && val >= 0) {
                state.secondRollModal.result = val;
                state.skipMapCentering = true;
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
            return;
        }
        if (action === 'second-roll-random') {
            if (!state.secondRollModal) return;
            const dc = state.secondRollModal.diceCount || 3;
            let total = 0;
            for (let i = 0; i < dc; i++) total += Math.floor(Math.random() * 3);
            state.secondRollModal.result = total;
            state.skipMapCentering = true;
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
        if (action === 'second-roll-apply') {
            import('../events/eventSecondRoll.js').then(m => m.applySecondRollResult(mountEl));
            return;
        }

        // Stat change notification
        if (action === 'stat-change-ok') {
            if (!state.statChangeNotification) return;
            const onCloseCallback = state.statChangeNotification.onClose;
            state.statChangeNotification = null;
            state.skipMapCentering = true;
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            if (onCloseCallback) onCloseCallback();
            return;
        }

        // Stat choice modal confirm
        if (action === 'stat-choice-confirm') {
            if (!state.statChoiceModal) return;
            const chosenStat = state.statChoiceModal.selectedStat;
            if (chosenStat) {
                const { effect, amount } = state.statChoiceModal;
                const playerId = state.mySocketId;
                if (chosenStat && effect === 'gainStat') {
                    applyStatChange(playerId, chosenStat, amount);
                } else if (chosenStat && effect === 'loseStat') {
                    applyStatChange(playerId, chosenStat, -amount);
                }
                state.statChoiceModal = null;
                syncGameStateToServer();
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
            return;
        }

        // Room preview click (rotate)
        if (target.closest('.game-map__room--preview')) {
            if (state.roomDiscoveryModal?.selectedRoom) {
                state.roomDiscoveryModal.currentRotation = (state.roomDiscoveryModal.currentRotation + 90) % 360;
                updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            }
            return;
        }

        // Combat result notification close
        if (action === 'close-combat-result') {
            const notification = target.closest('.combat-result-notification');
            if (notification) { notification.style.animation = 'fadeOut 0.3s ease'; setTimeout(() => { notification.remove(); if (state.currentGameState) state.currentGameState.combatResult = null; }, 300); }
            return;
        }
    });

    // Search input handlers
    mountEl.addEventListener('input', (e) => {
        const target = e.target;

        // Room search filter
        if (target.id === 'room-search-input') {
            const query = target.value.toLowerCase().trim();
            const items = mountEl.querySelectorAll('#room-list .room-discovery__item');
            items.forEach(item => {
                const searchText = item.dataset.searchText || '';
                item.style.display = searchText.includes(query) ? '' : 'none';
            });
            return;
        }

        // Token card search filter
        if (target.id === 'token-card-search-input') {
            const query = target.value.toLowerCase().trim();
            const items = mountEl.querySelectorAll('#token-card-list .token-card__item');
            items.forEach(item => {
                const searchText = item.dataset.searchText || '';
                item.style.display = searchText.includes(query) ? '' : 'none';
            });
            return;
        }

        // Event stat select
        if (target.dataset.input === 'event-stat-select') {
            if (state.eventDiceModal) {
                state.eventDiceModal.tempSelectedStat = target.value;
                const confirmBtn = mountEl.querySelector('[data-action="event-stat-confirm"]');
                if (confirmBtn) { if (target.value) confirmBtn.removeAttribute('disabled'); else confirmBtn.setAttribute('disabled', ''); }
            }
            return;
        }
    });

    // Change event for select elements (dropdowns)
    mountEl.addEventListener('change', (e) => {
        const target = e.target;

        if (target.matches('[data-input="event-stat-select"]')) {
            if (!state.eventDiceModal) return;
            state.eventDiceModal.tempSelectedStat = target.value;
            const confirmBtn = mountEl.querySelector('[data-action="event-stat-confirm"]');
            if (confirmBtn) confirmBtn.disabled = !target.value;
            return;
        }

        if (target.matches('[data-input="stat-choice-select"]')) {
            if (!state.statChoiceModal) return;
            state.statChoiceModal.selectedStat = target.value || null;
            const confirmBtn = mountEl.querySelector('[data-action="stat-choice-confirm"]');
            if (confirmBtn) confirmBtn.disabled = !target.value;
            return;
        }

        if (target.matches('[data-input="room-select-dropdown"]')) {
            if (!state.roomSelectModal) return;
            state.roomSelectModal.pendingRoomId = target.value || null;
            state.skipMapCentering = true;
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            return;
        }
    });
}
