# Event Cards Implementation Progress

## Tổng quan

Dự án triển khai đầy đủ logic cho **45 event cards** trong game Betrayal at House on the Hill. Mỗi event được implement riêng biệt và cần được test + confirm trước khi chuyển sang event tiếp theo.

**Trạng thái hiện tại**: 45/45 events đã hoàn thành (100% complete)

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

### ✅ Group 4: Fixed Dice Roll Events (4/4 completed)

Events roll fixed số lượng dice (không theo stat value).

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 18 | `duong_bi_mat` | Đường bí mật | ✅ Done | Roll 3 dice, place tokens |
| 19 | `cuoc_goi_den` | Cuộc gọi đến | ✅ Done | Fixed dice (2), stat changes |
| 20 | `am_thanh_bat_an` | Âm thanh bất an | ✅ Done | Fixed dice (6), compare to omen count |
| 21 | `tieng_buoc_chan` | Tiếng bước chân | ✅ Done | Roll 1 die, chapel bonus |

**Implementation Requirements:**
- Need `fixedDiceCount` parameter in event data
- Modify dice modal to support fixed counts
- Handle room-specific bonuses (chapel)

---

### ✅ Group 5: Token Placement Events (9/9 completed)

Events đặt tokens lên map (Closet, Smoke, Safe, etc.).

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 22 | `canh_cua_tu` | Cánh cửa tủ | ✅ Done | Place Closet token |
| 23 | `khoi` | Khói | ✅ Done | Place Smoke token, room effect |
| 24 | `ket_sat_bi_khoa` | Két sắt bị khóa | ✅ Done | Place Safe token, interaction |
| 25 | `bo_hai_cot` | Bộ hài cốt | ✅ Done | Place Skeletons token |
| 26 | `toang_toang_toang` | Toang... Toang... Toang... | ✅ Done | Place Drip token |
| 27 | `cua_xoay` | Cửa xoay | ✅ Done | Place Wall Switch token |
| 28 | `khoanh_khac_hi_vong` | Khoảnh khắc hi vọng | ✅ Done | Place Blessing token |
| 29 | `cau_thang_bi_mat` | Cầu thang bí mật | ✅ Done | Place 2 Secret Stairs tokens |
| 30 | `cau_truot_huyen_bi` | Cầu trượt huyền bí | ✅ Done | Place Slide token |

**Implementation:** Token placement via `eventToken.js`, room effects stored in `roomTokenEffects`, token interactions via `tokenInteractions` in game state, interaction modal with dice rolls.

---

### ✅ Group 6: Affects All Players Events (4/4 completed)

Events ảnh hưởng đến nhiều players cùng lúc.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 31 | `gio_gao_thet` | Gió gào thét | ✅ Done | All in outdoor rooms roll |
| 32 | `su_im_lang` | Sự im lặng | ✅ Done | All in basement roll |
| 33 | `lan_suong_ki_la` | Làn sương kì lạ | ✅ Done | All in basement roll |
| 34 | `tieng_vay_goi` | Tiếng vẫy gọi | ✅ Done | All in outdoor rooms roll |

**Implementation:** Multi-player roll system via `eventMultiPlayer.js`, filters players by floor/room, sequential rolling with per-player results.

---

### ✅ Group 7: Persistent Effect Events (1/1 completed)

Events tạo hiệu ứng kéo dài nhiều turns.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 35 | `den_tat` | Đèn tắt | ✅ Done | Movement restriction until condition |

**Implementation:** Persistent movement restriction via `eventSpecial.js`, checked in `turnManager.js` on turn advance, auto-removes when conditions met (same room with player, has Candle, in Furnace Room).

---

### ✅ Group 8: Choice-Based Events (2/2 completed)

Events cho player chọn giữa nhiều options.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 36 | `dinh_truoc_tuong_lai` | Định trước tương lai | ✅ Done | Choose peek or store dice |
| 37 | `lao_gia_an_xin` | Lão già ăn xin | ✅ Done | Choose to give money or ignore |

**Implementation:** Choice modal via `eventChoice.js` with options routing, peek modal for room/card peek, store dice modal for saving dice results.

---

### ✅ Group 9: Optional Roll Events (1/1 completed)

Events cho phép player chọn có roll hay không.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 38 | `thu_gi_do_an_giau` | Thứ gì đó ẩn giấu | ✅ Done | Optional roll for item |

**Implementation:** Optional roll modal via `eventChoice.js` with accept/skip buttons, skip advances turn.

---

### ✅ Group 10: Second Roll Mechanics (1/1 completed)

Events với second roll khi fail first roll.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 39 | `ai_do_bi_lac` | Ai đó bị lạc | ✅ Done | Second roll on fail |

**Implementation:** Second roll triggered by `secondRoll` effect type in `eventDice.js`, opens `eventSecondRoll.js` modal for re-roll with different outcomes.

---

### ✅ Group 11: Attack Events (2/2 completed)

Events kích hoạt combat giữa players.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 40 | `nguoi_lam_vuon` | Người làm vườn | ✅ Done | Roll or be attacked |
| 41 | `con_bup_be_kinh_di` | Con búp bê kinh dị | ✅ Done | Right player attacks you |

**Implementation:** Event-triggered combat via `eventAttack.js` and `eventDice.js`, uses existing combat modal with forced attack flag, right player determination via turn order.

---

### ✅ Group 12: Conditional Events (1/1 completed)

Events với conditions phức tạp (check inventory, etc.).

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 42 | `luot_cua_jonah` | Lượt của Jonah | ✅ Done | Check if player has item |

**Implementation:** Conditional event via `eventConditional.js`, checks player inventories for `hop_lac_ghep`, branches to discard+draw or mental damage.

---

### ✅ Group 13: Special Mechanics Events (3/3 completed)

Events với mechanics đặc biệt và phức tạp.

| # | ID | Name (VI) | Status | Notes |
|---|----|-----------|----|-------|
| 43 | `buc_tuong_thit` | Bức tường thịt | ✅ Done | Draw room, teleport |
| 44 | `what_the_f` | What the F...? | ✅ Done | Relocate current room |
| 45 | `whoops` | Whoops! | ✅ Done | Shuffle items, right player discards |

**Implementation:** Special mechanics via `eventSpecial.js` - room draw prompts manual placement, room relocation prompts manual map adjustment, item shuffle randomly discards.

---



**Progress: 45/45 Events Complete (100%)**
**Last Updated: 2026-02-07**
**All event card implementations complete.**
