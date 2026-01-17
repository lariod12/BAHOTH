"""
Game data loader for Betrayal at House on the Hill.
Provides card lookups and character information for the AI agent.
"""

import json
import re
from pathlib import Path

# Path to JS data files
DATA_DIR = Path(__file__).parent.parent / "src" / "app" / "data"


def parse_js_array(js_content: str, array_name: str) -> list:
    """Parse a JavaScript array export into Python list."""
    # Find the array content
    pattern = rf"export\s+const\s+{array_name}\s*=\s*\[([\s\S]*?)\];"
    match = re.search(pattern, js_content)
    if not match:
        return []

    # This is a simplified parser - for complex JS objects,
    # we'll use a manual approach
    return []


# Pre-parsed card data (extracted from cardsData.js)
ITEMS = {
    "long_vu_thien_than": {
        "name": "Lông vũ thiên thần",
        "text": "Khi đổ xúc xắc với chỉ số bất kì, bạn có thể chọn một số từ 0 đến 8 và sử dụng đó làm kết quả. Hủy bỏ sau khi sử dụng.",
        "usable": True,
        "consumable": True
    },
    "hop_nhac_ma_quai": {
        "name": "Hộp nhạc ma quái",
        "text": "Khi mở, tất cả người chơi và quái vật cùng phòng phải roll Sanity 4+. Thất bại = mất lượt.",
        "usable": True
    },
    "hop_lac_ghep": {
        "name": "Hộp lắp ghép",
        "text": "Roll Knowledge: 6+ = rút 2 Item, hủy hộp. 0-5 = không mở được.",
        "usable": True,
        "roll_stat": "knowledge"
    },
    "kim_tiem_an_than": {
        "name": "Kim tiêm an thần",
        "text": "Trước khi roll, cộng thêm 4 điểm vào kết quả. Hủy bỏ sau khi sử dụng.",
        "usable": True,
        "consumable": True
    },
    "ao_giap": {
        "name": "Áo giáp",
        "text": "Giảm 1 sát thương vật lí. Không thể bị cướp.",
        "passive": True
    },
    "cai_chai": {
        "name": "Cái chai",
        "text": "Roll 3 dice: 6=teleport, 5=+2 Might/Speed, 4=+2 Know/San, 3=+1K/-1S, 2=-2K/S, 1=-2M/Sp, 0=-2 all",
        "usable": True,
        "consumable": True
    },
    "xuc_xac_bong_toi": {
        "name": "Xúc xắc bóng tối",
        "text": "Roll 3 dice với nhiều hiệu ứng khác nhau. 0 = reset all stats về min.",
        "usable": True
    },
    "chiec_chuong": {
        "name": "Chiếc chuông",
        "text": "+1 Sanity khi nhận, -1 khi mất. Roll Sanity 5+ = kéo heroes lại gần.",
        "usable": True,
        "on_gain": "+1 Sanity"
    },
    "muoi_amoniac": {
        "name": "Muối Amoniac",
        "text": "Khôi phục Knowledge về mức khởi điểm cho bạn hoặc người cùng phòng.",
        "usable": True,
        "consumable": True
    },
    "hon_da_may_man": {
        "name": "Hòn đá may mắn",
        "text": "Sau khi roll, có thể roll lại số dice tùy ý.",
        "usable": True,
        "consumable": True
    },
    "dao_gam_hut_mau": {
        "name": "Dao găm hút máu",
        "text": "Vũ khí: Roll thêm dice (tối đa 8) nhưng mất 1 Speed mỗi lần dùng.",
        "weapon": True
    },
    "cay_riu": {
        "name": "Cây rìu",
        "text": "Vũ khí: +1 dice khi roll Might tấn công (tối đa 8).",
        "weapon": True
    },
    "sung_luc": {
        "name": "Súng lục",
        "text": "Vũ khí tầm xa: Tấn công bằng Speed trong tầm nhìn.",
        "weapon": True,
        "ranged": True
    },
    "hop_so_cuu": {
        "name": "Hộp sơ cứu",
        "text": "Hồi phục Might hoặc Speed về mức khởi điểm.",
        "usable": True,
        "consumable": True
    },
    "cay_nen": {
        "name": "Cây nến",
        "text": "Không bị ảnh hưởng bởi sự kiện Lights Out. Combo với Bell + Book.",
        "passive": True
    },
    "cuon_sach": {
        "name": "Cuốn sách",
        "text": "+2 Knowledge khi nhận. Combo với Bell + Candle.",
        "passive": True,
        "on_gain": "+2 Knowledge"
    }
}

