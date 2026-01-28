/**
 * Event Effects Module
 *
 * Pure functions for processing event card effects.
 * All functions receive gameState as a parameter instead of using module-level state.
 * This enables unit testing without DOM or Socket.IO dependencies.
 *
 * The main dispatcher (applyEventDiceResult) returns a result descriptor
 * that gameView.js uses to trigger UI updates and socket sync.
 */

import { CHARACTER_BY_ID } from '../data/charactersData.js';

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Destination name mapping from event data (snake_case) to room names
 */
export const DESTINATION_TO_ROOM_NAME = {
    'entrance_hall': 'Entrance Hall',
    'foyer': 'Foyer',
    'grand_staircase': 'Grand Staircase',
    'chapel': 'Chapel',
    'graveyard': 'Graveyard',
    'crypt': 'Crypt',
    'patio': 'Patio',
    'gardens': 'Gardens',
    'tower': 'Tower',
    'balcony': 'Balcony',
    'basement_landing': 'Basement Landing',
};

/**
 * Stat labels for display (Vietnamese with English in parentheses)
 */
export const STAT_LABELS = {
    speed: 'Toc do (Speed)',
    might: 'Suc manh (Might)',
    knowledge: 'Kien thuc (Knowledge)',
    sanity: 'Tam tri (Sanity)'
};

// ============================================================
// PURE PREDICATES - No state dependencies
// ============================================================

/**
 * Check if a dice result matches a roll range
 * @param {string} range - Range format: "4+" (X or higher), "2-3" (range), "0" (exact)
 * @param {number} result - The dice result
 * @returns {boolean}
 */
export function matchesRollRange(range, result) {
    if (!range) return false;

    // Handle "X+" format (X or higher)
    if (range.endsWith('+')) {
        const min = parseInt(range.slice(0, -1), 10);
        return result >= min;
    }

    // Handle "X-Y" format (range)
    if (range.includes('-')) {
        const [minStr, maxStr] = range.split('-');
        const min = parseInt(minStr, 10);
        const max = parseInt(maxStr, 10);
        return result >= min && result <= max;
    }

    // Handle single number (exact match)
    const exact = parseInt(range, 10);
    return result === exact;
}

/**
 * Find matching outcome for a dice result from an array of roll results
 * @param {Array<{range: string, effect: string, ...}>} rollResults - Array of roll result outcomes
 * @param {number} result - The dice result
 * @returns {object|null} The first matching outcome, or null if no match
 */
export function findMatchingOutcome(rollResults, result) {
    if (!rollResults || !Array.isArray(rollResults)) {
        return null;
    }

    for (const outcome of rollResults) {
        if (matchesRollRange(outcome.range, result)) {
            return outcome;
        }
    }

    return null;
}

// ============================================================
// PURE LOOKUPS - Read from gameState, no mutations
// ============================================================

/**
 * Get actual stat value from character trait track
 * @param {string} characterId - Character ID
 * @param {string} trait - Trait name (speed, might, sanity, knowledge)
 * @param {number} currentIndex - Current index in trait track (0-7)
 * @returns {number} The actual stat value
 */
export function getStatValue(characterId, trait, currentIndex) {
    const char = CHARACTER_BY_ID[characterId];
    if (!char) return 0;
    const traitData = char.traits[trait];
    if (!traitData) return 0;
    const idx = Math.max(0, Math.min(7, currentIndex));
    return traitData.track[idx];
}

/**
 * Get player's current stat value for dice count
 * @param {object} gameState - The game state object
 * @param {string} playerId - Player ID
 * @param {string} stat - Stat name (speed, might, sanity, knowledge)
 * @returns {number} The stat value (for dice count)
 */
export function getPlayerStatForDice(gameState, playerId, stat) {
    if (!gameState || !playerId || !stat) return 4; // default

    const player = gameState.players?.find(p => p.id === playerId);
    if (!player) return 4;

    const charData = gameState.playerState?.characterData?.[playerId];
    if (!charData || !charData.stats) {
        // Use starting index from character definition
        const char = CHARACTER_BY_ID[player.characterId];
        if (!char) return 4;
        return char.traits[stat]?.track[char.traits[stat]?.startIndex] || 4;
    }

    return getStatValue(player.characterId, stat, charData.stats[stat]);
}

