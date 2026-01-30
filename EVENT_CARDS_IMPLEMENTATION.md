# Event Cards Implementation Progress

## Tổng quan

Dự án triển khai đầy đủ logic cho **45 event cards** trong game Betrayal at House on the Hill. Mỗi event được implement riêng biệt và cần được test + confirm trước khi chuyển sang event tiếp theo.

**Trạng thái hiện tại**: 18/45 events đã hoàn thành (40% complete)

---

## Quy trình làm việc (Workflow)

### Cho mỗi event:

1. **Developer implement logic** cho event trong `src/app/views/gameView.js`
2. **User test** event trong debug mode (`http://localhost:5173/#/game/debug`)
3. **User confirm** kết quả (pass/fail)
4. **Mark done** nếu pass, fix nếu fail
5. **Chuyển sang event tiếp theo**

### Quy tắc quan trọng:

- ✅ **Bám theo flow của logic cũ** - tránh va chạm với code đã có
- ✅ **Không cần start yarn dev** - server luôn chạy sẵn
- ✅ **1 event = 1 task** - mỗi task bao gồm: code implementation + user test
- ✅ **User approve trước khi mark done**

---

## Implementation Status

### ✅ Group 1: Simple Immediate Roll Events (14/14 completed)

Những events có `immediateRoll: true` với stat rolls và outcomes đơn giản.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 1 | `tieng_het_that_thanh` | Tiếng hét thất thanh | ✅ Done | Roll Sanity, damage outcomes |
| 2 | `canh_tuong_ma_quai` | Cảnh tượng ma quái | ✅ Done | Roll Knowledge, gain/damage |
| 3 | `nguoi_dan_ong_bi_thieu_song` | Người đàn ông bị thiêu sống | ✅ Done | Roll Sanity, teleport effect |
| 4 | `bay_con_trung_kinh_di` | Bầy côn trùng kinh dị | ✅ Done | Roll Sanity, stat changes |
| 5 | `mui_hoi_thoi` | Mùi hôi thối | ✅ Done | Roll Sanity, multi-stat loss |
| 6 | `canh_tuong_mau_me` | Cảnh tượng máu me | ✅ Done | Roll Sanity, forced attack |
| 7 | `chat_nhay_kinh_tom` | Chất nhầy kinh tởm | ✅ Done | Roll Speed, stat changes |
| 8 | `con_nhen` | Con nhện | ✅ Done | Roll Speed/Sanity (choice) |
| 9 | `manh_vo` | Mảnh vỡ | ✅ Done | Roll Speed, trapped effect |
| 10 | `mang_nhen` | Mạng nhện | ✅ Done | Roll Might, trapped effect |
| 11 | `dat_mo` | Đất mộ | ✅ Done | Roll Might, persistent effect |
| 12 | `chiem_huu` | Chiếm hữu | ✅ Done | Roll choice stat, set to lowest |
| 13 | `tang_le` | Tang lễ | ✅ Done | Roll Sanity, **random** teleport to Graveyard/Crypt |
| 14 | `sinh_vat_tuc_gian` | Sinh vật tức giận | ✅ Done | Roll Speed, damage |

