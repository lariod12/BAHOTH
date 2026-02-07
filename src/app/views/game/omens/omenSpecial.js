// Special omen abilities - Secret Passage, room selection, token placement
import { state } from '../gameState.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { syncGameStateToServer } from '../turn/turnManager.js';
import { openEventResultModal } from '../events/eventResult.js';
import { getCharacterSpeed } from '../characters/characterManager.js';

export function getRevealedRoomsByFloor(floor) {
    const revealedRooms = state.currentGameState?.map?.revealedRooms || {};
    const rooms = Object.entries(revealedRooms).map(([roomId, room]) => ({
        roomId,
        name: room?.name || roomId,
        floor: room?.floor || 'ground'
    }));
    if (floor === 'any') return rooms;
    return rooms.filter(room => room.floor === floor);
}

export function getRoomsWithSpecialToken(gameState, tokenType) {
    const revealedRooms = gameState?.map?.revealedRooms || {};
    return Object.entries(revealedRooms)
        .filter(([, room]) => room?.specialTokens?.includes(tokenType))
        .map(([roomId, room]) => ({
            roomId,
            name: room?.name || roomId,
            floor: room?.floor || 'ground'
        }));
}

export function placeSpecialToken(roomId, tokenType) {
    if (!state.currentGameState?.map?.revealedRooms?.[roomId]) return false;
    const room = state.currentGameState.map.revealedRooms[roomId];
    if (!room.specialTokens) {
        room.specialTokens = [];
    }
    if (room.specialTokens.includes(tokenType)) {
        return false;
    }
    room.specialTokens.push(tokenType);
    if (!state.currentGameState.map.specialTokens) {
        state.currentGameState.map.specialTokens = [];
    }
    state.currentGameState.map.specialTokens.push({ roomId, tokenType });
    return true;
}

export function openRoomSelectModal(mountEl, title, description, rooms, tokenType, originRoomName = null, options = {}) {
    const allowedFloors = options.allowedFloors && options.allowedFloors.length > 0
        ? options.allowedFloors
        : ['basement', 'ground', 'upper'];
    const selectedFloor = allowedFloors.includes(options.selectedFloor) ? options.selectedFloor : allowedFloors[0];
    const mode = options.mode || 'placeToken';
    const allowSkip = !!options.allowSkip;

    state.roomSelectModal = {
        isOpen: true,
        title,
        description,
        rooms,
        tokenType,
        originRoomName,
        allowedFloors,
        selectedFloor,
        mode,
        pendingRoomId: null,
        selectionMode: 'menu',
        showConfirmModal: false,
        allowSkip,
        dropdownOpen: false
    };
    state.skipMapCentering = true;
    updateGameUI(mountEl, state.currentGameState, state.mySocketId);
}

export function isRoomSelectableForRoomSelect(roomId) {
    if (!state.roomSelectModal) return false;
    const room = state.roomSelectModal.rooms.find(r => r.roomId === roomId);
    if (!room) return false;
    if (state.roomSelectModal.selectedFloor && room.floor && room.floor !== state.roomSelectModal.selectedFloor) {
        return false;
    }
    return true;
}

export function handleRoomSelectChoice(mountEl, roomId) {
    if (!state.roomSelectModal) return;
    if (!isRoomSelectableForRoomSelect(roomId)) return;

    const { tokenType, originRoomName, mode, allowSkip } = state.roomSelectModal;
    const roomName = state.currentGameState.map?.revealedRooms?.[roomId]?.name || roomId;

    if (mode === 'teleport') {
        const playerId = state.mySocketId;
        if (state.currentGameState?.playerState?.playerPositions) {
            state.currentGameState.playerState.playerPositions[playerId] = roomId;
        }
        state.roomSelectModal = null;
        if (!allowSkip) {
            // Import dynamically to avoid circular dep at module level
            import('../turn/turnManager.js').then(m => m.advanceToNextTurn());
        }
        syncGameStateToServer();
        openEventResultModal(mountEl, 'DICH CHUYEN', `Ban da dich chuyen den ${roomName}.`, 'success');
        return;
    }

    if (mode === 'teleportAndDrawEvent') {
        const playerId = state.mySocketId;
        if (state.currentGameState?.playerState?.playerPositions) {
            state.currentGameState.playerState.playerPositions[playerId] = roomId;
        }
        state.roomSelectModal = null;
        // Advance turn synchronously before syncing
        const gs = state.currentGameState;
        gs.currentTurnIndex = (gs.currentTurnIndex + 1) % gs.turnOrder.length;
        const nextPlayerId = gs.turnOrder[gs.currentTurnIndex];
        const nextPlayer = gs.players.find(p => p.id === nextPlayerId);
        if (nextPlayer) {
            const nextCharData = gs.playerState?.characterData?.[nextPlayerId];
            const speed = getCharacterSpeed(nextPlayer.characterId, nextCharData);
            gs.playerMoves[nextPlayerId] = speed;
        }
        state.hasAttackedThisTurn = false;
        state.movesInitializedForTurn = -1;
        syncGameStateToServer();
        // Draw event card after teleporting via secret stairs
        import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(mountEl, ['event']));
        return;
    }

    if (!placeSpecialToken(roomId, tokenType)) {
        openEventResultModal(mountEl, 'DAT TOKEN THAT BAI', 'Khong the dat token tai phong duoc chon.', 'danger');
        return;
    }

    state.roomSelectModal = null;
    syncGameStateToServer();
    openEventResultModal(mountEl, 'DAT TOKEN', `Da dat token ${tokenType} tai ${originRoomName || 'phong hien tai'} va ${roomName}.`, 'success');
}

