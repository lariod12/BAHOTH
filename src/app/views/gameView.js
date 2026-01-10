// Game View - Dice rolling phase and main gameplay
import { CHARACTER_BY_ID } from '../data/charactersData.js';
import * as socketClient from '../services/socketClient.js';

/** @type {any} */
let currentGameState = null;
let mySocketId = null;
let unsubscribeGameState = null;

/**
 * Get character's Speed value at startIndex
 * @param {string} characterId
 * @returns {number}
 */
function getCharacterSpeed(characterId) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 4; // default
    const speedTrait = char.traits.speed;
    return speedTrait.track[speedTrait.startIndex];
}

/**
 * Get character name (Vietnamese)
 * @param {string} characterId
 * @returns {string}
 */
function getCharacterName(characterId) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 'Unknown';
    return char.name.vi || char.name.nickname || char.name.en;
}

/**
 * Check if current player's turn
 * @param {any} gameState
 * @param {string} myId
 * @returns {boolean}
 */
function isMyTurn(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return false;
    const currentPlayer = gameState.turnOrder[gameState.currentTurnIndex];
    return currentPlayer === myId;
}

/**
 * Check if I need to roll dice
 * @param {any} gameState
 * @param {string} myId
 * @returns {boolean}
 */
function needsToRoll(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'rolling') return false;
    return !gameState.diceRolls[myId] && gameState.needsRoll?.includes(myId);
}

/**
 * Render dice roll overlay
 */