EVENTS = {
    "screaming": {
        "name": "Tiếng thét",
        "text": "Roll Sanity. Thất bại = mất Sanity bằng kết quả.",
        "roll_stat": "sanity"
    },
    "lights_out": {
        "name": "Đèn tắt",
        "text": "Không thể di chuyển cho đến khi gặp người khác hoặc tìm được đèn.",
        "restricts_movement": True
    },
    "rotten_food": {
        "name": "Đồ ăn thiu",
        "text": "Roll Might. Thất bại = mất Might.",
        "roll_stat": "might"
    },
    "spider": {
        "name": "Nhện",
        "text": "Roll Speed để thoát. Thất bại = bị cắn, mất Speed.",
        "roll_stat": "speed"
    },
    "ghostly_apparition": {
        "name": "Bóng ma",
        "text": "Roll Sanity 5+. Thất bại = mất 1 Sanity.",
        "roll_stat": "sanity",
        "threshold": 5
    },
    "creepy_crawlies": {
        "name": "Côn trùng bò",
        "text": "Roll Sanity. Mất Sanity = 5 - kết quả (tối thiểu 0).",
        "roll_stat": "sanity"
    },
    "debris": {
        "name": "Đổ nát",
        "text": "Roll Speed. Thất bại = mắc kẹt, phải roll Speed mỗi lượt để thoát.",
        "roll_stat": "speed"
    },
    "mist": {
        "name": "Sương mù",
        "text": "Roll Sanity 4+. Thất bại = bị teleport đến phòng ngẫu nhiên.",
        "roll_stat": "sanity",
        "threshold": 4
    },
    "secret_stairs": {
        "name": "Cầu thang bí mật",
        "text": "Đặt token Secret Stairs vào phòng này và 1 phòng khác tầng khác. "
                "Dùng khi hết bước di chuyển. Khi dùng, rút thêm 1 Event.",
        "effect": "place_token",
        "token_type": "secret_stairs"
    },
    "secret_passage": {
        "name": "Đường bí mật",
        "text": "Roll 3 dice: 6+=any, 4-5=upper, 2-3=ground, 0-1=basement. "
                "Đặt token Secret Passage. Dùng khi hết bước di chuyển.",
        "effect": "place_token",
        "token_type": "secret_passage"
    },
    "bloody_vision": {
        "name": "Thị giác đẫm máu",
        "text": "Roll Sanity 4+. Thất bại = mất 1 Sanity.",
        "roll_stat": "sanity",
        "threshold": 4
    },
    "funeral": {
        "name": "Đám tang",
        "text": "Roll Sanity. 4+ = +1 Sanity. 0-3 = -1 Sanity.",
        "roll_stat": "sanity"
    },
    "image_in_mirror": {
        "name": "Hình ảnh trong gương",
        "text": "Roll Sanity 5+. Thất bại = mất 1 Sanity.",
        "roll_stat": "sanity",
        "threshold": 5
    },
    "locked_safe": {
        "name": "Két sắt",
        "text": "Roll Knowledge 6+. Thành công = rút 2 Item.",
        "roll_stat": "knowledge",
        "threshold": 6
    },
    "night_view": {
        "name": "Cảnh đêm",
        "text": "Roll Knowledge 5+. Thành công = xem 5 room tiles tiếp theo.",
        "roll_stat": "knowledge",
        "threshold": 5
    },
    "phone_call": {
        "name": "Cuộc gọi",
        "text": "Roll 2 dice: 4=+1 Sanity, 2-3=không gì, 0-1=-1 Sanity.",
        "special": True
    },
    "jonah_turn": {
        "name": "Lượt của Jonah",
        "text": "Roll cho 1 chỉ số (người bên phải chọn). Thất bại = -1 chỉ số đó.",
        "special": True
    },
    "grave_dirt": {
        "name": "Đất mộ",
        "text": "Roll Sanity 5+. Thất bại = -1 Sanity, -1 Might.",
        "roll_stat": "sanity",
        "threshold": 5
    },
    "revolving_wall": {
        "name": "Tường xoay",
        "text": "Roll Speed để thoát. Thất bại = bị đẩy sang phòng kế.",
        "roll_stat": "speed"
    },
    "groundskeeper": {
        "name": "Người làm vườn",
        "text": "Roll Knowledge 5+. Thành công = +1 Knowledge.",
        "roll_stat": "knowledge",
        "threshold": 5
    },
    "mystic_slide": {
        "name": "Cầu trượt thần bí",
        "text": "Trượt xuống Basement Landing nếu chưa ở basement.",
        "special": True
    },
    "skeletons": {
        "name": "Bộ xương",
        "text": "Roll Sanity 5+. Thất bại = -1 Sanity, -1 Speed.",
        "roll_stat": "sanity",
        "threshold": 5
    },
    "whoops": {
        "name": "Ối!",
        "text": "Làm rơi 1 item. Item rơi xuống tầng dưới (nếu có).",
        "special": True
    },
    "disquieting_sounds": {
        "name": "Âm thanh quấy rầy",
        "text": "Roll Sanity 4+. Thất bại = -1 Sanity.",
        "roll_stat": "sanity",
        "threshold": 4
    },
    "angry_being": {
        "name": "Sinh vật giận dữ",
        "text": "Roll Speed 4+. Thất bại = mất Might.",
        "roll_stat": "speed",
        "threshold": 4
    },
    "hanged_men": {
        "name": "Người treo cổ",
        "text": "Roll Sanity 5+. Thất bại = -2 Sanity.",
        "roll_stat": "sanity",
        "threshold": 5
    },
    "silence": {
        "name": "Im lặng",
        "text": "Roll Sanity 5+. Thất bại = mất lượt tiếp theo.",
        "roll_stat": "sanity",
        "threshold": 5
    },
    "smoke": {
        "name": "Khói",
        "text": "Roll Speed 4+. Thất bại = -1 Speed.",
        "roll_stat": "speed",
        "threshold": 4
    },
    "spider_web": {
        "name": "Mạng nhện",
        "text": "Roll Might hoặc Speed 4+ để thoát. Bị kẹt đến khi thành công.",
        "roll_stat": "might",
        "threshold": 4
    }
}

