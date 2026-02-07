// Event dice modal - immediate roll events
import { state } from '../gameState.js';
import { EVENTS } from '../../../data/cardsData.js';
import { CHARACTER_BY_ID } from '../../../data/charactersData.js';
import { getPlayerStatForDice, applyStatChange, applyMultipleStatChanges, getStatValue } from '../characters/characterManager.js';
import { findMatchingOutcome, findRoomIdByDestination as findRoomIdByDestinationUtil, findExistingRooms as findExistingRoomsUtil } from '../../../utils/eventEffects.js';
import { getTotalOmenCount } from '../omens/omenCount.js';
import { updateGameUI, renderGameScreen } from '../ui/mainRenderer.js';
import { advanceToNextTurn, syncGameStateToServer } from '../turn/turnManager.js';
import { openEventResultModal } from './eventResult.js';
import { applyTrappedEffect } from './eventTrapped.js';
import { applyPersistentEffect } from './eventPersistent.js';

function findRoomIdByDestination(destination) {
    return findRoomIdByDestinationUtil(state.currentGameState, destination);
}

function findExistingRooms(destinations) {
    return findExistingRoomsUtil(state.currentGameState, destinations);
}

export function checkEventRequiresImmediateRoll(cardId) {
    const card = EVENTS.find(e => e.id === cardId);
    if (!card) return false;
    // immediateRoll, rollDice (fixed die), or rollStat with rollResults (direct roll)
    return card.immediateRoll === true || card.rollDice > 0 ||
        (card.rollStat && card.rollResults && !card.optional && card.effect !== 'choice' && card.effect !== 'placeToken' && card.effect !== 'conditional' && card.effect !== 'attack');
}

export function getEventCardById(cardId) {
    return EVENTS.find(e => e.id === cardId) || null;
}

