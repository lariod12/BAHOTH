# Betrayal at House on the Hill

Digital edition cua board game Betrayal at House on the Hill (2nd Edition).

## Gioi thieu

Du an nay la phien ban digital cua board game Betrayal at House on the Hill, cho phep nguoi choi trai nghiem game kinh di kham pha ngoi nha ma am tren nen tang web voi che do multiplayer real-time.

**Mobile First Design**: Du an duoc thiet ke uu tien cho thiet bi di dong, sau do mo rong cho desktop.

## Cong nghe

- **Frontend**: Vite + Vanilla JavaScript (ES6+)
- **Backend**: Node.js + Socket.IO (tich hop vao Vite dev server)
- **Real-time**: WebSocket communication
- **Testing**: Vitest + fast-check
- **Package Manager**: Yarn

## Quick Start

```bash
# Cai dat
yarn install

# Chay development (frontend + socket server)
yarn dev
# Server chay tai: http://localhost:5173

# Build production
yarn build && yarn preview
```

---

## Cau truc du an

```
.
├── src/
│   ├── index.html                    # Entry point
│   ├── main.js                       # App initialization
│   ├── style.css                     # Global styles (~8000 lines, BEM)
│   └── app/
│       ├── router.js                 # Hash-based client router
│       ├── components/
│       │   └── GameMap.js            # Map rendering component
│       ├── services/
│       │   └── socketClient.js       # Socket.IO client wrapper
│       ├── data/                     # Game data (static)
│       │   ├── cardsData.js          # Cards: Events, Omens, Items
│       │   ├── charactersData.js     # 12 characters voi traits
│       │   ├── mapsData.js           # Room tiles data
│       │   └── ...                   # Rules reference tables
│       ├── utils/
│       │   ├── eventEffects.js       # Stat changes, dice logic, state mutations
│       │   ├── factionUtils.js       # Faction (ally/traitor) helpers
│       │   └── vaultLayout.js        # Vault room special layout
│       └── views/
│           ├── homeView.js           # Landing page
│           ├── roomView.js           # Lobby/room view
│           └── game/                 # *** GAME VIEW (core) ***
│               ├── index.js          # Game entry, server state handler
│               ├── gameState.js      # Centralized mutable state
│               ├── cards/            # Card drawing & display
│               ├── characters/       # Character stats management
│               ├── combat/           # Combat system
│               ├── events/           # Event card effects (14 modules)
│               ├── items/            # Item inventory
│               ├── movement/         # Player movement & room effects
│               ├── omens/            # Omen cards & Haunt
│               ├── turn/             # Turn management & state sync
│               └── ui/               # Rendering & event listeners
├── server/
│   ├── vite-socket-plugin.js         # Socket.IO server (Vite plugin)
│   ├── playerManager.js              # Player state persistence
│   ├── roomManager.js                # Room state persistence
│   ├── mapManager.js                 # Map state persistence
│   └── data/                         # JSON persistence files
│       ├── rooms.json
│       ├── players.json
│       └── maps.json
├── package.json
├── vite.config.js
├── EVENT_CARDS_IMPLEMENTATION.md     # Event cards progress tracker
└── boardgame_rules.md                # Luat choi day du (Vietnamese)
```

---

## Kien truc tong quan

### 1. State Management

**Pattern**: Centralized singleton state - tat ca modules import cung 1 object `state` va mutate truc tiep.

**File**: `src/app/views/game/gameState.js`

```javascript
// Moi module import va mutate cung state object
import { state } from '../gameState.js';

// Mutate truc tiep
state.eventDiceModal = { isOpen: true, ... };

// Sau khi mutate, goi re-render
updateGameUI(mountEl, state.currentGameState, state.mySocketId);
```

**Cac nhom state chinh:**

| Nhom | Mo ta | Vi du |
|------|-------|-------|
| Core | Game state tu server | `currentGameState`, `mySocketId` |
| UI Flags | Trang thai UI | `sidebarOpen`, `skipMapCentering`, `tokenDetailOpen` |
| Turn Tracking | Theo doi luot choi | `movesInitializedForTurn`, `hasAttackedThisTurn` |
| Modal States | 27+ modal states | `eventDiceModal`, `combatModal`, `damageDistributionModal` |
| Pending Actions | Hanh dong chua hoan thanh | `pendingMentalDamage`, `pendingTrappedEffect`, `pendingTokenPromptAfterDamage` |