export function renderRoomSelectModal() {
    if (!state.roomSelectModal?.isOpen || state.roomSelectModal.selectionMode === 'map') return '';

    const { title, description, rooms, allowedFloors, selectedFloor, pendingRoomId, selectionMode, allowSkip, dropdownOpen } = state.roomSelectModal;
    const floorLabels = {
        basement: 'Tang ham',
        ground: 'Tang tret',
        upper: 'Tang tren'
    };

    const floorButtons = allowedFloors.map(floor => `
        <button class="floor-filter-btn ${selectedFloor === floor ? 'is-active' : ''}"
                type="button"
                data-action="room-select-floor"
                data-floor="${floor}">
            ${floorLabels[floor] || floor}
        </button>
    `).join('');

    const filteredRooms = selectedFloor
        ? rooms.filter(room => room.floor === selectedFloor)
        : rooms;

    const roomDropdown = filteredRooms.length > 0
        ? `
            <button class="room-select-dropdown" type="button" data-action="room-select-toggle">
                ${pendingRoomId ? (filteredRooms.find(r => r.roomId === pendingRoomId)?.name || pendingRoomId) : '-- Chon phong --'}
            </button>
            ${dropdownOpen ? `
                <div class="room-select-dropdown__menu">
                    ${filteredRooms.map(room => `
                        <button class="room-select-dropdown__item ${pendingRoomId === room.roomId ? 'is-selected' : ''}"
                                type="button"
                                data-action="room-select-item"
                                data-room-id="${room.roomId}">
                            ${room.name}
                        </button>
                    `).join('')}
                </div>
            ` : ''}
        `
        : `<div class="teleport-choice-modal__empty">Khong co phong tren tang nay.</div>`;

    const pendingRoomName = pendingRoomId
        ? rooms.find(room => room.roomId === pendingRoomId)?.name || pendingRoomId
        : '';

    return `
        <div class="teleport-choice-overlay teleport-choice-overlay--room-select">
            <div class="teleport-choice-modal ${selectionMode === 'map' ? 'teleport-choice-modal--map' : ''}" data-modal-content="true">
                <header class="teleport-choice-modal__header">
                    <h3 class="teleport-choice-modal__title">${title}</h3>
                </header>
                <div class="teleport-choice-modal__body">
                    <p class="teleport-choice-modal__description">${description}</p>
                    <div class="teleport-choice-modal__floors">
                        ${floorButtons}
                    </div>
                    <div class="teleport-choice-modal__mode">
                        <button class="selection-mode-btn ${selectionMode === 'menu' ? 'is-active' : ''}"
                                type="button"
                                data-action="room-select-mode"
                                data-mode="menu">
                            Chon tu menu
                        </button>
                        <button class="selection-mode-btn ${selectionMode === 'map' ? 'is-active' : ''}"
                                type="button"
                                data-action="room-select-mode"
                                data-mode="map">
                            Chon tren map
                        </button>
                    </div>
                    <p class="teleport-choice-modal__hint">Chon tren map se dong popup, sau do click phong va xac nhan.</p>
                    ${pendingRoomId ? `<div class="teleport-choice-modal__selected">Da chon: ${pendingRoomName}</div>` : ''}
                    ${selectionMode === 'menu' ? `
                        <div class="teleport-choice-modal__options">
                            ${roomDropdown}
                        </div>
                    ` : ''}
                    <div class="teleport-choice-modal__actions">
                        ${allowSkip ? `
                            <button class="action-button action-button--secondary"
                                    type="button"
                                    data-action="room-select-skip">
                                Bo qua
                            </button>
                        ` : ''}
                        <button class="action-button action-button--secondary"
                                type="button"
                                data-action="room-select-confirm"
                                ${!pendingRoomId ? 'disabled' : ''}>
                            Xac nhan
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function renderRoomSelectConfirmModal() {
    if (!state.roomSelectModal?.showConfirmModal || !state.roomSelectModal.pendingRoomId) return '';

    const roomName = state.currentGameState?.map?.revealedRooms?.[state.roomSelectModal.pendingRoomId]?.name
        || state.roomSelectModal.pendingRoomId;

    return `
        <div class="teleport-choice-overlay teleport-choice-overlay--room-select-confirm">
            <div class="teleport-choice-modal teleport-choice-modal--confirm" data-modal-content="true">
                <header class="teleport-choice-modal__header">
                    <h3 class="teleport-choice-modal__title">XAC NHAN PHONG</h3>
                </header>
                <div class="teleport-choice-modal__body">
                    <p class="teleport-choice-modal__description">Ban muon chon phong:</p>
                    <div class="teleport-choice-modal__selected">${roomName}</div>
                    <div class="teleport-choice-modal__actions">
                        <button class="action-button action-button--secondary"
                                type="button"
                                data-action="room-select-confirm-map">
                            Xac nhan
                        </button>
                        <button class="action-button action-button--secondary"
                                type="button"
                                data-action="room-select-cancel-map">
                            Huy
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function tryPromptSecretPassageBeforeTurnEnd() {
    if (!state.currentGameState || !state.mySocketId || !state.mountElRef) return false;

    const currentTurnPlayer = state.currentGameState.turnOrder?.[state.currentGameState.currentTurnIndex];
    if (currentTurnPlayer !== state.mySocketId) return false;

    if (state.secretPassagePromptedTurnIndex === state.currentGameState.currentTurnIndex &&
        state.secretPassagePromptedPlayerId === currentTurnPlayer) {
        return false;
    }

    const movesLeft = state.currentGameState.playerMoves?.[currentTurnPlayer] ?? 0;
    if (movesLeft > 0) return false;

    const currentRoomId = state.currentGameState.playerState?.playerPositions?.[currentTurnPlayer];
    const currentRoom = currentRoomId ? state.currentGameState.map?.revealedRooms?.[currentRoomId] : null;

    // Check Secret Passage first
    if (currentRoom?.specialTokens?.includes('secretPassage')) {
        const roomsWithToken = getRoomsWithSpecialToken(state.currentGameState, 'secretPassage')
            .filter(room => room.roomId !== currentRoomId);
        if (roomsWithToken.length > 0) {
            state.secretPassagePromptedTurnIndex = state.currentGameState.currentTurnIndex;
            state.secretPassagePromptedPlayerId = currentTurnPlayer;

            const allowedFloors = [...new Set(roomsWithToken.map(room => room.floor))];
            const selectedFloor = allowedFloors.includes(currentRoom?.floor) ? currentRoom.floor : allowedFloors[0];
            const originRoomName = currentRoom?.name || currentRoomId || 'phong hien tai';

            if (roomsWithToken.length === 1) {
                const targetRoomId = roomsWithToken[0].roomId;
                state.currentGameState.playerState.playerPositions[currentTurnPlayer] = targetRoomId;
                import('../turn/turnManager.js').then(m => m.advanceToNextTurn());
                syncGameStateToServer();
                updateGameUI(state.mountElRef, state.currentGameState, state.mySocketId);
                return true;
            }

            openRoomSelectModal(
                state.mountElRef,
                'SU DUNG SECRET PASSAGE',
                'Ban dang dung tren Secret Passage. Muon dich chuyen truoc khi ket thuc luot?',
                roomsWithToken, 'secretPassage', originRoomName,
                { allowedFloors, selectedFloor, mode: 'teleport', allowSkip: false }
            );
            return true;
        }
    }

    // Check Secret Stairs
    // Unlike secretPassage, secretStairs returns false so the calling advanceToNextTurn()
    // handles the turn advance itself. We just teleport + queue event draw as side effect.
    if (currentRoom?.specialTokens?.includes('secretStairs')) {
        const roomsWithToken = getRoomsWithSpecialToken(state.currentGameState, 'secretStairs')
            .filter(room => room.roomId !== currentRoomId);
        if (roomsWithToken.length > 0) {
            state.secretPassagePromptedTurnIndex = state.currentGameState.currentTurnIndex;
            state.secretPassagePromptedPlayerId = currentTurnPlayer;

            if (roomsWithToken.length === 1) {
                // Auto-teleport to the only target, then let advanceToNextTurn proceed
                const targetRoomId = roomsWithToken[0].roomId;
                state.currentGameState.playerState.playerPositions[currentTurnPlayer] = targetRoomId;
                // Queue event draw after turn advances
                setTimeout(() => {
                    import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(state.mountElRef, ['event']));
                }, 100);
                // Return false so the original advanceToNextTurn() completes the turn advance
                return false;
            }

            // Multiple targets: show room select modal, block turn advance
            const allowedFloors = [...new Set(roomsWithToken.map(room => room.floor))];
            const selectedFloor = allowedFloors.includes(currentRoom?.floor) ? currentRoom.floor : allowedFloors[0];
            const originRoomName = currentRoom?.name || currentRoomId || 'phong hien tai';

            openRoomSelectModal(
                state.mountElRef,
                'CAU THANG BI MAT',
                'Ban dang dung tren Cau thang bi mat. Muon dich chuyen va rut Event?',
                roomsWithToken, 'secretStairs', originRoomName,
                { allowedFloors, selectedFloor, mode: 'teleportAndDrawEvent', allowSkip: false }
            );
            return true;
        }
    }

    return false;
}