export function openEventDiceModal(mountEl, cardId, tokenDrawingContext = null) {
    const card = getEventCardById(cardId);
    if (!card) {
        console.error('[EventDice] Card not found:', cardId);
        return;
    }

    const playerId = state.mySocketId;
    let rollStat = card.rollStat || card.rollStats?.[0];
    const fixedDice = card.fixedDice || card.rollDice || 0;
    let diceCount = fixedDice;

    // Chapel bonus check for tieng_buoc_chan
    let chapelBonusDice = 0;
    if (card.chapelBonus && card.chapelBonus.fromAlly) {
        const hasAllyInChapel = checkAllyInRoom(playerId, 'Chapel');
        if (hasAllyInChapel) {
            chapelBonusDice = card.chapelBonus.addDice || 0;
            diceCount += chapelBonusDice;
            console.log('[EventDice] Chapel bonus applied! +' + chapelBonusDice + ' dice');
        }
    }

    if (!fixedDice && rollStat && typeof rollStat === 'string') {
        diceCount = getPlayerStatForDice(playerId, rollStat);
    }

    // Room modifier (e.g., nguoi_lam_vuon in Gardens)
    let roomModifierInfo = '';
    if (card.roomModifier) {
        const currentRoomId = state.currentGameState?.playerState?.playerPositions?.[playerId];
        const currentRoom = currentRoomId ? state.currentGameState?.map?.revealedRooms?.[currentRoomId] : null;
        const targetRoomName = card.roomModifier.room;
        if (currentRoom && (currentRoom.name?.toLowerCase().includes(targetRoomName) || currentRoom.name?.includes(`(${targetRoomName.charAt(0).toUpperCase() + targetRoomName.slice(1)})`))) {
            const reduction = card.roomModifier.diceReduction || 0;
            diceCount = Math.max(1, diceCount - reduction);
            roomModifierInfo = ` (giam ${reduction} xuc xac vi dang o ${targetRoomName})`;
            console.log('[EventDice] Room modifier applied! -' + reduction + ' dice for ' + targetRoomName);
        }
    }

    state.eventDiceModal = {
        isOpen: true,
        eventCard: card,
        rollStat: card.rollStat || card.rollStats,
        selectedStat: null,
        diceCount: diceCount,
        inputValue: '',
        result: null,
        resultsApplied: false,
        currentRollIndex: 0,
        allResults: [],
        pendingEffect: null,
        tokenDrawingContext: tokenDrawingContext,
        chapelBonusDice: chapelBonusDice,
        roomModifierInfo: roomModifierInfo,
    };

    console.log('[EventDice] Opened modal for:', card.name?.vi, 'rollStat:', rollStat, 'diceCount:', diceCount, 'chapelBonus:', chapelBonusDice);
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Check if any ally (non-current player) is in a specific room
 */
function checkAllyInRoom(currentPlayerId, roomName) {
    const gs = state.currentGameState;
    if (!gs?.playerState?.playerPositions || !gs?.map?.revealedRooms) return false;
    const positions = gs.playerState.playerPositions;
    const rooms = gs.map.revealedRooms;
    for (const [pid, roomId] of Object.entries(positions)) {
        if (pid === currentPlayerId) continue;
        const room = rooms[roomId];
        if (room && (room.name === roomName || room.name?.includes(`(${roomName})`))) {
            return true;
        }
    }
    return false;
}

/**
 * Find the nearest player to a given player by room distance (BFS on map connections)
 */
function findNearestPlayer(currentPlayerId) {
    const gs = state.currentGameState;
    if (!gs?.playerState?.playerPositions || !gs?.map?.connections) return null;
    const positions = gs.playerState.playerPositions;
    const connections = gs.map.connections;
    const myRoom = positions[currentPlayerId];
    if (!myRoom) return null;

    // BFS from my room
    const visited = new Set();
    const queue = [{ roomId: myRoom, distance: 0 }];
    visited.add(myRoom);

    while (queue.length > 0) {
        const { roomId, distance } = queue.shift();
        // Check if any other player is in this room
        for (const [pid, pRoom] of Object.entries(positions)) {
            if (pid !== currentPlayerId && pRoom === roomId && distance > 0) {
                return pid;
            }
        }
        // Add connected rooms
        const roomConns = connections[roomId];
        if (roomConns) {
            for (const dir of ['north', 'south', 'east', 'west']) {
                const nextRoom = roomConns[dir];
                if (nextRoom && !visited.has(nextRoom)) {
                    visited.add(nextRoom);
                    queue.push({ roomId: nextRoom, distance: distance + 1 });
                }
            }
        }
    }
    return null;
}

/**
 * Get right player (next in turn order)
 */
export function getRightPlayer(currentPlayerId) {
    const gs = state.currentGameState;
    if (!gs?.turnOrder) return null;
    const idx = gs.turnOrder.indexOf(currentPlayerId);
    if (idx === -1) return null;
    return gs.turnOrder[(idx + 1) % gs.turnOrder.length];
}

export function openDamageDiceModal(mountEl, physicalDice, mentalDice) {
    let damageType = 'both';
    let startPhase = 'rollPhysical';

    if (physicalDice > 0 && mentalDice === 0) {
        damageType = 'physical';
        startPhase = 'rollPhysical';
    } else if (physicalDice === 0 && mentalDice > 0) {
        damageType = 'mental';
        startPhase = 'rollMental';
    }

    state.damageDiceModal = {
        isOpen: true,
        damageType: damageType,
        physicalDice: physicalDice,
        mentalDice: mentalDice,
        inputValue: '',
        result: null,
        physicalResult: null,
        mentalResult: null,
        currentPhase: startPhase,
        selectedPhysicalStat: null,
        selectedMentalStat: null,
    };

    console.log('[DamageDice] Opened modal - physical:', physicalDice, 'mental:', mentalDice, 'startPhase:', startPhase);
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function applyEventDiceResult(mountEl, result, stat) {
    if (!state.eventDiceModal || !state.eventDiceModal.eventCard) return;

    const { eventCard } = state.eventDiceModal;
    let outcome = null;
    let omenCount = null;

    if (eventCard.compareToOmenCount) {
        omenCount = getTotalOmenCount();
        const isSuccess = result >= omenCount;
        outcome = eventCard.rollResults?.find(r =>
            isSuccess ? r.condition === 'rollGreaterOrEqualOmen' : r.condition === 'rollLessThanOmen'
        ) || null;
    } else {
        outcome = findMatchingOutcome(eventCard.rollResults, result);
    }

    console.log('[EventDice] applyEventDiceResult - Result:', result, 'Stat:', stat, 'Outcome:', outcome, 'OmenCount:', omenCount);

    if (!outcome) {
        console.warn('[EventDice] No matching outcome found for result:', result);
        closeEventDiceModal(mountEl);
        return;
    }

    const playerId = state.mySocketId;
    const statLabels = {
        speed: 'Toc do (Speed)', might: 'Suc manh (Might)',
        knowledge: 'Kien thuc (Knowledge)', sanity: 'Tam tri (Sanity)'
    };

    switch (outcome.effect) {
        case 'nothing':
            state.eventDiceModal = null;
            openEventResultModal(mountEl, 'KHONG CO GI XAY RA', 'Ban da vuot qua thu thach!', 'neutral');
            break;

        case 'gainStat': {
            const gainStatName = outcome.stat === 'rolled' ? stat : outcome.stat;
            const amount = outcome.amount || 1;
            const oldValue = getPlayerStatForDice(playerId, gainStatName);
            applyStatChange(playerId, gainStatName, amount);
            const newValue = getPlayerStatForDice(playerId, gainStatName);
            let extraMsg = '';

            // Handle nearestPlayer sub-effect
            if (outcome.nearestPlayer) {
                const nearestPid = findNearestPlayer(playerId);
                if (nearestPid) {
                    const npEffect = outcome.nearestPlayer;
                    const npStat = npEffect.stat;
                    const npAmount = npEffect.amount || 1;
                    const npPlayer = state.currentGameState?.players?.find(p => p.id === nearestPid);
                    const npCharName = npPlayer?.characterId ? (() => { const c = CHARACTER_BY_ID[npPlayer.characterId]; return c?.name?.vi || c?.name?.en || 'Player'; })() : 'Player';
                    if (npEffect.effect === 'gainStat') {
                        applyStatChange(nearestPid, npStat, npAmount);
                        extraMsg = `. ${npCharName} +${npAmount} ${statLabels[npStat]}`;
                    } else if (npEffect.effect === 'loseStat') {
                        applyStatChange(nearestPid, npStat, -npAmount);
                        extraMsg = `. ${npCharName} -${npAmount} ${statLabels[npStat]}`;
                    }
                }
            }

            state.eventDiceModal = null;
            openEventResultModal(mountEl, 'TANG CHI SO', `${statLabels[gainStatName]}: ${oldValue} → ${newValue} (+${amount})${extraMsg}`, 'success');
            break;
        }

        case 'loseStat': {
            const loseStatName = outcome.stat === 'rolled' ? stat : outcome.stat;
            const amount = outcome.amount || 1;
            const oldValue = getPlayerStatForDice(playerId, loseStatName);
            applyStatChange(playerId, loseStatName, -amount);
            const newValue = getPlayerStatForDice(playerId, loseStatName);
            state.eventDiceModal = null;
            openEventResultModal(mountEl, 'GIAM CHI SO', `${statLabels[loseStatName]}: ${oldValue} → ${newValue} (-${amount})`, 'danger');
            break;
        }

        case 'loseStats': {
            applyMultipleStatChanges(playerId, outcome.stats);
            const loseStatsMsg = Object.entries(outcome.stats)
                .map(([s, amt]) => `${statLabels[s]} -${amt}`)
                .join(', ');

            if (outcome.then && outcome.then.effect === 'teleportIfExists') {
                const destinations = outcome.then.destinations || [];
                const existingRooms = findExistingRooms(destinations);
                if (existingRooms.length > 0) {
                    const randomIndex = Math.floor(Math.random() * existingRooms.length);
                    const selectedRoom = existingRooms[randomIndex];
                    if (!state.currentGameState.playerState.playerPositions) {
                        state.currentGameState.playerState.playerPositions = {};
                    }
                    state.currentGameState.playerState.playerPositions[playerId] = selectedRoom.roomId;
                    syncGameStateToServer();
                    renderGameScreen(state.currentGameState, state.mySocketId);
                    state.eventDiceModal = null;
                    openEventResultModal(mountEl, 'DICH CHUYEN', `${loseStatsMsg}. Ban da bi dich chuyen den ${selectedRoom.name}`, 'danger');
                } else {
                    state.eventDiceModal = null;
                    openEventResultModal(mountEl, 'GIAM CHI SO', loseStatsMsg, 'danger');
                }
            } else {
                state.eventDiceModal = null;
                openEventResultModal(mountEl, 'GIAM CHI SO', loseStatsMsg, 'danger');
            }
            break;
        }

        case 'mentalDamage':
            state.eventDiceModal.pendingEffect = outcome;
            state.eventDiceModal = null;
            openDamageDiceModal(mountEl, 0, outcome.dice);
            break;

        case 'physicalDamage':
            if (outcome.then === 'trapped' && eventCard.trappedEffect) {
                state.pendingTrappedEffect = { eventCard, outcome };
            }
            state.eventDiceModal.pendingEffect = outcome;
            state.eventDiceModal = null;
            openDamageDiceModal(mountEl, outcome.dice, 0);
            break;

        case 'damage':
            state.eventDiceModal.pendingEffect = outcome;
            state.eventDiceModal = null;
            openDamageDiceModal(mountEl, outcome.physicalDice || 0, outcome.mentalDice || 0);
            break;

        case 'teleport': {
            const destinationRoomId = findRoomIdByDestination(outcome.destination);
            if (destinationRoomId) {
                if (!state.currentGameState.playerState.playerPositions) {
                    state.currentGameState.playerState.playerPositions = {};
                }
                state.currentGameState.playerState.playerPositions[playerId] = destinationRoomId;
                const revealedRooms = state.currentGameState.map?.revealedRooms || {};
                const destRoom = revealedRooms[destinationRoomId];
                const roomName = destRoom?.name || outcome.destination;
                syncGameStateToServer();
                renderGameScreen(state.currentGameState, state.mySocketId);
                state.eventDiceModal = null;
                openEventResultModal(mountEl, 'DỊCH CHUYỂN', `Bạn đã được dịch chuyển đến ${roomName}`, 'neutral');
            } else {
                state.eventDiceModal = null;
                openEventResultModal(mountEl, 'LỖI', `Không tìm thấy phòng ${outcome.destination}. Phòng này chưa được khám phá.`, 'danger');
            }
            break;
        }

        case 'drawItem': {
            const drawCount = outcome.amount || 1;
            const itemTokens = Array(drawCount).fill('item');
            state.eventDiceModal = null;
            import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(mountEl, itemTokens));
            break;
        }

        case 'drawEvent': {
            const eventTokens = Array(outcome.amount || 1).fill('event');
            state.eventDiceModal = null;
            import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(mountEl, eventTokens));
            break;
        }

        case 'secondRoll': {
            state.eventDiceModal = null;
            import('./eventSecondRoll.js').then(m => m.openSecondRollModal(mountEl, eventCard, outcome));
            break;
        }

        case 'attack': {
            // Event-triggered combat (e.g., nguoi_lam_vuon 0-3 result)
            if (outcome.attackerDice && outcome.defenderStat) {
                const rightPlayerId = getRightPlayer(playerId);
                if (rightPlayerId) {
                    const attackerPlayer = state.currentGameState?.players?.find(pp => pp.id === rightPlayerId);
                    const defenderPlayer = state.currentGameState?.players?.find(pp => pp.id === playerId);
                    const attackerName = attackerPlayer ? (CHARACTER_BY_ID[attackerPlayer.characterId]?.name?.vi || 'Player') : 'Player';
                    const defenderName = defenderPlayer ? (CHARACTER_BY_ID[defenderPlayer.characterId]?.name?.vi || 'Player') : 'Player';
                    const defenderDiceCount = getPlayerStatForDice(playerId, outcome.defenderStat);

                    state.eventDiceModal = null;
                    state.combatModal = {
                        isOpen: true,
                        phase: 'confirm',
                        attackerId: rightPlayerId,
                        defenderId: playerId,
                        attackerName,
                        defenderName,
                        defenderFactionLabel: '',
                        attackerDiceCount: outcome.attackerDice,
                        defenderDiceCount,
                        attackerRoll: null,
                        defenderRoll: null,
                        winner: null,
                        damage: 0,
                        loserId: null,
                        isForced: true,
                        inputValue: '',
                        fixedAttackerDice: outcome.attackerDice,
                        defenderStat: outcome.defenderStat,
                        eventSource: eventCard.id,
                    };
                    if (!state.currentGameState.combatState) state.currentGameState.combatState = {};
                    state.currentGameState.combatState = {
                        isActive: true, attackerId: rightPlayerId, defenderId: playerId,
                        phase: 'waiting_attacker', attackerRoll: null, defenderRoll: null,
                        attackStat: 'event', winner: null, damage: 0, loserId: null,
                    };
                    syncGameStateToServer();
                    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
                } else {
                    closeEventDiceModal(mountEl);
                }
            } else {
                closeEventDiceModal(mountEl);
            }
            break;
        }

        case 'forcedAttack': {
            state.eventDiceModal = null;
            import('../combat/combatCalc.js').then(m => m.executeForcedAttack(mountEl, playerId, outcome.target));
            break;
        }

        case 'trapped':
            state.eventDiceModal = null;
            applyTrappedEffect(mountEl, playerId, eventCard);
            break;

        case 'persistent':
            state.eventDiceModal = null;
            applyPersistentEffect(mountEl, playerId, eventCard);
            break;

        case 'allPlayersLoseStat': {
            // All players choose 1 stat to lose
            const amt = outcome.amount || 1;

            // Store pending stat choice for ALL other players
            if (!state.currentGameState.playerState.pendingStatChoices) {
                state.currentGameState.playerState.pendingStatChoices = {};
            }
            const allPlayers = state.currentGameState.players || [];
            for (const p of allPlayers) {
                if (p.id !== playerId) {
                    state.currentGameState.playerState.pendingStatChoices[p.id] = {
                        effect: 'loseStat',
                        amount: amt,
                        reason: eventCard.name?.vi || 'Event',
                    };
                }
            }

            // Current player sees the modal immediately
            state.eventDiceModal = null;
            state.statChoiceModal = {
                isOpen: true,
                title: 'MAT CHI SO (HINH PHAT CHUNG)',
                effect: 'loseStat',
                amount: amt,
                options: ['speed', 'might', 'sanity', 'knowledge'],
                selectedStat: null,
                isAllPlayers: true,
            };
            syncGameStateToServer();
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            break;
        }

        case 'setStatToLowest': {
            const targetStatName = outcome.stat === 'rolled' ? stat : outcome.stat;
            const player = state.currentGameState.players?.find(p => p.id === playerId);
            const charData = state.currentGameState.playerState?.characterData?.[playerId];
            const charDef = player ? CHARACTER_BY_ID[player.characterId] : null;

            if (charData && charData.stats && charDef && charDef.traits) {
                const trait = charDef.traits[targetStatName];
                if (trait && trait.track) {
                    const currentIndex = charData.stats[targetStatName] ?? 0;
                    const currentValue = trait.track[currentIndex];
                    if (currentIndex > 0) {
                        charData.stats[targetStatName] = 0;
                        const newValue = trait.track[0];
                        state.eventDiceModal = null;
                        syncGameStateToServer();
                        openEventResultModal(mountEl, 'CHI SO GIAM TOI THIEU', `${statLabels[targetStatName]}: ${currentValue} → ${newValue}`, 'danger');
                    } else {
                        state.eventDiceModal = null;
                        openEventResultModal(mountEl, 'CHI SO DA O MUC THAP NHAT', `${statLabels[targetStatName]} da o muc thap nhat.`, 'warning');
                    }
                } else {
                    closeEventDiceModal(mountEl);
                }
            } else {
                closeEventDiceModal(mountEl);
            }
            break;
        }

        default:
            closeEventDiceModal(mountEl);
    }
}

