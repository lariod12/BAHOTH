/**
 * Property-Based Tests for Event Effects Module
 *
 * Uses fast-check for property-based testing
 * Tests verify the core event effect logic without DOM or Socket.IO dependencies
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
    matchesRollRange,
    findMatchingOutcome,
    getStatValue,
    getPlayerStatForDice,
    applyStatChange,
    applyMultipleStatChanges,
    findRoomIdByDestination,
    findExistingRooms,
    applyTrappedEffect,
    applyPersistentEffect,
    applyEventDiceResult,
    DESTINATION_TO_ROOM_NAME,
    STAT_LABELS
} from './eventEffects.js';

// ============================================================
// ARBITRARIES (fast-check generators)
// ============================================================

const statNameArb = fc.constantFrom('speed', 'might', 'sanity', 'knowledge');
const statIndexArb = fc.integer({ min: 0, max: 7 });
const diceResultArb = fc.integer({ min: 0, max: 16 });

// Helper to create minimal game state for testing
function makeGameState(playerId = 'p1', characterId = 'madame-zostra', statIndex = 3) {
    return {
        players: [{ id: playerId, characterId }],
        playerState: {
            characterData: {
                [playerId]: {
                    characterId,
                    stats: { speed: statIndex, might: statIndex, sanity: statIndex, knowledge: statIndex }
                }
            },
            playerPositions: { [playerId]: 'room-start' },
            trappedPlayers: {},
            persistentEffects: { [playerId]: [] }
        },
        map: { revealedRooms: {} },
        playerMoves: { [playerId]: 3 }
    };
}

// ============================================================
// GROUP 1: Pure predicate tests (matchesRollRange)
// ============================================================

describe('matchesRollRange', () => {
    // Property: "X+" format -- result >= X is always true
    it('matches result >= X for "X+" ranges', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 16 }),  // X
                fc.integer({ min: 0, max: 16 }),  // result
                (x, result) => {
                    const range = `${x}+`;
                    const matches = matchesRollRange(range, result);
                    return matches === (result >= x);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property: "X-Y" format -- result in [X, Y] inclusive
    it('matches result in [min, max] for "X-Y" ranges', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 8 }),   // min
                fc.integer({ min: 0, max: 8 }),   // delta (to ensure max >= min)
                fc.integer({ min: 0, max: 16 }),  // result
                (min, delta, result) => {
                    const max = min + delta;
                    const range = `${min}-${max}`;
                    const matches = matchesRollRange(range, result);
                    return matches === (result >= min && result <= max);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property: exact number matches only that number
    it('matches exact number only', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 16 }),  // exact
                fc.integer({ min: 0, max: 16 }),  // result
                (exact, result) => {
                    const range = `${exact}`;
                    const matches = matchesRollRange(range, result);
                    return matches === (result === exact);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Property: null/undefined range never matches
    it('returns false for null or undefined range', () => {
        fc.assert(
            fc.property(diceResultArb, (result) => {
                return matchesRollRange(null, result) === false &&
                       matchesRollRange(undefined, result) === false;
            }),
            { numRuns: 100 }
        );
    });

    // Specific edge cases
    it('handles edge case ranges correctly', () => {
        expect(matchesRollRange('0', 0)).toBe(true);
        expect(matchesRollRange('0', 1)).toBe(false);
        expect(matchesRollRange('0+', 0)).toBe(true);
        expect(matchesRollRange('4+', 4)).toBe(true);
        expect(matchesRollRange('4+', 3)).toBe(false);
        expect(matchesRollRange('1-3', 2)).toBe(true);
        expect(matchesRollRange('1-3', 4)).toBe(false);
    });
});

// ============================================================
// GROUP 2: Outcome lookup (findMatchingOutcome)
// ============================================================

describe('findMatchingOutcome', () => {
    // Property: first matching range wins (order matters)
    it('returns first outcome whose range matches the result', () => {
        fc.assert(
            fc.property(diceResultArb, (result) => {
                const outcomes = [
                    { range: '0-5', effect: 'loseStat', stat: 'might', amount: 1 },
                    { range: '6+', effect: 'gainStat', stat: 'speed', amount: 2 },
                ];
                const match = findMatchingOutcome(outcomes, result);
                if (result <= 5) return match?.effect === 'loseStat';
                return match?.effect === 'gainStat';
            }),
            { numRuns: 100 }
        );
    });

    // Property: overlapping ranges - first wins
    it('returns first match when ranges overlap', () => {
        const outcomes = [
            { range: '4+', effect: 'first' },
            { range: '6+', effect: 'second' },
        ];
        // Result 6 matches both, but first should win
        expect(findMatchingOutcome(outcomes, 6)?.effect).toBe('first');
        expect(findMatchingOutcome(outcomes, 4)?.effect).toBe('first');
        expect(findMatchingOutcome(outcomes, 3)).toBe(null);
    });

    // Property: empty rollResults returns null
    it('returns null for empty or missing rollResults', () => {
        expect(findMatchingOutcome([], 5)).toBe(null);
        expect(findMatchingOutcome(null, 5)).toBe(null);
        expect(findMatchingOutcome(undefined, 3)).toBe(null);
    });
});

// ============================================================
// GROUP 3: Stat change mutations (applyStatChange)
// ============================================================

describe('applyStatChange', () => {
    // Property: stat index is clamped to [0, 7]
    it('clamps stat index to [0, 7] range', () => {
        fc.assert(
            fc.property(statNameArb, statIndexArb, fc.integer({ min: -10, max: 10 }), (stat, startIdx, delta) => {
                const gs = makeGameState('p1', 'madame-zostra', startIdx);
                applyStatChange(gs, 'p1', stat, delta);
                const newIdx = gs.playerState.characterData['p1'].stats[stat];
                return newIdx >= 0 && newIdx <= 7;
            }),
            { numRuns: 100 }
        );
    });

    // Property: positive delta increases index (up to cap)
    it('positive amount increases stat index', () => {
        fc.assert(
            fc.property(statNameArb, fc.integer({ min: 0, max: 6 }), fc.integer({ min: 1, max: 3 }), (stat, startIdx, amount) => {
                const gs = makeGameState('p1', 'madame-zostra', startIdx);
                applyStatChange(gs, 'p1', stat, amount);
                const newIdx = gs.playerState.characterData['p1'].stats[stat];
                return newIdx > startIdx || newIdx === 7; // increased or hit cap
            }),
            { numRuns: 100 }
        );
    });

    // Property: negative delta decreases index (down to floor)
    it('negative amount decreases stat index', () => {
        fc.assert(
            fc.property(statNameArb, fc.integer({ min: 1, max: 7 }), fc.integer({ min: 1, max: 3 }), (stat, startIdx, amount) => {
                const gs = makeGameState('p1', 'madame-zostra', startIdx);
                applyStatChange(gs, 'p1', stat, -amount);
                const newIdx = gs.playerState.characterData['p1'].stats[stat];
                return newIdx < startIdx || newIdx === 0; // decreased or hit floor
            }),
            { numRuns: 100 }
        );
    });

    // Property: applying +N then -N is identity (when not clamped)
    it('applying +N then -N returns to original when not clamped', () => {
        fc.assert(
            fc.property(statNameArb, fc.integer({ min: 2, max: 5 }), fc.integer({ min: 1, max: 2 }), (stat, startIdx, delta) => {
                const gs = makeGameState('p1', 'madame-zostra', startIdx);
                applyStatChange(gs, 'p1', stat, delta);
                applyStatChange(gs, 'p1', stat, -delta);
                return gs.playerState.characterData['p1'].stats[stat] === startIdx;
            }),
            { numRuns: 100 }
        );
    });

    // Property: returns change record with correct values
    it('returns change record with before and after indices', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const result = applyStatChange(gs, 'p1', 'speed', 2);
        expect(result).toBeDefined();
        expect(result.beforeIndex).toBe(3);
        expect(result.afterIndex).toBe(5);
        expect(result.stat).toBe('speed');
        expect(result.amount).toBe(2);
    });

    // Edge case: invalid player returns null
    it('returns null for invalid player', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const result = applyStatChange(gs, 'invalid-player', 'speed', 1);
        expect(result).toBeNull();
    });
});

// ============================================================
// GROUP 4: Multiple stat changes (applyMultipleStatChanges)
// ============================================================

describe('applyMultipleStatChanges', () => {
    it('applies losses to multiple stats', () => {
        const gs = makeGameState('p1', 'madame-zostra', 5);
        const changes = applyMultipleStatChanges(gs, 'p1', { speed: 1, might: 2 });

        expect(gs.playerState.characterData['p1'].stats.speed).toBe(4); // 5 - 1
        expect(gs.playerState.characterData['p1'].stats.might).toBe(3); // 5 - 2
        expect(changes).toHaveLength(2);
    });

    it('returns empty array for null stats', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const changes = applyMultipleStatChanges(gs, 'p1', null);
        expect(changes).toEqual([]);
    });
});

// ============================================================
// GROUP 5: Room lookup (findRoomIdByDestination, findExistingRooms)
// ============================================================

describe('findRoomIdByDestination', () => {
    it('finds room by exact English name match', () => {
        const gs = {
            map: {
                revealedRooms: {
                    'room-abc': { name: 'Entrance Hall' },
                    'room-def': { name: 'Foyer' }
                }
            }
        };
        expect(findRoomIdByDestination(gs, 'entrance_hall')).toBe('room-abc');
        expect(findRoomIdByDestination(gs, 'foyer')).toBe('room-def');
    });

    it('returns null for unrevealed destination', () => {
        const gs = { map: { revealedRooms: { 'r1': { name: 'Foyer' } } } };
        expect(findRoomIdByDestination(gs, 'tower')).toBe(null);
    });

    it('returns null for unknown destination key', () => {
        const gs = { map: { revealedRooms: { 'r1': { name: 'Foyer' } } } };
        expect(findRoomIdByDestination(gs, 'nonexistent_room')).toBe(null);
    });

    it('returns null for missing game state', () => {
        expect(findRoomIdByDestination(null, 'foyer')).toBe(null);
        expect(findRoomIdByDestination({}, 'foyer')).toBe(null);
    });
});

describe('findExistingRooms', () => {
    it('finds multiple existing rooms', () => {
        const gs = {
            map: {
                revealedRooms: {
                    'room-1': { name: 'Graveyard' },
                    'room-2': { name: 'Crypt' },
                    'room-3': { name: 'Foyer' }
                }
            }
        };
        const results = findExistingRooms(gs, ['graveyard', 'crypt', 'tower']);
        expect(results).toHaveLength(2);
        expect(results.map(r => r.destination)).toContain('graveyard');
        expect(results.map(r => r.destination)).toContain('crypt');
    });

    it('returns empty array when no rooms match', () => {
        const gs = { map: { revealedRooms: { 'r1': { name: 'Foyer' } } } };
        const results = findExistingRooms(gs, ['graveyard', 'tower']);
        expect(results).toEqual([]);
    });

    it('returns empty array for empty destinations', () => {
        const gs = { map: { revealedRooms: { 'r1': { name: 'Foyer' } } } };
        expect(findExistingRooms(gs, [])).toEqual([]);
        expect(findExistingRooms(gs, null)).toEqual([]);
    });
});

// ============================================================
// GROUP 6: Trapped effect (applyTrappedEffect)
// ============================================================

describe('applyTrappedEffect', () => {
    it('initializes trappedPlayers map if missing', () => {
        const gs = {
            players: [{ id: 'p1', characterId: 'madame-zostra' }],
            playerState: { characterData: {} },
            playerMoves: { p1: 3 }
        };
        const eventCard = {
            id: 'trap-card',
            name: { vi: 'Trap' },
            trappedEffect: {
                escapeRoll: { stat: 'might', threshold: 4 },
                allyCanHelp: true,
                allyFailure: 'nothing',
                autoEscapeAfter: 2
            }
        };
        const record = applyTrappedEffect(gs, 'p1', eventCard);

        expect(gs.playerState.trappedPlayers).toBeDefined();
        expect(gs.playerState.trappedPlayers['p1']).toBeDefined();
        expect(record.turnsTrapped).toBe(1);
        expect(gs.playerMoves['p1']).toBe(0);
    });

    it('returns undefined for eventCard without trappedEffect', () => {
        const gs = { players: [], playerState: {}, playerMoves: {} };
        const result = applyTrappedEffect(gs, 'p1', { id: 'no-trap' });
        expect(result).toBeUndefined();
    });

    it('sets correct trapped record properties', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'mang_nhen',
            name: { vi: 'Mang Nhen' },
            trappedEffect: {
                escapeRoll: { stat: 'might', threshold: 4 },
                allyCanHelp: true,
                allyFailure: 'alsoTrapped',
                autoEscapeAfter: 3
            }
        };
        const record = applyTrappedEffect(gs, 'p1', eventCard);

        expect(record.eventId).toBe('mang_nhen');
        expect(record.escapeRoll.stat).toBe('might');
        expect(record.escapeRoll.threshold).toBe(4);
        expect(record.allyCanHelp).toBe(true);
        expect(record.allyFailure).toBe('alsoTrapped');
        expect(record.autoEscapeAfter).toBe(3);
    });
});

// ============================================================
// GROUP 7: Persistent effect (applyPersistentEffect)
// ============================================================

describe('applyPersistentEffect', () => {
    it('initializes persistentEffects array if missing', () => {
        const gs = {
            players: [{ id: 'p1', characterId: 'madame-zostra' }],
            playerState: { characterData: {} }
        };
        const eventCard = {
            id: 'persist-card',
            name: { vi: 'Persist' },
            persistentEffect: {
                onTurnStart: { effect: 'loseStat', statType: 'physical', amount: 1 },
                removeConditions: ['gainStatFromItem']
            }
        };
        const record = applyPersistentEffect(gs, 'p1', eventCard);

        expect(gs.playerState.persistentEffects['p1']).toHaveLength(1);
        expect(record.eventId).toBe('persist-card');
    });

    it('appends to existing array without replacing', () => {
        const gs = {
            players: [{ id: 'p1', characterId: 'madame-zostra' }],
            playerState: {
                characterData: {},
                persistentEffects: { p1: [{ eventId: 'existing-effect' }] }
            }
        };
        const eventCard = {
            id: 'second-persist',
            name: { vi: 'Second' },
            persistentEffect: {
                onTurnStart: { effect: 'loseStat', statType: 'mental', amount: 1 },
                removeConditions: []
            }
        };
        applyPersistentEffect(gs, 'p1', eventCard);

        expect(gs.playerState.persistentEffects['p1']).toHaveLength(2);
        expect(gs.playerState.persistentEffects['p1'][0].eventId).toBe('existing-effect');
        expect(gs.playerState.persistentEffects['p1'][1].eventId).toBe('second-persist');
    });

    it('returns undefined for eventCard without persistentEffect', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const result = applyPersistentEffect(gs, 'p1', { id: 'no-persist' });
        expect(result).toBeUndefined();
    });
});

// ============================================================
// GROUP 8: Main dispatcher (applyEventDiceResult)
// ============================================================

describe('applyEventDiceResult', () => {
    // Case: nothing effect
    it('nothing effect returns neutral descriptor without mutation', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'test-event',
            name: { vi: 'Test' },
            rollResults: [{ range: '5+', effect: 'nothing' }]
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 6, 'speed');

        expect(result.type).toBe('nothing');
        expect(result.displaySeverity).toBe('neutral');
        // State unchanged
        expect(gs.playerState.characterData['p1'].stats.speed).toBe(3);
    });

    // Case: gainStat effect
    it('gainStat increases stat and returns success descriptor', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'test-event',
            name: { vi: 'Test Event' },
            rollResults: [{ range: '4+', effect: 'gainStat', stat: 'speed', amount: 2 }]
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 5, 'speed');

        expect(result.type).toBe('gainStat');
        expect(result.stat).toBe('speed');
        expect(result.amount).toBe(2);
        expect(result.afterIndex).toBe(5); // 3 + 2
        expect(result.displaySeverity).toBe('success');
        expect(gs.playerState.characterData['p1'].stats.speed).toBe(5);
    });

    // Case: loseStat effect
    it('loseStat decreases stat and returns danger descriptor', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'test-event',
            name: { vi: 'Test Event' },
            rollResults: [{ range: '0-3', effect: 'loseStat', stat: 'sanity', amount: 1 }]
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 2, 'sanity');

        expect(result.type).toBe('loseStat');
        expect(result.stat).toBe('sanity');
        expect(result.afterIndex).toBe(2); // 3 - 1
        expect(result.displaySeverity).toBe('danger');
    });

    // Case: 'rolled' stat keyword resolves to rolledStat argument
    it('"rolled" stat keyword resolves to the rolledStat argument', () => {
        fc.assert(
            fc.property(statNameArb, fc.integer({ min: 1, max: 2 }), (rolledStat, amount) => {
                const gs = makeGameState('p1', 'madame-zostra', 3);
                const eventCard = {
                    id: 'rolled-test',
                    name: { vi: 'Rolled Test' },
                    rollResults: [{ range: '0+', effect: 'gainStat', stat: 'rolled', amount }]
                };
                const result = applyEventDiceResult(gs, 'p1', eventCard, 8, rolledStat);
                return result.stat === rolledStat;
            }),
            { numRuns: 100 }
        );
    });

    // Case: trapped effect
    it('trapped effect sets trappedPlayers and zeroes moves', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'mang_nhen',
            name: { vi: 'Mang Nhen' },
            rollResults: [{ range: '0-3', effect: 'trapped' }],
            trappedEffect: {
                escapeRoll: { stat: 'might', threshold: 4 },
                allyCanHelp: true,
                allyFailure: 'alsoTrapped',
                autoEscapeAfter: 3
            }
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 2, 'might');

        expect(result.type).toBe('trapped');
        expect(result.trappedRecord).toBeDefined();
        expect(result.trappedRecord.escapeRoll.stat).toBe('might');
        expect(gs.playerState.trappedPlayers['p1']).toBeDefined();
        expect(gs.playerMoves['p1']).toBe(0);
    });

    // Case: persistent effect
    it('persistent effect adds to persistentEffects array', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'bui_dat',
            name: { vi: 'Bui Dat' },
            rollResults: [{ range: '0-3', effect: 'persistent' }],
            persistentEffect: {
                onTurnStart: { effect: 'loseStat', statType: 'physical', amount: 1 },
                removeConditions: ['gainStatFromItem']
            }
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 1, 'might');

        expect(result.type).toBe('persistent');
        expect(result.persistentRecord).toBeDefined();
        expect(gs.playerState.persistentEffects['p1']).toHaveLength(1);
        expect(gs.playerState.persistentEffects['p1'][0].eventId).toBe('bui_dat');
    });

    // Case: drawItem effect
    it('drawItem returns correct draw count', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'test-draw',
            name: { vi: 'Draw Test' },
            rollResults: [{ range: '0+', effect: 'drawItem', amount: 2 }]
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 4, 'speed');

        expect(result.type).toBe('drawItem');
        expect(result.drawCount).toBe(2);
    });

    // Case: teleport when room exists
    it('teleport moves player position when room is revealed', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        gs.map.revealedRooms = { 'room-entrance': { name: 'Entrance Hall' } };

        const eventCard = {
            id: 'test-teleport',
            name: { vi: 'Teleport Event' },
            rollResults: [{ range: '0+', effect: 'teleport', destination: 'entrance_hall' }]
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 3, 'speed');

        expect(result.type).toBe('teleport');
        expect(result.destinationRoomId).toBe('room-entrance');
        expect(gs.playerState.playerPositions['p1']).toBe('room-entrance');
    });

    // Case: teleport when room NOT revealed
    it('teleport returns error when destination room is not revealed', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'test-teleport',
            name: { vi: 'Teleport Event' },
            rollResults: [{ range: '0+', effect: 'teleport', destination: 'tower' }]
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 3, 'speed');

        expect(result.type).toBe('error');
        expect(result.error).toContain('tower');
    });

    // Case: physicalDamage with pending trapped
    it('physicalDamage with then:trapped sets pendingTrapped flag', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'test-damage-trap',
            name: { vi: 'Damage Then Trap' },
            rollResults: [{ range: '0+', effect: 'physicalDamage', dice: 2, then: 'trapped' }],
            trappedEffect: { escapeRoll: { stat: 'might', threshold: 4 }, allyCanHelp: false, autoEscapeAfter: 3 }
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 3, 'might');

        expect(result.type).toBe('physicalDamage');
        expect(result.pendingTrapped).toBe(true);
        expect(result.pendingDamage.physicalDice).toBe(2);
    });

    // Case: damage effect
    it('damage returns both physical and mental dice', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'test-damage',
            name: { vi: 'Damage Test' },
            rollResults: [{ range: '0+', effect: 'damage', physicalDice: 1, mentalDice: 2 }]
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 4, 'speed');

        expect(result.type).toBe('damage');
        expect(result.pendingDamage.physicalDice).toBe(1);
        expect(result.pendingDamage.mentalDice).toBe(2);
    });

    // Case: error for missing event card
    it('returns error for invalid event card', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const result = applyEventDiceResult(gs, 'p1', null, 5, 'speed');
        expect(result.type).toBe('error');
    });

    // Case: error for no matching outcome
    it('returns error when no outcome matches', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'test-no-match',
            name: { vi: 'No Match' },
            rollResults: [{ range: '10+', effect: 'gainStat', stat: 'speed', amount: 1 }]
        };
        const result = applyEventDiceResult(gs, 'p1', eventCard, 5, 'speed');
        expect(result.type).toBe('error');
    });

    // Property: stat-affecting effects never produce out-of-bounds indices
    it('stat changes stay in [0, 7] for any valid event outcome', () => {
        fc.assert(
            fc.property(
                statNameArb,
                statIndexArb,
                fc.constantFrom(1, 2, 3),     // amount
                fc.constantFrom('gainStat', 'loseStat'),  // effect type
                (stat, startIdx, amount, effectType) => {
                    const gs = makeGameState('p1', 'madame-zostra', startIdx);
                    const eventCard = {
                        id: 'prop-test',
                        name: { vi: 'Prop Test' },
                        rollResults: [{ range: '0+', effect: effectType, stat: 'rolled', amount }]
                    };
                    applyEventDiceResult(gs, 'p1', eventCard, 5, stat);
                    const newIdx = gs.playerState.characterData['p1'].stats[stat];
                    return newIdx >= 0 && newIdx <= 7;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================================
// GROUP 9: Constants validation
// ============================================================

describe('Constants', () => {
    it('DESTINATION_TO_ROOM_NAME contains expected entries', () => {
        expect(DESTINATION_TO_ROOM_NAME['entrance_hall']).toBe('Entrance Hall');
        expect(DESTINATION_TO_ROOM_NAME['graveyard']).toBe('Graveyard');
        expect(DESTINATION_TO_ROOM_NAME['crypt']).toBe('Crypt');
    });

    it('STAT_LABELS contains all four stats', () => {
        expect(STAT_LABELS.speed).toBeDefined();
        expect(STAT_LABELS.might).toBeDefined();
        expect(STAT_LABELS.sanity).toBeDefined();
        expect(STAT_LABELS.knowledge).toBeDefined();
    });
});