/**
 * Find room ID by destination name
 * @param {object} gameState - The game state object
 * @param {string} destination - Destination name from event (e.g., 'entrance_hall')
 * @returns {string|null} Room ID if found, null otherwise
 */
export function findRoomIdByDestination(gameState, destination) {
    if (!gameState?.map?.revealedRooms) {
        return null;
    }

    const revealedRooms = gameState.map.revealedRooms;
    const targetRoomName = DESTINATION_TO_ROOM_NAME[destination];

    if (!targetRoomName) {
        return null;
    }

    // Search for room by name (supports both English name and Vietnamese name with English in parentheses)
    for (const [roomId, room] of Object.entries(revealedRooms)) {
        if (room.name === targetRoomName ||
            room.name?.includes(`(${targetRoomName})`) ||
            room.name?.en === targetRoomName) {
            return roomId;
        }
    }

    return null;
}

/**
 * Find all revealed rooms from a list of destinations
 * @param {object} gameState - The game state object
 * @param {string[]} destinations - Array of destination keys (e.g., ['graveyard', 'crypt'])
 * @returns {Array<{roomId: string, name: string, destination: string}>} Array of found rooms
 */
export function findExistingRooms(gameState, destinations) {
    if (!gameState?.map?.revealedRooms || !destinations?.length) {
        return [];
    }

    const results = [];
    const revealedRooms = gameState.map.revealedRooms;

    for (const dest of destinations) {
        const targetRoomName = DESTINATION_TO_ROOM_NAME[dest];
        if (!targetRoomName) continue;

        for (const [roomId, room] of Object.entries(revealedRooms)) {
            if (room.name === targetRoomName ||
                room.name?.includes(`(${targetRoomName})`) ||
                room.name?.en === targetRoomName) {
                results.push({
                    roomId,
                    name: room.name,
                    destination: dest
                });
                break; // Found this destination, move to next
            }
        }
    }

    return results;
}

// ============================================================
// STATE MUTATIONS - Modify gameState, return change records
// ============================================================

/**
 * Initialize character data for a player if not exists
 * @param {object} gameState - The game state object
 * @param {string} playerId - Player ID
 * @returns {object|null} The character data object, or null if player not found
 */
function ensureCharacterData(gameState, playerId) {
    const player = gameState.players?.find(p => p.id === playerId);
    if (!player) return null;

    // Initialize playerState if needed
    if (!gameState.playerState) {
        gameState.playerState = {};
    }

    // Initialize characterData if needed
    if (!gameState.playerState.characterData) {
        gameState.playerState.characterData = {};
    }

    if (!gameState.playerState.characterData[playerId]) {
        const char = CHARACTER_BY_ID[player.characterId];
        if (!char || !char.traits) {
            // Use default values if character not found
            gameState.playerState.characterData[playerId] = {
                characterId: player.characterId,
                stats: { speed: 3, might: 3, sanity: 3, knowledge: 3 }
            };
        } else {
            gameState.playerState.characterData[playerId] = {
                characterId: player.characterId,
                stats: {
                    speed: char.traits.speed?.startIndex ?? 3,
                    might: char.traits.might?.startIndex ?? 3,
                    sanity: char.traits.sanity?.startIndex ?? 3,
                    knowledge: char.traits.knowledge?.startIndex ?? 3,
                }
            };
        }
    }

    return gameState.playerState.characterData[playerId];
}

/**
 * Apply a stat change to a player
 * @param {object} gameState - The game state object
 * @param {string} playerId - Player ID
 * @param {string} stat - Stat name (speed, might, sanity, knowledge)
 * @param {number} amount - Amount to change (positive for gain, negative for loss)
 * @returns {{playerId: string, stat: string, amount: number, beforeIndex: number, afterIndex: number}|null}
 */