**Luu y quan trong:**
- **Khong co reactivity** - phai goi `updateGameUI()` thu cong sau moi thay doi
- `state.skipMapCentering = true` truoc khi re-render de giu vi tri scroll map
- `resetAllModalStates()` de reset tat ca modals

---

### 2. UI Rendering

**Pattern**: String-based HTML generation + `innerHTML` re-render

**File**: `src/app/views/game/ui/mainRenderer.js`

```javascript
// Render bang template literals
export function renderGameScreen(gameState, myId) {
    let content = `
        ${renderIntro()}
        ${renderSidebar()}
        ${renderMap()}
        ${renderGameControls()}
        ${renderRoomTokenNotification()}
        
        <!-- Modal layer (27+ modals) -->
        ${renderEventDiceModal()}
        ${renderDamageDiceModal()}
        ${renderDamageDistributionModal()}
        ${renderCombatModal()}
        ${renderTokenPromptModal()}
        ${renderTokenInteractionModal()}
        ...
    `;
}
```

**Render flow:**
1. `updateGameUI()` duoc goi
2. Kiem tra turn init, trapped, pending effects
3. Goi `renderGameScreen()` -> tao HTML string
4. Gan `mountEl.innerHTML = content`
5. Restore scroll position neu `skipMapCentering`
6. Center map tren player/preview room

**Luu y:**
- Full re-render moi lan (khong co diffing/virtual DOM)
- Modal order trong HTML quyet dinh z-index stacking
- Moi modal co render function rieng, tra ve `''` neu khong open

---

### 3. Event Delegation

**Pattern**: 1 delegated click handler duy nhat tren mount element

**File**: `src/app/views/game/ui/eventListeners.js`

```html
<!-- HTML su dung data-action va data-* attributes -->
<button data-action="move" data-direction="up">Di chuyen</button>
<button data-action="damage-dist-inc" data-stat="stat1">+</button>
<button data-action="token-prompt-accept">Chap nhan</button>
```

```javascript
// 1 handler duy nhat
mountEl.addEventListener('click', async (e) => {
    const actionEl = e.target.closest('[data-action]');
    const action = actionEl?.dataset.action;
    
    if (action === 'move') { /* handle movement */ }
    if (action === 'damage-dist-inc') { /* handle damage */ }
    if (action === 'token-prompt-accept') {
        import('../events/eventToken.js').then(m => m.acceptTokenPrompt(mountEl));
    }
});
```

**Quy tac dat ten action:**
- `{domain}-{action}`: `combat-start`, `damage-dist-inc`, `token-prompt-accept`
- `{action}-{target}`: `close-sidebar`, `open-tutorial`, `view-cards`
- Dom lookup: `target.closest('[data-stat]')?.dataset.stat`

**Input handling:**
- `data-input="event-dice-value"` cho input fields
- Doc bang `mountEl.querySelector('[data-input="..."]')?.value`

---

### 4. Socket Architecture

**Pattern**: Client-authoritative state voi server sync

#### Flow dong bo:

```
Client (mutate state)
    |
    v
syncGameStateToServer()          // gui partial state update
    |
    v
Server: game:sync-state          // nhan va persist
    |
    v
playerManager.update*()          // luu vao players.json
roomManager.updateRoom*()        // luu vao rooms.json
mapManager.update*()             // luu vao maps.json
    |
    v
Server broadcast: game:state     // gui full state cho tat ca players
    |
    v
Client: onGameState callback     // cap nhat state.currentGameState
    |
    v
updateGameUI()                   // re-render UI
```

#### Socket Events:

**Client -> Server:**

