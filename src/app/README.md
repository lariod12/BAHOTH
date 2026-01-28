# src/app Directory Documentation

> **Comprehensive guide to the application source code structure, architecture patterns, and file organization**

## Table of Contents
- [Overview](#overview)
- [Directory Structure](#directory-structure)
- [Architecture Patterns](#architecture-patterns)
- [Visualizations](#visualizations)
- [Detailed File Documentation](#detailed-file-documentation)
- [Key Concepts](#key-concepts)
- [Getting Started for Contributors](#getting-started-for-contributors)
- [File Size Reference](#file-size-reference)

---

## Overview

The `src/app` directory contains the core application logic for the Betrayal at House on the Hill digital edition. This is a **single-page application (SPA)** built with **Vanilla JavaScript** (no framework), using a **functional component pattern** for rendering and **Socket.IO** for real-time multiplayer synchronization.

### Architecture Philosophy

- **Component-Based Structure**: Separation of views, reusable components, services, and data
- **Functional Rendering**: Components return HTML strings that are injected into the DOM
- **Event-Driven**: User interactions trigger event handlers that update state and re-render
- **Real-Time Sync**: Socket.IO provides bidirectional communication with the server
- **Mobile-First**: UI optimized for mobile devices, then scaled up for desktop

### Technology Stack

- **Vanilla JavaScript (ES6+)**: No framework dependencies
- **Socket.IO Client**: Real-time WebSocket communication
- **Hash-based Routing**: Client-side navigation without page reloads
- **HTML String Templates**: Dynamic HTML generation via template literals
- **CSS**: Component-scoped styling

---

## Directory Structure

```
src/app/
├── router.js                                    # 4KB   | 115 lines  | Client-side hash router
│
├── components/                                  # Reusable UI components
│   └── GameMap.js                               # 22KB  | 545 lines  | Game map viewport renderer
│
├── data/                                        # Static game data files
│   ├── cardsData.js                             # 73KB  | 1800+ lines| Item/Event/Omen card definitions
│   ├── charactersData.js                        # 41KB  | 1200+ lines| Character stats and bios
│   ├── mapsData.js                              # 19KB  | 600+ lines | Room tile definitions
│   ├── rulesBookVietnameseEnglishTableData.js   # 12KB  | 350+ lines | Translation reference table
│   ├── traitorsTomeReferenceTableData.js        # 4KB   | 86 lines   | Haunt reference lookup
│   └── traitorsTomeTraitorMap.js                # 3KB   | 61 lines   | Haunt-to-traitor mapping
│
├── services/                                    # External service integrations
│   └── socketClient.js                          # 14KB  | 513 lines  | Socket.IO client wrapper
│
├── utils/                                       # Utility functions and helpers
│   ├── eventEffects.js                          # 24KB  | 650 lines  | Event card effect logic (testable)
│   ├── eventEffects.test.js                     # 22KB  | 580 lines  | Property-based tests for events
│   ├── factionUtils.js                          # 5KB   | 170 lines  | Faction/haunt system utilities
│   ├── vaultLayout.js                           # 8KB   | 249 lines  | Vault room layout calculator
│   └── vaultLayout.test.js                      # 4KB   | 112 lines  | Property-based tests
│
└── views/                                       # Page-level view components
    ├── gameView.js                              # 152KB | 4000+ lines| Main gameplay interface
    ├── homeView.js                              # 14KB  | 350+ lines | Landing/lobby page
    ├── roomView.js                              # 31KB  | 900+ lines | Character selection lobby
    ├── rulesBookReferenceView.js                # 34KB  | 900+ lines | Rulebook viewer with search
    ├── traitorsTomeReferenceView.js             # 11KB  | 300+ lines | Haunt reference table
    └── tutorialBooksView.js                     # 2KB   | 63 lines   | Tutorial menu
```

**Total**: 20 files | ~500KB | ~14,400+ lines of code

---

## Architecture Patterns

### 1. Component Organization

```
┌─────────────────────────────────────────────────────┐
│ Router (router.js)                                  │
│ - Hash-based navigation                             │
│ - Route → View mapping                              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Views (views/)                                      │
│ - Full-screen page components                       │
│ - Manage page-level state                           │
│ - Subscribe to real-time updates                    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Components (components/)                            │
│ - Reusable UI pieces                                │
│ - Pure functions returning HTML                     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Services (services/)                                │
│ - External integrations (Socket.IO)                 │
│ - Pub/sub event system                              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Data (data/) + Utils (utils/)                       │
│ - Static game definitions                           │
│ - Pure utility functions                            │
└─────────────────────────────────────────────────────┘
```

### 2. Rendering Pattern

All views and components follow a consistent pattern:

```javascript
export function renderView({ mountEl, onNavigate, ...props }) {
  // 1. Generate HTML string
  const html = `
    <div class="view-container">
      ${generateContent(props)}
    </div>
  `;

  // 2. Inject into DOM
  mountEl.innerHTML = html;

  // 3. Attach event listeners
  const button = mountEl.querySelector('.my-button');
  button.addEventListener('click', handleClick);

  // 4. Subscribe to updates
  socketClient.onGameState((state) => {
    // Re-render or update specific elements
  });
}
```

**Key characteristics**:
- Functional components (not class-based)
- HTML string generation via template literals
- Manual DOM manipulation after injection
- Event listeners attached after rendering
- Real-time updates trigger re-renders

### 3. Data Flow

```
User Action (click, input)
        ↓
Event Handler (view-level)
        ↓
Socket Emit (socketClient.method())
        ↓
Server Processing
        ↓
Socket Event (broadcast to clients)
        ↓
Event Listener (view-level subscription)
        ↓
State Update (module-level variables)
        ↓
Re-render (update DOM)
```

**Example**:
```javascript
// User clicks "Roll Dice"
button.onclick = () => {
  socketClient.rollDice(6); // Emit to server
};

// Server broadcasts result
socketClient.onGameState((state) => {
  localState.diceValue = state.lastRoll;
  renderDiceResult(localState.diceValue); // Update UI
});
```

### 4. State Management

**No centralized state store**. Instead:

- **Module-level variables**: Each view maintains its own state
- **Socket.IO as source of truth**: Server state is authoritative
- **Event-driven updates**: Socket events trigger state changes
- **Local state for UI**: Modals, animations, temporary UI state

```javascript
// Example: gameView.js maintains local state
let localGameState = null;
let currentPlayerId = null;
let isRoomPlacementMode = false;

socketClient.onGameState((state) => {
  localGameState = state; // Update from server
  renderGameScreen(); // Re-render
});
```

### 5. Localization Strategy

**Bilingual support** (Vietnamese/English):

- **Primary language**: Vietnamese (user-facing text)
- **Secondary language**: English (character names, technical terms)
- **Data structure**: Objects with `{ en: "...", vi: "..." }` properties
- **Translation tables**: Separate files map EN ↔ VI terms

```javascript
// Example: charactersData.js
{
  name: {
    en: "Madame Zostra",
    vi: "Madame Zostra",
    nickname: "Zostra"
  },
  bio: {
    en: { age: 37, /* ... */ },
    vi: { age: 37, /* ... */ }
  }
}
```

### 6. Testing Approach

- **Property-based testing**: Using Vitest + fast-check
- **Focus on complex logic**: Vault layout calculations
- **100 iterations per test**: Ensures robustness
- **Pure function testing**: Utils are easiest to test

```javascript
// Example: vaultLayout.test.js
test('event token always in near-door zone', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 3 }), (rotation) => {
      const layout = calculateVaultLayout(rotation);
      const { eventToken } = calculateTokenPositions(layout, bounds);
      return isPositionInZone(eventToken, layout.nearDoorZone, bounds);
    }),
    { numRuns: 100 }
  );
});
```

---

## Visualizations

### Dependency Graph

```
router.js
  ├─ homeView.js
  ├─ roomView.js
  ├─ gameView.js
  ├─ tutorialBooksView.js
  ├─ traitorsTomeReferenceView.js
  └─ rulesBookReferenceView.js

homeView.js
  └─ socketClient.js

roomView.js
  ├─ charactersData.js
  └─ socketClient.js

gameView.js (Most Complex)
  ├─ charactersData.js
  ├─ mapsData.js
  ├─ cardsData.js
  ├─ socketClient.js
  ├─ GameMap.js
  ├─ vaultLayout.js
  └─ factionUtils.js

GameMap.js
  └─ vaultLayout.js

traitorsTomeReferenceView.js
  ├─ traitorsTomeReferenceTableData.js
  └─ traitorsTomeTraitorMap.js

rulesBookReferenceView.js
  ├─ rulesBookVietnameseEnglishTableData.js
  └─ cardsData.js
```

### Data Flow Diagram

```
┌──────────────┐
│  User Input  │ (click, type, select)
└──────┬───────┘
       ↓
┌──────────────────────┐
│  View Event Handler  │ (onclick, oninput)
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│   socketClient.js    │ (emit to server)
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│   Server (Backend)   │ (process & validate)
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│  Socket Broadcast    │ (emit to all clients)
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│   Event Listener     │ (onGameState, onRoomState)
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│   State Update       │ (module-level vars)
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│   View Re-render     │ (update DOM)
└──────────────────────┘
```

### Component Hierarchy

```
Router (app/router.js)
├─ HomeView (views/homeView.js)
│   ├─ Create Room Modal
│   ├─ Join Room Modal
│   └─ Debug Mode Toggle
│
├─ RoomView (views/roomView.js)
│   ├─ Character Selection Grid (12 characters)
│   ├─ Player List with Ready Status
│   └─ Host Controls (Start Game button)
│
├─ GameView (views/gameView.js) ★ MOST COMPLEX
│   ├─ GameMap Component (components/GameMap.js)
│   │   ├─ Room Tiles (viewport-based)
│   │   ├─ Door Indicators
│   │   ├─ Token Markers (omen/event/item)
│   │   └─ Player Pawns
│   ├─ Dice Roll Overlay (turn order phase)
│   ├─ Room Placement Modal (rotation picker)
│   ├─ Token Draw Modal (card display)
│   ├─ Stat Adjustment Modal (trait modification)
│   ├─ Cards View Modal (inventory browser)
│   ├─ Player Sidebar (character stats)
│   └─ Player Bar (turn order)
│
├─ TutorialBooksView (views/tutorialBooksView.js)
│   └─ Book Selection Menu (3 options)
│
├─ TraitorsTomeReferenceView (views/traitorsTomeReferenceView.js)
│   ├─ Haunt Reference Table (searchable)
│   └─ Traitor Determination Display
│
└─ RulesBookReferenceView (views/rulesBookReferenceView.js)
    ├─ Tab Interface (Rules | Reference)
    ├─ Markdown Renderer (full rulebook)
    ├─ Table of Contents (navigation)
    ├─ Search Bar (keyword search)
    ├─ Translation Table (EN ↔ VI)
    └─ Card Browser (Items/Events/Omens)
```

---

## Detailed File Documentation

### Root Level

#### `router.js` (115 lines)

**Purpose**: Client-side hash-based router for single-page application navigation.

**Key Features**:
- Hash-based routing using `window.location.hash`
- Route parameter extraction (e.g., `/room/:roomId`)
- Navigation management between views
- URL normalization and validation

**Routes**:
| Pattern | View | Description |
|---------|------|-------------|
| `/` or `/home` | homeView | Landing page |
| `/room` | roomView | Create new room |
| `/room/:roomId` | roomView | Join existing room |
| `/game/:roomId` | gameView | Join game session |
| `/game/debug` | gameView | Debug mode (3 local players) |
| `/tutorial` | tutorialBooksView | Tutorial menu |
| `/tutorial/traitors-tome` | traitorsTomeReferenceView | Haunt reference |
| `/tutorial/survival` | traitorsTomeReferenceView | Survival guide |
| `/tutorial/rulesbook` | rulesBookReferenceView | Full rulebook |

**Exports**:
```javascript
export function initRouter({ mountEl })
```

**Dependencies**: All view modules

**Pattern**: Pure functional router without external libraries

**Example Usage**:
```javascript
import { initRouter } from './app/router.js';

const mountEl = document.getElementById('app');
initRouter({ mountEl });

// Navigate programmatically
window.location.hash = '#/game/BAH-ABC123';
```

---

### components/

#### `GameMap.js` (545 lines)

**Purpose**: Renders the game map with revealed rooms and player positions using a viewport-based rendering system.

**Key Features**:
- **Viewport rendering**: 5x5 grid centered on active player (performance optimization)
- **Floor filtering**: Only shows rooms on current floor
- **Door rendering**: Visual indicators for connections with wall detection
- **Token positioning**: Omen/event/item markers on rooms
- **Player pawns**: Character markers with color-coding and directional positioning
- **Active player indicator**: Yellow arrow pointing down at the current turn player's pawn
- **Vault special layout**: Zone-based token positioning for divided rooms
- **Room preview**: Shows placement preview during room placement mode

**Key Functions**:
```javascript
export function renderGameMap({
  mapState,              // Map state with revealedRooms
  playerPositions,       // socketId -> roomId
  playerNames,           // socketId -> character name
  playerColors,          // socketId -> color
  myId,                  // Current player's socket ID
  myPosition,            // Current player's room ID
  roomPreview,           // Optional: room being placed (preview mode)
  playerEntryDirections, // socketId -> entry direction
  activePlayerId         // ID of active player (current turn) - NEW
})

export function buildPlayerNamesMap(players)
export function buildPlayerColorsMap(players)
```

**Exports**:
- `renderGameMap()` - Main render function
- `buildPlayerNamesMap()` - Helper for player ID → name mapping
- `buildPlayerColorsMap()` - Helper for player ID → color mapping

**Dependencies**:
- `../utils/vaultLayout.js` - For Vault room zone calculations

**Pattern**: Functional component returning HTML string

**Usage Example**:
```javascript
import { renderGameMap, buildPlayerNamesMap } from './components/GameMap.js';

const mapHTML = renderGameMap({
  rooms: gameState.rooms,
  players: gameState.players,
  currentFloor: 'ground',
  activePlayerId: 'player-123'
});

document.querySelector('.map-container').innerHTML = mapHTML;
```

**Visual Output**:
```
┌─────┬─────┬─────┬─────┬─────┐
│     │     │ ◄░░ │     │     │  ◄░░ = Door (left)
├─────┼─────┼─────┼─────┼─────┤
│     │     │  🏠 │     │     │  🏠 = Room with player
├─────┼─────┼─────┼─────┼─────┤
│     │ 🔮  │ ⭐️ │ 📜  │     │  🔮 = Omen | ⭐️ = Event | 📜 = Item
├─────┼─────┼─────┼─────┼─────┤
│     │     │  ▼  │     │     │  ▼ = Active player indicator (NEW)
│     │     │ 👤  │     │     │  👤 = Player pawn
├─────┼─────┼─────┼─────┼─────┤
│     │     │     │     │     │
└─────┴─────┴─────┴─────┴─────┘
```

---

### data/

#### `cardsData.js` (~1800 lines, 73KB)

**Purpose**: Complete definitions for all game cards (Items, Events, Omens).

**Contains**:
- `ITEMS` array - 22+ item card definitions
- `EVENTS` array - 45+ event card definitions
- `OMENS` array - 13 omen card definitions

**Card Structure**:
```javascript
{
  id: string,              // Unique identifier (e.g., "item-adrenaline-shot")
  type: 'item' | 'event' | 'omen',
  name: { vi: string },    // Vietnamese name
  text: { vi: string },    // Card text/description
  usable?: boolean,        // Can be used as an action
  passive?: boolean,       // Always active effect
  effect?: object,         // Game effect data
  consumable?: boolean     // Destroyed after use
}
```

**Example**:
```javascript
{
  id: "item-adrenaline-shot",
  type: "item",
  name: { vi: "Tiêm Adrenaline" },
  text: { vi: "Tăng 2 Speed cho đến khi kết thúc lượt." },
  usable: true,
  consumable: true,
  effect: { trait: "speed", modifier: 2, duration: "turn" }
}
```

**Exports**:
```javascript
export const ITEMS = [ /* ... */ ];
export const EVENTS = [ /* ... */ ];
export const OMENS = [ /* ... */ ];
```

**Pattern**: Static data export with Vietnamese text

---

#### `charactersData.js` (~1200 lines, 41KB)

**Purpose**: Complete character definitions for all 12 playable characters.

**Contains**:
- `CHARACTERS` array - All character definitions
- `CHARACTER_BY_ID` object - Quick lookup map
- `TRAIT_KEYS` - Constant array `['speed', 'might', 'sanity', 'knowledge']`

**Character Structure**:
```javascript
{
  id: string,                                    // e.g., "madame-zostra"
  name: {
    en: string,                                   // English name
    vi?: string,                                  // Vietnamese translation (if different)
    nickname?: string                             // Short name
  },
  color: 'red' | 'blue' | 'green' | 'yellow' | 'white' | 'purple',
  bio: {
    en: { age: number, height: string, weight: string, hobbies: string[], birthday: string },
    vi: { /* same structure, Vietnamese text */ }
  },
  traits: {
    speed:     { track: number[], startIndex: number },
    might:     { track: number[], startIndex: number },
    sanity:    { track: number[], startIndex: number },
    knowledge: { track: number[], startIndex: number }
  },
  profile: {
    en: { text: string },
    vi: { text: string }
  }
}
```

**Example**:
```javascript
{
  id: "madame-zostra",
  name: { en: "Madame Zostra", vi: "Madame Zostra", nickname: "Zostra" },
  color: "blue",
  traits: {
    speed:     { track: [2, 3, 3, 5, 6, 6, 7, 7], startIndex: 2 }, // Starts at 3
    might:     { track: [2, 3, 3, 4, 5, 5, 5, 6], startIndex: 2 },
    sanity:    { track: [1, 3, 4, 5, 6, 6, 7, 7], startIndex: 4 },
    knowledge: { track: [1, 3, 4, 4, 4, 5, 6, 6], startIndex: 3 }
  },
  bio: {
    vi: {
      age: 37,
      height: "5'6\"",
      weight: "110 lbs",
      hobbies: ["Đọc bài Tarot", "Thiền định", "Nghiên cứu huyền bí"],
      birthday: "November 10"
    }
  }
}
```

**Exports**:
```javascript
export const CHARACTERS = [ /* ... */ ];
export const CHARACTER_BY_ID = { /* ... */ };
export const TRAIT_KEYS = ['speed', 'might', 'sanity', 'knowledge'];
```

**Pattern**: Rich data model with bilingual support

---

#### `mapsData.js` (~600 lines, 19KB)

**Purpose**: Room tile definitions with doors, tokens, floor placement rules, and special layouts.

**Room Structure**:
```javascript
{
  name: { en: string, vi?: string },
  floorsAllowed: ('basement' | 'ground' | 'upper')[],
  doors: [
    { side: 'top' | 'right' | 'bottom' | 'left', kind: 'door' | 'stairs' }
  ],
  tokens: ('omen' | 'event' | 'item')[],
  text?: { en?: string, vi?: string },          // Special room text
  specialLayout?: {
    type: 'divided',
    zones: {
      nearDoor: { tokens: string[] },
      farDoor: { tokens: string[] }
    }
  }
}
```

**Special Room Types**:
- **Starting rooms**: Entrance Hall, Foyer, Grand Staircase (no tokens)
- **Staircase rooms**: Have `{ kind: 'stairs' }` doors
- **Divided rooms**: Vault has `specialLayout` with zone-based token placement

**Example**:
```javascript
{
  name: { en: "Vault", vi: "Két Sắt" },
  floorsAllowed: ['basement', 'ground'],
  doors: [{ side: 'top', kind: 'door' }],
  tokens: ['event', 'item'],
  specialLayout: {
    type: 'divided',
    zones: {
      nearDoor: { tokens: ['event'] },  // Event always near door
      farDoor: { tokens: ['item'] }      // Item always far from door
    }
  }
}
```

**Exports**:
```javascript
export const ROOMS = [ /* ... */ ];
```

**Pattern**: Static game data with comprehensive metadata

---

#### `rulesBookVietnameseEnglishTableData.js` (~350 lines, 12KB)

**Purpose**: Vietnamese-English translation tables for game terminology.

**Structure**:
```javascript
export const TRANSLATION_SECTIONS = [
  {
    title: { en: "Traits", vi: "Chỉ Số" },
    terms: [
      { en: "Speed", vi: "Tốc Độ" },
      { en: "Might", vi: "Sức Mạnh" },
      // ...
    ]
  },
  // More sections...
];
```

**Sections**:
1. Traits (Speed, Might, Sanity, Knowledge)
2. Items (all item names)
3. Omens (all omen names)
4. Rooms (all room names)
5. Events (all event names)
6. Characters (all character names)

**Exports**:
```javascript
export const TRANSLATION_SECTIONS = [ /* ... */ ];
```

**Usage**: Referenced in `rulesBookReferenceView.js` for displaying translation table

---

#### `traitorsTomeReferenceTableData.js` (~86 lines, 4KB)

**Purpose**: Haunt reference table data for determining which haunt scenario occurs.

**Structure**:
```javascript
export const REFERENCE_ROWS = [
  {
    room: "Tầng Hầm", // Vietnamese room name
    bite: 1, book: 12, orb: 20, dog: 28, girl: 37, cross: 42,
    wood: 45, mask: 47, amulet: 48, ring: 49, skull: 49, spear: 49, ouija: 50
  },
  // 12 more rows...
];

export const OMEN_DEFS = [
  { key: 'bite', label: { vi: 'Cắn' }, aliases: ['vampire'] },
  { key: 'book', label: { vi: 'Sách Ma' }, aliases: ['tome', 'grimoire'] },
  // ...
];
```

**How It Works**:
1. Player draws an omen in a specific room
2. Cross-reference room + omen in table → get haunt number
3. Use haunt number to determine scenario and traitor

**Exports**:
```javascript
export const REFERENCE_ROWS = [ /* ... */ ];
export const OMEN_DEFS = [ /* ... */ ];
```

---

#### `traitorsTomeTraitorMap.js` (~61 lines, 3KB)

**Purpose**: Maps haunt numbers (1-50) to traitor selection rules.

**Structure**:
```javascript
export const TRAITOR_BY_HAUNT_NUMBER = {
  "1": "Người có omen Bite",
  "2": "Người trái nhất",
  "3": "Người có omen Book",
  // ... 47 more
  "50": "Không có kẻ phản bội"
};

export function getTraitorDescriptionByHauntNumber(hauntNumber) {
  return TRAITOR_BY_HAUNT_NUMBER[String(hauntNumber)] || "Không rõ";
}
```

**Exports**:
```javascript
export const TRAITOR_BY_HAUNT_NUMBER = { /* ... */ };
export function getTraitorDescriptionByHauntNumber(hauntNumber);
```

**Usage**: Called by `traitorsTomeReferenceView.js` to display traitor rules

---

### services/

#### `socketClient.js` (~513 lines, 14KB)

**Purpose**: WebSocket client wrapper using Socket.IO for real-time multiplayer communication.

**Key Features**:
- Connection management
- Promise-based API for async operations
- Event listener subscription patterns
- Room management (create, join, leave)
- Game state synchronization
- Debug mode support (local multiplayer)

**Main API**:

**Connection**:
```javascript
export function connect()              // Connect to Socket.IO server
export function disconnect()           // Disconnect
export function getSocket()            // Get socket instance
export function getSocketId()          // Get client's socket ID
```

**Room Management**:
```javascript
export function createRoom(playerName, maxPlayers)    // Returns { roomId, playerId }
export function joinRoom(roomId, playerName)          // Returns { roomId, playerId }
export function leaveRoom()
export function checkRoom(roomId)                      // Check if room exists
export function getRoomState(roomId)                   // Get current room state
```

**Player Actions**:
```javascript
export function selectCharacter(characterId)
export function toggleReady()
export function updateStatus(status)
export function updateName(name)
export function startGame()                            // Host only
```

**Game Actions**:
```javascript
export function rollDice(value)
export function move(direction)                        // 'up' | 'down' | 'left' | 'right'
export function setMoves(moves)
export function setActive(isActive)
export function getGameState(roomId)
```

**Event Subscriptions**:
```javascript
export function onRoomState(callback)                  // Subscribe to room updates
export function onError(callback)
export function onGameStart(callback)
export function onGameState(callback)                  // Subscribe to game state
export function onPlayersActive(callback)
```

**Debug Mode**:
```javascript
export function createDebugRoom(playerCount)           // Create local debug room
export function debugSelectCharacter(playerId, characterId)
export function onDebugRoomState(callback)
```

**Pattern**: Singleton service with pub/sub event system

**Example Usage**:
```javascript
import * as socketClient from './services/socketClient.js';

// Connect and create room
await socketClient.connect();
const { roomId, playerId } = await socketClient.createRoom('Alice', 6);

// Subscribe to updates
socketClient.onRoomState((state) => {
  console.log('Players:', state.players);
  renderLobby(state);
});

// Select character
await socketClient.selectCharacter('madame-zostra');
await socketClient.toggleReady();
```

---

### utils/

#### `eventEffects.js` (~650 lines, 24KB)

**Purpose**: Pure functions for processing event card effects. Extracted from gameView.js to enable unit testing without DOM or Socket.IO dependencies.

**Key Concepts**:
- **Stat Changes**: Functions modify stat indices (0-7) in game state
- **Effect Dispatch**: Main function returns result descriptors for UI handling
- **Testable Logic**: All functions receive `gameState` as parameter instead of using module-level state

**Key Functions**:
```javascript
// Pure predicates (no dependencies)
export function matchesRollRange(range, result)     // Checks if roll matches "4+", "2-3", "0"
export function findMatchingOutcome(rollResults, result)  // Finds first matching outcome

// State lookups (gameState in, value out)
export function getStatValue(characterId, trait, index)   // Gets actual stat value from track
export function getPlayerStatForDice(gameState, playerId, stat)  // Gets dice count for stat roll
export function findRoomIdByDestination(gameState, destination)  // Finds room by event destination
export function findExistingRooms(gameState, destinations)       // Finds multiple revealed rooms

// State mutations (gameState in, mutated + result out)
export function applyStatChange(gameState, playerId, stat, amount)
// Returns: { playerId, stat, amount, beforeIndex, afterIndex }

export function applyMultipleStatChanges(gameState, playerId, stats)
// Returns: Array of change records

export function applyTrappedEffect(gameState, playerId, eventCard)
// Returns: trappedRecord written to gameState

export function applyPersistentEffect(gameState, playerId, eventCard)
// Returns: persistentRecord added to gameState

// Main dispatcher (returns EventEffectResult for UI handling)
export function applyEventDiceResult(gameState, playerId, eventCard, result, rolledStat)
// Returns: { type, displayTitle, displayMessage, displaySeverity, ...effectSpecificData }
```

**Usage Example**:
```javascript
import { applyStatChange, matchesRollRange, findMatchingOutcome } from './utils/eventEffects.js';

// Check roll outcome
if (matchesRollRange('4+', diceResult)) {
    // Success case
}

// Apply stat change (mutates gameState)
const result = applyStatChange(gameState, playerId, 'speed', 2);
console.log(`${result.stat}: ${result.beforeIndex} -> ${result.afterIndex}`);
```

**Testing**: Has comprehensive property-based tests in `eventEffects.test.js` using fast-check (49 tests, 100 runs each).

**Pattern**: Pure functional utilities that receive gameState as parameter. Returns descriptive result objects instead of triggering side effects directly.

---

#### `factionUtils.js` (~170 lines, 5KB)

**Purpose**: Utility functions for the faction/haunt system. Handles player allegiances (allies vs enemies) before and after haunt.

**Key Concepts**:
- **Pre-Haunt**: All players are allies (`faction: null`)
- **Post-Haunt**: Players split into `'heroes'` or `'traitor'` factions
- **Allies**: Same faction or pre-haunt
- **Enemies**: Different factions after haunt

**Key Functions**:
```javascript
// State creation
export function createDefaultHauntState()
// Returns: { hauntTriggered, hauntNumber, triggeredByPlayerId, triggerOmen, triggerRoom, traitorId }

// State checks
export function isHauntTriggered(gameState)         // Returns: boolean
export function getFaction(gameState, playerId)      // Returns: 'heroes' | 'traitor' | null
export function getTraitorId(gameState)              // Returns: string | null

// Relationship checks
export function isAlly(gameState, playerId1, playerId2)   // Returns: boolean
export function isEnemy(gameState, playerId1, playerId2)  // Returns: boolean

// Player queries
export function getPlayersInFaction(gameState, faction)   // Returns: string[]
export function getHeroes(gameState)                      // Returns: string[]
export function isTraitor(gameState, playerId)            // Returns: boolean
export function isHero(gameState, playerId)               // Returns: boolean

// Display
export function getFactionLabel(faction)             // Returns: 'Ke Phan Boi' | 'Anh Hung' | ''

// Debug mode
export function triggerHauntDebug(gameState, hauntData)  // Mutates gameState directly
```

**Usage Example**:
```javascript
import { isAlly, isEnemy, getFaction, isHauntTriggered } from './utils/factionUtils.js';

// Check if players are allies
if (isAlly(gameState, myId, otherPlayerId)) {
    // Can trade items, share information, etc.
}

// Check if player is an enemy
if (isEnemy(gameState, myId, otherPlayerId)) {
    // Can attack, block movement, etc.
}

// Get faction for UI display
const faction = getFaction(gameState, playerId);
if (faction === 'traitor') {
    // Show traitor UI
}
```

**Pattern**: Pure functional utilities with no side effects (except `triggerHauntDebug` for debug mode)

---

#### `vaultLayout.js` (~249 lines, 8KB)

**Purpose**: Specialized layout calculations for the Vault room, which has a unique divided structure.

**Key Concepts**:
- **Vault room**: Special room divided by a barrier parallel to the door
- **Zones**: Near-door zone (event token) vs far-door zone (item token)
- **Rotation**: Door can be on any side (0°, 90°, 180°, 270°)
- **Divider orientation**: Always parallel to the door side

**Key Functions**:
```javascript
export function calculateVaultLayout(rotation)
// Returns: { doorSide, dividerOrientation, nearDoorZone, farDoorZone }

export function getDoorSideAfterRotation(originalSide, rotation)
// Returns: 'top' | 'right' | 'bottom' | 'left'

export function getDividerOrientation(doorSide)
// Returns: 'horizontal' | 'vertical'

export function getNearDoorZone(doorSide)
// Returns: 'top-half' | 'bottom-half' | 'left-half' | 'right-half'

export function getFarDoorZone(doorSide)
// Returns: opposite zone from getNearDoorZone()

export function calculateTokenPositions(layout, roomBounds)
// Returns: { eventToken: {x, y}, itemTokens: [{x, y}, ...] }

export function calculatePlayerSpawnPosition(layout, roomBounds)
// Returns: {x, y} (same zone as event token)

export function getZoneCenter(zone, roomBounds)
// Returns: {x, y}

export function isPositionInZone(position, zone, roomBounds)
// Returns: boolean
```

**Visual Example**:
```
Door on TOP (rotation = 0):
┌───────────────┐
│   ┌───────┐   │ ← Door
│   │       │   │
│ ⭐️│ EVENT │   │ ← Near-door zone (event + player spawn)
│───┴───────┴───│ ← Divider (horizontal)
│               │
│    📜  📜     │ ← Far-door zone (items)
│               │
└───────────────┘

Door on RIGHT (rotation = 90):
┌───────────────┐
│           │📜 │
│           ││  │
│    EVENT  │📜 │ ⭐️
│     ⭐️    ││  │
│           │   │ ← Door
└───────────────┘
       ↑
  Divider (vertical)
```

**Exports**: All functions as named exports + default object

**Pattern**: Pure functional utilities with comprehensive JSDoc types

---

#### `vaultLayout.test.js` (~112 lines, 4KB)

**Purpose**: Property-based tests for Vault layout calculations using Vitest + fast-check.

**Test Framework**:
```javascript
import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
```

**Tests**:
1. **Event token always in near-door zone**: Verifies event token placement
2. **Divider orientation matches door side**: Horizontal for top/bottom, vertical for left/right
3. **Player spawns in same zone as event**: Ensures correct spawn location
4. **Item tokens in far-door zone**: Items always opposite from event

**Example Test**:
```javascript
test('event token should always be in near-door zone', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 3 }),  // rotation (0, 1, 2, 3)
      (rotation) => {
        const layout = calculateVaultLayout(rotation);
        const roomBounds = { x: 0, y: 0, width: 100, height: 100 };
        const { eventToken } = calculateTokenPositions(layout, roomBounds);

        return isPositionInZone(eventToken, layout.nearDoorZone, roomBounds);
      }
    ),
    { numRuns: 100 }  // Test 100 random cases
  );
});
```

**Pattern**: Property-based testing ensures correctness across all possible inputs

**Run Tests**:
```bash
yarn test
```

---

### views/

#### `homeView.js` (~350 lines, 14KB)

**Purpose**: Landing page with room creation, joining, and debug mode toggle.

**Features**:
- Create new room modal (name + max players)
- Join existing room modal (room ID + name)
- Room status checking (exists, full, in-game)
- Debug mode toggle (3-6 players)
- Tutorial navigation
- Mobile-first responsive design

**Main Function**:
```javascript
export function renderHomeView({ mountEl, onNavigate })
```

**User Actions**:
- Click "Tạo Phòng" → Open create room modal
- Click "Vào Phòng" → Open join room modal
- Toggle "Debug Mode" → Enable local testing
- Click "Hướng Dẫn" → Navigate to tutorial

**Dependencies**:
- `socketClient` for room operations

**Pattern**: View component with modal state management

**Example Flow**:
```
1. User enters name "Alice"
2. Selects max players: 6
3. Clicks "Tạo Phòng"
4. socketClient.createRoom("Alice", 6)
5. Server returns { roomId: "BAH-ABC123", playerId: "p1" }
6. Navigate to #/room/BAH-ABC123
```

---

#### `roomView.js` (~900 lines, 31KB)

**Purpose**: Character selection lobby before game starts.

**Features**:
- Display all 12 characters in a grid
- Character details (stats, bio, profile)
- Character selection (click to select/deselect)
- Player list with ready status indicators
- Host controls (start game button)
- Room ID display and sharing
- Turn order display (based on character speed)
- Debug mode support (3-6 local players)

**Main Function**:
```javascript
export function renderRoomView({ mountEl, onNavigate, roomId })
```

**User Actions**:
- Click character card → Select/deselect character
- Click "Sẵn Sàng" → Toggle ready status
- Click "Bắt Đầu" (host only) → Start game
- Click "Rời Phòng" → Leave room
- Edit player name

**Character Card Display**:
```
┌─────────────────────────┐
│   Madame Zostra (Blue)  │
├─────────────────────────┤
│ Speed:    [2 3 3 5 6 6] │ ★ Starting value
│ Might:    [2 3 3 4 5 5] │
│ Sanity:   [1 3 4 5 6 6] │
│ Knowledge:[1 3 4 4 4 5] │
├─────────────────────────┤
│ Age: 37 | 5'6" | 110lbs │
│ Hobbies: Tarot, ...     │
└─────────────────────────┘
```

**Dependencies**:
- `charactersData` for character definitions
- `socketClient` for room state management

**Pattern**: Stateful view with real-time updates via WebSocket

---

#### `gameView.js` (~4000 lines, 152KB) ★ LARGEST & MOST COMPLEX FILE

**Purpose**: Main gameplay interface with all game mechanics.

**Game Phases**:
1. **Rolling**: Dice roll for turn order
2. **Movement**: Player moves and explores
3. **Token Drawing**: Draw cards after discovering new rooms
4. **Haunt**: Post-haunt gameplay (not fully implemented)

**Key Features**:
- **Dice rolling phase**: Determine turn order at game start
- **Turn-based movement**: Active player moves based on speed
- **Room discovery**: Place new rooms when exploring
- **Room placement**: Rotation picker for new rooms
- **Token drawing**: Draw omen/event/item cards
- **Character stats tracking**: Display and modify traits
- **Stat adjustment modal**: +/- buttons for trait changes
- **Dice event modal**: Manual input or random roll (0-16)
- **Game map rendering**: Via `GameMap` component
- **Player sidebar**: Character info and stats
- **Turn order bar**: Click to see detailed turn order
- **Cards view modal**: Browse collected cards
- **Tutorial access**: Link to reference materials
- **Debug mode**: 3 local players for testing
- **Floor transitions**: Stairs between basement/ground/upper

**Main Function**:
```javascript
export function renderGameView({ mountEl, onNavigate, roomId, debugMode })
```

**Core Game Loop**:
```
1. Roll dice (all players)
2. Sort players by roll (turn order)
3. Active player moves
4. If new room discovered:
   a. Show room placement modal
   b. Player chooses rotation
   c. Room is placed
   d. If room has tokens:
      - Draw card(s)
      - Show token draw modal
5. End turn → Next player
6. Repeat step 3-5
```

**Modal States**:
- `roomDiscoveryModal` - Placing a new room
- `tokenDrawingModal` - Drawing cards
- `statAdjustModal` - Modifying character traits
- `cardsViewModal` - Viewing collected cards
- `diceEventModal` - Manual dice input or random roll (0-16)
- `tutorialOpen` - Viewing tutorial modal

**Key Functions** (internal):
```javascript
function renderGameScreen()               // Main game UI
function renderDiceRollOverlay()          // Turn order phase
function renderRoomPlacementModal()       // Room placement
function renderTokenDrawModal()           // Card drawing
function renderStatAdjustModal()          // Trait modification
function renderCardsViewModal()           // Card browser
function renderDiceEventModal()           // Dice event (0-16 input/random)
function renderSidebar()                  // Character stats panel
function renderPlayerBar()                // Turn order bar
function handleMove(direction)            // Player movement
function handleRoomPlacement(rotation)    // Confirm room placement
function handleStatAdjustment(trait, delta) // Modify trait value
function getCharacterSpeed(characterId, index) // Get speed value
function mapDirectionToDoor(direction)    // 'up' → 'top'
```

**Dependencies**:
- `charactersData` - Character stats and info
- `mapsData` - Room definitions
- `cardsData` - Item/Event/Omen cards
- `socketClient` - Game state synchronization
- `GameMap` component - Map rendering
- `vaultLayout` - Vault room calculations

**Pattern**: Complex stateful view with multiple modal states and real-time sync

**Debug Mode**:
```javascript
// Enable debug mode with 3 local players
window.location.hash = '#/game/debug';

// Features:
// - 3 players with random characters
// - Pre-initialized map (Entrance → Foyer → Grand Staircase)
// - Click turn order to switch active player
// - All game logic identical to main game
// - No server connection required
```

---

#### `tutorialBooksView.js` (~63 lines, 2KB)

**Purpose**: Tutorial book selection menu.

**Features**:
- Three book options:
  1. **Traitors Tome** - Haunt reference table
  2. **Survival** - Same as Traitors Tome (alternate entry)
  3. **Rulesbook** - Full game rules

**Main Function**:
```javascript
export function renderTutorialBooksView({ mountEl, onNavigate })
```

**Pattern**: Simple navigation menu view

---

#### `traitorsTomeReferenceView.js` (~300 lines, 11KB)

**Purpose**: Interactive Traitors Tome reference table for haunt lookup.

**Features**:
- **Searchable haunt table**: Filter by room or omen
- **Haunt number lookup**: Cross-reference room + omen → haunt #
- **Traitor determination**: Shows who becomes the traitor
- **Vietnamese/English room names**: Bilingual support
- **Responsive table**: Scrollable on mobile

**Main Function**:
```javascript
export function renderTraitorsTomeReferenceView({ mountEl, onNavigate })
```

**User Actions**:
- Type in search box → Filter table by room/omen name
- Click cell → Highlight haunt number
- Read traitor rule below table

**Dependencies**:
- `traitorsTomeReferenceTableData` - Reference table data
- `traitorsTomeTraitorMap` - Traitor rules

**Pattern**: Interactive reference table with search/filter

**Table Layout**:
```
┌──────────────┬──────┬──────┬──────┬─────┐
│ Room         │ Bite │ Book │ Orb  │ ... │
├──────────────┼──────┼──────┼──────┼─────┤
│ Tầng Hầm     │  1   │  12  │  20  │ ... │
│ Tầng Trệt    │  2   │  13  │  21  │ ... │
│ ...          │ ...  │ ...  │ ...  │ ... │
└──────────────┴──────┴──────┴──────┴─────┘

Selected: Haunt #28 → "Người có omen Dog"
```

---

#### `rulesBookReferenceView.js` (~900 lines, 34KB)

**Purpose**: Full rulebook viewer with search, translation reference, and card browser.

**Features**:
- **Markdown rendering**: Full game rules from `boardgame_rules.md`
- **Table of contents**: Auto-generated from headers, click to navigate
- **Search functionality**: Keyword search across all rules
- **Translation table**: Vietnamese-English term reference
- **Card browser**: Browse all Items/Events/Omens with filters
- **Tab interface**: Switch between Rules | Reference | Cards
- **Mobile-optimized**: Collapsible sections, sticky headers

**Main Function**:
```javascript
export function renderRulesBookReferenceView({ mountEl, onNavigate })
```

**Tab Structure**:
1. **Rules Tab**:
   - Table of contents (sidebar)
   - Markdown-rendered rulebook
   - Search bar with highlighting

2. **Reference Tab**:
   - Vietnamese-English translation table
   - Organized by categories (Traits, Items, Rooms, etc.)
   - Searchable/filterable

3. **Cards Tab**:
   - Filter by type (Items | Events | Omens)
   - Search by name
   - Card details (name, text, effects)

**Dependencies**:
- `rulesBookVietnameseEnglishTableData` - Translation data
- `cardsData` - Card definitions
- `marked` library - Markdown parser
- `boardgame_rules.md` - Rulebook content (imported as raw text)

**Pattern**: Complex reference view with multiple tabs and search

**Example Card Display**:
```
┌────────────────────────────────────┐
│ 📜 Tiêm Adrenaline (Item)          │
├────────────────────────────────────┤
│ Tăng 2 Speed cho đến khi kết thúc │
│ lượt.                              │
│                                    │
│ ✓ Usable                           │
│ ✓ Consumable                       │
└────────────────────────────────────┘
```

---

## Key Concepts

### 1. Viewport-Based Rendering (GameMap)

**Problem**: Rendering a large, dynamically growing map is expensive on mobile devices.

**Solution**: Only render a 5x5 grid centered on the active player.

**How It Works**:
```javascript
// 1. Get active player position
const activePlayer = players.find(p => p.id === activePlayerId);
const centerX = activePlayer.x;
const centerY = activePlayer.y;

// 2. Calculate viewport bounds
const RADIUS = 2; // 5x5 grid (2 rooms in each direction)
const minX = centerX - RADIUS;
const maxX = centerX + RADIUS;
const minY = centerY - RADIUS;
const maxY = centerY + RADIUS;

// 3. Filter rooms within viewport
const visibleRooms = rooms.filter(room =>
  room.x >= minX && room.x <= maxX &&
  room.y >= minY && room.y <= maxY &&
  room.floor === currentFloor
);
```

**Benefits**:
- Reduces DOM elements (better performance)
- Focuses player attention
- Scales to large maps

---

### 2. Hash-Based Routing

**Why Hash-Based?**
- Works without server configuration
- Compatible with static hosting (GitHub Pages, Netlify, etc.)
- No need for server-side redirects

**How It Works**:
```javascript
// URL: http://localhost:5173/#/game/BAH-ABC123
window.location.hash = '#/game/BAH-ABC123';

// Parse route
const hash = window.location.hash.slice(1); // Remove '#'
const [, view, param] = hash.match(/^\/(\w+)(?:\/([^/]+))?/) || [];

// view = 'game'
// param = 'BAH-ABC123'
```

**Navigation**:
```javascript
// Programmatic navigation
window.location.hash = '#/room/BAH-XYZ789';

// Listener for route changes
window.addEventListener('hashchange', () => {
  // Re-render appropriate view
});
```

---

### 3. Real-Time Synchronization

**Architecture**:
```
Client A                    Server                    Client B
   │                           │                          │
   ├─ emit('move', 'up') ────→ │                          │
   │                           ├─ Validate & update       │
   │                           ├─ broadcast('gameState')─→│
   │                           │                          ├─ Update UI
   │←── on('gameState') ───────┤                          │
   ├─ Update UI                │                          │
```

**Key Principle**: Server is the source of truth.

**Client-Side Flow**:
```javascript
// 1. User action → Emit to server
button.onclick = () => {
  socketClient.move('up');
};

// 2. Server responds → Update local state
socketClient.onGameState((state) => {
  localGameState = state;
  renderGameScreen();
});
```

---

### 4. Debug Mode vs Production Mode

**Why Debug Mode?**
- Test game logic without multiple players
- Faster iteration during development
- No server dependency

**Differences**:

| Feature | Debug Mode | Production Mode |
|---------|-----------|-----------------|
| Players | 3 local players (same device) | Multiple remote players |
| Server | No connection | Socket.IO connection required |
| State | Local module variables | Server-authoritative |
| Turn switching | Click turn order bar | Automatic (server-controlled) |
| Room creation | `createDebugRoom()` | `createRoom()` |
| Movement | `handleDebugMove()` | `socketClient.move()` |

**Shared Logic**:
- Same rendering functions (`renderGameScreen`, etc.)
- Same game rules (movement, dice, etc.)
- Same map connections logic
- Same character speed calculations

**Usage**:
```javascript
// Production: http://localhost:5173/#/game/BAH-ABC123
// Debug:      http://localhost:5173/#/game/debug

if (roomId === 'debug') {
  debugMode = true;
  createDebugRoom(3); // 3 local players
} else {
  socketClient.joinRoom(roomId);
}
```

---

### 5. Special Room Layouts (Vault)

**Problem**: The Vault room is divided by a barrier, with specific token placement rules.

**Solution**: `vaultLayout.js` utility calculates zone-based positioning.

**Rules**:
- Event token: Always in near-door zone
- Item token: Always in far-door zone (opposite side of divider)
- Player spawn: Same zone as event token
- Divider: Always parallel to door

**Rotation Handling**:
```javascript
// Door can be rotated 0°, 90°, 180°, 270°
const layout = calculateVaultLayout(rotation);

// rotation=0 (door on top):
// - Divider: horizontal
// - Near zone: top half
// - Far zone: bottom half

// rotation=1 (door on right):
// - Divider: vertical
// - Near zone: right half
// - Far zone: left half
```

---

### 6. Bilingual Support Implementation

**Strategy**: Store all text in objects with `en` and `vi` keys.

**Example**:
```javascript
// charactersData.js
const character = {
  name: { en: "Madame Zostra", vi: "Madame Zostra" },
  bio: {
    en: { hobbies: ["Tarot reading", "Meditation"] },
    vi: { hobbies: ["Đọc bài Tarot", "Thiền định"] }
  }
};

// Display in UI (Vietnamese by default)
const displayName = character.name.vi || character.name.en;
const hobbies = character.bio.vi.hobbies;
```

**Translation Reference**:
- `rulesBookVietnameseEnglishTableData.js` provides EN ↔ VI mappings
- Used in `rulesBookReferenceView.js` for quick lookups

---

## Getting Started for Contributors

### New to the Codebase?

**Start Here**:
1. Read [README.md](../../README.md) (root) for project overview
2. Read this file for detailed architecture
3. Explore [router.js](./router.js) to understand navigation
4. Look at [homeView.js](./views/homeView.js) (simplest view)
5. Check [charactersData.js](./data/charactersData.js) (game data structure)

**Then Dive Deeper**:
6. Study [gameView.js](./views/gameView.js) (main game logic)
7. Understand [GameMap.js](./components/GameMap.js) (viewport rendering)
8. Review [socketClient.js](./services/socketClient.js) (real-time sync)

---

### How to Add a New View

1. **Create view file**: `src/app/views/myNewView.js`

```javascript
export function renderMyNewView({ mountEl, onNavigate }) {
  // 1. Generate HTML
  const html = `
    <div class="my-new-view">
      <h1>My New View</h1>
      <button class="back-btn">Back</button>
    </div>
  `;

  // 2. Inject into DOM
  mountEl.innerHTML = html;

  // 3. Attach event listeners
  const backBtn = mountEl.querySelector('.back-btn');
  backBtn.onclick = () => onNavigate('/home');

  // 4. (Optional) Subscribe to real-time updates
  socketClient.onGameState((state) => {
    // Update UI
  });
}
```

2. **Register route**: Edit `router.js`

```javascript
import { renderMyNewView } from './views/myNewView.js';

// Add to route handlers
if (hash === '/mynewview') {
  renderMyNewView({ mountEl, onNavigate });
}
```

3. **Add navigation**: Link from other views

```javascript
<a href="#/mynewview">Go to My New View</a>
```

---

### How to Add a New Game Feature

**Example**: Add a "Trade Items" feature

1. **Update data model**: Modify `cardsData.js` if needed

```javascript
// Add tradable flag to items
{
  id: "item-rope",
  tradable: true, // NEW
  // ...
}
```

2. **Add UI to gameView**: Edit `gameView.js`

```javascript
function renderTradeModal() {
  return `
    <div class="trade-modal">
      <h2>Trade Items</h2>
      <select class="player-select">
        ${players.map(p => `<option value="${p.id}">${p.name}</option>`)}
      </select>
      <select class="item-select">
        ${myItems.map(i => `<option value="${i.id}">${i.name.vi}</option>`)}
      </select>
      <button class="confirm-trade-btn">Trade</button>
    </div>
  `;
}
```

3. **Add server communication**: Edit `socketClient.js`

```javascript
export function tradeItem(targetPlayerId, itemId) {
  return new Promise((resolve, reject) => {
    socket.emit('trade-item', { targetPlayerId, itemId }, (response) => {
      if (response.success) {
        resolve(response.data);
      } else {
        reject(response.error);
      }
    });
  });
}
```

4. **Handle server events**: Subscribe to updates

```javascript
socketClient.onGameState((state) => {
  // Update inventory display after trade
  renderInventory(state.players[myPlayerId].items);
});
```

5. **Update backend**: Edit `server/managers/GameManager.js` (outside `src/app`)

---

### How to Modify Game Data

**All game data is in `src/app/data/`**.

**Add a New Character**:
1. Edit [charactersData.js](./data/charactersData.js)
2. Add new character object to `CHARACTERS` array
3. Update `CHARACTER_BY_ID` object

**Add a New Room**:
1. Edit [mapsData.js](./data/mapsData.js)
2. Add new room object to `ROOMS` array
3. Specify `floorsAllowed`, `doors`, `tokens`

**Add a New Card**:
1. Edit [cardsData.js](./data/cardsData.js)
2. Add to appropriate array (`ITEMS`, `EVENTS`, or `OMENS`)
3. Follow existing structure

---

### Testing Guidelines

**Current Testing**:
- Property-based tests for complex logic ([vaultLayout.test.js](./utils/vaultLayout.test.js))
- Run with: `yarn test`

**What to Test**:
- Pure utility functions (easiest to test)
- Complex calculations (Vault layout, movement validation)
- Game rules enforcement

**What NOT to Test**:
- UI rendering (brittle, expensive)
- Socket.IO integration (requires mocking)
- Static data imports

**Adding New Tests**:
1. Create `*.test.js` file next to source file
2. Use Vitest + fast-check for property-based tests
3. Test edge cases (0, negative, max values)

```javascript
import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

describe('myFunction', () => {
  test('should handle all valid inputs', () => {
    fc.assert(
      fc.property(fc.integer(), (input) => {
        const result = myFunction(input);
        return result >= 0; // Property to verify
      }),
      { numRuns: 100 }
    );
  });
});
```

---

## File Size Reference

| File | Size | Lines | Complexity | Primary Purpose |
|------|------|-------|------------|-----------------|
| [gameView.js](./views/gameView.js) | 152KB | 4000+ | Very High | Main game interface |
| [cardsData.js](./data/cardsData.js) | 73KB | 1800+ | Low (data) | Card definitions |
| [charactersData.js](./data/charactersData.js) | 41KB | 1200+ | Low (data) | Character data |
| [rulesBookReferenceView.js](./views/rulesBookReferenceView.js) | 34KB | 900+ | High | Rulebook viewer |
| [roomView.js](./views/roomView.js) | 31KB | 900+ | Medium | Character selection |
| [GameMap.js](./components/GameMap.js) | 22KB | 545 | High | Map rendering |
| [mapsData.js](./data/mapsData.js) | 19KB | 600+ | Low (data) | Room definitions |
| [socketClient.js](./services/socketClient.js) | 14KB | 513 | Medium | Socket.IO wrapper |
| [homeView.js](./views/homeView.js) | 14KB | 350+ | Low | Landing page |
| [rulesBookVietnameseEnglishTableData.js](./data/rulesBookVietnameseEnglishTableData.js) | 12KB | 350+ | Low (data) | Translation table |
| [traitorsTomeReferenceView.js](./views/traitorsTomeReferenceView.js) | 11KB | 300+ | Medium | Haunt reference |
| [vaultLayout.js](./utils/vaultLayout.js) | 8KB | 249 | Medium | Vault calculations |
| [traitorsTomeReferenceTableData.js](./data/traitorsTomeReferenceTableData.js) | 4KB | 86 | Low (data) | Haunt table data |
| [vaultLayout.test.js](./utils/vaultLayout.test.js) | 4KB | 112 | Low (test) | Vault layout tests |
| [router.js](./router.js) | 4KB | 115 | Low | Client-side router |
| [traitorsTomeTraitorMap.js](./data/traitorsTomeTraitorMap.js) | 3KB | 61 | Low (data) | Traitor rules |
| [tutorialBooksView.js](./views/tutorialBooksView.js) | 2KB | 63 | Very Low | Tutorial menu |

**Total**: ~450KB | ~13,000+ lines

---

## Architecture Decisions

### Why Vanilla JavaScript?

**Pros**:
- No build-time dependencies (except Vite for bundling)
- Smaller bundle size
- Direct DOM manipulation (full control)
- Educational value (understand fundamentals)

**Cons**:
- More boilerplate (manual DOM updates)
- No reactive state (must manually re-render)
- Harder to scale (no component lifecycle)

**When to Consider a Framework**:
- Team grows beyond 3-4 developers
- Application complexity increases significantly
- Need for server-side rendering (SEO)
- Complex state management needs

---

### Why Functional Components?

**Pattern**:
```javascript
function renderComponent(props) {
  return `<div>${props.text}</div>`;
}
```

**Pros**:
- Easy to understand (just functions)
- Easy to test (pure functions)
- No lifecycle management
- No memory leaks (no subscriptions to clean up)

**Cons**:
- Manual re-rendering required
- No built-in prop validation
- No component state (use module-level variables)

---

### Why Socket.IO?

**Alternatives Considered**:
- WebSockets (native) - Too low-level
- Server-Sent Events (SSE) - One-way only
- Long polling - Inefficient

**Why Socket.IO Won**:
- Bidirectional communication
- Automatic reconnection
- Room management built-in
- Fallback to long polling (compatibility)
- Event-based API (clean code)

---

## Future Improvements

### Performance Optimizations
- [ ] Virtual scrolling for long lists (cards, rooms)
- [ ] Web Workers for heavy calculations
- [ ] Service Worker for offline support
- [ ] Image lazy loading
- [ ] Code splitting (separate bundles for views)

### Code Quality
- [ ] Add TypeScript (gradual migration)
- [ ] More unit tests (target 70% coverage)
- [ ] Integration tests (Playwright or Cypress)
- [ ] ESLint + Prettier setup
- [ ] Pre-commit hooks (lint + test)

### Features
- [ ] Haunt phase implementation (currently not complete)
- [ ] Persistent game state (save/load)
- [ ] Replays (store game actions)
- [ ] Spectator mode (watch ongoing games)
- [ ] Chat system (in-game messaging)

### Accessibility
- [ ] ARIA labels for screen readers
- [ ] Keyboard navigation
- [ ] High contrast mode
- [ ] Font size adjustment
- [ ] Color-blind friendly palettes

---

## Questions?

**Found a bug?** Check existing issues or create a new one.

**Want to contribute?** Read the root [README.md](../../README.md) for setup instructions.

**Need clarification?** Reach out to the maintainers or open a discussion.

---

**Last Updated**: 2026-01-28 @ Event effects extracted to testable module (eventEffects.js)

**Maintainers**: See [package.json](../../package.json) for contact info

**License**: Educational and entertainment purposes
