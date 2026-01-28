# Event Testing Architecture

> Hướng dẫn chi tiết về kiến trúc testable event effects trong game Betrayal at House on the Hill

## Mục lục

- [Tổng quan](#tổng-quan)
- [Vấn đề cần giải quyết](#vấn-đề-cần-giải-quyết)
- [Giải pháp kiến trúc](#giải-pháp-kiến-trúc)
- [Cấu trúc files](#cấu-trúc-files)
- [Cách hoạt động](#cách-hoạt-động)
- [Hướng dẫn viết tests](#hướng-dẫn-viết-tests)
- [Hướng dẫn thêm event mới](#hướng-dẫn-thêm-event-mới)
- [API Reference](#api-reference)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Tổng quan

### Ý tưởng chính

Tách biệt **event logic** (pure functions) ra khỏi **UI/Socket layer** để có thể:
1. **Unit test** event effects mà không cần chạy browser
2. **Property-based testing** với nhiều input combinations
3. **Dễ maintain** và debug khi logic nằm riêng biệt
4. **Multiplayer vẫn hoạt động** vì sync logic giữ nguyên

### Kiến trúc 2 lớp

```
┌─────────────────────────────────────────────────────────────┐
│                    gameView.js (UI Layer)                   │
│  - DOM manipulation (modals, rendering)                     │
│  - Socket.IO sync (syncGameStateToServer)                   │
│  - Event handlers (click, input)                            │
│  - Module-level state (currentGameState, eventDiceModal)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                eventEffects.js (Logic Layer)                │
│  - Pure functions (no side effects)                         │
│  - Receives gameState as parameter                          │
│  - Returns result descriptors                               │
│  - Mutates gameState in place                               │
│  - NO DOM, NO Socket, NO module-level state                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Vấn đề cần giải quyết

### Trước đây (monolithic)

```javascript
// Tất cả logic trong gameView.js
function applyEventDiceResult(mountEl, result, stat) {
    // 1. Tìm outcome
    const outcome = findMatchingOutcome(eventCard.rollResults, result);

    // 2. Apply stat change (mutate currentGameState - module-level)
    applyStatChange(playerId, stat, amount);

    // 3. Sync to server (side effect)
    syncGameStateToServer();

    // 4. Update UI (DOM manipulation)
    openEventResultModal(mountEl, 'TANG CHI SO', message, 'success');
}
```

**Vấn đề:**
- Không thể test `applyStatChange` mà không mock DOM
- Không thể test `findMatchingOutcome` riêng biệt
- Logic trộn lẫn với side effects
- Khó debug vì không biết bug ở đâu

### Sau refactor (layered)

```javascript
// eventEffects.js - Pure logic
export function applyStatChange(gameState, playerId, stat, amount) {
    // Mutate gameState, return change record
    return { beforeIndex, afterIndex, stat, amount };
}

// gameView.js - Thin wrapper
function applyStatChange(playerId, stat, amount) {
    const result = applyStatChangeUtil(currentGameState, playerId, stat, amount);
    // UI/sync handled separately
}
```

**Lợi ích:**
- Test `applyStatChange` với mock gameState object
- Test `findMatchingOutcome` với bất kỳ rollResults array
- Logic tách biệt, dễ debug
- Property-based testing với fast-check

---

## Giải pháp kiến trúc

### Nguyên tắc thiết kế

1. **Pure Functions First**: Logic functions nhận input, trả output, không có side effects
2. **Explicit State**: `gameState` được truyền vào, không dùng global/module state
3. **Result Descriptors**: Thay vì gọi UI trực tiếp, trả về object mô tả kết quả
4. **Thin Wrappers**: gameView.js chỉ là adapter gọi utility functions

### Data Flow

```
User Action (click roll button)
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ gameView.js: handleEventDiceRoll(result)                │
│   eventDiceModal.result = result;                       │
│   const effectResult = computeEventDiceResult(          │
│       currentGameState,  // passed explicitly           │
│       playerId,                                         │
│       eventCard,                                        │
│       result,                                           │
│       rolledStat                                        │
│   );                                                    │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ eventEffects.js: applyEventDiceResult(...)              │
│   1. findMatchingOutcome(rollResults, result)           │
│   2. switch(outcome.effect) {                           │
│        case 'gainStat':                                 │
│          applyStatChange(gameState, ...)  // mutates    │
│          return { type: 'gainStat', ... }  // descriptor│
│      }                                                  │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ gameView.js: handle result descriptor                   │
│   switch(effectResult.type) {                           │
│     case 'gainStat':                                    │
│       syncGameStateToServer();  // side effect          │
│       openEventResultModal(...);  // DOM update         │
│   }                                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Cấu trúc files

```
src/app/
├── utils/
│   ├── eventEffects.js        # Pure event logic (650 lines)
│   │   ├── matchesRollRange()
│   │   ├── findMatchingOutcome()
│   │   ├── getStatValue()
│   │   ├── getPlayerStatForDice()
│   │   ├── applyStatChange()
│   │   ├── applyMultipleStatChanges()
│   │   ├── findRoomIdByDestination()
│   │   ├── findExistingRooms()
│   │   ├── applyTrappedEffect()
│   │   ├── applyPersistentEffect()
│   │   ├── applyEventDiceResult()  # Main dispatcher
│   │   └── Constants (DESTINATION_TO_ROOM_NAME, STAT_LABELS)
│   │
│   └── eventEffects.test.js   # Property-based tests (580 lines)
│       ├── matchesRollRange tests (5 tests)
│       ├── findMatchingOutcome tests (3 tests)
│       ├── applyStatChange tests (6 tests)
│       ├── applyMultipleStatChanges tests (2 tests)
│       ├── findRoomIdByDestination tests (4 tests)
│       ├── findExistingRooms tests (3 tests)
│       ├── applyTrappedEffect tests (3 tests)
│       ├── applyPersistentEffect tests (3 tests)
│       ├── applyEventDiceResult tests (15 tests)
│       └── Constants tests (2 tests)
│
└── views/
    └── gameView.js            # UI layer with thin wrappers
        ├── import { ... } from '../utils/eventEffects.js'
        ├── function getPlayerStatForDice(playerId, stat) {
        │       return getPlayerStatForDiceUtil(currentGameState, ...);
        │   }
        ├── function applyStatChange(playerId, stat, amount) {
        │       applyStatChangeUtil(currentGameState, ...);
        │   }
        └── ... (other thin wrappers)
```

---

## Cách hoạt động

### 1. Game State Structure

```javascript
const gameState = {
    players: [
        { id: 'player-123', characterId: 'madame-zostra' }
    ],
    playerState: {
        characterData: {
            'player-123': {
                characterId: 'madame-zostra',
                stats: {
                    speed: 3,      // index 0-7, not actual value
                    might: 4,
                    sanity: 3,
                    knowledge: 5
                }
            }
        },
        playerPositions: {
            'player-123': 'room-abc'
        },
        trappedPlayers: {
            // 'player-123': { escapeRoll: {...}, turnsTrapped: 1 }
        },
        persistentEffects: {
            'player-123': []
        }
    },
    map: {
        revealedRooms: {
            'room-abc': { name: 'Entrance Hall', x: 0, y: 0 }
        }
    },
    playerMoves: {
        'player-123': 4
    }
};
```

### 2. Event Card Structure

```javascript
const eventCard = {
    id: 'tieng_het_that_thanh',
    type: 'event',
    name: { vi: 'Tiếng hét thất thanh', en: 'Shriek' },
    text: { vi: 'Bạn nghe thấy tiếng hét...' },
    immediateRoll: true,
    rollStat: 'sanity',  // or ['speed', 'sanity'] for choice
    rollResults: [
        { range: '4+', effect: 'nothing' },
        { range: '1-3', effect: 'mentalDamage', dice: 1 },
        { range: '0', effect: 'mentalDamage', dice: 2 }
    ],
    // Optional for special effects:
    trappedEffect: {
        escapeRoll: { stat: 'might', threshold: 4 },
        allyCanHelp: true,
        allyFailure: 'alsoTrapped',
        autoEscapeAfter: 3
    },
    persistentEffect: {
        onTurnStart: { effect: 'loseStat', statType: 'physical', amount: 1 },
        removeConditions: ['gainStatFromItem']
    }
};
```

### 3. Result Descriptor Structure

```javascript
// Returned by applyEventDiceResult()
const result = {
    type: 'gainStat',  // or 'loseStat', 'teleport', 'trapped', etc.

    // For UI display
    displayTitle: 'TANG CHI SO',
    displayMessage: 'Speed: 4 → 6 (+2)',
    displaySeverity: 'success',  // 'success' | 'neutral' | 'danger' | 'warning'

    // Effect-specific data
    stat: 'speed',
    amount: 2,
    beforeIndex: 3,
    afterIndex: 5,

    // For teleport
    destinationRoomId: 'room-xyz',
    destinationName: 'Entrance Hall',

    // For damage
    pendingDamage: { physicalDice: 2, mentalDice: 0 },
    pendingTrapped: true,  // if damage has then:trapped

    // For trapped/persistent
    trappedRecord: { escapeRoll: {...}, turnsTrapped: 1 },
    persistentRecord: { eventId: 'xxx', onTurnStart: {...} },

    // For errors
    error: 'Room not found'
};
```

---

## Hướng dẫn viết tests

### Setup cơ bản

```javascript
// eventEffects.test.js
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
    matchesRollRange,
    applyStatChange,
    applyEventDiceResult
} from './eventEffects.js';

// Helper to create test game state
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
```

### Property-based test (với fast-check)

```javascript
describe('applyStatChange', () => {
    // Property: stat index luôn nằm trong [0, 7]
    it('clamps stat index to [0, 7] range', () => {
        const statNameArb = fc.constantFrom('speed', 'might', 'sanity', 'knowledge');
        const statIndexArb = fc.integer({ min: 0, max: 7 });

        fc.assert(
            fc.property(
                statNameArb,
                statIndexArb,
                fc.integer({ min: -10, max: 10 }),  // delta
                (stat, startIdx, delta) => {
                    const gs = makeGameState('p1', 'madame-zostra', startIdx);
                    applyStatChange(gs, 'p1', stat, delta);
                    const newIdx = gs.playerState.characterData['p1'].stats[stat];
                    return newIdx >= 0 && newIdx <= 7;
                }
            ),
            { numRuns: 100 }
        );
    });
});
```

### Case-based test (specific scenarios)

```javascript
describe('applyEventDiceResult', () => {
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
        expect(result.afterIndex).toBe(5);  // 3 + 2
        expect(gs.playerState.characterData['p1'].stats.speed).toBe(5);
    });
});
```

### Chạy tests

```bash
# Chạy tất cả tests
yarn test

# Chạy với watch mode
yarn test:watch

# Chạy specific file
yarn test eventEffects
```

---

## Hướng dẫn thêm event mới

### Bước 1: Định nghĩa event trong cardsData.js

```javascript
// src/app/data/cardsData.js
export const EVENTS = [
    // ... existing events
    {
        id: 'my_new_event',
        type: 'event',
        name: { vi: 'Tên Event', en: 'Event Name' },
        text: { vi: 'Mô tả event...' },
        immediateRoll: true,
        rollStat: 'sanity',
        rollResults: [
            { range: '4+', effect: 'gainStat', stat: 'sanity', amount: 1 },
            { range: '2-3', effect: 'nothing' },
            { range: '0-1', effect: 'loseStat', stat: 'sanity', amount: 1 }
        ]
    }
];
```

### Bước 2: Viết test trước (TDD)

```javascript
// src/app/utils/eventEffects.test.js
describe('my_new_event', () => {
    it('gains sanity on 4+', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'my_new_event',
            name: { vi: 'Tên Event' },
            rollResults: [
                { range: '4+', effect: 'gainStat', stat: 'sanity', amount: 1 }
            ]
        };

        const result = applyEventDiceResult(gs, 'p1', eventCard, 5, 'sanity');

        expect(result.type).toBe('gainStat');
        expect(gs.playerState.characterData['p1'].stats.sanity).toBe(4);
    });

    it('loses sanity on 0-1', () => {
        const gs = makeGameState('p1', 'madame-zostra', 3);
        const eventCard = {
            id: 'my_new_event',
            name: { vi: 'Tên Event' },
            rollResults: [
                { range: '0-1', effect: 'loseStat', stat: 'sanity', amount: 1 }
            ]
        };

        const result = applyEventDiceResult(gs, 'p1', eventCard, 1, 'sanity');

        expect(result.type).toBe('loseStat');
        expect(gs.playerState.characterData['p1'].stats.sanity).toBe(2);
    });
});
```

### Bước 3: Verify tests pass

```bash
yarn test
```

### Bước 4: Test manual trong debug mode

```
http://localhost:5173/#/game/debug
```

---

## API Reference

### Pure Predicates

```javascript
// Check if roll result matches range pattern
matchesRollRange(range: string, result: number): boolean
// range: "4+" | "2-3" | "0" | etc.
// Examples:
matchesRollRange('4+', 5)   // true
matchesRollRange('2-3', 4)  // false
matchesRollRange('0', 0)    // true

// Find first matching outcome
findMatchingOutcome(rollResults: Array, result: number): object | null
```

### State Lookups

```javascript
// Get actual stat value from character track
getStatValue(characterId: string, trait: string, index: number): number

// Get player's stat value for dice count
getPlayerStatForDice(gameState: object, playerId: string, stat: string): number

// Find room by destination key
findRoomIdByDestination(gameState: object, destination: string): string | null

// Find multiple rooms by destinations
findExistingRooms(gameState: object, destinations: string[]): Array<{roomId, name, destination}>
```

### State Mutations

```javascript
// Apply single stat change
applyStatChange(gameState: object, playerId: string, stat: string, amount: number)
// Returns: { playerId, stat, amount, beforeIndex, afterIndex } | null

// Apply multiple stat losses
applyMultipleStatChanges(gameState: object, playerId: string, stats: object)
// stats: { speed: 1, might: 2 } = lose 1 speed, 2 might
// Returns: Array<{ stat, amount, beforeIndex, afterIndex }>

// Apply trapped effect
applyTrappedEffect(gameState: object, playerId: string, eventCard: object)
// Returns: trappedRecord | undefined

// Apply persistent effect
applyPersistentEffect(gameState: object, playerId: string, eventCard: object)
// Returns: persistentRecord | undefined
```

### Main Dispatcher

```javascript
// Process event dice result
applyEventDiceResult(
    gameState: object,
    playerId: string,
    eventCard: object,
    result: number,
    rolledStat: string
): EventEffectResult

// EventEffectResult types:
// 'nothing' | 'gainStat' | 'loseStat' | 'loseStats' | 'teleport' |
// 'drawItem' | 'damage' | 'physicalDamage' | 'mentalDamage' |
// 'trapped' | 'persistent' | 'setStatToLowest' | 'forcedAttack' | 'error'
```

### Constants

```javascript
// Destination key to room name mapping
DESTINATION_TO_ROOM_NAME = {
    'entrance_hall': 'Entrance Hall',
    'graveyard': 'Graveyard',
    // ...
}

// Stat display labels
STAT_LABELS = {
    speed: 'Toc do (Speed)',
    might: 'Suc manh (Might)',
    knowledge: 'Kien thuc (Knowledge)',
    sanity: 'Tam tri (Sanity)'
}
```

---

## Best Practices

### 1. Luôn viết test trước khi implement

```javascript
// 1. Viết test
it('new effect works', () => { ... });

// 2. Chạy test - expect FAIL
yarn test

// 3. Implement logic
// 4. Chạy test - expect PASS
```

### 2. Sử dụng property-based tests cho logic quan trọng

```javascript
// Thay vì test vài case cụ thể
it('works for 0', () => { ... });
it('works for 5', () => { ... });

// Dùng property-based để test MỌI input
it('works for any valid input', () => {
    fc.assert(
        fc.property(fc.integer({ min: 0, max: 16 }), (result) => {
            // property luôn đúng với mọi result
        }),
        { numRuns: 100 }
    );
});
```

### 3. Không import module-level state trong tests

```javascript
// ❌ Bad - phụ thuộc vào module state
import { currentGameState } from '../views/gameView.js';

// ✅ Good - tạo mock state
const gs = makeGameState('p1', 'madame-zostra', 3);
```

### 4. Test edge cases

```javascript
// Stat at minimum (0)
const gs = makeGameState('p1', 'madame-zostra', 0);
applyStatChange(gs, 'p1', 'speed', -5);
expect(gs.playerState.characterData['p1'].stats.speed).toBe(0);

// Stat at maximum (7)
const gs = makeGameState('p1', 'madame-zostra', 7);
applyStatChange(gs, 'p1', 'speed', 5);
expect(gs.playerState.characterData['p1'].stats.speed).toBe(7);

// Player not found
const result = applyStatChange(gs, 'invalid-id', 'speed', 1);
expect(result).toBeNull();
```

### 5. Giữ eventEffects.js pure

```javascript
// ❌ Bad - side effects trong eventEffects.js
export function applyStatChange(gameState, playerId, stat, amount) {
    // ...
    syncGameStateToServer();  // NO! Side effect
    console.log('Applied');   // NO! Side effect
}

// ✅ Good - return result, let caller handle side effects
export function applyStatChange(gameState, playerId, stat, amount) {
    // ...mutate gameState...
    return { beforeIndex, afterIndex };  // descriptor only
}
```

---

## Troubleshooting

### Test fails với "Cannot read property of undefined"

**Nguyên nhân**: gameState thiếu nested objects

**Giải pháp**: Sử dụng `makeGameState()` helper hoặc đảm bảo structure đầy đủ

```javascript
// ❌ Incomplete state
const gs = { players: [] };

// ✅ Complete state
const gs = makeGameState('p1', 'madame-zostra', 3);
```

### Test fails với stat index out of bounds

**Nguyên nhân**: Logic không clamp đúng

**Giải pháp**: Kiểm tra `Math.max(0, Math.min(7, newIndex))`

### Import error "module not found"

**Nguyên nhân**: Path sai hoặc export thiếu

**Giải pháp**:
```javascript
// eventEffects.js - đảm bảo export
export function myFunction() { ... }

// test file - đảm bảo path đúng
import { myFunction } from './eventEffects.js';
```

### Property test fails intermittently

**Nguyên nhân**: Logic có edge case chưa handle

**Giải pháp**: Check seed và reproduce
```bash
# Khi test fail, fast-check show seed
# Reproduce với seed
yarn test -- --seed=12345
```

---

## Roadmap

### Đã implement
- [x] matchesRollRange, findMatchingOutcome
- [x] applyStatChange, applyMultipleStatChanges
- [x] findRoomIdByDestination, findExistingRooms
- [x] applyTrappedEffect, applyPersistentEffect
- [x] applyEventDiceResult (main dispatcher)
- [x] 49 property-based tests

### Cần implement tiếp
- [ ] Token placement effects (placeToken)
- [ ] Multi-player effects (affects all in room)
- [ ] Fixed dice count events
- [ ] Combat/attack effects
- [ ] Item draw effects

### Improvements
- [ ] Extract damage distribution logic
- [ ] Extract combat logic
- [ ] Add test coverage reporting
- [ ] Integration tests với mock socket

---

**Last Updated**: 2026-01-28

**Related Files**:
- [eventEffects.js](../src/app/utils/eventEffects.js)
- [eventEffects.test.js](../src/app/utils/eventEffects.test.js)
- [gameView.js](../src/app/views/gameView.js)
- [EVENT_CARDS_IMPLEMENTATION.md](../EVENT_CARDS_IMPLEMENTATION.md)