function renderDiceRollOverlay(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'rolling') return '';

    const players = gameState.players || [];
    const diceRolls = gameState.diceRolls || {};
    const needsRoll = gameState.needsRoll || [];
    const iNeedToRoll = needsRoll.includes(myId);

    const playersRollsHtml = players.map(p => {
        const charName = getCharacterName(p.characterId);
        const roll = diceRolls[p.id];
        const isMe = p.id === myId;
        const waiting = needsRoll.includes(p.id);

        let rollDisplay = '';
        if (roll !== undefined) {
            rollDisplay = `<span class="dice-result">${roll}</span>`;
        } else if (waiting) {
            rollDisplay = `<span class="dice-waiting">...</span>`;
        } else {
            rollDisplay = `<span class="dice-waiting">-</span>`;
        }

        return `
            <div class="dice-player ${isMe ? 'is-me' : ''} ${waiting ? 'is-waiting' : ''}">
                <span class="dice-player__name">${charName}${isMe ? ' (You)' : ''}</span>
                ${rollDisplay}
            </div>
        `;
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
                🎲 Tung Xi Ngau
            </button>
        </div>
    ` : `
        <div class="dice-controls">
            <p class="dice-instruction">Dang cho cac nguoi choi khac tung xi ngau...</p>
        </div>
    `;

    return `
        <div class="dice-overlay">
            <div class="dice-modal">
                <h2 class="dice-title">Tung Xi Ngau</h2>
                <p class="dice-subtitle">Nguoi co diem cao nhat se di truoc</p>
                <div class="dice-players-list">
                    ${playersRollsHtml}
                </div>
                ${rollControls}
            </div>
        </div>
    `;
}

/**
 * Render player bar (bottom HUD)
 */
function renderPlayerBar(gameState, myId) {
    if (!gameState) return '';

    const me = gameState.players?.find(p => p.id === myId);
    if (!me) return '';

    const charName = getCharacterName(me.characterId);
    const movesLeft = gameState.playerMoves?.[myId] ?? 0;
    const myTurn = isMyTurn(gameState, myId);

    return `
        <div class="player-bar ${myTurn ? 'is-my-turn' : ''}">
            <div class="player-bar__info">
                <span class="player-bar__name">${charName}</span>
                <span class="player-bar__moves">Luot di: <strong>${movesLeft}</strong></span>
            </div>
        </div>
    `;
}

/**
 * Render turn order indicator
 */
function renderTurnOrder(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return '';

    const turnOrder = gameState.turnOrder || [];
    const currentIndex = gameState.currentTurnIndex ?? 0;
    const players = gameState.players || [];

    const orderedPlayers = turnOrder.map((socketId, idx) => {
        const player = players.find(p => p.id === socketId);
        if (!player) return null;
        const charName = getCharacterName(player.characterId);
        const isMe = socketId === myId;
        const isCurrent = idx === currentIndex;

        return `
            <div class="turn-indicator ${isCurrent ? 'is-current' : ''} ${isMe ? 'is-me' : ''}">
                <span class="turn-indicator__order">${idx + 1}</span>
                <span class="turn-indicator__name">${charName}${isMe ? ' (You)' : ''}</span>
            </div>
        `;
    }).filter(Boolean).join('');

    return `
        <div class="turn-order">
            <p class="turn-order__label">Thu tu luot di:</p>
            <div class="turn-order__list">${orderedPlayers}</div>
        </div>
    `;
}

/**
 * Render game controls (movement arrows + dice)
 */
function renderGameControls(gameState, myId) {
    if (!gameState || gameState.gamePhase !== 'playing') return '';

    const myTurn = isMyTurn(gameState, myId);
    const movesLeft = gameState.playerMoves?.[myId] ?? 0;
    const canMove = myTurn && movesLeft > 0;

    return `
        <div class="game-controls">
            <div class="movement-controls">
                <button class="move-btn move-btn--up" type="button" data-action="move" data-direction="up" ${!canMove ? 'disabled' : ''}>
                    ▲
                </button>
                <div class="move-btn-row">
                    <button class="move-btn move-btn--left" type="button" data-action="move" data-direction="left" ${!canMove ? 'disabled' : ''}>
                        ◀
                    </button>
                    <div class="move-center">
                        <span class="moves-remaining">${movesLeft}</span>
                    </div>
                    <button class="move-btn move-btn--right" type="button" data-action="move" data-direction="right" ${!canMove ? 'disabled' : ''}>
                        ▶
                    </button>
                </div>
                <button class="move-btn move-btn--down" type="button" data-action="move" data-direction="down" ${!canMove ? 'disabled' : ''}>
                    ▼
                </button>
            </div>
            <button class="dice-event-btn" type="button" data-action="dice-event" disabled title="Chi kich hoat khi co su kien">
                🎲
            </button>
        </div>
    `;
}

/**
 * Render welcome message
 */
function renderWelcomeMessage() {
    return `
        <div class="game-welcome">
            <h1 class="game-welcome__title">Chao mung den Vinh thu bo hoang</h1>
            <p class="game-welcome__subtitle">Betrayal at House on the Hill</p>
        </div>
    `;
}

/**
 * Render main game screen
 */
function renderGameScreen(gameState, myId) {
    const isRolling = gameState?.gamePhase === 'rolling';
    const isPlaying = gameState?.gamePhase === 'playing';

    let content = '';

    if (isRolling) {
        content = renderDiceRollOverlay(gameState, myId);
    } else if (isPlaying) {
        content = `
            ${renderWelcomeMessage()}
            ${renderTurnOrder(gameState, myId)}
            <div class="game-area">
                <!-- Map will go here later -->
                <p class="game-placeholder">Ban do se duoc hien thi o day</p>
            </div>
            ${renderPlayerBar(gameState, myId)}
            ${renderGameControls(gameState, myId)}
        `;
    } else {
        content = `
            <div class="game-loading">
                <p>Dang tai tro choi...</p>
            </div>
        `;
    }

    return `
        <div class="game-container">
            ${content}
        </div>
    `;
}

/**
 * Attach event listeners
 */
function attachEventListeners(mountEl, roomId) {
    // Roll dice manually
    mountEl.addEventListener('click', async (e) => {
        const target = /** @type {HTMLElement} */ (e.target);

        // Roll manual
        if (target.dataset.action === 'roll-manual') {
            const input = /** @type {HTMLInputElement} */ (mountEl.querySelector('#dice-manual-input'));
            const value = parseInt(input?.value || '0', 10);
            if (value >= 1 && value <= 16) {
                await socketClient.rollDice(value);
            } else {
                alert('Vui long nhap so tu 1 den 16');
            }
            return;
        }

        // Roll random
        if (target.dataset.action === 'roll-random') {
            const randomValue = Math.floor(Math.random() * 16) + 1;
            await socketClient.rollDice(randomValue);
            return;
        }

        // Move
        if (target.dataset.action === 'move') {
            const direction = target.dataset.direction;
            if (direction) {
                await socketClient.move(direction);
            }
            return;
        }

        // Dice event (disabled for now)
        if (target.dataset.action === 'dice-event') {
            // Placeholder for future events
            return;
        }
    });

    // Enter key for dice input
    mountEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.id === 'dice-manual-input') {
            const btn = mountEl.querySelector('[data-action="roll-manual"]');
            btn?.click();
        }
    });
}

// Track if we've initialized moves for the current turn
let movesInitializedForTurn = -1;

/**
 * Update game UI
 */
async function updateGameUI(mountEl, gameState, myId) {
    // When it becomes my turn in 'playing' phase, set my moves based on speed
    if (gameState?.gamePhase === 'playing' && myId) {
        const currentTurnIndex = gameState.currentTurnIndex ?? 0;
        const currentPlayer = gameState.turnOrder?.[currentTurnIndex];
        const me = gameState.players?.find(p => p.id === myId);
        const myMoves = gameState.playerMoves?.[myId] ?? 0;

        // If it's my turn and moves are 0 and we haven't initialized for this turn
        if (currentPlayer === myId && myMoves === 0 && movesInitializedForTurn !== currentTurnIndex) {
            if (me?.characterId) {
                movesInitializedForTurn = currentTurnIndex;
                const speed = getCharacterSpeed(me.characterId);
                await socketClient.setMoves(speed);
                return; // Will re-render after state update
            }
        }
    }

    const html = renderGameScreen(gameState, myId);
    mountEl.innerHTML = html;
}

/**
 * Render game view
 * @param {{ mountEl: HTMLElement; onNavigate: (hash: string) => void; roomId: string }} options
 */
export function renderGameView({ mountEl, onNavigate, roomId }) {
    // Connect socket
    socketClient.connect();
    mySocketId = socketClient.getSocketId();

    // Initial loading state
    mountEl.innerHTML = renderGameScreen(null, mySocketId);

    // Subscribe to game state updates
    unsubscribeGameState = socketClient.onGameState((state) => {
        currentGameState = state;
        mySocketId = socketClient.getSocketId();
        updateGameUI(mountEl, currentGameState, mySocketId);
    });

    // Request game state
    socketClient.getGameState(roomId);

    // Attach event listeners
    attachEventListeners(mountEl, roomId);

    // Cleanup on navigate away
    window.addEventListener('hashchange', () => {
        if (unsubscribeGameState) {
            unsubscribeGameState();
            unsubscribeGameState = null;
        }
    }, { once: true });
}