OMENS = {
    "vet_can": {
        "name": "Vết cắn",
        "text": "Người bên phải bạn roll 4 dice tấn công bạn bằng Might.",
        "immediate_effect": True
    },
    "mat_na": {
        "name": "Mặt nạ",
        "text": "Đeo: +2 Knowledge, -2 Sanity. Tháo: -2 Knowledge, +2 Sanity.",
        "toggleable": True
    },
    "chiec_nhan": {
        "name": "Chiếc nhẫn",
        "text": "Có thể dùng Sanity thay Might trong chiến đấu.",
        "passive": True
    },
    "cuon_sach_ma": {
        "name": "Cuốn sách ma",
        "text": "+2 Knowledge khi nhận.",
        "on_gain": "+2 Knowledge"
    },
    "qua_cau_thuy_tinh": {
        "name": "Quả cầu thủy tinh",
        "text": "Sau haunt, có thể xem 3 lá bài Event, Item, hoặc Omen.",
        "usable": True
    },
    "co_gai": {
        "name": "Cô gái",
        "text": "Đồng hành. Có thể di chuyển riêng, dùng để scout.",
        "companion": True
    },
    "con_cho": {
        "name": "Con chó",
        "text": "Đồng hành. +1 Might, +1 Sanity. Có thể di chuyển riêng.",
        "companion": True,
        "on_gain": "+1 Might, +1 Sanity"
    },
    "so_dau_lau": {
        "name": "Sọ đầu lâu",
        "text": "Có thể chuyển đổi sát thương tinh thần thành vật lý.",
        "passive": True
    },
    "cay_giao": {
        "name": "Cây giáo",
        "text": "Vũ khí: +2 dice khi roll Might tấn công (tối đa 8).",
        "weapon": True
    }
}