export function applyStatChange(gameState, playerId, stat, amount) {
    if (!gameState || !playerId || !stat) return null;

    const charData = ensureCharacterData(gameState, playerId);
    if (!charData || !charData.stats) return null;

    const beforeIndex = charData.stats[stat] ?? 0;
    const afterIndex = Math.max(0, Math.min(7, beforeIndex + amount));
    charData.stats[stat] = afterIndex;

    return {
        playerId,
        stat,
        amount,
        beforeIndex,
        afterIndex
    };
}

/**
 * Apply multiple stat changes to a player (for loseStats effect)
 * @param {object} gameState - The game state object
 * @param {string} playerId - Player ID
 * @param {object} stats - Object with stat names as keys and amounts as values (positive = loss)
 * @returns {Array<{stat: string, amount: number, beforeIndex: number, afterIndex: number}>}
 */
export function applyMultipleStatChanges(gameState, playerId, stats) {
    if (!stats) return [];

    const changes = [];
    for (const [stat, lossAmount] of Object.entries(stats)) {
        // negative because stats object contains "loss" amounts
        const result = applyStatChange(gameState, playerId, stat, -lossAmount);
        if (result) {
            changes.push({
                stat: result.stat,
                amount: -lossAmount,
                beforeIndex: result.beforeIndex,
                afterIndex: result.afterIndex
            });
        }
    }
    return changes;
}

/**
 * Apply trapped effect to a player
 * @param {object} gameState - The game state object
 * @param {string} playerId - Player ID
 * @param {object} eventCard - Event card with trappedEffect
 * @returns {object|undefined} The trapped record, or undefined if no trappedEffect
 */
export function applyTrappedEffect(gameState, playerId, eventCard) {
    if (!eventCard.trappedEffect) return undefined;

    const { escapeRoll, allyCanHelp, allyFailure, autoEscapeAfter } = eventCard.trappedEffect;

    // Initialize trapped state in player data
    if (!gameState.playerState) {
        gameState.playerState = {};
    }
    if (!gameState.playerState.trappedPlayers) {
        gameState.playerState.trappedPlayers = {};
    }

    const trappedRecord = {
        eventId: eventCard.id,
        eventName: eventCard.name?.vi || 'Event',
        escapeRoll: escapeRoll,
        allyCanHelp: allyCanHelp,
        allyFailure: allyFailure || 'nothing', // 'alsoTrapped' or 'nothing'
        autoEscapeAfter: autoEscapeAfter,
        turnsTrapped: 1 // Start at 1 since this is the turn they got trapped
    };

    gameState.playerState.trappedPlayers[playerId] = trappedRecord;

    // Set moves to 0 immediately - trapped player can't move this turn
    if (!gameState.playerMoves) {
        gameState.playerMoves = {};
    }
    gameState.playerMoves[playerId] = 0;

    return trappedRecord;
}

/**
 * Apply persistent effect to a player
 * @param {object} gameState - The game state object
 * @param {string} playerId - Player ID
 * @param {object} eventCard - Event card with persistentEffect
 * @returns {object|undefined} The persistent record, or undefined if no persistentEffect
 */
export function applyPersistentEffect(gameState, playerId, eventCard) {
    if (!eventCard.persistentEffect) return undefined;

    const { onTurnStart, removeConditions } = eventCard.persistentEffect;

    // Initialize persistent effects in player data
    if (!gameState.playerState) {
        gameState.playerState = {};
    }
    if (!gameState.playerState.persistentEffects) {
        gameState.playerState.persistentEffects = {};
    }
    if (!gameState.playerState.persistentEffects[playerId]) {
        gameState.playerState.persistentEffects[playerId] = [];
    }

    const persistentRecord = {
        eventId: eventCard.id,
        eventName: eventCard.name?.vi || 'Event',
        onTurnStart: onTurnStart,
        removeConditions: removeConditions
    };

    gameState.playerState.persistentEffects[playerId].push(persistentRecord);

    return persistentRecord;
}

// ============================================================
// MAIN DISPATCHER - Returns EventEffectResult
// ============================================================