| Event | Mo ta |
|-------|-------|
| `room:create` | Tao phong moi |
| `room:join` | Vao phong |
| `room:start` | Bat dau game (host) |
| `game:sync-state` | Dong bo state tu client |
| `game:roll-dice` | Gui ket qua dice roll |
| `game:move` | Di chuyen player |
| `game:set-moves` | Dat so buoc di chuyen |
| `game:end-turn` | Ket thuc luot som |
| `debug:solo-create` | Tao solo debug room |

**Server -> Client:**

| Event | Mo ta |
|-------|-------|
| `game:state` | Full game state update |
| `game:players-active` | Danh sach players dang online |
| `room:state` | Room lobby state |
| `room:player-disconnected` | Player mat ket noi (5 phut grace) |
| `room:player-reconnected` | Player ket noi lai |

#### State duoc sync:

```javascript
// turnManager.js - syncGameStateToServer()
socketClient.syncGameState({
    playerMoves,
    playerPositions,
    map: { revealedRooms, connections, elevatorShafts },
    drawnRooms,
    playerCards,
    characterData,
    trappedPlayers,
    pendingEvents,
    pendingStatChoices,
    persistentEffects,
    storedDice,
    currentTurnIndex,
    combatState, combatResult,
    gameOver, hauntState,
    roomTokenEffects,       // token passive effects tren room
    tokenInteractions,      // token interaction data (dice roll)
});
```

**Luu y quan trong:**
- `roomTokenEffects` va `tokenInteractions` duoc luu o **top-level** cua `currentGameState` (khong phai trong `playerState`)
- Sau khi nhan `game:state` tu server, can promote chung tu `serverState.playerState` len `state.currentGameState` (xu ly trong `index.js`)
- Server **khong validate** game logic - chi persist va broadcast

---

### 5. CSS Conventions

**File**: `src/style.css` (~8000 dong)

**Naming**: BEM (Block Element Modifier)

```css
/* Block */
.damage-dist-modal { ... }

/* Element */
.damage-dist-modal__header { ... }
.damage-dist-modal__title { ... }
.damage-dist-modal__stat-row { ... }

/* Modifier */
.damage-dist-modal__btn--confirm { ... }
.damage-dist-modal__stat-row--dead { ... }
.damage-dist-modal__remaining--done { ... }
```

#### Overlay + Modal Pattern:

Moi popup/modal gom 2 lop: overlay (nen mo) + modal (noi dung):

```css
/* Overlay - nen mo fullscreen */
.{name}-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;       /* 1000-2200 tuy theo priority */
    padding: 20px;
}

/* Modal - hop noi dung */
.{name}-modal {
    background: linear-gradient(145deg, #2a1515 0%, #1a1a1a 100%);
    border: 2px solid #c94c4c;
    border-radius: 16px;
    width: 100%;
    max-width: 380px;
}

/* Header */
.{name}-modal__header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(201, 76, 76, 0.3);
}

/* Body */
.{name}-modal__body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
```

#### Z-index Hierarchy:

| Z-index | Dung cho |
|---------|----------|
| 1000 | Standard overlays (event dice, token drawing) |
| 1100 | Event result modal |
| 2000 | Character modal |
| 2100 | Combat, trapped escape modals |
| 2200 | Damage distribution modal |

#### Color Scheme:

```css
:root {
    --bg: #000;
    --fg: #fff;
    --muted: rgba(255, 255, 255, 0.72);
    --hairline: rgba(255, 255, 255, 0.18);
}

/* Accent colors */
Gold:   #c9a55c
Red:    #e74c3c / #c94c4c / #f87171
Green:  #34d399 / #4ade80 / #059669
Purple: #7c3aed
Orange: #ea580c
```

---

## He thong Game

### 6. Event Cards System

**Data**: `src/app/data/cardsData.js` - Dinh nghia tat ca event cards voi:
- `id`, `name`, `text` (bilingual)
- `effect`: loai hieu ung (`rollDice`, `placeToken`, `conditional`, `attack`, ...)
- `rollStat`: chi so dung de roll (speed/might/sanity/knowledge)
- `rollResults`: mang ket qua theo range
- `tokenType`: loai token dat vao room
- `tokenInteraction`: tuong tac voi token (roll stat, ket qua)
- `immediateEffect`: hieu ung xay ra ngay khi mo la

