// Event Token Module - handles token placement events
import { state } from '../gameState.js';
import { EVENTS } from '../../../data/cardsData.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { syncGameStateToServer, advanceToNextTurn } from '../turn/turnManager.js';
import { openEventResultModal } from './eventResult.js';
import { openEventDiceModal, openDamageDiceModal } from './eventDice.js';
import { getPlayerStatForDice } from '../characters/characterManager.js';
import { findMatchingOutcome } from '../../../utils/eventEffects.js';
import { placeSpecialToken } from '../omens/omenSpecial.js';
import { getOppositeDoor, doorDirToSide } from '../movement/roomUtils.js';

/**
 * Handle place token event - places token on current room and shows result
 */
export function handlePlaceTokenEvent(mountEl, eventCard) {
    const playerId = state.mySocketId;
    const roomId = state.currentGameState?.playerState?.playerPositions?.[playerId];

    if (!roomId) {
        openEventResultModal(mountEl, 'LOI', 'Khong tim thay phong hien tai.', 'danger');
        return;
    }

    // Wall Switch: special placement flow - need to pick a wall side
    if (eventCard.tokenType === 'wallSwitch') {
        state.wallSwitchPlacementModal = {
            isOpen: true,
            roomId,
            eventCard,
            selectedSide: null,
        };
        console.log('[EventToken] Opening wall switch placement mode for room', roomId);
        state.skipMapCentering = true;
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
        return;
    }

    // Place the token on the current room
    placeSpecialToken(roomId, eventCard.tokenType);
    console.log('[EventToken] Placed token', eventCard.tokenType, 'in room', roomId);

    // Build result message based on token type
    const tokenNames = {
        closet: 'Closet', smoke: 'Smoke', safe: 'Safe', skeletons: 'Skeletons',
        drip: 'Drip', wallSwitch: 'Wall Switch', blessing: 'Blessing',
        secretStairs: 'Secret Stairs', slide: 'Slide', secretPassage: 'Secret Passage'
    };
    const tokenName = tokenNames[eventCard.tokenType] || eventCard.tokenType;
    const roomName = state.currentGameState?.map?.revealedRooms?.[roomId]?.name || roomId;

    // Build description of room effect
    let effectDesc = '';
    if (eventCard.roomEffect) {
        if (eventCard.roomEffect.diceReduction) {
            effectDesc += ` Nguoi choi trong phong nay phai do it hon ${eventCard.roomEffect.diceReduction} xuc xac.`;
        }
        if (eventCard.roomEffect.diceBonus) {
            effectDesc += ` Nguoi choi chinh dien trong phong nay duoc do nhieu hon ${eventCard.roomEffect.diceBonus} xuc xac.`;
        }
        if (eventCard.roomEffect.blocksLineOfSight) {
            effectDesc += ` Can tam nhin den phong lien ke.`;
        }
    }

    // Store room effect in game state
    if (eventCard.roomEffect) {
        if (!state.currentGameState.roomTokenEffects) {
            state.currentGameState.roomTokenEffects = {};
        }
        state.currentGameState.roomTokenEffects[roomId] = {
            tokenType: eventCard.tokenType,
            ...eventCard.roomEffect
        };
    }

    // Store token interactions BEFORE handling immediate effects
    // (so interaction data is available when the prompt opens after damage resolves)
    if (eventCard.tokenInteraction || eventCard.rollResults) {
        if (!state.currentGameState.tokenInteractions) {
            state.currentGameState.tokenInteractions = {};
        }
        if (eventCard.tokenInteraction) {
            state.currentGameState.tokenInteractions[roomId] = {
                tokenType: eventCard.tokenType,
                ...eventCard.tokenInteraction
            };
        } else if (eventCard.rollResults) {
            state.currentGameState.tokenInteractions[roomId] = {
                tokenType: eventCard.tokenType,
                fixedDice: eventCard.fixedDice || 2,
                rollStat: eventCard.interactionRollStat || null,
                rollResults: eventCard.rollResults,
            };
        }
    }

    // Handle immediate effects (e.g., bo_hai_cot has immediateEffect)
    // This must come AFTER storing tokenInteractions above
    if (eventCard.immediateEffect) {
        const effect = eventCard.immediateEffect;
        if (effect.effect === 'mentalDamage' && effect.dice) {
            // If this token also has interaction, chain the prompt after damage resolves
            const promptConfig = TOKEN_PROMPT_CONFIG[eventCard.tokenType];
            if (promptConfig && promptConfig.promptOnPlacement) {
                state.pendingTokenPromptAfterDamage = { roomId, tokenType: eventCard.tokenType };
            }
            syncGameStateToServer();
            openDamageDiceModal(mountEl, 0, effect.dice);
            return;
        }
    }

    // For dual token placement (e.g., cau_thang_bi_mat), open room select for second token
    if (eventCard.tokenCount === 2) {
        syncGameStateToServer();
        import('../omens/omenSpecial.js').then(m => {
            const revealedRooms = state.currentGameState?.map?.revealedRooms || {};
            const currentRoom = revealedRooms[roomId];
            const currentFloor = currentRoom?.floor;
            const otherFloorRooms = Object.entries(revealedRooms)
                .filter(([rid, room]) => room.floor !== currentFloor && rid !== roomId)
                .map(([rid, room]) => ({ roomId: rid, name: room.name, floor: room.floor }));

            if (otherFloorRooms.length > 0) {
                const allowedFloors = [...new Set(otherFloorRooms.map(r => r.floor))];
                m.openRoomSelectModal(mountEl,
                    `DAT TOKEN ${tokenName.toUpperCase()} THU 2`,
                    `Chon phong o tang khac de dat token thu 2.`,
                    otherFloorRooms, eventCard.tokenType, roomName,
                    { allowedFloors, selectedFloor: allowedFloors[0], mode: 'placeToken' }
                );
            } else {
                openEventResultModal(mountEl, 'DAT TOKEN', `Da dat token ${tokenName} tai ${roomName}.${effectDesc}`, 'success');
            }
        });
        return;
    }

    syncGameStateToServer();

    // For interactive tokens: immediately prompt player to interact
    const promptConfig = TOKEN_PROMPT_CONFIG[eventCard.tokenType];
    if (promptConfig && promptConfig.promptOnPlacement) {
        showTokenInteractionPrompt(mountEl, roomId, eventCard.tokenType);
        return;
    }

    openEventResultModal(mountEl, 'DAT TOKEN', `Da dat token ${tokenName} tai ${roomName}.${effectDesc}`, 'success');
}