/**
 * @typedef {Object} EventEffectResult
 * @property {'nothing'|'gainStat'|'loseStat'|'loseStats'|'teleport'|'teleportIfExists'|
 *           'drawItem'|'damage'|'physicalDamage'|'mentalDamage'|'trapped'|'persistent'|
 *           'setStatToLowest'|'attack'|'forcedAttack'|'error'} type
 * @property {string} [displayTitle] - UI modal title
 * @property {string} [displayMessage] - UI modal message
 * @property {'success'|'neutral'|'danger'|'warning'} [displaySeverity]
 * @property {string} [stat] - Affected stat name
 * @property {number} [beforeIndex] - Stat index before change
 * @property {number} [afterIndex] - Stat index after change
 * @property {number} [amount] - Change amount
 * @property {string} [destinationRoomId] - For teleport
 * @property {string} [destinationName] - For teleport display
 * @property {number} [drawCount] - For drawItem
 * @property {object} [pendingDamage] - For damage effects: { physicalDice, mentalDice }
 * @property {boolean} [pendingTrapped] - True if damage has then:trapped
 * @property {object} [outcome] - The original outcome object (for chained effects)
 * @property {object} [trappedRecord] - The trapped state written to gameState
 * @property {object} [persistentRecord] - The persistent state written to gameState
 * @property {string} [attackTarget] - For forcedAttack
 * @property {string} [error] - Error description if type === 'error'
 */

/**
 * Apply event dice result effect - main dispatcher
 * Mutates gameState where needed, returns result descriptor for UI handling
 *
 * @param {object} gameState - The game state object (will be mutated)
 * @param {string} playerId - Player ID
 * @param {object} eventCard - The event card object
 * @param {number} result - Dice roll result
 * @param {string} rolledStat - The stat that was rolled (for 'rolled' keyword resolution)
 * @returns {EventEffectResult}
 */