**Key Implementation Details (Event #13):**
- Random teleport thay vì cho player chọn
- Tìm tất cả phòng available trong destinations array
- Random.floor(Math.random() * existingRooms.length)
- Popup thông báo phòng đã teleport
- Code: `gameView.js:2592-2611`, `cardsData.js:1382`

---

### ✅ Group 2: Draw Card Effects (2/2 completed)

Events yêu cầu draw Item/Event cards từ deck.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 15 | `anh_phan_chieu` | Ảnh phản chiếu | ✅ Done | Draw 1 Item (direct effect + dice outcome) |
| 16 | `anh_phan_chieu_2` | Ảnh phản chiếu (2) | ✅ Done | Return Item, conditional + pending turn |

**Implementation Requirements:**
- Need `drawItem` effect handler
- Integrate with card inventory system
- Handle card deck management

---

### ✅ Group 3: Multi-Roll Events (1/1 completed)

Events với nhiều dice rolls và bonus conditions.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 17 | `nguoi_treo_co` | Người treo cổ | ✅ Done | Roll 4 stats, bonus condition |

**Implementation Requirements:**
- Multi-roll system already exists
- Need to handle 4-stat sequential rolls
- Apply bonus based on roll results

---

### 🔄 Group 4: Fixed Dice Roll Events (1/4 completed)

Events roll fixed số lượng dice (không theo stat value).

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 18 | `duong_bi_mat` | Đường bí mật | ✅ Done | Roll 3 dice, place tokens |
| 19 | `cuoc_goi_den` | Cuộc gọi đến | ⏳ Pending | Roll 2 dice, stat changes |
| 20 | `am_thanh_bat_an` | Âm thanh bất an | ⏳ Pending | Roll 6 dice, compare to omen count |
| 21 | `tieng_buoc_chan` | Tiếng bước chân | ⏳ Pending | Roll 1 die, chapel bonus |

**Implementation Requirements:**
- Need `fixedDiceCount` parameter in event data
- Modify dice modal to support fixed counts
- Handle room-specific bonuses (chapel)

---

### ⏳ Group 5: Token Placement Events (0/9 completed)

Events đặt tokens lên map (Closet, Smoke, Safe, etc.).

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 22 | `canh_cua_tu` | Cánh cửa tủ | ⏳ Pending | Place Closet token |
| 23 | `khoi` | Khói | ⏳ Pending | Place Smoke token, room effect |
| 24 | `ket_sat_bi_khoa` | Két sắt bị khóa | ⏳ Pending | Place Safe token, interaction |
| 25 | `bo_hai_cot` | Bộ hài cốt | ⏳ Pending | Place Skeletons token |
| 26 | `toang_toang_toang` | Toang... Toang... Toang... | ⏳ Pending | Place Drip token |
| 27 | `cua_xoay` | Cửa xoay | ⏳ Pending | Place Wall Switch token |
| 28 | `khoanh_khac_hi_vong` | Khoảnh khắc hi vọng | ⏳ Pending | Place Blessing token |
| 29 | `cau_thang_bi_mat` | Cầu thang bí mật | ⏳ Pending | Place 2 Secret Stairs tokens |
| 30 | `cau_truot_huyen_bi` | Cầu trượt huyền bí | ⏳ Pending | Place Slide token |

**Implementation Requirements:**
- Token placement system
- Token interaction mechanics
- Room token tracking in game state
- Visual token rendering on map

---

### ⏳ Group 6: Affects All Players Events (0/4 completed)

Events ảnh hưởng đến nhiều players cùng lúc.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 31 | `gio_gao_thet` | Gió gào thét | ⏳ Pending | All in outdoor rooms roll |
| 32 | `su_im_lang` | Sự im lặng | ⏳ Pending | All in basement roll |
| 33 | `lan_suong_ki_la` | Làn sương kì lạ | ⏳ Pending | All in basement roll |
| 34 | `tieng_vay_goi` | Tiếng vẫy gọi | ⏳ Pending | All in outdoor rooms roll |

**Implementation Requirements:**
- Filter players by room location
- Filter by floor (basement/ground/upper)
- Filter by room type (outdoor/indoor)
- Sequential or parallel roll handling

---

### ⏳ Group 7: Persistent Effect Events (0/1 completed)

Events tạo hiệu ứng kéo dài nhiều turns.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 35 | `den_tat` | Đèn tắt | ⏳ Pending | Movement restriction until condition |

**Implementation Requirements:**
- Persistent effect state tracking
- Turn-based effect checking
- Condition resolution system

---

### ⏳ Group 8: Choice-Based Events (0/2 completed)

Events cho player chọn giữa nhiều options.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 36 | `dinh_truoc_tuong_lai` | Định trước tương lai | ⏳ Pending | Choose peek or store dice |
| 37 | `lao_gia_an_xin` | Lão già ăn xin | ⏳ Pending | Choose to give money or ignore |

**Implementation Requirements:**
- Choice modal UI
- Store player choices in state
- Apply different effects based on choice

---

### ⏳ Group 9: Optional Roll Events (0/1 completed)

Events cho phép player chọn có roll hay không.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 38 | `thu_gi_do_an_giau` | Thứ gì đó ẩn giấu | ⏳ Pending | Optional roll for item |

**Implementation Requirements:**
- Optional roll UI (Yes/No buttons)
- Handle skip action
- Reward system for success

---

### ⏳ Group 10: Second Roll Mechanics (0/1 completed)

Events với second roll khi fail first roll.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 39 | `ai_do_bi_lac` | Ai đó bị lạc | ⏳ Pending | Second roll on fail |

**Implementation Requirements:**
- Track first roll result
- Trigger second roll conditionally
- Handle second roll outcomes

---

### ⏳ Group 11: Attack Events (0/2 completed)

Events kích hoạt combat giữa players.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 40 | `nguoi_lam_vuon` | Người làm vườn | ⏳ Pending | Roll or be attacked |
| 41 | `con_bup_be_kinh_di` | Con búp bê kinh dị | ⏳ Pending | Right player attacks you |

**Implementation Requirements:**
- Combat initiation from events
- Attack/defense roll system
- Determine attacker (right player, etc.)
- Damage application

---

### ⏳ Group 12: Conditional Events (0/1 completed)

Events với conditions phức tạp (check inventory, etc.).

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 42 | `luot_cua_jonah` | Lượt của Jonah | ⏳ Pending | Check if player has item |

**Implementation Requirements:**
- Inventory checking
- Conditional effect branching
- Item-based logic

---

### ⏳ Group 13: Special Mechanics Events (0/3 completed)

Events với mechanics đặc biệt và phức tạp.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 43 | `buc_tuong_thit` | Bức tường thịt | ⏳ Pending | Draw room, teleport |
| 44 | `what_the_f` | What the F...? | ⏳ Pending | Relocate current room |
| 45 | `whoops` | Whoops! | ⏳ Pending | Shuffle items, right player discards |

**Implementation Requirements:**
- Room drawing/placement mechanics
- Room relocation system
- Item shuffling between players
- Complex multi-step effects

---

## Existing Implementation (Already Working)

### ✅ Core Systems

Những hệ thống đã được implement và hoạt động tốt:

1. **Event Card Drawing** (`gameView.js`)
   - Detect `immediateRoll: true`
   - Open dice modal automatically
   - Track event state

2. **Dice Rolling System** (`gameView.js`)
   - Stat-based dice count
   - Roll result calculation
   - Outcome matching logic

3. **Damage System** (`gameView.js`)
   - Physical damage (Might/Speed)
   - Mental damage (Knowledge/Sanity)
   - Damage distribution modal
   - Death handling

4. **Stat Changes** (`gameView.js`)
   - `gainStat` - Increase stat
   - `loseStat` - Decrease stat
   - `loseStats` - Multiple stats at once
   - Stat value clamping (0-7)

5. **Teleport System** (`gameView.js`)
   - `teleport` - Direct teleport to room
   - `teleportIfExists` - Conditional teleport
   - Random room selection
   - Destination room finding

6. **Trapped System** (`gameView.js`)
   - Trapped state tracking
   - Escape roll mechanics
   - Ally rescue mechanics
   - Movement restrictions

7. **Persistent Damage** (`gameView.js`)
   - Per-turn damage application
   - Damage state tracking
   - Damage modal UI

8. **Modal System** (`gameView.js`)
   - Event dice modal
   - Damage distribution modal
   - Event result modal (clickable)
   - Trapped escape modal
   - Rescue trapped modal
   - Persistent damage modal

---

## Critical Files

| File | Purpose | Lines |
|------|---------|-------|
| [gameView.js](src/app/views/gameView.js) | Main gameplay logic, event processing | ~6500 |
| [cardsData.js](src/app/data/cardsData.js) | All card data (items, omens, events) | ~1400 |
| [socketClient.js](src/app/services/socketClient.js) | Socket.IO client wrapper | ~150 |
| [playerManager.js](server/playerManager.js) | Player state management | ~200 |
| [mapManager.js](server/mapManager.js) | Map state management | ~150 |
| [style.css](src/style.css) | All UI styles including modals | ~8700 |

---

## Key Functions Reference

### Event Processing (`gameView.js`)

```javascript
// Line 683 - Check if event requires immediate roll
checkEventRequiresImmediateRoll(eventCard)

// Line 725 - Open dice modal for event
openEventDiceModal(mountEl, eventCard, statChoice)

// Line 2514 - Apply dice result effects
applyEventDiceResult(mountEl, result, stat)

// Line 795 - Find matching outcome from roll results
findMatchingOutcome(rollResults, diceResult)

// Line 767 - Check if result matches range (4+, 0-1, etc.)
matchesRollRange(range, result)
```

### Helper Functions

```javascript
// Line 2300 - Find existing rooms by destination names
findExistingRooms(destinations) // Returns [{roomId, name, destination}]

// Line 2267 - Find single room by destination
findRoomIdByDestination(destination) // Returns roomId or null

// Line 2207 - Apply stat change to player
applyStatChange(playerId, stat, amount)

// Line 703 - Get current stat value for dice
getPlayerStatForDice(playerId, stat)
```

### Modal Functions

```javascript
// Line 1236 - Open result notification modal (clickable)
openEventResultModal(mountEl, title, message, type)

// Line 1252 - Close result modal
closeEventResultModal(mountEl)

// Line 813 - Open damage dice modal
openDamageDiceModal(mountEl, physicalDice, mentalDice)

// Line 1273 - Open teleport choice modal (if needed in future)
openTeleportChoiceModal(mountEl, rooms, preMessage)
```

---

## Testing Guide

### Unit Testing (Recommended)

Event logic đã được extract ra `src/app/utils/eventEffects.js` để có thể test bằng unit tests.

**Chạy tests:**
```bash
yarn test
```

**Test coverage:**
- 49 property-based tests với fast-check (100 iterations mỗi test)
- Tests cho: matchesRollRange, findMatchingOutcome, applyStatChange, applyEventDiceResult, etc.
- Không cần UI, không cần socket - test pure functions

**Thêm test cho event mới:**
```javascript
// Trong src/app/utils/eventEffects.test.js
it('my new event effect works correctly', () => {
    const gs = makeGameState('p1', 'madame-zostra', 3);
    const eventCard = {
        id: 'my_event',
        name: { vi: 'My Event' },
        rollResults: [{ range: '4+', effect: 'gainStat', stat: 'speed', amount: 1 }]
    };
    const result = applyEventDiceResult(gs, 'p1', eventCard, 5, 'speed');
    expect(result.type).toBe('gainStat');
    expect(gs.playerState.characterData['p1'].stats.speed).toBe(4);
});
```

### Debug Mode (Manual Testing)

URL: `http://localhost:5173/#/game/debug`

**Features:**
- 3 local players với random characters
- Click turn order để switch players
- Không cần multiplayer setup
- Instant testing

### Manual Test Workflow

1. **Start debug mode**
2. **Move to room** có Event token (màu vàng)
3. **Draw specific event card** từ danh sách
4. **Follow event flow** (dice roll, modals, effects)
5. **Verify outcomes**:
   - Stat changes đúng
   - Teleport hoạt động
   - Damage applied correctly
   - Modals close properly
6. **Test edge cases**:
   - Roll lowest/highest values
   - Player death scenarios
   - Multiple players affected
   - Missing rooms (teleport fail)

### Common Test Scenarios

```javascript
// Roll ranges to test
'4+' → Test with 4, 5, 6, 7, 8
'2-3' → Test with 2, 3
'0-1' → Test with 0, 1

// Teleport scenarios
- No destination rooms revealed
- One room revealed
- Multiple rooms revealed

// Damage scenarios
- Physical damage → Choose Speed or Might
- Mental damage → Choose Knowledge or Sanity
- Player dies (stat reaches 0)
```

---

## Implementation Patterns

### Event Data Structure

```javascript
{
  id: 'event_id',
  type: 'event',
  name: { vi: 'Tên tiếng Việt', en: 'English Name' },
  text: { vi: 'Mô tả chi tiết...' },
  immediateRoll: true,
  rollStat: 'sanity', // speed, might, knowledge, sanity
  rollResults: [
    {
      range: '4+',
      effect: 'gainStat',
      stat: 'sanity',
      amount: 1
    },
    {
      range: '0-3',
      effect: 'mentalDamage',
      dice: 2
    },
    {
      range: '0-1',
      effect: 'loseStats',
      stats: { sanity: 1, might: 1 },
      then: {
        effect: 'teleportIfExists',
        destinations: ['graveyard', 'crypt']
      }
    }
  ]
}
```

### Effect Types

```javascript
// Simple effects
'nothing'          // No effect
'gainStat'         // Increase stat
'loseStat'         // Decrease stat
'loseStats'        // Decrease multiple stats

// Damage effects
'physicalDamage'   // Roll physical damage dice
'mentalDamage'     // Roll mental damage dice
'damage'           // Both physical and mental

// Movement effects
'teleport'         // Direct teleport to room
'teleportIfExists' // Conditional teleport (with random selection)

// Combat effects
'attack'           // Initiate attack
'forcedAttack'     // Force attack on specific target

// State effects
'trapped'          // Player becomes trapped
'drawItem'         // Draw item card (TODO)
'placeToken'       // Place token on map (TODO)
```

### Adding New Effect Types

1. Add new case in `applyEventDiceResult()` switch statement
2. Implement effect logic
3. Update event data in `cardsData.js`
4. Create modal UI if needed
5. Add event handler in click handler
6. Test thoroughly

---

## Known Issues & Limitations

### Current Limitations

1. **Draw Item effect** chưa implement (Events #15, #16)
2. **Token placement** chưa có system (Events #22-30)
3. **Multi-player effects** chưa hỗ trợ (Events #31-34)
4. **Attack from events** chưa implement (Events #40-41)
5. **Fixed dice count** chưa hỗ trợ (Events #18-21)

### Technical Debt

- Event result modal có thể improve UX
- Cần refactor applyEventDiceResult() (quá dài)
- Token system cần thiết kế carefully
- Multi-player event flow cần sync tốt hơn

---

## Next Steps

### Immediate Next Task: Event #19 (cuoc_goi_den) - Group 4

**Event**: Cuộc gọi đến
**Type**: Fixed dice (2), stat changes
**Requires**: fixed dice flow, apply stat changes per outcome

### Priorities

1. **Fixed Dice Count** (Events #19-21) - Common pattern
2. **Token Placement System** (Events #22-30) - Big feature
3. **Multi-player Effects** (Events #31-34) - Complex sync

---

## Change Log

### 2026-01-30

**Event #18 (duong_bi_mat) - COMPLETED**
- Fixed dice roll (3) handled via event dice modal
- Places first Secret Passage token in current room
- Prompts player to choose target room based on rolled floor
- Added Secret Passage token badge (corner) + floor selector + map click for placement
- Added Secret Passage travel button when movesLeft = 0 (manual test pending)

**Event #17 (nguoi_treo_co) - COMPLETED**
- Multi-roll (4 stats) works with per-roll stat loss on fail
- Bonus condition grants +2 to a chosen stat when all rolls >= 2
- Uses existing multi-roll summary + stat choice modal

**Event #16 (anh_phan_chieu_2) - COMPLETED**
- Conditional event now checks current player items
- If none, assigns random player with item and triggers on their turn
- Added return-item modal and pending event queue
- Syncs pending events via server state

### 2026-01-28

**Event Testing Architecture Refactor**
- Extracted event logic to `src/app/utils/eventEffects.js` (pure functions)
- Added 49 property-based tests in `eventEffects.test.js`
- gameView.js now uses thin wrappers that call utility functions
- Can now test event effects with `yarn test` without UI
- Functions extracted: `matchesRollRange`, `findMatchingOutcome`, `applyStatChange`, `applyTrappedEffect`, `applyPersistentEffect`, `findRoomIdByDestination`, `findExistingRooms`, `applyEventDiceResult`

**Files created:**
- `src/app/utils/eventEffects.js` (650 lines)
- `src/app/utils/eventEffects.test.js` (580 lines)

**Files modified:**
- `src/app/views/gameView.js` (imports + thin wrappers)

---

### 2025-01-25

**Event #13 (tang_le) - COMPLETED**
- Changed teleport logic from "player choice" to "random selection"
- Modified `applyEventDiceResult()` in `gameView.js:2592-2611`
- Removed `choice: true` from event data in `cardsData.js:1382`
- Uses `Math.random()` to select random room from available destinations
- Displays result in clickable popup modal
- Test scenarios: All pass ✅

**Files modified:**
- `src/app/views/gameView.js` (logic change)
- `src/app/data/cardsData.js` (data change)

**Next**: Event #16 (anh_phan_chieu_2) - Group 2: Draw Card Effects

---

## Contact & Support

**Development Environment:**
- Node.js + Yarn
- Vite dev server (auto-restart)
- Debug mode for testing

**Questions?**
- Check `src/app/README.md` for architecture details
- Review existing event implementations in `gameView.js`
- Test in debug mode first before asking

---

**Progress: 18/45 Events Complete (40%)**
**Last Updated: 2026-01-30**
**Current Task: Event #19 - Group 4: Fixed Dice Roll Events**