**Event processing pipeline:**

```
tokenDrawing.js       (rut la bai)
    |
    v
events/index.js       (router - phan loai event type)
    |
    ├── eventDice.js          (rollDice events - do xuc xac)
    ├── eventToken.js         (placeToken events - dat token)
    ├── eventChoice.js        (optional/choice events)
    ├── eventConditional.js   (conditional effects)
    ├── eventAttack.js        (combat events)
    ├── eventMultiPlayer.js   (multi-player roll events)
    ├── eventPersistent.js    (persistent effects)
    ├── eventTrapped.js       (trapped effects)
    ├── eventSpecial.js       (special one-off events)
    ├── eventSecondRoll.js    (two-stage roll events)
    └── eventReflection.js    (return item events)
```

### 7. Token System

**Token types va tuong tac:**

| Token | Event | Interaction | Prompt on Place | Prompt on Entry |
|-------|-------|-------------|-----------------|-----------------|
| `closet` | canh_cua_tu | Roll 2 fixed dice | Co | Co |
| `safe` | ket_sat_bi_khoa | Roll Knowledge | Co | Co |
| `skeletons` | bo_hai_cot | Roll Sanity | Co (sau immediate damage) | Co |
| `wallSwitch` | cua_xoay | Roll Knowledge | Khong (teleport truoc) | Co |
| `smoke` | khoi | Passive: -1 dice | Khong | Khong |
| `drip` | am_thanh_nho_giot | Passive: -1 dice | Khong | Khong |
| `blessing` | ban_phep | Passive: +1 dice ally | Khong | Khong |

**Token data flow:**
1. `handlePlaceTokenEvent()` - dat token + luu `tokenInteractions` vao state
2. `showTokenInteractionPrompt()` - hien prompt Yes/No
3. `openTokenInteractionModal()` - hien modal roll dice
4. `applyTokenInteractionResult()` - ap dung ket qua

**Passive tokens**: Hien thi notification bar o cuoi man hinh (`room-token-notif`). Click de xem full description (`token-detail-popup`).

### 8. Damage Distribution System

**Flow khi bi sat thuong:**

```
Event/Combat ket qua sat thuong
    |
    v
openDamageDiceModal()           # Nhap/random so damage dice
    |
    v
closeDamageDiceModal()          # Dong modal, mo distribution
    |
    v
openDamageDistributionModal()   # Chon phan bo: Speed/Might hoac Sanity/Knowledge
    |                            # Gioi han: khong duoc tru qua stat index hien tai
    |                            # Warning: "TOI DA!" khi stat da max, "DA CHET!" khi = 0
    v
closeDamageDistributionModal()  # Ap dung stat changes
    |
    ├── checkPlayerDeath()      # Kiem tra chet (stat = 0)
    ├── pendingMentalDamage?    # Chain tiep mental damage
    ├── pendingTrappedEffect?   # Chain trapped effect
    └── pendingTokenPrompt?     # Chain token interaction prompt
```

**Quy tac:**
- **Vat li (Physical)**: Phan bo giua Speed va Might
- **Tinh than (Mental)**: Phan bo giua Sanity va Knowledge
- Moi stat chi bi tru toi da = stat index hien tai (khong duoc am)
- Neu ca 2 stats deu max, cho phep confirm voi damage thua bi bo qua

### 9. Turn Management

```
advanceToNextTurn()
    |
    ├── Tang currentTurnIndex (modulo turnOrder.length)
    ├── Kiem tra trapped players (moves = 0)
    ├── Kiem tra persistent effects (movement restrictions)
    ├── Tinh so buoc = character speed stat
    ├── Reset hasAttackedThisTurn
    └── syncGameStateToServer()
```

**Turn initialization** (trong `updateGameUI`):
1. Kiem tra trapped -> mo escape modal
2. Kiem tra pendingStatChoices -> mo stat choice modal
3. Kiem tra persistent turn effects
4. Kiem tra interactive tokens trong room -> mo prompt
5. Dat so buoc di chuyen

---

## Game Modes