export function applyEventDiceResult(gameState, playerId, eventCard, result, rolledStat) {
    if (!eventCard || !eventCard.rollResults) {
        return { type: 'error', error: 'Invalid event card or missing rollResults' };
    }

    const outcome = findMatchingOutcome(eventCard.rollResults, result);

    if (!outcome) {
        return { type: 'error', error: `No matching outcome found for result: ${result}` };
    }

    // Handle different effect types
    switch (outcome.effect) {
        case 'nothing':
            return {
                type: 'nothing',
                displayTitle: 'KHONG CO GI XAY RA',
                displayMessage: 'Ban da vuot qua thu thach!',
                displaySeverity: 'neutral'
            };

        case 'gainStat': {
            const gainStatName = outcome.stat === 'rolled' ? rolledStat : outcome.stat;
            const amount = outcome.amount || 1;
            const beforeValue = getPlayerStatForDice(gameState, playerId, gainStatName);
            const changeResult = applyStatChange(gameState, playerId, gainStatName, amount);
            const afterValue = getPlayerStatForDice(gameState, playerId, gainStatName);

            return {
                type: 'gainStat',
                stat: gainStatName,
                amount,
                beforeIndex: changeResult?.beforeIndex,
                afterIndex: changeResult?.afterIndex,
                displayTitle: 'TANG CHI SO',
                displayMessage: `${STAT_LABELS[gainStatName]}: ${beforeValue} → ${afterValue} (+${amount})`,
                displaySeverity: 'success'
            };
        }

        case 'loseStat': {
            const loseStatName = outcome.stat === 'rolled' ? rolledStat : outcome.stat;
            const amount = outcome.amount || 1;
            const beforeValue = getPlayerStatForDice(gameState, playerId, loseStatName);
            const changeResult = applyStatChange(gameState, playerId, loseStatName, -amount);
            const afterValue = getPlayerStatForDice(gameState, playerId, loseStatName);

            return {
                type: 'loseStat',
                stat: loseStatName,
                amount,
                beforeIndex: changeResult?.beforeIndex,
                afterIndex: changeResult?.afterIndex,
                displayTitle: 'GIAM CHI SO',
                displayMessage: `${STAT_LABELS[loseStatName]}: ${beforeValue} → ${afterValue} (-${amount})`,
                displaySeverity: 'danger'
            };
        }

        case 'loseStats': {
            applyMultipleStatChanges(gameState, playerId, outcome.stats);

            // Build message for multiple stats
            const loseStatsMsg = Object.entries(outcome.stats)
                .map(([s, amt]) => `${STAT_LABELS[s]} -${amt}`)
                .join(', ');

            // Check if there's a 'then' effect (like teleportIfExists)
            if (outcome.then && outcome.then.effect === 'teleportIfExists') {
                const destinations = outcome.then.destinations || [];
                const existingRooms = findExistingRooms(gameState, destinations);

                if (existingRooms.length > 0) {
                    // Random teleport to one of the available rooms
                    const randomIndex = Math.floor(Math.random() * existingRooms.length);
                    const selectedRoom = existingRooms[randomIndex];
                    const destRoomId = selectedRoom.roomId;

                    // Initialize playerPositions if needed
                    if (!gameState.playerState) {
                        gameState.playerState = {};
                    }
                    if (!gameState.playerState.playerPositions) {
                        gameState.playerState.playerPositions = {};
                    }
                    gameState.playerState.playerPositions[playerId] = destRoomId;

                    return {
                        type: 'loseStats',
                        displayTitle: 'DICH CHUYEN',
                        displayMessage: `${loseStatsMsg}. Ban da bi dich chuyen den ${selectedRoom.name}`,
                        displaySeverity: 'danger',
                        destinationRoomId: destRoomId,
                        destinationName: selectedRoom.name
                    };
                }
            }

            return {
                type: 'loseStats',
                displayTitle: 'GIAM CHI SO',
                displayMessage: loseStatsMsg,
                displaySeverity: 'danger'
            };
        }

        case 'mentalDamage':
            return {
                type: 'mentalDamage',
                pendingDamage: { physicalDice: 0, mentalDice: outcome.dice },
                outcome
            };

        case 'physicalDamage': {
            const hasPendingTrapped = outcome.then === 'trapped' && !!eventCard.trappedEffect;
            return {
                type: 'physicalDamage',
                pendingDamage: { physicalDice: outcome.dice, mentalDice: 0 },
                pendingTrapped: hasPendingTrapped,
                outcome
            };
        }

        case 'damage':
            return {
                type: 'damage',
                pendingDamage: {
                    physicalDice: outcome.physicalDice || 0,
                    mentalDice: outcome.mentalDice || 0
                },
                outcome
            };

        case 'teleport': {
            const destinationRoomId = findRoomIdByDestination(gameState, outcome.destination);

            if (destinationRoomId) {
                // Initialize playerPositions if needed
                if (!gameState.playerState) {
                    gameState.playerState = {};
                }
                if (!gameState.playerState.playerPositions) {
                    gameState.playerState.playerPositions = {};
                }
                gameState.playerState.playerPositions[playerId] = destinationRoomId;

                // Get room name for display
                const revealedRooms = gameState.map?.revealedRooms || {};
                const destRoom = revealedRooms[destinationRoomId];
                const roomName = destRoom?.name || outcome.destination;

                return {
                    type: 'teleport',
                    destinationRoomId,
                    destinationName: roomName,
                    displayTitle: 'DICH CHUYEN',
                    displayMessage: `Ban da duoc dich chuyen den ${roomName}`,
                    displaySeverity: 'neutral'
                };
            } else {
                return {
                    type: 'error',
                    error: `Khong tim thay phong ${outcome.destination}. Phong nay chua duoc kham pha.`,
                    displayTitle: 'LOI',
                    displayMessage: `Khong tim thay phong ${outcome.destination}. Phong nay chua duoc kham pha.`,
                    displaySeverity: 'danger'
                };
            }
        }

        case 'drawItem': {
            const drawCount = outcome.amount || 1;
            return {
                type: 'drawItem',
                drawCount,
                displayTitle: 'RUT THE VAT PHAM',
                displayMessage: `Ban duoc rut ${drawCount} the vat pham`,
                displaySeverity: 'success'
            };
        }

        case 'attack':
            return {
                type: 'attack',
                attackerDice: outcome.attackerDice,
                displayTitle: 'TAN CONG',
                displayMessage: 'Chuc nang tan cong chua duoc ho tro',
                displaySeverity: 'warning'
            };

        case 'forcedAttack':
            return {
                type: 'forcedAttack',
                attackTarget: outcome.target,
                displayTitle: 'BI CUONG CHE TAN CONG',
                displayMessage: `Ban bi ep phai tan cong ${outcome.target}`,
                displaySeverity: 'danger'
            };

        case 'trapped': {
            const trappedRecord = applyTrappedEffect(gameState, playerId, eventCard);

            if (!trappedRecord) {
                return {
                    type: 'error',
                    error: 'Event card missing trappedEffect configuration'
                };
            }

            const { escapeRoll, autoEscapeAfter } = trappedRecord;

            return {
                type: 'trapped',
                trappedRecord,
                displayTitle: 'BI MAC KET!',
                displayMessage: `Ban bi mac ket va khong the di chuyen! Luot sau phai do ${escapeRoll.stat.toUpperCase()} dat ${escapeRoll.threshold}+ de thoat. Tu dong thoat sau ${autoEscapeAfter} luot.`,
                displaySeverity: 'danger'
            };
        }

        case 'persistent': {
            const persistentRecord = applyPersistentEffect(gameState, playerId, eventCard);

            if (!persistentRecord) {
                return {
                    type: 'error',
                    error: 'Event card missing persistentEffect configuration'
                };
            }

            // Build description of the effect
            let effectDesc = '';
            const { onTurnStart } = persistentRecord;
            if (onTurnStart) {
                if (onTurnStart.effect === 'loseStat' && onTurnStart.statType === 'physical') {
                    effectDesc = 'Giam 1 chi so vat li (Speed/Might) moi luot.';
                } else if (onTurnStart.effect === 'loseStat' && onTurnStart.statType === 'mental') {
                    effectDesc = 'Giam 1 chi so tinh than (Sanity/Knowledge) moi luot.';
                }
            }

            return {
                type: 'persistent',
                persistentRecord,
                displayTitle: 'HIEU UNG DAI HAN',
                displayMessage: `${effectDesc} Huy bo khi ket thuc luot tai mot trong cac phong: Balcony, Gardens, Graveyard, Gymnasium, Larder, Patio, Tower.`,
                displaySeverity: 'danger'
            };
        }

        case 'setStatToLowest': {
            const targetStatName = outcome.stat === 'rolled' ? rolledStat : outcome.stat;
            const player = gameState.players?.find(p => p.id === playerId);
            const charData = gameState.playerState?.characterData?.[playerId];
            const charDef = player ? CHARACTER_BY_ID[player.characterId] : null;

            if (charData && charData.stats && charDef && charDef.traits) {
                const trait = charDef.traits[targetStatName];
                if (trait && trait.track) {
                    const currentIndex = charData.stats[targetStatName] ?? 0;
                    const currentValue = trait.track[currentIndex];

                    if (currentIndex > 0) {
                        // Set to index 0 (lowest above skull)
                        charData.stats[targetStatName] = 0;
                        const newValue = trait.track[0];

                        return {
                            type: 'setStatToLowest',
                            stat: targetStatName,
                            beforeIndex: currentIndex,
                            afterIndex: 0,
                            displayTitle: 'CHI SO GIAM TOI THIEU',
                            displayMessage: `${STAT_LABELS[targetStatName]}: ${currentValue} → ${newValue}`,
                            displaySeverity: 'danger'
                        };
                    } else {
                        return {
                            type: 'setStatToLowest',
                            stat: targetStatName,
                            beforeIndex: 0,
                            afterIndex: 0,
                            displayTitle: 'CHI SO DA O MUC THAP NHAT',
                            displayMessage: `${STAT_LABELS[targetStatName]} da o muc thap nhat.`,
                            displaySeverity: 'warning'
                        };
                    }
                }
            }

            return {
                type: 'error',
                error: `Character data or trait not found for ${targetStatName}`
            };
        }

        default:
            return {
                type: 'error',
                error: `Unknown effect type: ${outcome.effect}`
            };
    }
}