# Character data
CHARACTERS = {
    "professor-longfellow": {
        "name": "Professor Longfellow",
        "color": "white",
        "stats": {
            "speed": {"track": [2, 2, 4, 4, 5, 5, 6, 6], "start": 3},
            "might": {"track": [1, 2, 3, 4, 5, 5, 6, 6], "start": 2},
            "sanity": {"track": [1, 3, 3, 4, 5, 5, 6, 7], "start": 2},
            "knowledge": {"track": [4, 5, 5, 5, 5, 6, 7, 8], "start": 3}
        }
    },
    "madame-zostra": {
        "name": "Madame Zostra",
        "color": "blue",
        "stats": {
            "speed": {"track": [2, 3, 3, 5, 5, 6, 6, 7], "start": 2},
            "might": {"track": [2, 3, 3, 4, 5, 5, 5, 6], "start": 3},
            "sanity": {"track": [4, 4, 4, 5, 6, 7, 8, 8], "start": 2},
            "knowledge": {"track": [1, 3, 4, 4, 4, 5, 6, 6], "start": 3}
        }
    },
    "ox-bellows": {
        "name": "Ox Bellows",
        "color": "blue",
        "stats": {
            "speed": {"track": [2, 2, 2, 3, 4, 5, 5, 6], "start": 4},
            "might": {"track": [4, 5, 5, 6, 6, 7, 8, 8], "start": 2},
            "sanity": {"track": [2, 2, 3, 4, 5, 5, 6, 7], "start": 2},
            "knowledge": {"track": [2, 2, 3, 3, 5, 5, 6, 6], "start": 2}
        }
    },
    "darrin-flash-williams": {
        "name": "Darrin \"Flash\" Williams",
        "color": "yellow",
        "stats": {
            "speed": {"track": [4, 4, 4, 5, 6, 7, 7, 8], "start": 4},
            "might": {"track": [2, 3, 3, 4, 5, 6, 6, 7], "start": 2},
            "sanity": {"track": [1, 2, 3, 4, 5, 5, 5, 7], "start": 2},
            "knowledge": {"track": [2, 3, 3, 4, 5, 5, 5, 7], "start": 2}
        }
    },
    "brandon-jaspers": {
        "name": "Brandon Jaspers",
        "color": "green",
        "stats": {
            "speed": {"track": [3, 4, 4, 4, 4, 5, 6, 7], "start": 2},
            "might": {"track": [2, 3, 3, 4, 5, 6, 6, 7], "start": 3},
            "sanity": {"track": [3, 3, 3, 4, 5, 6, 7, 8], "start": 3},
            "knowledge": {"track": [1, 3, 3, 5, 5, 6, 6, 7], "start": 2}
        }
    },
    "peter-akimoto": {
        "name": "Peter Akimoto",
        "color": "green",
        "stats": {
            "speed": {"track": [3, 3, 3, 4, 6, 6, 7, 7], "start": 3},
            "might": {"track": [2, 3, 3, 4, 5, 5, 6, 8], "start": 2},
            "sanity": {"track": [3, 4, 4, 4, 5, 6, 6, 7], "start": 3},
            "knowledge": {"track": [3, 4, 4, 5, 6, 7, 7, 8], "start": 2}
        }
    },
    "heather-granville": {
        "name": "Heather Granville",
        "color": "red",
        "stats": {
            "speed": {"track": [3, 3, 4, 5, 6, 6, 7, 8], "start": 2},
            "might": {"track": [3, 3, 3, 4, 5, 6, 7, 8], "start": 2},
            "sanity": {"track": [3, 3, 3, 4, 5, 6, 6, 6], "start": 2},
            "knowledge": {"track": [2, 3, 3, 4, 5, 6, 7, 8], "start": 4}
        }
    },
    "jenny-leclerc": {
        "name": "Jenny LeClerc",
        "color": "red",
        "stats": {
            "speed": {"track": [2, 3, 4, 4, 4, 5, 6, 8], "start": 3},
            "might": {"track": [3, 4, 4, 4, 4, 5, 6, 8], "start": 2},
            "sanity": {"track": [1, 1, 2, 4, 4, 4, 5, 6], "start": 4},
            "knowledge": {"track": [2, 3, 3, 4, 4, 5, 6, 8], "start": 3}
        }
    },
    "father-rhinehardt": {
        "name": "Father Rhinehardt",
        "color": "white",
        "stats": {
            "speed": {"track": [2, 3, 3, 4, 5, 6, 7, 7], "start": 2},
            "might": {"track": [1, 2, 2, 4, 4, 5, 5, 7], "start": 2},
            "sanity": {"track": [3, 4, 5, 5, 6, 7, 7, 8], "start": 4},
            "knowledge": {"track": [1, 3, 3, 4, 5, 6, 6, 8], "start": 3}
        }
    },
    "vivian-lopez": {
        "name": "Vivian Lopez",
        "color": "purple",
        "stats": {
            "speed": {"track": [3, 4, 4, 4, 4, 6, 7, 8], "start": 3},
            "might": {"track": [2, 2, 2, 4, 4, 5, 6, 6], "start": 2},
            "sanity": {"track": [4, 4, 4, 5, 6, 7, 8, 8], "start": 2},
            "knowledge": {"track": [4, 5, 5, 5, 5, 6, 6, 7], "start": 3}
        }
    },
    "missy-dubourde": {
        "name": "Missy Dubourde",
        "color": "yellow",
        "stats": {
            "speed": {"track": [3, 4, 5, 6, 6, 6, 7, 7], "start": 2},
            "might": {"track": [2, 3, 3, 3, 4, 5, 6, 7], "start": 3},
            "sanity": {"track": [1, 2, 3, 4, 5, 5, 6, 7], "start": 2},
            "knowledge": {"track": [2, 3, 4, 4, 5, 6, 6, 6], "start": 3}
        }
    },
    "zoe-ingstrom": {
        "name": "Zoe Ingstrom",
        "color": "purple",
        "stats": {
            "speed": {"track": [4, 4, 4, 4, 5, 6, 8, 8], "start": 3},
            "might": {"track": [2, 2, 3, 3, 4, 4, 6, 7], "start": 3},
            "sanity": {"track": [3, 4, 5, 5, 6, 6, 7, 8], "start": 2},
            "knowledge": {"track": [1, 2, 3, 4, 4, 5, 5, 5], "start": 2}
        }
    }
}


