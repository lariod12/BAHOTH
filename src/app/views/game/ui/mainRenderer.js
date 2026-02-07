// Main renderer - renderGameScreen, updateGameUI, and all UI render helpers
import { state, DICE_ROLL_ROOMS, ROOM_EFFECTS } from '../gameState.js';
import { CHARACTER_BY_ID } from '../../../data/charactersData.js';
import { ROOMS } from '../../../data/mapsData.js';
import { ITEMS, EVENTS, OMENS } from '../../../data/cardsData.js';
import { renderGameMap, buildPlayerNamesMap, buildPlayerColorsMap } from '../../../components/GameMap.js';
import { isHauntTriggered, getFaction, isAlly, isEnemy, getFactionLabel } from '../../../utils/factionUtils.js';
import * as socketClient from '../../../services/socketClient.js';
import {
    getCharacterName, getCharacterColor, getCharacterSpeed,
    getAllStatValues, removeDiacritics
} from '../characters/characterManager.js';
import { isMyTurn, needsToRoll, syncGameStateToServer, centerMapOnPlayer, centerMapOnPreview } from '../turn/turnManager.js';
import { getCardData } from '../items/itemInventory.js';
import {
    isDoorBlocked, convertDoorSide, rotateRoomDoors, isRotationValid,
    getAvailableRoomsForFloor, filterRoomsWithConnectingDoor, getFloorDisplayName
} from '../movement/roomUtils.js';
import { getRoomsWithSpecialToken } from '../omens/omenSpecial.js';
import { getPlayerStatForDice } from '../characters/characterManager.js';
import { openTrappedEscapeModal } from '../events/eventTrapped.js';
import { openEventResultModal } from '../events/eventResult.js';
import { applyPersistentTurnEffect } from '../events/eventPersistent.js';
import { removePendingEvent } from '../events/pendingEvents.js';
import { handleReflectionEvent } from '../events/eventReflection.js';

// -- Import render functions from domain modules --
import { renderTokenDrawingModal } from '../cards/tokenDrawing.js';
import { renderCardsViewModal } from '../cards/cardsView.js';
import { renderCombatModal, renderDamageDistributionModal } from '../combat/combatRenderer.js';
import { renderEventResultModal as renderEventResultModalFn } from '../events/eventResult.js';
import { renderReturnItemModal as renderReturnItemModalFn } from '../events/eventReflection.js';
import { renderTrappedEscapeModal as renderTrappedEscapeModalFn, renderRescueTrappedModal as renderRescueTrappedModalFn } from '../events/eventTrapped.js';
import { renderPersistentDamageModal as renderPersistentDamageModalFn } from '../events/eventPersistent.js';
import { renderRoomSelectModal as renderRoomSelectModalFn, renderRoomSelectConfirmModal as renderRoomSelectConfirmModalFn } from '../omens/omenSpecial.js';
import { renderOptionalRollModal, renderChoiceModal, renderPeekModal, renderStoreDiceModal } from '../events/eventChoice.js';
import { renderTokenInteractionModal, renderTokenPromptModal } from '../events/eventToken.js';
import { renderMultiPlayerRollModal } from '../events/eventMultiPlayer.js';
import { renderSecondRollModal } from '../events/eventSecondRoll.js';

// ======================= HELPER FUNCTIONS =======================

function roomRequiresDiceRoll(gameState, myId) {
    if (!gameState || !myId) return false;
    const playerPositions = gameState?.playerState?.playerPositions || {};
    const currentRoomId = playerPositions[myId];
    if (!currentRoomId) return false;
    const revealedRooms = gameState?.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    if (!currentRoom) return false;
    return DICE_ROLL_ROOMS.has(currentRoom.name);
}

function getStairsAvailability(gameState, myId) {
    const playerPositions = gameState?.playerState?.playerPositions || {};
    const currentRoomId = playerPositions[myId];
    const revealedRooms = gameState?.map?.revealedRooms || {};
    const currentRoom = revealedRooms[currentRoomId];
    const defaultResult = { canGoUp: false, canGoDown: false, targetRoom: null, isMysticElevator: false, availableFloors: [] };
    if (!currentRoom) return defaultResult;

    if (currentRoom.name === 'Mystic Elevator') {
        const currentFloor = currentRoom.floor;
        const availableFloors = ['upper', 'ground', 'basement'].filter(f => f !== currentFloor);
        return { canGoUp: currentFloor !== 'upper', canGoDown: currentFloor !== 'basement', targetRoom: null, isMysticElevator: true, availableFloors };
    }
    if (currentRoom.name === 'Stairs From Basement') {
        let foyerRoomId = null;
        for (const [roomId, room] of Object.entries(revealedRooms)) { if (room.name === 'Foyer') { foyerRoomId = roomId; break; } }
        if (foyerRoomId) return { canGoUp: true, canGoDown: false, targetRoom: foyerRoomId, isMysticElevator: false, availableFloors: [] };
    }
    if (currentRoom.name === 'Foyer') {
        let stairsId = null;
        for (const [roomId, room] of Object.entries(revealedRooms)) { if (room.name === 'Stairs From Basement') { stairsId = roomId; break; } }
        if (stairsId) return { canGoUp: false, canGoDown: true, targetRoom: stairsId, isMysticElevator: false, availableFloors: [] };
    }
    if (!currentRoom.stairsTo) return defaultResult;
    const targetRoomId = currentRoom.stairsTo;
    const targetRoom = revealedRooms[targetRoomId];
    if (!targetRoom) return defaultResult;
    const floorOrder = { basement: 0, ground: 1, upper: 2 };
    const goingUp = floorOrder[targetRoom.floor] > floorOrder[currentRoom.floor];
    return { canGoUp: goingUp, canGoDown: !goingUp, targetRoom: targetRoomId, isMysticElevator: false, availableFloors: [] };
}

