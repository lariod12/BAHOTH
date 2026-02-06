// Special omen abilities - Secret Passage, room selection, token placement
import { state } from '../gameState.js';
import { updateGameUI } from '../ui/mainRenderer.js';
import { syncGameStateToServer } from '../turn/turnManager.js';
import { openEventResultModal } from '../events/eventResult.js';

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
    if (!currentRoom?.specialTokens?.includes('secretPassage')) return false;

    const roomsWithToken = getRoomsWithSpecialToken(state.currentGameState, 'secretPassage')
        .filter(room => room.roomId !== currentRoomId);
    if (roomsWithToken.length === 0) return false;

    const allowedFloors = [...new Set(roomsWithToken.map(room => room.floor))];
    const selectedFloor = allowedFloors.includes(currentRoom?.floor) ? currentRoom.floor : allowedFloors[0];
    const title = 'SU DUNG SECRET PASSAGE';
    const description = 'Ban dang dung tren Secret Passage. Muon dich chuyen truoc khi ket thuc luot?';
    const originRoomName = currentRoom?.name || currentRoomId || 'phong hien tai';

    state.secretPassagePromptedTurnIndex = state.currentGameState.currentTurnIndex;
    state.secretPassagePromptedPlayerId = currentTurnPlayer;

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
        title,
        description,
        roomsWithToken,
        'secretPassage',
        originRoomName,
        { allowedFloors, selectedFloor, mode: 'teleport', allowSkip: false }
    );
    return true;
}