def get_card_info(card_name: str) -> dict | None:
    """Look up a card by name (Vietnamese). Supports exact and partial matching."""
    card_name_lower = card_name.lower().strip()

    # First try exact match
    # Search in ITEMS
    for card_id, card in ITEMS.items():
        if card["name"].lower() == card_name_lower:
            return {"type": "item", "id": card_id, **card}

    # Search in EVENTS
    for card_id, card in EVENTS.items():
        if card["name"].lower() == card_name_lower:
            return {"type": "event", "id": card_id, **card}

    # Search in OMENS
    for card_id, card in OMENS.items():
        if card["name"].lower() == card_name_lower:
            return {"type": "omen", "id": card_id, **card}

    # If no exact match, try partial match (contains)
    for card_id, card in ITEMS.items():
        if card_name_lower in card["name"].lower() or card["name"].lower() in card_name_lower:
            return {"type": "item", "id": card_id, **card}

    for card_id, card in EVENTS.items():
        if card_name_lower in card["name"].lower() or card["name"].lower() in card_name_lower:
            return {"type": "event", "id": card_id, **card}

    for card_id, card in OMENS.items():
        if card_name_lower in card["name"].lower() or card["name"].lower() in card_name_lower:
            return {"type": "omen", "id": card_id, **card}

    return None


def get_character_info(character_id: str) -> dict | None:
    """Get character info by ID."""
    return CHARACTERS.get(character_id)


def get_character_stat_value(character_id: str, stat: str, index: int) -> int:
    """Get the value of a stat at a specific index."""
    char = CHARACTERS.get(character_id)
    if not char or stat not in char["stats"]:
        return 0

    track = char["stats"][stat]["track"]
    if 0 <= index < len(track):
        return track[index]
    return 0


def get_character_starting_stat(character_id: str, stat: str) -> int:
    """Get the starting value of a stat."""
    char = CHARACTERS.get(character_id)
    if not char or stat not in char["stats"]:
        return 0

    start_index = char["stats"][stat]["start"]
    return char["stats"][stat]["track"][start_index]


def list_all_items() -> list[str]:
    """List all item names."""
    return [item["name"] for item in ITEMS.values()]


def list_all_events() -> list[str]:
    """List all event names."""
    return [event["name"] for event in EVENTS.values()]


def list_all_omens() -> list[str]:
    """List all omen names."""
    return [omen["name"] for omen in OMENS.values()]


def list_all_characters() -> list[str]:
    """List all character names."""
    return [char["name"] for char in CHARACTERS.values()]