/**
 * Open token interaction modal - when player wants to interact with a token in their room
 */
export function openTokenInteractionModal(mountEl, tokenType) {
    const playerId = state.mySocketId;
    const roomId = state.currentGameState?.playerState?.playerPositions?.[playerId];
    if (!roomId) return;

    const interaction = state.currentGameState?.tokenInteractions?.[roomId];
    if (!interaction || interaction.tokenType !== tokenType) {
        console.warn('[EventToken] No interaction found for token', tokenType, 'in room', roomId);
        return;
    }

    const diceCount = interaction.rollStat
        ? getPlayerStatForDice(playerId, interaction.rollStat)
        : interaction.fixedDice || 2;

    const statLabels = { speed: 'Speed', might: 'Might', sanity: 'Sanity', knowledge: 'Knowledge' };
    const statLabel = interaction.rollStat ? statLabels[interaction.rollStat] : '';

    state.tokenInteractionModal = {
        isOpen: true,
        tokenType: tokenType,
        roomId: roomId,
        interaction: interaction,
        diceCount: diceCount,
        statLabel: statLabel,
        inputValue: '',
        result: null,
    };

    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Apply token interaction dice result
 */
export function applyTokenInteractionResult(mountEl) {
    if (!state.tokenInteractionModal) return;

    const { interaction, result, roomId, tokenType } = state.tokenInteractionModal;
    const playerId = state.mySocketId;

    const outcome = findMatchingOutcome(interaction.rollResults, result);
    if (!outcome) {
        state.tokenInteractionModal = null;
        openEventResultModal(mountEl, 'KHONG CO GI', 'Khong co gi xay ra.', 'neutral');
        return;
    }

    state.tokenInteractionModal = null;

    // Handle outcomes
    switch (outcome.effect) {
        case 'drawItem': {
            const count = outcome.amount || 1;
            import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(mountEl, Array(count).fill('item')));
            break;
        }
        case 'drawEvent': {
            import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(mountEl, ['event']));
            break;
        }
        case 'removeToken': {
            // Remove token from room
            removeTokenFromRoom(roomId, tokenType);

            // Ensure room is marked as drawn so it won't re-trigger events
            if (!state.currentGameState.playerState.drawnRooms) {
                state.currentGameState.playerState.drawnRooms = [];
            }
            if (!state.currentGameState.playerState.drawnRooms.includes(roomId)) {
                state.currentGameState.playerState.drawnRooms.push(roomId);
            }

            // Closet special case: just vanishes, nothing else happens
            if (tokenType === 'closet') {
                syncGameStateToServer();
                openEventResultModal(mountEl, 'AO ANH!', 'Cai tu dot nhien bien mat, ban nhan ra do la ao anh.', 'neutral');
                break;
            }

            if (outcome.then) {
                if (outcome.then.effect === 'drawItem') {
                    const count = outcome.then.amount || 1;
                    syncGameStateToServer();
                    import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(mountEl, Array(count).fill('item')));
                } else if (outcome.then.effect === 'drawEvent') {
                    syncGameStateToServer();
                    import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(mountEl, ['event']));
                }
            } else if (outcome.draw === 'event') {
                syncGameStateToServer();
                import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(mountEl, ['event']));
            } else {
                syncGameStateToServer();
                openEventResultModal(mountEl, 'TOKEN DA BI BO', `Token ${tokenType} da bi loai bo khoi phong.`, 'neutral');
            }
            break;
        }
        case 'physicalDamage': {
            syncGameStateToServer();
            openDamageDiceModal(mountEl, outcome.dice, 0);
            break;
        }
        case 'mentalDamage': {
            syncGameStateToServer();
            openDamageDiceModal(mountEl, 0, outcome.dice);
            break;
        }
        case 'useWallSwitch': {
            // Look up wall switch connection and teleport player
            const wsConn = state.currentGameState?.wallSwitchConnections?.[roomId];
            if (!wsConn || !wsConn.connectedRoomId) {
                openEventResultModal(mountEl, 'LOI', 'Khong tim thay ket noi cua xoay.', 'danger');
                break;
            }
            const targetRoomId = wsConn.connectedRoomId;
            const targetRoomName = state.currentGameState?.map?.revealedRooms?.[targetRoomId]?.name || targetRoomId;
            state.currentGameState.playerState.playerPositions[playerId] = targetRoomId;
            // Free move - do NOT deduct movement
            syncGameStateToServer();
            openEventResultModal(mountEl, 'CUA XOAY', `Ban da dung cua xoay de di chuyen den ${targetRoomName} (khong ton buoc).`, 'success');
            break;
        }
        case 'nothing': {
            openEventResultModal(mountEl, 'KHONG CO GI', 'Khong co gi xay ra.', 'neutral');
            break;
        }
        default: {
            openEventResultModal(mountEl, 'KET QUA', `Hieu ung: ${outcome.effect}`, 'neutral');
            break;
        }
    }
}

