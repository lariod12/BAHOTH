"""
Game rules for Betrayal at House on the Hill.
Used as system prompt context for the AI agent.
"""

GAME_RULES = """
# Betrayal at House on the Hill - Game Rules Summary

## Tổng Quan
- Game khám phá căn nhà ma ám với 3-6 người chơi
- Mỗi người chơi điều khiển 1 nhân vật thám hiểm
- Game có 2 giai đoạn: Khám phá (exploration) và Câu chuyện ma (haunt)

## Chỉ Số Nhân Vật (Traits)
Mỗi nhân vật có 4 chỉ số, mỗi chỉ số có track 8 giá trị:
- **Speed (Tốc Độ)**: Số bước di chuyển tối đa mỗi lượt
- **Might (Sức Mạnh)**: Sử dụng trong chiến đấu vật lý
- **Sanity (Tỉnh Táo)**: Sức mạnh tinh thần
- **Knowledge (Trí Tuệ)**: Kiến thức, giải đố

Khi bị sát thương:
- Sát thương vật lý → giảm Speed hoặc Might
- Sát thương tinh thần → giảm Sanity hoặc Knowledge
- Nếu bất kỳ chỉ số nào về 0 (skull) → nhân vật chết

## Cấu Trúc Lượt Chơi
Mỗi lượt, người chơi có thể:
1. Di chuyển (tối đa = Speed hiện tại)
2. Khám phá phòng mới (nếu đi qua cửa chưa có phòng)
3. Sử dụng vật dụng
4. Tấn công (chỉ sau khi haunt bắt đầu)

## Di Chuyển
- Mỗi bước = 1 phòng
- Có thể thực hiện hành động giữa chừng (dùng item, tấn công)
- NẾU rút bài (event/omen/item) → PHẢI dừng di chuyển
- Sau haunt: Mỗi đối thủ trong phòng = +1 bước để rời đi

## Các Tầng Nhà
- **Ground (Trệt)**: Tiền Sảnh, Sảnh Chính, Cầu Thang Lớn (bắt đầu tại đây)
- **Basement (Hầm)**: Đi xuống qua cầu thang
- **Upper (Lầu)**: Đi lên qua Cầu Thang Lớn

## Rút Bài Khi Khám Phá Phòng
Phòng có biểu tượng → rút bài tương ứng:
- 🌀 **Event (Sự kiện)**: Xảy ra ngay, thường yêu cầu roll dice
- 🐮 **Item (Vật dụng)**: Giữ lại, có thể sử dụng
- 🦅 **Omen (Điềm gở)**: Giữ lại + Roll dice ma ám cuối lượt

## Roll Dice (Đổ Xúc Xắc)
- Mỗi dice có mặt: 0, 1, hoặc 2
- Roll chỉ số = roll số dice bằng giá trị chỉ số hiện tại
- Kết quả = tổng các mặt dice
- Thành công/thất bại tùy thuộc yêu cầu (ví dụ: 4+ để thành công)

## Roll Dice Ma Ám
- Khi rút Omen, cuối lượt phải roll 6 dice
- Nếu kết quả < tổng số Omen đã rút trong game → Haunt bắt đầu
- Ví dụ: Có 4 Omen → roll ≤3 = Haunt bắt đầu

## Chiến Đấu (Sau Haunt)
1. Cả 2 bên roll dice = chỉ số Might (hoặc chỉ số khác nếu có item đặc biệt)
2. Ai cao hơn thắng
3. Người thua nhận sát thương = chênh lệch điểm
4. Hòa = không ai bị thương

## Vật Dụng (Items)
- Mỗi item dùng 1 lần/lượt (trừ khi ghi khác)
- Có thể: Sử dụng, Trao đổi, Đánh rơi, Cướp (nếu gây 2+ sát thương)
- Vũ khí (Axe, Dagger, Gun, Spear): Chỉ dùng khi tấn công, không dùng phòng thủ

## Phòng Đặc Biệt
- **Catacombs**: Roll Sanity 6+ để qua, thất bại = dừng
- **Chasm**: Roll Speed để không rơi, thất bại = sát thương
- **Vault**: Phòng chia 2 vùng, cần roll để mở
- **Tower/Attic**: Thường yêu cầu roll
- **Furnace Room**: Kết thúc lượt ở đây = 1 sát thương
- **Coal Chute**: Trượt xuống tầng hầm
- **Mystic Elevator**: Roll để chọn tầng đến

## Câu Chuyện Ma (Haunt)
Khi haunt bắt đầu:
1. Tra bảng để biết câu chuyện ma nào
2. Xác định kẻ phản bội (traitor)
3. Kẻ phản bội đọc sách Phản Bội
4. Phe chính diện đọc sách Sống Còn
5. Thực hiện setup theo hướng dẫn
6. Lượt đi: Chính diện → Phản bội → Quái vật

## Điều Kiện Thắng
- Trước haunt: Không có người thắng
- Sau haunt: Hoàn thành mục tiêu theo sách (khác nhau mỗi câu chuyện)

## Chiến Thuật Cơ Bản
1. **Trước Haunt**:
   - Ưu tiên lấy Item để tăng sức mạnh
   - Cân nhắc khi rút Omen (có thể trigger haunt)
   - Tăng chỉ số qua các phòng đặc biệt

2. **Khi Haunt**:
   - Nếu là chính diện: Hợp tác, tập trung mục tiêu
   - Nếu là phản bội: Tận dụng quái vật, ngăn chặn chính diện
"""