# Room data for navigation (từ mapsData.js)
# doors: trái (left), phải (right), trên (top), dưới (bottom)
# up/down: dùng cho cầu thang lên/xuống tầng
# connects: phòng đã kết nối sẵn theo hướng (không cần rút room)
ROOMS = [
    # ===== STARTING ROOMS (fixed layout, pre-connected) =====
    {
        "id": "entrance-hall",
        "name": "Entrance Hall",
        "name_vi": "Lối vào sảnh chính",
        "floor": "ground",
        "tokens": [],
        "doors": ["top", "left", "right"],
        "connects": {"top": "foyer"},
        "text": "Front door - cannot exit"
    },
    {
        "id": "foyer",
        "name": "Foyer",
        "name_vi": "Sảnh",
        "floor": "ground",
        "tokens": [],
        "doors": ["top", "bottom", "left", "right"],
        "connects": {"bottom": "entrance-hall", "top": "grand-staircase"}
    },
    {
        "id": "grand-staircase",
        "name": "Grand Staircase",
        "name_vi": "Cầu thang lớn",
        "floor": "ground",
        "tokens": [],
        "doors": ["bottom", "up"],
        "connects": {"bottom": "foyer", "up": "upper-landing"},
        "text": "Leads to Upper Landing"
    },
    {
        "id": "upper-landing",
        "name": "Upper Landing",
        "name_vi": "Chiếu nghỉ tầng trên",
        "floor": "upper",
        "tokens": [],
        "doors": ["top", "left", "right", "bottom", "down"],
        "connects": {"down": "grand-staircase"},
        "text": "Stairs to Grand Staircase"
    },
    {
        "id": "basement-landing",
        "name": "Basement Landing",
        "name_vi": "Chiếu nghỉ tầng hầm",
        "floor": "basement",
        "tokens": [],
        "doors": ["top", "left", "right", "bottom"],
        "connects": {"up": "stairs-from-basement"}
    },
    {
        "id": "stairs-from-basement",
        "name": "Stairs From Basement",
        "name_vi": "Cầu thang từ Tầng hầm",
        "floor": "basement",
        "tokens": [],
        "doors": ["top"],
        "connects": {"bottom": "basement-landing"},
        "text": "Leads to and from Foyer"
    },

    # ===== BASEMENT ROOMS =====
    {
        "id": "catacombs",
        "name": "Catacombs",
        "name_vi": "Hầm mộ",
        "floor": "basement",
        "tokens": ["omen"],
        "doors": ["top", "bottom"],
        "text": "Roll Sanity 6+ to cross. Fail = stop moving."
    },
    {
        "id": "furnace-room",
        "name": "Furnace Room",
        "name_vi": "Phòng lò",
        "floor": "basement",
        "tokens": ["omen"],
        "doors": ["top", "bottom", "left"],
        "text": "End turn here = 1 physical damage."
    },
    {
        "id": "chasm",
        "name": "Chasm",
        "name_vi": "Khe vực",
        "floor": "basement",
        "tokens": [],
        "doors": ["left", "right"],
        "text": "Roll Speed 3+ to cross. Fail = stop moving."
    },
    {
        "id": "pentagram-chamber",
        "name": "Pentagram Chamber",
        "name_vi": "Phòng ngũ giác",
        "floor": "basement",
        "tokens": ["omen"],
        "doors": ["top", "right"],
        "text": "Exit: Roll Knowledge 4+. Fail = lose 1 Sanity."
    },
    {
        "id": "underground-lake",
        "name": "Underground Lake",
        "name_vi": "Hồ ngầm",
        "floor": "basement",
        "tokens": ["event"],
        "doors": ["top", "right"]
    },
    {
        "id": "crypt",
        "name": "Crypt",
        "name_vi": "Hầm mộ",
        "floor": "basement",
        "tokens": ["event"],
        "doors": ["top"],
        "text": "End turn here = 1 mental damage."
    },
    {
        "id": "wine-cellar",
        "name": "Wine Cellar",
        "name_vi": "Hầm rượu",
        "floor": "basement",
        "tokens": ["item"],
        "doors": ["top", "bottom"]
    },
    {
        "id": "larder",
        "name": "Larder",
        "name_vi": "Kho thực phẩm",
        "floor": "basement",
        "tokens": ["item"],
        "doors": ["top"],
        "text": "Once per game, end turn here = +1 Might."
    },

    # ===== GROUND ROOMS =====
    {
        "id": "patio",
        "name": "Patio",
        "name_vi": "Sân hiên",
        "floor": "ground",
        "tokens": ["event"],
        "doors": ["top", "bottom", "left"]
    },
    {
        "id": "gardens",
        "name": "Gardens",
        "name_vi": "Vườn",
        "floor": "ground",
        "tokens": ["event"],
        "doors": ["top", "bottom"]
    },
    {
        "id": "coal-chute",
        "name": "Coal Chute",
        "name_vi": "Ống than",
        "floor": "ground",
        "tokens": [],
        "doors": ["top"],
        "text": "One-way slide to Basement Landing."
    },
    {
        "id": "dining-room",
        "name": "Dining Room",
        "name_vi": "Phòng ăn",
        "floor": "ground",
        "tokens": ["omen"],
        "doors": ["top", "right"]
    },
    {
        "id": "graveyard",
        "name": "Graveyard",
        "name_vi": "Nghĩa địa",
        "floor": "ground",
        "tokens": ["event"],
        "doors": ["bottom"],
        "text": "Exit: Roll Sanity 4+. Fail = lose 1 Knowledge."
    },
    {
        "id": "ballroom",
        "name": "Ballroom",
        "name_vi": "Phòng khiêu vũ",
        "floor": "ground",
        "tokens": ["event"],
        "doors": ["top", "bottom", "left", "right"]
    },
    {
        "id": "kitchen",
        "name": "Kitchen",
        "name_vi": "Nhà bếp",
        "floor": "ground",
        "tokens": ["omen"],
        "doors": ["top", "right"]
    },

    # ===== MULTI-FLOOR ROOMS (basement/ground/upper) =====
    {
        "id": "vault",
        "name": "Vault",
        "name_vi": "Hầm két",
        "floor": "any",
        "tokens": ["event", "item", "item"],
        "doors": ["top"],
        "text": "Roll Knowledge 6+ to open vault."
    },
    {
        "id": "research-laboratory",
        "name": "Research Laboratory",
        "name_vi": "Phòng thí nghiệm nghiên cứu",
        "floor": "any",
        "tokens": ["event"],
        "doors": ["top", "bottom"]
    },
    {
        "id": "operating-laboratory",
        "name": "Operating Laboratory",
        "name_vi": "Phòng thí nghiệm phẫu thuật",
        "floor": "any",
        "tokens": ["event"],
        "doors": ["right", "bottom"]
    },
    {
        "id": "mystic-elevator",
        "name": "Mystic Elevator",
        "name_vi": "Thang máy huyền bí",
        "floor": "any",
        "tokens": [],
        "doors": ["top"],
        "text": "Roll 2 dice: 4=any floor, 3=upper, 2=ground, 1=basement, 0=basement+dmg"
    },
    {
        "id": "creaky-hallway",
        "name": "Creaky Hallway",
        "name_vi": "Hành lang kẽo kẹt",
        "floor": "any",
        "tokens": [],
        "doors": ["top", "left", "right", "bottom"]
    },
    {
        "id": "dusty-hallway",
        "name": "Dusty Hallway",
        "name_vi": "Hành lang bụi bặm",
        "floor": "any",
        "tokens": [],
        "doors": ["top", "left", "right", "bottom"]
    },
    {
        "id": "junk-room",
        "name": "Junk Room",
        "name_vi": "Phòng đồ đạc",
        "floor": "any",
        "tokens": ["omen"],
        "doors": ["top", "left", "right", "bottom"],
        "text": "Exit: Roll Might 3+. Fail = lose 1 Speed."
    },
    {
        "id": "statuary-corridor",
        "name": "Statuary Corridor",
        "name_vi": "Hành lang tượng",
        "floor": "any",
        "tokens": ["event"],
        "doors": ["top", "bottom"]
    },
    {
        "id": "game-room",
        "name": "Game Room",
        "name_vi": "Phòng giải trí",
        "floor": "any",
        "tokens": ["event"],
        "doors": ["top", "right", "bottom", "left"]
    },
    {
        "id": "organ-room",
        "name": "Organ Room",
        "name_vi": "Phòng đàn organ",
        "floor": "any",
        "tokens": ["event"],
        "doors": ["left", "bottom"]
    },

    # ===== UPPER ONLY =====
    {
        "id": "gymnasium",
        "name": "Gymnasium",
        "name_vi": "Phòng thể dục",
        "floor": "upper",
        "tokens": ["omen"],
        "doors": ["right", "bottom"],
        "text": "Once per game, end turn here = +1 Speed."
    },
    {
        "id": "storeroom",
        "name": "Storeroom",
        "name_vi": "Kho chứa",
        "floor": "upper",
        "tokens": ["item"],
        "doors": ["top"]
    },
    {
        "id": "servants-quarters",
        "name": "Servants' Quarters",
        "name_vi": "Phòng ở người hầu",
        "floor": "upper",
        "tokens": ["omen"],
        "doors": ["left", "right", "bottom"]
    },

    # ===== GROUND + UPPER =====
    {
        "id": "chapel",
        "name": "Chapel",
        "name_vi": "Nhà nguyện",
        "floor": "ground_upper",
        "tokens": ["event"],
        "doors": ["top"],
        "text": "Once per game, end turn here = +1 Sanity."
    },
    {
        "id": "charred-room",
        "name": "Charred Room",
        "name_vi": "Phòng cháy xém",
        "floor": "ground_upper",
        "tokens": ["omen"],
        "doors": ["top", "left", "right", "bottom"]
    },
    {
        "id": "collapsed-room",
        "name": "Collapsed Room",
        "name_vi": "Phòng sụp",
        "floor": "ground_upper",
        "tokens": [],
        "doors": ["top", "left", "right", "bottom"],
        "text": "Roll Speed 5+ or fall to basement + 1 die physical dmg."
    },
    {
        "id": "conservatory",
        "name": "Conservatory",
        "name_vi": "Nhà kính",
        "floor": "ground_upper",
        "tokens": ["event"],
        "doors": ["top"]
    },
    {
        "id": "abandoned-room",
        "name": "Abandoned Room",
        "name_vi": "Phòng bỏ hoang",
        "floor": "ground_upper",
        "tokens": ["omen"],
        "doors": ["top", "left", "right", "bottom"]
    },
    {
        "id": "bloody-room",
        "name": "Bloody Room",
        "name_vi": "Phòng đẫm máu",
        "floor": "ground_upper",
        "tokens": ["item"],
        "doors": ["top", "left", "right", "bottom"]
    },
    {
        "id": "bedroom",
        "name": "Bedroom",
        "name_vi": "Phòng ngủ",
        "floor": "upper",
        "tokens": ["event"],
        "doors": ["left", "right", "bottom"]
    },
    {
        "id": "master-bedroom",
        "name": "Master Bedroom",
        "name_vi": "Phòng ngủ chính",
        "floor": "upper",
        "tokens": ["omen"],
        "doors": ["top", "left", "bottom"]
    },
    {
        "id": "gallery",
        "name": "Gallery",
        "name_vi": "Phòng trưng bày",
        "floor": "upper",
        "tokens": ["omen"],
        "doors": ["top", "bottom"],
        "text": "Can fall to Ballroom if in house = 1 die physical dmg."
    },
    {
        "id": "tower",
        "name": "Tower",
        "name_vi": "Tháp",
        "floor": "upper",
        "tokens": ["event"],
        "doors": ["left", "right"],
        "text": "Roll Might 3+ to cross. Fail = stop moving."
    },
    {
        "id": "attic",
        "name": "Attic",
        "name_vi": "Gác mái",
        "floor": "upper",
        "tokens": ["event"],
        "doors": ["bottom"],
        "text": "Exit: Roll Speed 3+. Fail = lose 1 Might."
    },
    {
        "id": "balcony",
        "name": "Balcony",
        "name_vi": "Ban công",
        "floor": "upper",
        "tokens": ["omen"],
        "doors": ["top", "bottom"]
    },
]