// ============================================================
// WALL SWITCH PLACEMENT FLOW
// ============================================================

/**
 * Complete the wall switch placement after a wall side is selected
 */
export function completeWallSwitchPlacement(mountEl, side) {
    const wsModal = state.wallSwitchPlacementModal;
    if (!wsModal) return;

    const { roomId, eventCard } = wsModal;
    const playerId = state.mySocketId;
    const revealedRooms = state.currentGameState?.map?.revealedRooms || {};
    const currentRoom = revealedRooms[roomId];
    if (!currentRoom) return;

    // Close the wall selection mode
    state.wallSwitchPlacementModal = null;

    // Place the wallSwitch token on the current room
    placeSpecialToken(roomId, eventCard.tokenType);
    console.log('[EventToken] Placed wallSwitch token in room', roomId, 'on side', side);

    // Calculate adjacent position
    const dirOffsets = { north: { x: 0, y: 1 }, south: { x: 0, y: -1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };
    const offset = dirOffsets[side];
    const targetX = currentRoom.x + offset.x;
    const targetY = currentRoom.y + offset.y;

    // Check if an adjacent room already exists at that position on the same floor
    let adjacentRoomId = null;
    for (const [rid, room] of Object.entries(revealedRooms)) {
        if (room.floor === currentRoom.floor && room.x === targetX && room.y === targetY) {
            adjacentRoomId = rid;
            break;
        }
    }

    // Store token interactions for current room
    if (!state.currentGameState.tokenInteractions) {
        state.currentGameState.tokenInteractions = {};
    }
    state.currentGameState.tokenInteractions[roomId] = {
        tokenType: 'wallSwitch',
        rollStat: eventCard.tokenInteraction?.rollStat || 'knowledge',
        rollResults: eventCard.tokenInteraction?.rollResults || [
            { range: '3+', effect: 'useWallSwitch', freeMove: true },
            { range: '0-2', effect: 'nothing' },
        ],
    };

    if (adjacentRoomId) {
        // Adjacent room exists - connect them and place token on the second room
        _finalizeWallSwitchConnection(mountEl, roomId, adjacentRoomId, side, eventCard);
    } else {
        // No adjacent room - open room discovery modal to draw a new room
        const currentFloor = currentRoom.floor;
        const requiredDoorSide = doorDirToSide(getOppositeDoor(side));

        state.roomDiscoveryModal = {
            isOpen: true,
            direction: side,
            floor: currentFloor,
            doorSide: requiredDoorSide,
            selectedRoom: null,
            currentRotation: 0,
            selectedFloor: null,
            needsFloorSelection: false,
            // Custom flag to indicate this is for wall switch placement
            wallSwitchContext: {
                originRoomId: roomId,
                side: side,
                eventCard: eventCard,
            },
        };
        updateGameUI(mountEl, state.currentGameState, state.mySocketId);
    }
}

/**
 * Finalize the wall switch connection between two rooms
 * Called either after side selection (adjacent exists) or after room discovery (new room placed)
 */
export function _finalizeWallSwitchConnection(mountEl, roomAId, roomBId, side, eventCard) {
    const oppositeSide = getOppositeDoor(side);

    // Place wallSwitch token on the second room too
    placeSpecialToken(roomBId, 'wallSwitch');

    // Ensure map connections exist between the two rooms (for wall switch traversal)
    if (!state.currentGameState.map.connections[roomAId]) state.currentGameState.map.connections[roomAId] = {};
    if (!state.currentGameState.map.connections[roomBId]) state.currentGameState.map.connections[roomBId] = {};

    // Store bidirectional wall switch connections
    if (!state.currentGameState.wallSwitchConnections) {
        state.currentGameState.wallSwitchConnections = {};
    }
    state.currentGameState.wallSwitchConnections[roomAId] = {
        side: side,
        connectedRoomId: roomBId,
    };
    state.currentGameState.wallSwitchConnections[roomBId] = {
        side: oppositeSide,
        connectedRoomId: roomAId,
    };

    // Store token interactions for second room too
    if (!state.currentGameState.tokenInteractions) {
        state.currentGameState.tokenInteractions = {};
    }
    state.currentGameState.tokenInteractions[roomBId] = {
        tokenType: 'wallSwitch',
        rollStat: eventCard.tokenInteraction?.rollStat || 'knowledge',
        rollResults: eventCard.tokenInteraction?.rollResults || [
            { range: '3+', effect: 'useWallSwitch', freeMove: true },
            { range: '0-2', effect: 'nothing' },
        ],
    };

    const roomAName = state.currentGameState?.map?.revealedRooms?.[roomAId]?.name || roomAId;
    const roomBName = state.currentGameState?.map?.revealedRooms?.[roomBId]?.name || roomBId;
    console.log('[EventToken] Wall switch connected:', roomAName, '<->', roomBName);

    syncGameStateToServer();

    // Prompt the player to use the wall switch immediately
    showTokenInteractionPrompt(mountEl, roomAId, 'wallSwitch');
}

/**
 * Confirm token placement (for modals)
 */
export function confirmTokenPlacement(mountEl) {
    state.tokenPlacementModal = null;
    const playerId = state.mySocketId;
    if (state.currentGameState?.playerMoves?.[playerId] <= 0) {
        advanceToNextTurn();
    }
    syncGameStateToServer();
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Remove a token from a room
 */
function removeTokenFromRoom(roomId, tokenType) {
    const room = state.currentGameState?.map?.revealedRooms?.[roomId];
    if (room?.specialTokens) {
        const idx = room.specialTokens.indexOf(tokenType);
        if (idx >= 0) room.specialTokens.splice(idx, 1);
    }
    if (state.currentGameState?.tokenInteractions?.[roomId]) {
        delete state.currentGameState.tokenInteractions[roomId];
    }
    if (state.currentGameState?.roomTokenEffects?.[roomId]) {
        delete state.currentGameState.roomTokenEffects[roomId];
    }
}

// ============================================================
// TOKEN INTERACTION PROMPT CONFIG
// ============================================================

const TOKEN_PROMPT_CONFIG = {
    closet: {
        title: 'CANH CUA TU',
        description: 'Canh cua tu kia dang mo... Co gi do ben trong.\nBan co muon mo cua tu khong? (Do 2 xuc xac)',
        acceptLabel: 'MO CUA TU',
        promptOnPlacement: true,
        promptOnEntry: true,
    },
    safe: {
        title: 'KET SAT BI KHOA',
        description: 'Mot cai ket sat bi khoa phia sau buc chan dung.\nBan co muon thu mo ket sat khong? (Do xuc xac Knowledge)',
        acceptLabel: 'MO KET SAT',
        promptOnPlacement: true,
        promptOnEntry: true,
    },
    skeletons: {
        title: 'BO HAI COT',
        description: 'Mot nua than tren cua bo hai cot dang bi chon duoi dat.\nBan co muon dao len khong? (Do xuc xac Sanity)',
        acceptLabel: 'DAO LEN',
        promptOnPlacement: true,
        promptOnEntry: true,
    },
    wallSwitch: {
        title: 'CUA XOAY',
        description: 'Cai cua xoay dan den noi khac.\nBan co muon su dung cua xoay khong? (Do xuc xac Knowledge 3+)',
        acceptLabel: 'SU DUNG',
        promptOnPlacement: true,
        promptOnEntry: true,
    },
};

// ============================================================
// TOKEN INTERACTION PROMPT (GENERIC)
// ============================================================

/**
 * Block all wallSwitch prompts for the current turn (any room)
 * Called after accepting OR declining a wallSwitch prompt (1 attempt per turn)
 */
function _blockAllWallSwitchPromptsThisTurn() {
    const tc = state.turnCounter;
    const wsConns = state.currentGameState?.wallSwitchConnections || {};
    for (const rid of Object.keys(wsConns)) {
        state.lastTokenPromptKeys.add(`${rid}_wallSwitch_${tc}`);
    }
    // Also block for the player's current room
    const playerId = state.mySocketId;
    const currentRoomId = state.currentGameState?.playerState?.playerPositions?.[playerId];
    if (currentRoomId) {
        state.lastTokenPromptKeys.add(`${currentRoomId}_wallSwitch_${tc}`);
    }
}

/**
 * Show prompt asking if player wants to interact with a token
 */
export function showTokenInteractionPrompt(mountEl, roomId, tokenType) {
    const config = TOKEN_PROMPT_CONFIG[tokenType];
    if (!config) return;

    const roomName = state.currentGameState?.map?.revealedRooms?.[roomId]?.name || roomId;
    const currentTurnIdx = state.turnCounter;

    state.tokenPromptModal = {
        isOpen: true,
        roomId,
        roomName,
        tokenType,
    };
    state.lastTokenPromptKeys.add(`${roomId}_${tokenType}_${currentTurnIdx}`);
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

/**
 * Check if player's current room has any interactive token and prompt if not yet prompted
 */
export function checkTokenInteractionOnRoomEntry(mountEl) {
    const playerId = state.mySocketId;
    const roomId = state.currentGameState?.playerState?.playerPositions?.[playerId];
    if (!roomId) return false;

    const room = state.currentGameState?.map?.revealedRooms?.[roomId];
    if (!room?.specialTokens?.length) return false;

    // Don't prompt if another modal is open
    if (state.tokenInteractionModal?.isOpen || state.tokenPromptModal?.isOpen ||
        state.tokenDrawingModal?.isOpen || state.eventDiceModal?.isOpen ||
        state.roomDiscoveryModal?.isOpen || state.damageDiceModal ||
        state.wallSwitchPlacementModal?.isOpen ||
        state.eventResultModal?.isOpen) return false;

    const currentTurnIdx = state.turnCounter;

    // Check each interactive token in the room
    for (const tokenType of room.specialTokens) {
        const config = TOKEN_PROMPT_CONFIG[tokenType];
        if (!config || !config.promptOnEntry) continue;

        const promptKey = `${roomId}_${tokenType}_${currentTurnIdx}`;
        if (state.lastTokenPromptKeys.has(promptKey)) continue;

        // Check that there's actually an interaction registered for this token
        const hasInteraction = state.currentGameState?.tokenInteractions?.[roomId]?.tokenType === tokenType;
        if (!hasInteraction) continue;

        showTokenInteractionPrompt(mountEl, roomId, tokenType);
        return true;
    }

    return false;
}

/**
 * Handle token prompt accept - open the interaction modal
 */
export function acceptTokenPrompt(mountEl) {
    const tokenType = state.tokenPromptModal?.tokenType;
    state.tokenPromptModal = null;

    // Wall switch: block all prompts for this turn after accepting (1 attempt per turn)
    if (tokenType === 'wallSwitch') {
        _blockAllWallSwitchPromptsThisTurn();
    }

    if (tokenType) {
        openTokenInteractionModal(mountEl, tokenType);
    }
}

/**
 * Handle token prompt decline - close and continue
 */
export function declineTokenPrompt(mountEl) {
    const declinedType = state.tokenPromptModal?.tokenType;
    state.tokenPromptModal = null;

    // Wall switch: block all prompts for this turn after declining (1 attempt per turn)
    if (declinedType === 'wallSwitch') {
        _blockAllWallSwitchPromptsThisTurn();
    }

    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================

export function renderTokenPromptModal() {
    if (!state.tokenPromptModal?.isOpen) return '';

    const tokenType = state.tokenPromptModal.tokenType;
    const config = TOKEN_PROMPT_CONFIG[tokenType];
    if (!config) return '';

    const descriptionHtml = config.description.replace(/\n/g, '<br>');

    return `
        <div class="event-choice-overlay">
            <div class="event-choice-modal">
                <h3 class="event-choice-modal__title">${config.title}</h3>
                <p class="event-choice-modal__description">${descriptionHtml}</p>
                <div class="event-choice-modal__actions">
                    <button class="action-button action-button--primary" type="button" data-action="token-prompt-accept">${config.acceptLabel}</button>
                    <button class="action-button action-button--secondary" type="button" data-action="token-prompt-decline">KHONG</button>
                </div>
            </div>
        </div>
    `;
}

export function renderTokenInteractionModal() {
    if (!state.tokenInteractionModal?.isOpen) return '';
    const { tokenType, diceCount, statLabel, result } = state.tokenInteractionModal;
    const hasResult = result !== null;
    const tokenNames = {
        closet: 'Canh cua tu', safe: 'Ket sat', skeletons: 'Bo hai cot',
        wallSwitch: 'Cua xoay', slide: 'Cau truot'
    };
    const tokenName = tokenNames[tokenType] || tokenType;

    let bodyContent = '';
    if (hasResult) {
        bodyContent = `
            <div class="event-dice-modal__result">
                <span class="event-dice-modal__result-label">Ket qua:</span>
                <span class="event-dice-modal__result-value">${result}</span>
            </div>
            <div class="event-dice-modal__actions event-dice-modal__actions--result">
                <button class="event-dice-modal__btn event-dice-modal__btn--continue" type="button" data-action="token-interact-apply">Ap dung ket qua</button>
            </div>`;
    } else {
        bodyContent = `
            <div class="event-dice-modal__roll-info"><p>Do ${diceCount} vien xuc xac ${statLabel}</p></div>
            <div class="event-dice-modal__input-group">
                <label class="event-dice-modal__label">Nhap ket qua xuc xac:</label>
                <input type="number" class="event-dice-modal__input" min="0" value="" data-input="token-interact-dice-value" placeholder="Nhap so" />
            </div>
            <div class="event-dice-modal__actions">
                <button class="event-dice-modal__btn event-dice-modal__btn--confirm" type="button" data-action="token-interact-confirm">Xac nhan</button>
                <button class="event-dice-modal__btn event-dice-modal__btn--random" type="button" data-action="token-interact-random">Ngau nhien</button>
            </div>`;
    }

    return `
        <div class="event-dice-overlay">
            <div class="event-dice-modal" data-modal-content="true">
                <header class="event-dice-modal__header">
                    <h3 class="event-dice-modal__title">TUONG TAC: ${tokenName}</h3>
                </header>
                <div class="event-dice-modal__body">${bodyContent}</div>
            </div>
        </div>
    `;
}