# Character starting stats for quick reference
CHARACTER_STATS = {
    "professor-longfellow": {
        "name": "Professor Longfellow",
        "speed": [2, 2, 4, 4, 5, 5, 6, 6],
        "might": [1, 2, 3, 4, 5, 5, 6, 6],
        "sanity": [1, 3, 3, 4, 5, 5, 6, 7],
        "knowledge": [4, 5, 5, 5, 5, 6, 7, 8],
        "speed_start": 3,
        "might_start": 2,
        "sanity_start": 2,
        "knowledge_start": 3
    },
    "madame-zostra": {
        "name": "Madame Zostra",
        "speed": [2, 3, 3, 5, 5, 6, 6, 7],
        "might": [2, 3, 3, 4, 5, 5, 5, 6],
        "sanity": [4, 4, 4, 5, 6, 7, 8, 8],
        "knowledge": [1, 3, 4, 4, 4, 5, 6, 6],
        "speed_start": 2,
        "might_start": 3,
        "sanity_start": 2,
        "knowledge_start": 3
    },
    # More characters will be loaded from charactersData.js
}

# Room special effects for quick reference
SPECIAL_ROOMS = {
    "catacombs": {
        "name": "Catacombs",
        "effect": "Roll Sanity 6+ để đi qua. Thất bại = dừng lại.",
        "roll_stat": "sanity",
        "roll_target": 6
    },
    "chasm": {
        "name": "Chasm",
        "effect": "Roll Speed để không rơi xuống. Thất bại = sát thương.",
        "roll_stat": "speed"
    },
    "vault": {
        "name": "Vault",
        "effect": "Phòng chia 2 vùng. Cần roll để mở khóa.",
        "has_zones": True
    },
    "furnace-room": {
        "name": "Furnace Room",
        "effect": "Kết thúc lượt ở đây = nhận 1 sát thương vật lý.",
        "end_turn_damage": 1
    },
    "coal-chute": {
        "name": "Coal Chute",
        "effect": "Tự động trượt xuống tầng hầm.",
        "auto_slide": "basement"
    },
    "mystic-elevator": {
        "name": "Mystic Elevator",
        "effect": "Roll 1 dice: 0=Basement, 1=Ground, 2=Upper",
        "roll_for_floor": True
    }
}

# Common events for reference
COMMON_EVENTS = {
    "screaming": {
        "name": "Screaming",
        "effect": "Roll Sanity. Thất bại = mất Sanity."
    },
    "lights-out": {
        "name": "Lights Out",
        "effect": "Không thể di chuyển cho đến khi tìm được đèn hoặc gặp đồng đội."
    },
    "rotten-food": {
        "name": "Rotten Food",
        "effect": "Roll Might. Thất bại = mất Might."
    }
}