function getAvailableDirections(gameState, myId) {
    const result = { north: false, south: false, east: false, west: false };
    const playerPositions = gameState?.playerState?.playerPositions || {};
    const currentRoomId = playerPositions[myId];
    const revealedRooms = gameState?.map?.revealedRooms || {};
    const connections = gameState?.map?.connections || {};
    const elevatorShafts = gameState?.map?.elevatorShafts || {};
    const currentRoom = revealedRooms[currentRoomId];
    if (!currentRoom) return result;

    const doors = currentRoom.doors || [];
    const roomConnections = connections[currentRoomId] || {};
    const dirOffsets = { north: { x: 0, y: 1 }, south: { x: 0, y: -1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };

    for (const dir of doors) {
        if (isDoorBlocked(currentRoom.name, dir)) continue;
        const shaftId = elevatorShafts[currentRoom.floor];
        if (shaftId) {
            const shaft = revealedRooms[shaftId];
            if (shaft) {
                const offset = dirOffsets[dir];
                const tX = currentRoom.x + offset.x, tY = currentRoom.y + offset.y;
                if (shaft.x === tX && shaft.y === tY) continue;
            }
        }
        const targetRoomId = roomConnections[dir];
        if (targetRoomId) {
            const targetRoom = revealedRooms[targetRoomId];
            if (targetRoom && targetRoom.isElevatorShaft && !targetRoom.elevatorPresent) continue;
        }
        result[dir] = true;
    }
    return result;
}

// ======================= RENDER FUNCTIONS =======================

function renderDiceResults(gameState, myId) {
    const players = gameState.players || [];
    const diceRolls = gameState.diceRolls || {};
    const turnOrder = gameState.turnOrder || [];
    const sortedPlayers = turnOrder.map(playerId => {
        const player = players.find(p => p.id === playerId);
        return player ? { ...player, roll: diceRolls[playerId] } : null;
    }).filter(p => p !== null);

    const playersHtml = sortedPlayers.map((player, index) => {
        const charName = getCharacterName(player.characterId);
        const isMe = player.id === myId;
        const orderLabel = index === 0 ? 'Di truoc' : `Thu tu ${index + 1}`;
        return `<div class="dice-result-player ${isMe ? 'is-me' : ''} ${index === 0 ? 'is-first' : ''}">
            <span class="dice-result-player__name">${charName}${isMe ? ' (You)' : ''}</span>
            <span class="dice-result-player__roll">${player.roll}</span>
            <span class="dice-result-player__order">${orderLabel}</span>
        </div>`;
    }).join('');

    return `<div class="dice-overlay"><div class="dice-modal dice-modal--results">
        <h2 class="dice-title">Ket qua Tung Xi Ngau</h2>
        <p class="dice-subtitle">Nguoi co diem cao nhat se di truoc</p>
        <div class="dice-results-list">${playersHtml}</div>
        <p class="dice-results-countdown">Bat dau trong 5 giay...</p>
    </div></div>`;
}

function renderDiceRollOverlay(gameState, myId) {
    if (!gameState) return '';
    if (state.showingDiceResults) return renderDiceResults(gameState, myId);
    if (gameState.gamePhase !== 'rolling') return '';

    const players = gameState.players || [];
    const diceRolls = gameState.diceRolls || {};
    const needsRollList = gameState.needsRoll || [];
    const iNeedToRoll = state.mySocketId && needsRollList.includes(state.mySocketId);

    const playersRollsHtml = players.map(p => {
        const charName = getCharacterName(p.characterId);
        const roll = diceRolls[p.id];
        const isMe = p.id === myId;
        const waiting = needsRollList.includes(p.id);
        let rollDisplay = roll !== undefined ? `<span class="dice-result">${roll}</span>` : waiting ? `<span class="dice-waiting">...</span>` : `<span class="dice-waiting">-</span>`;
        return `<div class="dice-player ${isMe ? 'is-me' : ''} ${waiting ? 'is-waiting' : ''}">
            <span class="dice-player__name">${charName}${isMe ? ' (You)' : ''}</span>${rollDisplay}</div>`;
    }).join('');

    const rollControls = iNeedToRoll ? `
        <div class="dice-controls">
            <p class="dice-instruction">Tung xi ngau de quyet dinh thu tu di</p>
            <div class="dice-input-group">
                <input type="number" class="dice-input" id="dice-manual-input" min="1" max="16" placeholder="1-16" />
                <button class="action-button action-button--secondary" type="button" data-action="roll-manual">Nhap</button>
            </div>
            <span class="dice-or">hoac</span>
            <button class="action-button action-button--primary dice-roll-btn" type="button" data-action="roll-random">
                <svg class="dice-icon dice-icon--inline" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="4" width="40" height="40" rx="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
                    <circle cx="14" cy="14" r="3.5" fill="currentColor"/><circle cx="34" cy="14" r="3.5" fill="currentColor"/>
                    <circle cx="24" cy="24" r="3.5" fill="currentColor"/>
                    <circle cx="14" cy="34" r="3.5" fill="currentColor"/><circle cx="34" cy="34" r="3.5" fill="currentColor"/>
                </svg> Tung Xi Ngau
            </button>
        </div>
    ` : `<div class="dice-controls"><p class="dice-instruction">Dang cho cac nguoi choi khac tung xi ngau...</p></div>`;

    return `<div class="dice-overlay"><div class="dice-modal"><h2 class="dice-title">Tung Xi Ngau</h2>
        <p class="dice-subtitle">Nguoi co diem cao nhat se di truoc</p>
        <div class="dice-players-list">${playersRollsHtml}</div>${rollControls}</div></div>`;
}

function renderSidebarToggle(gameState, myId) {
    let colorClass = '';
    if (gameState && myId) {
        const me = gameState.players?.find(p => p.id === myId);
        if (me?.characterId) colorClass = `sidebar-toggle--${getCharacterColor(me.characterId)}`;
    }
    return `<button class="sidebar-toggle ${colorClass}" type="button" data-action="toggle-sidebar" title="Toggle Players">
        <svg class="sidebar-toggle__icon" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="6" r="4"/><path d="M12 12c-3 0-6 2-6 5v3h12v-3c0-3-3-5-6-5z"/>
        </svg></button>`;
}

function renderCharacterStats(characterData) {
    const statValues = getAllStatValues(characterData);
    if (!statValues) return '';
    return `<div class="sidebar-traits">
        <div class="sidebar-trait sidebar-trait--speed"><span class="sidebar-trait__label">Speed</span><span class="sidebar-trait__value">${statValues.speed}</span></div>
        <div class="sidebar-trait sidebar-trait--might"><span class="sidebar-trait__label">Might</span><span class="sidebar-trait__value">${statValues.might}</span></div>
        <div class="sidebar-trait sidebar-trait--sanity"><span class="sidebar-trait__label">Sanity</span><span class="sidebar-trait__value">${statValues.sanity}</span></div>
        <div class="sidebar-trait sidebar-trait--knowledge"><span class="sidebar-trait__label">Knowledge</span><span class="sidebar-trait__value">${statValues.knowledge}</span></div>
    </div>`;
}

function renderSidebar(gameState, myId) {
    if (!gameState) return '';
    const me = gameState.players?.find(p => p.id === myId);
    if (!me) return '';
    const charName = getCharacterName(me.characterId);
    const movesLeft = gameState.playerMoves?.[myId] ?? 0;
    const myTurn = isMyTurn(gameState, myId);
    const playerPositions = gameState.playerState?.playerPositions || {};
    const myPosition = playerPositions[myId] || 'Unknown';
    const revealedRooms = gameState.map?.revealedRooms || {};
    const currentRoom = revealedRooms[myPosition];
    const currentFloor = currentRoom?.floor || 'ground';
    const floorDisplay = getFloorDisplayName(currentFloor);
    const roomName = currentRoom?.name || myPosition;
    const characterData = gameState.playerState?.characterData?.[myId] || gameState.characterData?.[myId];
    const playerCards = gameState.playerState?.playerCards?.[myId] || { omens: [], events: [], items: [] };
    const openClass = state.sidebarOpen ? 'is-open' : '';
    const hauntActive = isHauntTriggered(gameState);
    const myFaction = hauntActive ? getFaction(gameState, myId) : 'survivor';
    const factionLabel = hauntActive ? getFactionLabel(myFaction) : 'Survivor';
    const factionClass = `sidebar-faction--${myFaction}`;
    const factionIcon = myFaction === 'traitor' ? '☠' : '◆';

    return `<aside class="game-sidebar ${openClass} ${myTurn ? 'is-my-turn' : ''} ${hauntActive ? 'is-haunt-active' : ''}">
        <div class="sidebar-header"><span class="sidebar-title">${charName}</span>
        <button class="sidebar-close" type="button" data-action="close-sidebar">&times;</button></div>
        <div class="sidebar-faction ${factionClass}"><span class="sidebar-faction__icon">${factionIcon}</span><span class="sidebar-faction__label">${factionLabel}</span></div>
        <div class="sidebar-content">
            <div class="sidebar-stats">
                <div class="sidebar-stat"><span class="sidebar-stat__label">Vi tri</span><span class="sidebar-stat__value">${roomName}</span></div>
                <div class="sidebar-stat sidebar-stat--floor sidebar-stat--floor-${currentFloor}"><span class="sidebar-stat__label">Tang</span><span class="sidebar-stat__value">${floorDisplay}</span></div>
                <div class="sidebar-stat sidebar-stat--highlight"><span class="sidebar-stat__label">Luot di</span><span class="sidebar-stat__value">${movesLeft}</span></div>
            </div>
            ${renderCharacterStats(characterData)}
            <div class="sidebar-cards">
                <div class="sidebar-card sidebar-card--omen" data-action="view-cards" data-card-type="omen"><span class="sidebar-card__count">${(playerCards.omens||[]).length}</span><span class="sidebar-card__label">Omen</span></div>
                <div class="sidebar-card sidebar-card--event" data-action="view-cards" data-card-type="event"><span class="sidebar-card__count">${(playerCards.events||[]).length}</span><span class="sidebar-card__label">Event</span></div>
                <div class="sidebar-card sidebar-card--item" data-action="view-cards" data-card-type="item"><span class="sidebar-card__count">${(playerCards.items||[]).length}</span><span class="sidebar-card__label">Item</span></div>
            </div>
            <button class="sidebar-detail-btn" type="button" data-action="view-character-detail" data-character-id="${me.characterId}">Xem chi tiet nhan vat</button>
        </div>
        ${gameState.isDebug ? `<div class="sidebar-debug"><button class="sidebar-reset-btn" type="button" data-action="reset-debug-game">🔄 Reset Game</button></div>` : ''}
    </aside>`;
}

function renderTurnOrder(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return '';
    const turnOrder = gameState.turnOrder || [];
    const currentIndex = gameState.currentTurnIndex ?? 0;
    const players = gameState.players || [];
    const playerPositions = gameState.playerState?.playerPositions || {};
    const currentPlayerId = turnOrder[currentIndex];
    const currentPlayer = players.find(p => p.id === currentPlayerId);
    const currentCharName = currentPlayer ? getCharacterName(currentPlayer.characterId) : 'Unknown';
    const isCurrentMe = currentPlayerId === myId;
    const hauntActive = isHauntTriggered(gameState);

    const orderedPlayers = turnOrder.map((socketId, idx) => {
        const player = players.find(p => p.id === socketId);
        if (!player) return null;
        const charName = getCharacterName(player.characterId);
        const isMe = socketId === myId;
        const isCurrent = idx === currentIndex;
        const isDisconnected = player.status === 'disconnected';
        const position = playerPositions[socketId] || 'Unknown';
        const playerFaction = getFaction(gameState, socketId);
        const factionClass = playerFaction ? `faction-${playerFaction}` : '';
        const isMyEnemy = hauntActive ? isEnemy(gameState, myId, socketId) : false;
        const isMyAlly = hauntActive ? isAlly(gameState, myId, socketId) && !isMe : false;
        const relationClass = isMyEnemy ? 'is-enemy' : (isMyAlly ? 'is-ally' : '');
        const disconnectedClass = isDisconnected ? 'is-disconnected' : '';
        const isTrapped = gameState?.playerState?.trappedPlayers?.[socketId] != null;
        const trappedIcon = isTrapped ? ' 🔗' : '';
        return `<div class="turn-indicator ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''} ${factionClass} ${relationClass} ${disconnectedClass} ${isTrapped ? 'is-trapped' : ''}">
            <span class="turn-indicator__order">${idx + 1}</span>
            <div class="turn-indicator__info">
                <span class="turn-indicator__name">${charName}${isMe ? ' (You)' : ''}${playerFaction === 'traitor' ? ' ☠' : ''}${trappedIcon}${isDisconnected ? ' ⚠' : ''}</span>
                <span class="turn-indicator__room">${isDisconnected ? 'Mat ket noi...' : position}</span>
            </div></div>`;
    }).filter(Boolean).join('');

    const expandedClass = state.turnOrderExpanded ? 'is-expanded' : '';
    const chevronIcon = state.turnOrderExpanded ? '▲' : '▼';
    return `<div class="turn-order ${expandedClass}">
        <div class="turn-order__header" data-action="toggle-turn-order">
            <span class="turn-order__current"><span class="turn-order__current-label">Luot:</span>
            <span class="turn-order__current-name">${currentCharName}${isCurrentMe ? ' (You)' : ''}</span></span>
            <span class="turn-order__chevron">${chevronIcon}</span>
        </div>
        <div class="turn-order__list">${orderedPlayers}</div></div>`;
}

function renderGameControls(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return '';
    const isBlocked = state.eventDiceModal?.isOpen || state.damageDiceModal?.isOpen;
    const myTurn = isMyTurn(gameState, myId);
    const movesLeft = gameState.playerMoves?.[myId] ?? 0;
    const canMove = myTurn && movesLeft > 0 && !isBlocked;
    const stairs = getStairsAvailability(gameState, myId);
    const showUpBtn = stairs.canGoUp && canMove && !stairs.isMysticElevator;
    const showDownBtn = stairs.canGoDown && canMove && !stairs.isMysticElevator;
    const showElevator = stairs.isMysticElevator && canMove;
    const availableDirs = getAvailableDirections(gameState, myId);
    const canMoveUp = canMove && availableDirs.north;
    const canMoveDown = canMove && availableDirs.south;
    const canMoveLeft = canMove && availableDirs.west;
    const canMoveRight = canMove && availableDirs.east;

    const floorNames = { upper: 'Tang tren', ground: 'Tang tret', basement: 'Tang ham' };
    const floorOrder = ['upper', 'ground', 'basement'];
    const sortedFloors = showElevator ? floorOrder.filter(f => stairs.availableFloors.includes(f)) : [];
    const elevatorButtons = sortedFloors.map(floor =>
        `<button class="stairs-btn stairs-btn--elevator stairs-btn--floor-${floor}" type="button" data-action="use-elevator" data-floor="${floor}" title="${floorNames[floor]}"><span class="stairs-btn__label">${floorNames[floor]}</span></button>`
    ).join('');

    const diceEventActive = roomRequiresDiceRoll(gameState, myId);
    const currentRoomId = gameState?.playerState?.playerPositions?.[myId];
    const currentRoom = currentRoomId ? gameState?.map?.revealedRooms?.[currentRoomId] : null;
    const secretPassageRooms = getRoomsWithSpecialToken(gameState, 'secretPassage').filter(room => room.roomId !== currentRoomId);
    const canUseSecretPassage = myTurn && movesLeft === 0 && !isBlocked && currentRoom?.specialTokens?.includes('secretPassage') && secretPassageRooms.length > 0;

    return `<div class="game-controls">
        <div class="movement-controls">
            <button class="move-btn move-btn--up" type="button" data-action="move" data-direction="up" ${!canMoveUp ? 'disabled' : ''}>▲</button>
            <div class="move-btn-row">
                <button class="move-btn move-btn--left" type="button" data-action="move" data-direction="left" ${!canMoveLeft ? 'disabled' : ''}>◀</button>
                <div class="move-center" data-action="open-end-turn" title="Click de ket thuc luot"><span class="moves-remaining">${movesLeft}</span></div>
                <button class="move-btn move-btn--right" type="button" data-action="move" data-direction="right" ${!canMoveRight ? 'disabled' : ''}>▶</button>
            </div>
            <button class="move-btn move-btn--down" type="button" data-action="move" data-direction="down" ${!canMoveDown ? 'disabled' : ''}>▼</button>
        </div>
        <button class="dice-event-btn" type="button" data-action="dice-event" title="Tung xuc xac (0-16)" ${!diceEventActive ? 'disabled' : ''}>
            <svg class="dice-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="4" width="40" height="40" rx="6" stroke="currentColor" stroke-width="2.5" fill="none"/>
                <circle cx="14" cy="14" r="3.5" fill="currentColor"/><circle cx="34" cy="14" r="3.5" fill="currentColor"/>
                <circle cx="24" cy="24" r="3.5" fill="currentColor"/>
                <circle cx="14" cy="34" r="3.5" fill="currentColor"/><circle cx="34" cy="34" r="3.5" fill="currentColor"/>
            </svg>
        </button>
        ${canUseSecretPassage ? `<button class="secret-passage-btn" type="button" data-action="use-secret-passage" title="Su dung Secret Passage"><span class="secret-passage-btn__label">SP</span></button>` : ''}
        <div class="stairs-controls">
            ${showUpBtn ? `<button class="stairs-btn stairs-btn--up" type="button" data-action="use-stairs" data-target="${stairs.targetRoom}" title="Leo len tang tren"><span class="stairs-btn__arrow">▲</span><span class="stairs-btn__label">UP</span></button>` : ''}
            ${showDownBtn ? `<button class="stairs-btn stairs-btn--down" type="button" data-action="use-stairs" data-target="${stairs.targetRoom}" title="Di xuong tang duoi"><span class="stairs-btn__arrow">▼</span><span class="stairs-btn__label">DOWN</span></button>` : ''}
            ${showElevator ? `<div class="elevator-controls"><span class="elevator-label">Thang may:</span>${elevatorButtons}</div>` : ''}
        </div>
    </div>`;
}

function renderRoomTokenNotification(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return '';

    const currentRoomId = gameState?.playerState?.playerPositions?.[myId];
    if (!currentRoomId) return '';

    const currentRoom = gameState?.map?.revealedRooms?.[currentRoomId];
    if (!currentRoom?.specialTokens || currentRoom.specialTokens.length === 0) return '';

    // Token short descriptions
    const tokenInfo = {
        smoke: { icon: '🌫️', short: 'Khoi: Do it hon 2 xuc xac' },
        drip: { icon: '💧', short: 'Nho giot: Do it hon 1 xuc xac (toi thieu 1)' },
        blessing: { icon: '✨', short: 'Ban phep: Phe chinh dien +1 xuc xac' },
        closet: { icon: '🚪', short: 'Tu: Do 2 xuc xac de mo (1 lan/luot)' },
        safe: { icon: '🔒', short: 'Ket sat: Do Knowledge de mo (1 lan/luot)' },
        skeletons: { icon: '💀', short: 'Hai cot: Do Sanity de dao (1 lan/luot)' },
        wallSwitch: { icon: '🔄', short: 'Cua xoay: Do Knowledge de su dung' },
        slide: { icon: '🎢', short: 'Cau truot: Do Might de truot xuong' },
        secretPassage: { icon: '🚶', short: 'Loi bi mat: Su dung khi het buoc' },
        secretStairs: { icon: '🪜', short: 'Cau thang bi mat: Su dung khi het buoc' },
    };

    const notifications = [];
    for (const token of currentRoom.specialTokens) {
        if (tokenInfo[token]) {
            notifications.push({ ...tokenInfo[token], tokenType: token });
        }
    }

    if (notifications.length === 0) return '';

    const items = notifications.map(n =>
        `<span class="room-token-notif__item">${n.icon} ${n.short}</span>`
    ).join('');

    return `<div class="room-token-notif" data-action="open-token-detail">${items}</div>`;
}

function renderTokenDetailPopup(gameState, myId) {
    if (!state.tokenDetailOpen) return '';

    const currentRoomId = gameState?.playerState?.playerPositions?.[myId];
    if (!currentRoomId) return '';

    const currentRoom = gameState?.map?.revealedRooms?.[currentRoomId];
    if (!currentRoom?.specialTokens || currentRoom.specialTokens.length === 0) return '';

    // Find the full card data for each token in the room
    const cards = [];
    for (const token of currentRoom.specialTokens) {
        const card = EVENTS.find(e => e.tokenType === token);
        if (card) cards.push(card);
    }

    if (cards.length === 0) return '';

    const cardEntries = cards.map(card => {
        const name = card.name?.vi || card.id;
        const text = (card.text?.vi || '').replace(/\n/g, '<br>');
        return `<div class="token-detail__card">
            <h3 class="token-detail__name">${name}</h3>
            <p class="token-detail__text">${text}</p>
        </div>`;
    }).join('');

    return `<div class="token-detail-overlay" data-action="close-token-detail">
        <div class="token-detail-popup">
            ${cardEntries}
            <p class="token-detail__hint">Tap de dong</p>
        </div>
    </div>`;
}

function renderHauntButton(gameState) {
    if (isHauntTriggered(gameState)) return '';
    if (gameState?.gamePhase !== 'playing') return '';
    return `<button class="haunt-btn" type="button" data-action="trigger-haunt" title="Kich hoat Haunt"><span class="haunt-btn__icon">👻</span><span class="haunt-btn__label">Haunt</span></button>`;
}

function renderGameIntro() {
    if (state.introShown) return '';
    return `<div class="game-intro" data-action="skip-intro"><div class="game-intro__content">
        <h1 class="game-intro__title">Chao mung den Vinh thu bo hoang</h1>
        <p class="game-intro__subtitle">Betrayal at House on the Hill</p>
        <p class="game-intro__hint">Click de bat dau...</p></div></div>`;
}

function renderTutorialModal() {
    if (!state.tutorialOpen) return '';
    return `<div class="tutorial-modal-overlay">
        <div class="tutorial-modal-overlay__backdrop" data-action="close-tutorial"></div>
        <div class="tutorial-modal-overlay__content">
            <header class="tutorial-modal-overlay__header"><h2>Huong Dan Choi</h2>
            <button class="tutorial-modal-overlay__close" type="button" data-action="close-tutorial">×</button></header>
            <div class="tutorial-modal-overlay__body">
                <div class="tutorial-books">
                    <button class="tutorial-book-btn" data-tutorial-book="rules"><span class="tutorial-book-btn__title">RULESBOOK</span><span class="tutorial-book-btn__desc">Luat choi co ban</span></button>
                    <button class="tutorial-book-btn" data-tutorial-book="traitors"><span class="tutorial-book-btn__title">TRAITORS TOME</span><span class="tutorial-book-btn__desc">Bang tra cuu ke phan boi</span></button>
                    <button class="tutorial-book-btn" data-tutorial-book="survival"><span class="tutorial-book-btn__title">SURVIVAL</span><span class="tutorial-book-btn__desc">Huong dan song sot</span></button>
                </div>
                <p class="tutorial-modal-overlay__note">Chon sach de xem chi tiet.</p>
            </div></div></div>`;
}

function renderCharacterModal() {
    return `<div class="character-modal" id="character-modal" aria-hidden="true">
        <div class="character-modal__backdrop" data-action="close-modal"></div>
        <div class="character-modal__content" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <header class="character-modal__header"><h2 class="character-modal__title" id="modal-title"></h2>
            <button class="character-modal__close" type="button" data-action="close-modal" aria-label="Dong">x</button></header>
            <div class="character-modal__body" id="modal-body"></div>
        </div></div>`;
}

function renderEndTurnModal() {
    if (!state.endTurnModal?.isOpen) return '';
    const movesLeft = state.currentGameState?.playerMoves?.[state.mySocketId] ?? 0;
    return `<div class="end-turn-overlay" data-action="close-end-turn">
        <div class="end-turn-modal" data-modal-content="true">
            <header class="end-turn-modal__header"><h3 class="end-turn-modal__title">Ket thuc luot</h3>
            <button class="end-turn-modal__close" type="button" data-action="close-end-turn">×</button></header>
            <div class="end-turn-modal__body">
                <p class="end-turn-modal__message">Ban con <strong>${movesLeft}</strong> buoc di.</p>
                <p class="end-turn-modal__question">Ban muon lam gi?</p>
                <div class="end-turn-modal__actions">
                    <button class="end-turn-modal__btn end-turn-modal__btn--continue" type="button" data-action="continue-turn">Tiep tuc di</button>
                    <button class="end-turn-modal__btn end-turn-modal__btn--end" type="button" data-action="confirm-end-turn">Ket thuc luot</button>
                </div></div></div></div>`;
}

function renderResetGameModal() {
    if (!state.resetGameModal?.isOpen) return '';
    return `<div class="reset-game-overlay" data-action="close-reset-game">
        <div class="reset-game-modal" data-modal-content="true">
            <header class="reset-game-modal__header"><span class="reset-game-modal__icon">🔄</span>
            <h3 class="reset-game-modal__title">Reset Game</h3>
            <button class="reset-game-modal__close" type="button" data-action="close-reset-game">×</button></header>
            <div class="reset-game-modal__body">
                <p class="reset-game-modal__message">Ca 2 nguoi choi se quay lai trang thai ban dau.</p>
                <p class="reset-game-modal__warning">⚠️ Tien trinh game hien tai se bi mat!</p></div>
            <div class="reset-game-modal__actions">
                <button class="reset-game-modal__btn reset-game-modal__btn--cancel" type="button" data-action="close-reset-game">Huy bo</button>
                <button class="reset-game-modal__btn reset-game-modal__btn--confirm" type="button" data-action="confirm-reset-game">Reset Game</button>
            </div></div></div>`;
}

function renderDiceEventModal() {
    if (!state.diceEventModal?.isOpen) return '';
    const { inputValue, result } = state.diceEventModal;
    const hasResult = result !== null;
    return `<div class="dice-event-overlay" data-action="close-dice-event">
        <div class="dice-event-modal" data-modal-content="true">
            <header class="dice-event-modal__header"><h3 class="dice-event-modal__title">Tung xuc xac</h3>
            <button class="dice-event-modal__close" type="button" data-action="close-dice-event">×</button></header>
            <div class="dice-event-modal__body">
                ${hasResult ? `<div class="dice-event-modal__result"><span class="dice-event-modal__result-label">Ket qua:</span><span class="dice-event-modal__result-value">${result}</span></div>
                    <button class="dice-event-modal__btn dice-event-modal__btn--close" type="button" data-action="close-dice-event">Dong</button>`
                : `<div class="dice-event-modal__input-group"><label class="dice-event-modal__label">Nhap ket qua xuc xac:</label>
                    <input type="number" class="dice-event-modal__input" min="0" value="${inputValue}" data-input="dice-event-value" placeholder="Nhap so" /></div>
                    <div class="dice-event-modal__actions">
                        <button class="dice-event-modal__btn dice-event-modal__btn--confirm" type="button" data-action="dice-event-confirm">Xac nhan</button>
                        <button class="dice-event-modal__btn dice-event-modal__btn--random" type="button" data-action="dice-event-random">Ngau nhien</button>
                    </div>`}
            </div></div></div>`;
}

// Delegate to domain modules for remaining render functions
function renderEventDiceModal() {
    if (!state.eventDiceModal?.isOpen) return '';
    // Import inline to avoid circular - this is a large render function
    const { eventCard, rollStat, selectedStat, diceCount, inputValue, result, currentRollIndex, allResults } = state.eventDiceModal;
    const hasResult = result !== null;
    const cardName = eventCard?.name?.vi || 'Event';
    const isMultiRoll = eventCard?.rollStats && Array.isArray(eventCard.rollStats);
    const totalRolls = isMultiRoll ? eventCard.rollStats.length : 1;
    const currentStat = isMultiRoll ? eventCard.rollStats[currentRollIndex] : (selectedStat || rollStat);
    const isStatChoice = (Array.isArray(rollStat) && !isMultiRoll) || rollStat === 'choice';
    const needsStatSelection = isStatChoice && !selectedStat;
    let statOptions = rollStat === 'choice' ? ['speed', 'might', 'sanity', 'knowledge'] : (Array.isArray(rollStat) ? rollStat : []);
    if (rollStat === 'choice' && eventCard?.rollResults?.some(r => r.effect === 'setStatToLowest')) {
        const charData = state.currentGameState?.playerState?.characterData?.[state.mySocketId];
        if (charData?.stats) { statOptions = statOptions.filter(s => { const si = charData.stats[s]; return si !== undefined && si > 0; }); }
    }
    const statLabels = { speed: 'Toc do (Speed)', might: 'Suc manh (Might)', sanity: 'Tam tri (Sanity)', knowledge: 'Kien thuc (Knowledge)' };
    const currentStatLabel = currentStat ? statLabels[currentStat] : '';
    let resultsHistoryHtml = '';
    if (isMultiRoll && allResults.length > 0) {
        resultsHistoryHtml = `<div class="event-dice-modal__history"><h4>Ket qua da do:</h4><ul>${allResults.map(r => `<li>${statLabels[r.stat]}: ${r.result}</li>`).join('')}</ul></div>`;
    }

    let bodyContent = '';
    if (needsStatSelection) {
        bodyContent = `<div class="event-dice-modal__stat-select">
            <label class="event-dice-modal__label">Chon chi so de do:</label>
            <select class="event-dice-modal__select" data-input="event-stat-select"><option value="">-- Chon --</option>${statOptions.map(s => `<option value="${s}">${statLabels[s]}</option>`).join('')}</select>
            <div class="event-dice-modal__stat-actions">
                ${state.eventDiceModal.tokenDrawingContext ? `<button class="event-dice-modal__btn event-dice-modal__btn--back" type="button" data-action="event-dice-back-to-select">← Chon lai bai</button>` : ''}
                <button class="event-dice-modal__btn event-dice-modal__btn--confirm event-dice-modal__btn--stat-confirm" type="button" data-action="event-stat-confirm" disabled>Xac nhan lua chon</button>
            </div></div>`;
    } else if (hasResult) {
        bodyContent = `<div class="event-dice-modal__result"><span class="event-dice-modal__result-label">Ket qua ${currentStatLabel}:</span><span class="event-dice-modal__result-value">${result}</span></div>`;
    } else {
        bodyContent = `<div class="event-dice-modal__roll-info"><p>Do ${eventCard?.fixedDice || eventCard?.rollDice || diceCount} vien xuc xac ${currentStatLabel}${state.eventDiceModal.chapelBonusDice ? ` (co bonus Chapel +${state.eventDiceModal.chapelBonusDice})` : ''}</p></div>
            <div class="event-dice-modal__input-group"><label class="event-dice-modal__label">Nhap ket qua xuc xac:</label>
            <input type="number" class="event-dice-modal__input" min="0" value="${inputValue}" data-input="event-dice-value" placeholder="Nhap so" /></div>
            <div class="event-dice-modal__actions">
                ${isMultiRoll && allResults.length > 0 ? `<button class="event-dice-modal__btn event-dice-modal__btn--back" type="button" data-action="event-dice-back">← Quay lai</button>`
                : state.eventDiceModal.tokenDrawingContext ? `<button class="event-dice-modal__btn event-dice-modal__btn--back" type="button" data-action="event-dice-back-to-select">← Chon lai</button>` : ''}
                <button class="event-dice-modal__btn event-dice-modal__btn--confirm" type="button" data-action="event-dice-confirm">Xac nhan</button>
                <button class="event-dice-modal__btn event-dice-modal__btn--random" type="button" data-action="event-dice-random">Ngau nhien</button>
            </div>`;
    }

    let resultActions = '';
    if (hasResult) {
        resultActions = `<div class="event-dice-modal__actions event-dice-modal__actions--result">
            ${isMultiRoll ? `<button class="event-dice-modal__btn event-dice-modal__btn--back" type="button" data-action="event-dice-back">← Nhap lai</button>` : ''}
            <button class="event-dice-modal__btn event-dice-modal__btn--continue" type="button" data-action="event-dice-continue">${isMultiRoll && currentRollIndex < totalRolls - 1 ? 'Tiep theo' : 'Ap dung ket qua'}</button>
        </div>`;
    }

    return `<div class="event-dice-overlay"><div class="event-dice-modal" data-modal-content="true">
        <header class="event-dice-modal__header"><h3 class="event-dice-modal__title">${cardName}</h3>
        ${isMultiRoll ? `<span class="event-dice-modal__progress">Lan ${currentRollIndex + 1}/${totalRolls}</span>` : ''}</header>
        <div class="event-dice-modal__body"><p class="event-dice-modal__description">${eventCard?.text?.vi || ''}</p>
        ${resultsHistoryHtml}${bodyContent}${resultActions}</div></div></div>`;
}

function renderRoomEffectDiceModal() {
    if (!state.roomEffectDiceModal?.isOpen) return '';
    const { roomName, roomEffect, diceCount, inputValue, result } = state.roomEffectDiceModal;
    const hasResult = result !== null;
    const statLabels = { speed: 'Toc do (Speed)', might: 'Suc manh (Might)', sanity: 'Tam tri (Sanity)', knowledge: 'Kien thuc (Knowledge)' };
    const statLabel = statLabels[roomEffect.rollStat];
    const targetDisplay = `${roomEffect.target}+`;
    let resultStatusHtml = '';
    if (hasResult) {
        const isSuccess = result >= roomEffect.target;
        resultStatusHtml = `<div class="room-effect-dice-modal__result-status room-effect-dice-modal__result-status--${isSuccess ? 'success' : 'fail'}">${isSuccess ? 'THANH CONG!' : 'THAT BAI!'}</div>`;
    }
    return `<div class="room-effect-dice-overlay"><div class="room-effect-dice-modal" data-modal-content="true">
        <header class="room-effect-dice-modal__header"><h3 class="room-effect-dice-modal__title">${roomName}</h3></header>
        <div class="room-effect-dice-modal__body"><p class="room-effect-dice-modal__description">${roomEffect.description.vi}</p>
        <div class="room-effect-dice-modal__requirement"><span class="room-effect-dice-modal__stat-label">${statLabel}</span><span class="room-effect-dice-modal__target">${targetDisplay}</span></div>
        ${hasResult ? `<div class="room-effect-dice-modal__result"><span class="room-effect-dice-modal__result-label">Ket qua:</span><span class="room-effect-dice-modal__result-value">${result}</span></div>${resultStatusHtml}
            <button class="room-effect-dice-modal__btn room-effect-dice-modal__btn--continue" type="button" data-action="room-effect-dice-continue">Tiep tuc</button>`
        : `<div class="room-effect-dice-modal__roll-info"><p>Do ${diceCount} vien xuc xac ${statLabel}</p></div>
            <div class="room-effect-dice-modal__input-group"><label class="room-effect-dice-modal__label">Nhap ket qua xuc xac:</label>
            <input type="number" class="room-effect-dice-modal__input" min="0" value="${inputValue}" data-input="room-effect-dice-value" placeholder="Nhap so" /></div>
            <div class="room-effect-dice-modal__actions">
                <button class="room-effect-dice-modal__btn room-effect-dice-modal__btn--confirm" type="button" data-action="room-effect-dice-confirm">Xac nhan</button>
                <button class="room-effect-dice-modal__btn room-effect-dice-modal__btn--random" type="button" data-action="room-effect-dice-random">Ngau nhien</button></div>`}
        </div></div></div>`;
}

function renderDamageDiceModal() {
    if (!state.damageDiceModal?.isOpen) return '';
    const { physicalDice, mentalDice, inputValue, currentPhase, physicalResult, mentalResult } = state.damageDiceModal;
    let resultsHtml = '';
    if (physicalResult !== null) resultsHtml += `<p class="damage-dice-modal__result-item">Sat thuong vat li: <strong>${physicalResult}</strong></p>`;
    if (mentalResult !== null) resultsHtml += `<p class="damage-dice-modal__result-item">Sat thuong tinh than: <strong>${mentalResult}</strong></p>`;

    let bodyContent = '';
    if (currentPhase === 'rollPhysical') {
        bodyContent = `<div class="damage-dice-modal__roll-info"><p class="damage-dice-modal__instruction">Do <strong>${physicalDice}</strong> xuc xac sat thuong vat li</p></div>
            <div class="damage-dice-modal__input-group"><label class="damage-dice-modal__label">Nhap ket qua xuc xac:</label>
            <input type="number" class="damage-dice-modal__input" min="0" value="${inputValue}" data-input="damage-dice-value" placeholder="Nhap so" /></div>
            <div class="damage-dice-modal__actions">
                <button class="damage-dice-modal__btn damage-dice-modal__btn--confirm" type="button" data-action="damage-dice-confirm">Xac nhan</button>
                <button class="damage-dice-modal__btn damage-dice-modal__btn--random" type="button" data-action="damage-dice-random">Ngau nhien</button></div>`;
    } else if (currentPhase === 'rollMental') {
        bodyContent = `${resultsHtml ? `<div class="damage-dice-modal__results">${resultsHtml}</div>` : ''}
            <div class="damage-dice-modal__roll-info"><p class="damage-dice-modal__instruction">Do <strong>${mentalDice}</strong> xuc xac sat thuong tinh than</p></div>
            <div class="damage-dice-modal__input-group"><label class="damage-dice-modal__label">Nhap ket qua xuc xac:</label>
            <input type="number" class="damage-dice-modal__input" min="0" value="${inputValue}" data-input="damage-dice-value" placeholder="Nhap so" /></div>
            <div class="damage-dice-modal__actions">
                <button class="damage-dice-modal__btn damage-dice-modal__btn--confirm" type="button" data-action="damage-dice-confirm">Xac nhan</button>
                <button class="damage-dice-modal__btn damage-dice-modal__btn--random" type="button" data-action="damage-dice-random">Ngau nhien</button></div>`;
    }

    return `<div class="damage-dice-overlay"><div class="damage-dice-modal" data-modal-content="true">
        <header class="damage-dice-modal__header"><h3 class="damage-dice-modal__title">Do xuc xac sat thuong</h3></header>
        <div class="damage-dice-modal__body">${bodyContent}</div></div></div>`;
}

function renderStatChoiceModal() {
    if (!state.statChoiceModal?.isOpen) return '';
    const { title, effect, amount, options, isAllPlayers } = state.statChoiceModal;
    const statLabels = { speed: 'Toc do', might: 'Suc manh', sanity: 'Tam tri', knowledge: 'Kien thuc' };
    const effectLabel = effect === 'loseStat' ? 'Mat' : effect === 'gainStat' ? 'Tang' : effect;
    const amountLabel = amount ? `${amount}` : '1';
    const description = effect === 'loseStat'
        ? `Chon 1 chi so de mat ${amountLabel} nac:`
        : effect === 'gainStat'
        ? `Chon 1 chi so de tang ${amountLabel} nac:`
        : `${effectLabel} ${amountLabel}`;

    const statBtns = (options || ['speed', 'might', 'sanity', 'knowledge']).map(s =>
        `<button class="stat-choice-modal__btn" type="button" data-action="stat-choice-select" data-stat="${s}">${statLabels[s] || s}</button>`
    ).join('');
    return `<div class="stat-choice-overlay"><div class="stat-choice-modal">
        <h3 class="stat-choice-modal__title">${title || 'Chon chi so'}</h3>
        <p class="stat-choice-modal__desc">${description}</p>
        <div class="stat-choice-modal__options">${statBtns}</div></div></div>`;
}

function renderStatChangeNotification() {
    if (!state.statChangeNotification) return '';
    const { stat, amount, playerName } = state.statChangeNotification;
    const statLabels = { speed: 'Toc do', might: 'Suc manh', sanity: 'Tam tri', knowledge: 'Kien thuc' };
    const label = statLabels[stat] || stat;
    const sign = amount > 0 ? '+' : '';
    return `<div class="stat-change-notification stat-change-notification--${amount > 0 ? 'gain' : 'loss'}">
        <span class="stat-change-notification__player">${playerName || ''}</span>
        <span class="stat-change-notification__stat">${label}: ${sign}${amount}</span></div>`;
}

function renderMultiRollSummary() {
    if (!state.multiRollSummary?.isOpen) return '';
    const { title, results, totalEffect } = state.multiRollSummary;
    const statLabels = { speed: 'Toc do', might: 'Suc manh', sanity: 'Tam tri', knowledge: 'Kien thuc' };
    const resultsHtml = results.map(r => `<li>${statLabels[r.stat] || r.stat}: ${r.result} → ${r.effectText || ''}</li>`).join('');
    return `<div class="multi-roll-overlay"><div class="multi-roll-modal">
        <h3 class="multi-roll-modal__title">${title || 'Ket qua'}</h3>
        <ul class="multi-roll-modal__results">${resultsHtml}</ul>
        ${totalEffect ? `<p class="multi-roll-modal__total">${totalEffect}</p>` : ''}
        <button class="multi-roll-modal__btn" type="button" data-action="close-multi-roll">Dong</button></div></div>`;
}

function renderTeleportChoiceModal() {
    if (!state.teleportChoiceModal?.isOpen) return '';
    const { rooms, preMessage } = state.teleportChoiceModal;
    const roomsHtml = rooms.map(r =>
        `<button class="teleport-choice-modal__room" type="button" data-action="teleport-choice" data-room-id="${r.roomId}">${r.name} (${getFloorDisplayName(r.floor)})</button>`
    ).join('');
    return `<div class="teleport-choice-overlay"><div class="teleport-choice-modal">
        <h3 class="teleport-choice-modal__title">DICH CHUYEN</h3>
        ${preMessage ? `<p class="teleport-choice-modal__pre">${preMessage}</p>` : ''}
        <p class="teleport-choice-modal__desc">Chon phong de dich chuyen:</p>
        <div class="teleport-choice-modal__rooms">${roomsHtml}</div></div></div>`;
}

function renderRoomDiscoveryModal(floor, doorSide, revealedRooms) {
    if (!state.roomDiscoveryModal?.isOpen) return '';
    const availableRooms = getAvailableRoomsForFloor(floor, revealedRooms);
    const validRooms = filterRoomsWithConnectingDoor(availableRooms, doorSide);
    const floorNames = { ground: 'Tang tret', upper: 'Tang tren', basement: 'Tang ham' };
    const floorDisplay = floorNames[floor] || floor;

    if (!state.roomDiscoveryModal.selectedRoom) {
        const floorShortNames = { ground: 'G', upper: 'U', basement: 'B' };
        const roomListHtml = validRooms.map(room => {
            const nameVi = room.name.vi || room.name.en;
            const floorsLabel = room.floorsAllowed.length > 1 ? ` (${room.floorsAllowed.map(f => floorShortNames[f] || f).join('/')})` : '';
            let tokenIndicator = '';
            if (room.tokens && room.tokens.length > 0) {
                const tokenCounts = {};
                room.tokens.forEach(token => { tokenCounts[token] = (tokenCounts[token] || 0) + 1; });
                const tokenLabels = [];
                if (tokenCounts.item) tokenLabels.push(tokenCounts.item > 1 ? `Itemx${tokenCounts.item}` : 'Item');
                if (tokenCounts.event) tokenLabels.push(tokenCounts.event > 1 ? `Eventx${tokenCounts.event}` : 'Event');
                if (tokenCounts.omen) tokenLabels.push(tokenCounts.omen > 1 ? `Omenx${tokenCounts.omen}` : 'Omen');
                tokenIndicator = ` (${tokenLabels.join(', ')})`;
            }
            const searchText = `${nameVi.toLowerCase()} ${removeDiacritics(nameVi).toLowerCase()} ${room.name.en.toLowerCase()}`;
            return `<div class="room-discovery__item" data-room-name="${room.name.en}" data-search-text="${searchText}">${nameVi}${floorsLabel}${tokenIndicator}</div>`;
        }).join('');
        const noRoomsMessage = validRooms.length === 0 ? `<p class="room-discovery__no-rooms">Khong con phong nao co the dat o huong nay!</p>` : '';
        return `<div class="room-discovery-overlay"><div class="room-discovery-modal">
            <h2 class="room-discovery__title">Rut bai phong moi</h2>
            <p class="room-discovery__subtitle">Chon phong (${floorDisplay})</p>${noRoomsMessage}
            ${validRooms.length > 0 ? `<div class="room-discovery__options">
                <div class="room-discovery__option"><label class="room-discovery__label">Chon phong:</label>
                <div class="room-discovery__search-wrapper">
                    <input type="text" class="room-discovery__search" id="room-search-input" placeholder="Nhap ten phong de tim kiem..." autocomplete="off" />
                    <button class="room-discovery__clear-btn" type="button" data-action="clear-room-selection" title="Xoa lua chon">✕</button>
                    <div class="room-discovery__list" id="room-list">${roomListHtml}</div></div>
                <input type="hidden" id="room-select-value" value="" />
                <button class="action-button action-button--primary" type="button" data-action="select-room-next">Tiep theo</button></div>
                <div class="room-discovery__divider"><span>hoac</span></div>
                <div class="room-discovery__option"><button class="action-button action-button--secondary room-discovery__random-btn" type="button" data-action="random-room">Rut ngau nhien</button></div></div>` : ''}
            <button class="room-discovery__cancel" type="button" data-action="cancel-room-discovery">Huy bo</button>
        </div></div>`;
    }

    const selectedRoomDef = ROOMS.find(r => r.name.en === state.roomDiscoveryModal.selectedRoom);
    if (!selectedRoomDef) return '';
    const roomNameVi = selectedRoomDef.name.vi || selectedRoomDef.name.en;
    const currentRotation = state.roomDiscoveryModal.currentRotation || 0;
    const isValid = isRotationValid(selectedRoomDef, currentRotation, doorSide);
    return `<div class="room-discovery-panel"><div class="room-discovery-panel__content">
        <h3 class="room-discovery-panel__title">${roomNameVi}</h3>
        <p class="room-discovery-panel__hint">Click vao phong tren map de xoay</p>
        <p class="room-discovery-panel__status ${isValid ? 'room-discovery-panel__status--valid' : 'room-discovery-panel__status--invalid'}">${isValid ? '✓ Hop le' : '✗ Chua hop le'}</p>
        <div class="room-discovery-panel__buttons">
            <button class="action-button action-button--secondary" type="button" data-action="back-to-room-select">Quay lai</button>
            <button class="action-button action-button--primary" type="button" data-action="confirm-room-placement" ${!isValid ? 'disabled' : ''}>Xac nhan</button>
        </div></div></div>`;
}

// ======================= MAIN RENDER/UPDATE =======================

export function renderGameScreen(gameState, myId) {
    const isRolling = gameState?.gamePhase === 'rolling';
    const isPlaying = gameState?.gamePhase === 'playing';
    let content = '';

    if (isRolling) {
        content = renderDiceRollOverlay(gameState, myId);
    } else if (isPlaying) {
        const mapState = gameState.map || null;
        const playerState = gameState.playerState || {};
        const playerPositions = playerState.playerPositions || {};
        const playerEntryDirections = playerState.playerEntryDirections || {};
        const players = gameState.players || [];
        const playerNames = buildPlayerNamesMap(players, getCharacterName);
        const playerColors = buildPlayerColorsMap(players, getCharacterColor);
        const myPosition = playerPositions[myId];
        const revealedRooms = mapState?.revealedRooms || {};
        const currentRoom = myPosition ? revealedRooms[myPosition] : null;
        const activePlayerId = gameState.turnOrder?.[gameState.currentTurnIndex] || null;

        let roomDiscoveryHtml = '';
        let roomPreview = null;

        if (state.roomDiscoveryModal?.isOpen) {
            if (state.roomDiscoveryModal.selectedRoom) {
                const selectedRoomDef = ROOMS.find(r => r.name.en === state.roomDiscoveryModal.selectedRoom);
                if (selectedRoomDef && currentRoom) {
                    const currentRotation = state.roomDiscoveryModal.currentRotation || 0;
                    const originalDoors = selectedRoomDef.doors.filter(d => d.kind === 'door').map(d => convertDoorSide(d.side));
                    const rotatedDoors = rotateRoomDoors(originalDoors, currentRotation);
                    const isValid = isRotationValid(selectedRoomDef, currentRotation, state.roomDiscoveryModal.doorSide);
                    const direction = state.roomDiscoveryModal.direction;
                    const offsets = { 'north': { x: 0, y: 1 }, 'south': { x: 0, y: -1 }, 'east': { x: 1, y: 0 }, 'west': { x: -1, y: 0 } };
                    const offset = offsets[direction] || { x: 0, y: 0 };
                    roomPreview = { name: selectedRoomDef.name.vi || selectedRoomDef.name.en, doors: rotatedDoors, rotation: currentRotation, x: currentRoom.x + offset.x, y: currentRoom.y + offset.y, isValid };
                }
            }
            roomDiscoveryHtml = renderRoomDiscoveryModal(state.roomDiscoveryModal.floor, state.roomDiscoveryModal.doorSide, revealedRooms);
        }

        const floorOverride = state.roomSelectModal ? state.roomSelectModal.selectedFloor : null;

        content = `
            ${renderGameIntro()}
            ${renderSidebarToggle(gameState, myId)}
            <div class="game-layout">
                ${renderSidebar(gameState, myId)}
                <div class="game-main">
                    ${renderTurnOrder(gameState, myId)}
                    <div class="game-area">
                        ${renderGameMap(mapState, playerPositions, playerNames, playerColors, myId, myPosition, roomPreview, playerEntryDirections, activePlayerId, floorOverride)}
                    </div>
                </div>
            </div>
            ${renderRoomTokenNotification(gameState, myId)}
            ${renderGameControls(gameState, myId)}
            ${renderHauntButton(gameState)}
            ${renderTokenDetailPopup(gameState, myId)}
            ${roomDiscoveryHtml}
            ${renderTokenDrawingModal()}
            ${renderCardsViewModal()}
            ${renderDiceEventModal()}
            ${renderEventDiceModal()}
            ${renderDamageDiceModal()}
            ${renderRoomEffectDiceModal()}
            ${renderCombatModal()}
            ${renderDamageDistributionModal()}
            ${renderStatChoiceModal()}
            ${renderStatChangeNotification()}
            ${renderMultiRollSummary()}
            ${renderTrappedEscapeModalFn()}
            ${renderRescueTrappedModalFn()}
            ${renderPersistentDamageModalFn()}
            ${renderTeleportChoiceModal()}
            ${renderRoomSelectModalFn()}
            ${renderRoomSelectConfirmModalFn()}
            ${renderReturnItemModalFn()}
            ${renderEventResultModalFn()}
            ${renderOptionalRollModal()}
            ${renderChoiceModal()}
            ${renderPeekModal()}
            ${renderStoreDiceModal()}
            ${renderTokenInteractionModal()}
            ${renderTokenPromptModal()}
            ${renderMultiPlayerRollModal()}
            ${renderSecondRollModal()}
            ${renderEndTurnModal()}
            ${renderResetGameModal()}
            ${renderTutorialModal()}
        `;
    } else {
        content = `<div class="game-loading"><p>Dang tai tro choi...</p></div>`;
    }

    return `<div class="game-container">${content}${renderCharacterModal()}
        <button class="tutorial-fab" type="button" data-action="open-tutorial" title="Huong dan choi">
            <svg class="tutorial-fab__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="8" y1="7" x2="16" y2="7" stroke="currentColor" stroke-width="1.5"/>
                <line x1="8" y1="11" x2="14" y2="11" stroke="currentColor" stroke-width="1.5"/>
            </svg>
        </button></div>`;
}

export async function updateGameUI(mountEl, gameState, myId) {
    if (gameState?.gamePhase === 'playing' && myId) {
        const currentTurnIndex = gameState.currentTurnIndex ?? 0;
        const currentPlayer = gameState.turnOrder?.[currentTurnIndex];
        const me = gameState.players?.find(p => p.id === myId);
        const myMoves = gameState.playerMoves?.[myId] ?? 0;

        if (currentPlayer === myId && state.movesInitializedForTurn !== currentTurnIndex) {
            const trappedInfo = gameState?.playerState?.trappedPlayers?.[myId];
            if (trappedInfo && !state.trappedEscapeModal?.isOpen) {
                state.movesInitializedForTurn = currentTurnIndex;
                if (trappedInfo.turnsTrapped > trappedInfo.autoEscapeAfter) {
                    delete gameState.playerState.trappedPlayers[myId];
                    syncGameStateToServer();
                    if (me?.characterId) {
                        const charData = gameState.playerState?.characterData?.[myId] || gameState.characterData?.[myId];
                        const speed = getCharacterSpeed(me.characterId, charData);
                        socketClient.setMoves(speed);
                    }
                    openEventResultModal(mountEl, 'TU DONG THOAT!', `Ban da tu dong thoat sau ${trappedInfo.autoEscapeAfter} luot that bai.`, 'success');
                    return;
                }
                openTrappedEscapeModal(mountEl, trappedInfo);
                return;
            }
        }

        if (currentPlayer === myId && state.movesInitializedForTurn !== currentTurnIndex && !state.returnItemModal?.isOpen) {
            // Check for pending stat choices (from allPlayersLoseStat events)
            const pendingStatChoice = gameState?.playerState?.pendingStatChoices?.[myId];
            if (pendingStatChoice && !state.statChoiceModal?.isOpen) {
                // Remove from pending before showing modal
                delete gameState.playerState.pendingStatChoices[myId];
                syncGameStateToServer();
                state.statChoiceModal = {
                    isOpen: true,
                    title: `MAT CHI SO (${pendingStatChoice.reason || 'HINH PHAT CHUNG'})`,
                    effect: pendingStatChoice.effect || 'loseStat',
                    amount: pendingStatChoice.amount || 1,
                    options: ['speed', 'might', 'sanity', 'knowledge'],
                    selectedStat: null,
                    isAllPlayers: true,
                };
                // Don't return - still render the screen with the modal
            }

            const pendingEvents = gameState?.playerState?.pendingEvents?.[myId] || [];
            const pendingReflection = pendingEvents.find(entry => entry.id === 'anh_phan_chieu_2');
            if (pendingReflection) {
                removePendingEvent(myId, pendingReflection.id);
                syncGameStateToServer();
                const eventCard = EVENTS.find(card => card.id === pendingReflection.id);
                if (eventCard) { handleReflectionEvent(mountEl, eventCard, myId); return; }
            }
        }

        if (currentPlayer === myId && myMoves === 0 && state.movesInitializedForTurn !== currentTurnIndex) {
            if (me?.characterId) {
                state.movesInitializedForTurn = currentTurnIndex;
                const persistentEffects = gameState.playerState?.persistentEffects?.[myId];
                if (persistentEffects && persistentEffects.length > 0) {
                    const effect = persistentEffects[0];
                    if (effect.onTurnStart) {
                        applyPersistentTurnEffect(mountEl, myId, effect);
                        return;
                    }
                }
                const charData = gameState.playerState?.characterData?.[myId] || gameState.characterData?.[myId];
                const speed = getCharacterSpeed(me.characterId, charData);
                await socketClient.setMoves(speed);
                return;
            }
        }
    }

    // Check for interactive token prompt when entering a room with interactive tokens
    if (gameState?.gamePhase === 'playing' && myId) {
        const currentRoomId = gameState?.playerState?.playerPositions?.[myId];
        const currentTurnIdx = gameState.currentTurnIndex ?? 0;
        const currentTurnPlayerId = gameState.turnOrder?.[currentTurnIdx];
        if (currentTurnPlayerId === myId && currentRoomId) {
            const room = gameState?.map?.revealedRooms?.[currentRoomId];
            if (room?.specialTokens?.length &&
                !state.tokenPromptModal?.isOpen &&
                !state.tokenInteractionModal?.isOpen &&
                !state.tokenDrawingModal?.isOpen &&
                !state.eventDiceModal?.isOpen &&
                !state.roomDiscoveryModal?.isOpen &&
                !state.damageDiceModal) {

                // Dynamically import to check interactive tokens
                import('../events/eventToken.js').then(m => {
                    m.checkTokenInteractionOnRoomEntry(mountEl);
                });
            }
        }
    }

    let savedScrollLeft = 0;
    let savedScrollTop = 0;
    if (state.skipMapCentering) {
        const gameMap = mountEl.querySelector('.game-map');
        if (gameMap) { savedScrollLeft = gameMap.scrollLeft; savedScrollTop = gameMap.scrollTop; }
    }

    const html = renderGameScreen(gameState, myId);
    mountEl.innerHTML = html;

    if (state.skipMapCentering) {
        state.skipMapCentering = false;
        requestAnimationFrame(() => {
            const gameMap = mountEl.querySelector('.game-map');
            if (gameMap) { gameMap.scrollLeft = savedScrollLeft; gameMap.scrollTop = savedScrollTop; }
        });
        return;
    }

    if (state.roomDiscoveryModal?.isOpen && state.roomDiscoveryModal?.selectedRoom) {
        centerMapOnPreview(mountEl);
    } else {
        centerMapOnPlayer(mountEl);
    }
}

// Export helpers needed by other modules
export {
    openCharacterModal, closeCharacterModal, renderCharacterDetail,
    getStairsAvailability, getAvailableDirections, roomRequiresDiceRoll
};

function renderCharacterDetail(char, currentStats = null) {
    const bio = char.bio.vi;
    const profile = char.profile?.vi || char.profile?.en || {};
    const hobbies = bio.hobbies?.join(', ') || 'Khong ro';
    const fear = profile.fear || 'Khong ro';
    const info = profile.info || '';
    const traitLabels = { speed: 'Toc do', might: 'Suc manh', sanity: 'Tam tri', knowledge: 'Kien thuc' };
    const traitsHtml = Object.entries(char.traits).map(([key, trait]) => {
        const label = traitLabels[key] || key;
        const currentIndex = currentStats ? currentStats[key] : trait.startIndex;
        const trackHtml = trait.track.map((val, idx) => {
            const isStart = idx === trait.startIndex;
            const isCurrent = idx === currentIndex;
            let classes = 'trait-value';
            if (isStart) classes += ' trait-value--start';
            if (isCurrent && !isStart) classes += ' trait-value--current';
            return `<span class="${classes}">${val}</span>`;
        }).join('<span class="trait-sep"> - </span>');
        return `<div class="trait-row"><span class="trait-label">${label}</span><span class="trait-track">${trackHtml}</span></div>`;
    }).join('');
    return `<div class="character-detail">
        <div class="character-detail__bio">
            <div class="detail-row"><span class="detail-label">Tuoi:</span><span class="detail-value">${bio.age}</span></div>
            <div class="detail-row"><span class="detail-label">Chieu cao:</span><span class="detail-value">${bio.height}</span></div>
            <div class="detail-row"><span class="detail-label">Can nang:</span><span class="detail-value">${bio.weight}</span></div>
            <div class="detail-row"><span class="detail-label">Sinh nhat:</span><span class="detail-value">${bio.birthday}</span></div>
            <div class="detail-row"><span class="detail-label">So thich:</span><span class="detail-value">${hobbies}</span></div>
            <div class="detail-row"><span class="detail-label">Noi so:</span><span class="detail-value">${fear}</span></div>
        </div>
        <div class="character-detail__traits"><h3 class="detail-section-title">Chi so</h3>${traitsHtml}</div>
        <div class="character-detail__story"><h3 class="detail-section-title">Tieu su</h3><p class="detail-info">${info.replace(/\n\n/g, '</p><p class="detail-info">')}</p></div>
    </div>`;
}

function openCharacterModal(mountEl, charId, currentStats = null) {
    const char = CHARACTER_BY_ID[charId];
    const modal = mountEl.querySelector('#character-modal');
    const modalTitle = mountEl.querySelector('#modal-title');
    const modalBody = mountEl.querySelector('#modal-body');
    if (!char || !modal || !modalTitle || !modalBody) return;
    modalTitle.textContent = char.name.vi || char.name.nickname || char.name.en;
    modalBody.innerHTML = renderCharacterDetail(char, currentStats);
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
}

function closeCharacterModal(mountEl) {
    const modal = mountEl.querySelector('#character-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
}