/**
 * Use secret stairs manually (button click when moves = 0)
 */
export function useSecretStairs(mountEl) {
    const playerId = state.mySocketId;
    const movesLeft = state.currentGameState?.playerMoves?.[playerId] ?? 0;
    if (movesLeft > 0) return;

    const currentRoomId = state.currentGameState?.playerState?.playerPositions?.[playerId];
    const currentRoom = currentRoomId ? state.currentGameState?.map?.revealedRooms?.[currentRoomId] : null;
    if (!currentRoom?.specialTokens?.includes('secretStairs')) return;

    const roomsWithToken = getRoomsWithSpecialToken(state.currentGameState, 'secretStairs')
        .filter(room => room.roomId !== currentRoomId);
    if (roomsWithToken.length === 0) {
        openEventResultModal(mountEl, 'CAU THANG BI MAT', 'Khong co phong nao khac co cau thang bi mat.', 'neutral');
        return;
    }

    if (roomsWithToken.length === 1) {
        // Auto-teleport, advance turn synchronously, then draw event
        const targetRoomId = roomsWithToken[0].roomId;
        state.currentGameState.playerState.playerPositions[playerId] = targetRoomId;
        // Advance turn directly by manipulating state, then sync
        const gs = state.currentGameState;
        gs.currentTurnIndex = (gs.currentTurnIndex + 1) % gs.turnOrder.length;
        const nextPlayerId = gs.turnOrder[gs.currentTurnIndex];
        const nextPlayer = gs.players.find(p => p.id === nextPlayerId);
        if (nextPlayer) {
            const nextCharData = gs.playerState?.characterData?.[nextPlayerId];
            const speed = getCharacterSpeed(nextPlayer.characterId, nextCharData);
            gs.playerMoves[nextPlayerId] = speed;
        }
        state.hasAttackedThisTurn = false;
        state.movesInitializedForTurn = -1;
        syncGameStateToServer();
        import('../cards/tokenDrawing.js').then(m => m.initTokenDrawing(mountEl, ['event']));
        return;
    }

    const allowedFloors = [...new Set(roomsWithToken.map(r => r.floor))];
    const selectedFloor = allowedFloors.includes(currentRoom?.floor) ? currentRoom.floor : allowedFloors[0];
    openRoomSelectModal(
        mountEl,
        'CAU THANG BI MAT',
        'Chon phong de dich chuyen qua cau thang bi mat. Sau do rut 1 la Event.',
        roomsWithToken, 'secretStairs', currentRoom?.name || currentRoomId,
        { allowedFloors, selectedFloor, mode: 'teleportAndDrawEvent', allowSkip: false }
    );
}