export function closeEventDiceModal(mountEl) {
    state.eventDiceModal = null;
    const playerId = state.mySocketId;
    if (state.currentGameState && state.currentGameState.playerMoves[playerId] <= 0) {
        advanceToNextTurn();
    }
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
    syncGameStateToServer();
}

export function closeTeleportChoiceModal(mountEl, roomId) {
    if (!state.teleportChoiceModal) return;

    const playerId = state.mySocketId;

    if (roomId && state.currentGameState) {
        if (!state.currentGameState.playerState.playerPositions) {
            state.currentGameState.playerState.playerPositions = {};
        }
        state.currentGameState.playerState.playerPositions[playerId] = roomId;

        const room = state.currentGameState.map?.revealedRooms?.[roomId];
        const roomName = room?.name || roomId;
        console.log('[TeleportChoice] Player teleported to', roomName);
    }

    state.teleportChoiceModal = null;

    if (state.currentGameState && state.currentGameState.playerMoves[playerId] <= 0) {
        console.log('[Turn] Player moves depleted after teleport, advancing turn');
        advanceToNextTurn();
    }

    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
    syncGameStateToServer();
}

export function closeDamageDiceModal(mountEl) {
    if (!state.damageDiceModal) return;
    const physicalDamage = state.damageDiceModal.physicalResult || 0;
    const mentalDamage = state.damageDiceModal.mentalResult || 0;

    state.damageDiceModal = null;

    // Open damage distribution modal so player can choose how to distribute damage
    import('../combat/combatManager.js').then(combatMod => {
        if (physicalDamage > 0 && mentalDamage > 0) {
            // Both physical and mental: distribute physical first, then mental will chain
            state.pendingMentalDamage = mentalDamage;
            combatMod.openDamageDistributionModal(mountEl, physicalDamage, 'event', 'physical');
        } else if (physicalDamage > 0) {
            combatMod.openDamageDistributionModal(mountEl, physicalDamage, 'event', 'physical');
        } else if (mentalDamage > 0) {
            combatMod.openDamageDistributionModal(mountEl, mentalDamage, 'event', 'mental');
        } else {
            // No damage at all, just continue
            if (state.pendingTokenPromptAfterDamage) {
                const { roomId, tokenType } = state.pendingTokenPromptAfterDamage;
                state.pendingTokenPromptAfterDamage = null;
                syncGameStateToServer();
                import('../events/eventToken.js').then(m => {
                    m.showTokenInteractionPrompt(mountEl, roomId, tokenType);
                });
                return;
            }
            const playerId = state.mySocketId;
            if (state.currentGameState && state.currentGameState.playerMoves[playerId] <= 0) {
                advanceToNextTurn();
            }
            updateGameUI(mountEl, state.currentGameState, state.mySocketId);
            syncGameStateToServer();
        }
    });
}