def get_room_by_id(room_id: str) -> dict | None:
    """Get room info by ID."""
    for room in ROOMS:
        if room["id"] == room_id:
            return room
    return None


def get_room_by_name(name: str) -> dict | None:
    """Get room info by name (English or Vietnamese, case insensitive)."""
    name_lower = name.lower().strip()
    # Exact match first
    for room in ROOMS:
        if room["name"].lower() == name_lower:
            return room
        if room.get("name_vi", "").lower() == name_lower:
            return room
    # Partial match
    for room in ROOMS:
        if name_lower in room["name"].lower():
            return room
        if name_lower in room.get("name_vi", "").lower():
            return room
    return None


def list_all_rooms() -> list[dict]:
    """Get all rooms."""
    return ROOMS


def list_rooms_by_floor(floor: str) -> list[dict]:
    """Get rooms for a specific floor."""
    return [r for r in ROOMS if r["floor"] == floor or r["floor"] == "any"]


if __name__ == "__main__":
    # Test the data
    print("=== Items ===")
    for name in list_all_items()[:5]:
        print(f"  - {name}")

    print("\n=== Events ===")
    for name in list_all_events()[:5]:
        print(f"  - {name}")

    print("\n=== Omens ===")
    for name in list_all_omens()[:5]:
        print(f"  - {name}")

    print("\n=== Characters ===")
    for name in list_all_characters():
        print(f"  - {name}")

    print("\n=== Rooms ===")
    for room in list_all_rooms()[:10]:
        tokens = ", ".join(room["tokens"]) if room["tokens"] else "none"
        print(f"  - {room['name']} ({room['floor']}) - tokens: {tokens}")

    # Test lookup
    print("\n=== Card Lookup Test ===")
    card = get_card_info("Áo giáp")
    if card:
        print(f"Found: {card['name']} - {card['text']}")