### Multiplayer Mode
```
http://localhost:5173/#/home              # Landing page
http://localhost:5173/#/room              # Tao phong
http://localhost:5173/#/room/BAH-XXX      # Vao phong
http://localhost:5173/#/game/BAH-XXX      # Game dang choi
```

### Solo Debug Mode
```
http://localhost:5173/#/game/solo-debug    # 1 socket, 2 virtual players
```
- Instant start, khong can doi
- Click turn order de switch giua players
- Ho tro `asPlayerId` parameter

### Multiplayer Debug Mode
```
http://localhost:5173/#/game/debug         # Auto-start khi 2 players
```

---

## Luu y khi Development

### Them modal moi

1. **State**: Them modal state vao `gameState.js`:
   ```javascript
   /** @type {any} */
   myNewModal: null,
   ```

2. **Render**: Tao render function tra ve HTML string:
   ```javascript
   export function renderMyNewModal() {
       if (!state.myNewModal?.isOpen) return '';
       return `<div class="my-new-overlay">
           <div class="my-new-modal">...</div>
       </div>`;
   }
   ```

3. **Register**: Them vao `renderGameScreen()` trong `mainRenderer.js`

4. **Events**: Them action handlers vao `eventListeners.js`:
   ```javascript
   if (action === 'my-new-action') { /* handler */ return; }
   ```

5. **CSS**: Them styles theo BEM convention vao `style.css`

6. **Reset**: Them vao `resetAllModalStates()` trong `gameState.js`

### Them event card moi

1. Dinh nghia trong `cardsData.js` voi day du: `id`, `type`, `name`, `text`, `effect`, `rollStat`, `rollResults`
2. Tao handler trong module tuong ung (`events/eventDice.js`, `events/eventToken.js`, ...)
3. Register trong `events/index.js` router
4. Cap nhat `EVENT_CARDS_IMPLEMENTATION.md`

### Them token moi

1. Dinh nghia `tokenType` va `tokenInteraction` trong `cardsData.js`
2. Them vao `TOKEN_PROMPT_CONFIG` trong `eventToken.js` (neu can prompt)
3. Them icon/label vao `renderRoomTokenNotification()` trong `mainRenderer.js`
4. Them vao `tokenNames` object trong `eventToken.js`

### Luu y ve state sync

- **Luon goi** `syncGameStateToServer()` sau khi thay doi state quan trong
- `roomTokenEffects` va `tokenInteractions` nam o **top-level** cua `currentGameState`, KHONG phai trong `playerState`
- Server chi persist va broadcast, **khong validate** game logic
- Sau khi nhan server state, kiem tra va promote `roomTokenEffects`/`tokenInteractions` tu `playerState` len top-level (da xu ly trong `index.js`)

### Luu y ve UI

- **Luon dat** `state.skipMapCentering = true` truoc khi `updateGameUI()` neu muon giu scroll position
- Modals su dung overlay pattern: `.{name}-overlay` + `.{name}-modal`
- CSS class names phai dung BEM: `block__element--modifier`
- Button actions dung `data-action="..."`, parameters dung `data-*`
- Input fields dung `data-input="..."` de doc gia tri

### Chain effects

Nhieu effects can chain noi tiep. Su dung pattern `pending*`:
```javascript
// Luu pending action truoc khi mo modal
state.pendingTokenPromptAfterDamage = { roomId, tokenType };

// Trong close handler, kiem tra va thuc hien pending action
if (state.pendingTokenPromptAfterDamage) {
    const { roomId, tokenType } = state.pendingTokenPromptAfterDamage;
    state.pendingTokenPromptAfterDamage = null;
    showTokenInteractionPrompt(mountEl, roomId, tokenType);
    return;
}
```

---

## Tai lieu

- [boardgame_rules.md](./boardgame_rules.md) - Luat choi day du (Vietnamese)
- [EVENT_CARDS_IMPLEMENTATION.md](./EVENT_CARDS_IMPLEMENTATION.md) - Event cards progress
- [src/app/README.md](./src/app/README.md) - Chi tiet technical architecture

## License

Du an nay duoc tao cho muc dich giao duc va giai tri.
