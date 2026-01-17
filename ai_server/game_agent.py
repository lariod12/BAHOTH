"""
AI Game Agent for Betrayal at House on the Hill.
Interactive CLI agent that plays the game with minimal input from user.
"""

import json
import os
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

from game_rules import GAME_RULES
from game_data import (
    get_card_info,
    list_all_rooms,
    get_room_by_id,
    CHARACTERS,
    list_all_items,
    list_all_events,
    list_all_omens,
)

# Load environment
script_dir = Path(__file__).parent
env_path = script_dir / ".env"
load_dotenv(dotenv_path=env_path, override=True, encoding="utf-8-sig")

API_URL = os.getenv("API_URL", "http://localhost:1234/v1/chat/completions")
MODELS_URL = os.getenv("MODELS_URL", "http://localhost:1234/v1/models")
MODEL_NAME = os.getenv("MODEL_NAME", "")
HISTORY_FILE = script_dir / "game_history.json"

# System prompt for the AI
SYSTEM_PROMPT = f"""Bạn là AI Game Agent cho Betrayal at House on the Hill.
Bạn đang chơi game cùng với người chơi thật và cần đưa ra quyết định chiến thuật.

{GAME_RULES}

## Cách bạn hoạt động:
1. Bạn là 1 trong các người chơi trong game (duy nhất 1 AI)
2. Bạn tự quyết định hướng di chuyển qua CỬA CÓ SẴN của phòng hiện tại
3. User cung cấp kết quả ngẫu nhiên: room rút được, thẻ rút được, dice roll

## Quy tắc trả lời QUAN TRỌNG:
Khi đưa ra quyết định trong lượt, BẮT BUỘC phải trả lời theo format JSON:

1. Di chuyển đến phòng đã khám phá (qua cửa đã kết nối):
{{"action": "move_to", "target_room": "room-id", "reason": "lý do"}}

2. Khám phá cửa mới (chưa có phòng - rút room ngẫu nhiên):
{{"action": "explore", "direction": "left/right/top/bottom/up/down", "reason": "lý do"}}

3. Sử dụng item:
{{"action": "use_item", "item": "tên item", "reason": "lý do"}}

4. Kết thúc lượt:
{{"action": "end_turn", "reason": "lý do"}}

## Hướng di chuyển (chỉ đi qua CỬA có sẵn):
- left: Cửa bên trái
- right: Cửa bên phải
- top: Cửa phía trên
- bottom: Cửa phía dưới
- up: Cầu thang lên tầng trên
- down: Cầu thang xuống tầng dưới

## Lưu ý QUAN TRỌNG:
- CHỈ được di chuyển qua CỬA có sẵn của phòng hiện tại
- Nếu cửa đó chưa có phòng → dùng "explore" để rút room mới
- Nếu cửa đó đã nối với phòng khác → dùng "move_to"
- Luôn đưa ra lý do chiến thuật ngắn gọn

## Phòng mặc định (đã kết nối sẵn - không cần rút room):
- Entrance Hall (tầng trệt) → Foyer (đi lên trên/top)
- Foyer (tầng trệt) → Entrance Hall (xuống/bottom), Grand Staircase (lên/top)
- Grand Staircase (tầng trệt) → Foyer (xuống/bottom), Upper Landing (lên tầng/up)
- Upper Landing (tầng trên) → Grand Staircase (xuống tầng/down)
- Basement Landing + Stairs From Basement (tầng hầm) → cũng kết nối sẵn"""


class GameAgent:
    """AI Agent that plays Betrayal at House on the Hill."""

    def __init__(self):
        self.session_id = str(uuid.uuid4())[:8]
        self.model_name = MODEL_NAME
        self.messages = []
        self.game_state = {
            "phase": "setup",
            "total_players": 0,
            "agent_position": 0,  # Turn order position (1-based)
            "agent_character": None,
            "turn_number": 0,
            "agent_stats": {
                "speed": {"index": 0, "value": 0},
                "might": {"index": 0, "value": 0},
                "sanity": {"index": 0, "value": 0},
                "knowledge": {"index": 0, "value": 0},
            },
            "agent_items": [],
            "agent_omens": [],
            "agent_room": "entrance-hall",
            "agent_floor": "ground",
            "haunt_started": False,
            "is_traitor": False,
            # Other players info
            "other_players": [],  # [{name, character, room, floor}]
            # Discovered rooms for quick selection (default rooms are pre-connected)
            "discovered_rooms": ["entrance-hall", "foyer", "grand-staircase", "upper-landing"],
        }
        self.turn_history = []
        self.current_turn_actions = []

        # Load existing history if exists
        self._load_history()

    def _load_history(self):
        """Load game history from file if exists."""
        if HISTORY_FILE.exists():
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if data.get("session_id"):
                        print(f"Tìm thấy game đang chơi (session: {data['session_id']})")
                        choice = input("Tiếp tục game cũ? (Y/N): ").strip().upper()
                        if choice == "Y":
                            self.session_id = data["session_id"]
                            self.game_state = data.get("game_state", self.game_state)
                            self.turn_history = data.get("turn_history", [])
                            print("Đã load game state.")
                            return
            except Exception as e:
                print(f"Lỗi đọc history: {e}")

    def save_history(self):
        """Save game state to JSON file."""
        data = {
            "session_id": self.session_id,
            "saved_at": datetime.now().isoformat(),
            "game_state": self.game_state,
            "turn_history": self.turn_history,
        }
        try:
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Lỗi lưu history: {e}")

    def fetch_models(self) -> list[str]:
        """Fetch available models from LM Studio."""
        try:
            resp = requests.get(MODELS_URL, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                return [m.get("id") for m in data.get("data", []) if m.get("id")]
        except Exception as e:
            print(f"Lỗi kết nối LM Studio: {e}")
        return []

    def select_model(self, models: list[str]) -> str | None:
        """Let user select a model."""
        if not models:
            return None

        if self.model_name and self.model_name in models:
            return self.model_name

        print("\nChọn model:")
        for i, model in enumerate(models, 1):
            print(f"  {i}. {model}")

        while True:
            try:
                choice = input("\nNhập số: ").strip()
                if not choice:
                    return models[0]
                idx = int(choice) - 1
                if 0 <= idx < len(models):
                    return models[idx]
            except ValueError:
                pass
            except (EOFError, KeyboardInterrupt):
                return None
            print("Số không hợp lệ.")

    def call_llm(self, user_message: str, show_thinking: bool = True) -> str:
        """Call LM Studio API with the message."""
        import threading
        import time

        self.messages.append({"role": "user", "content": user_message})

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                *self.messages,
            ],
            "temperature": 0.7,
            "max_tokens": 500,
        }

        # Thinking indicator
        thinking_done = threading.Event()

        def show_thinking_indicator():
            symbols = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
            idx = 0
            elapsed = 0
            while not thinking_done.is_set():
                print(f"\r🧠 AI đang suy nghĩ {symbols[idx]} ({elapsed}s)", end="", flush=True)
                idx = (idx + 1) % len(symbols)
                time.sleep(0.1)
                elapsed = round(elapsed + 0.1, 1)
            print("\r" + " " * 40 + "\r", end="", flush=True)  # Clear line

        thinking_thread = None
        if show_thinking:
            thinking_thread = threading.Thread(target=show_thinking_indicator)
            thinking_thread.start()

        try:
            resp = requests.post(API_URL, json=payload, timeout=180)  # 3 minutes
            thinking_done.set()
            if thinking_thread:
                thinking_thread.join()

            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                    if content:
                        self.messages.append({"role": "assistant", "content": content})
                        return content
            return f"[Lỗi API: {resp.status_code}]"
        except requests.exceptions.ConnectionError:
            thinking_done.set()
            if thinking_thread:
                thinking_thread.join()
            return "[Lỗi: Không kết nối được LM Studio]"
        except Exception as e:
            thinking_done.set()
            if thinking_thread:
                thinking_thread.join()
            return f"[Lỗi: {e}]"

    def ask_yes_no(self, question: str) -> bool:
        """Ask a yes/no question."""
        print(f"\n{question}")
        while True:
            answer = input("(Y/N): ").strip().upper()
            if answer in ("Y", "YES", "1"):
                return True
            if answer in ("N", "NO", "0"):
                return False
            print("Nhập Y hoặc N.")

    def ask_option(self, question: str, options: list[str], allow_other: bool = False) -> int:
        """Ask user to select an option. Returns 0-based index. -1 if 'other'."""
        print(f"\n{question}")
        for i, opt in enumerate(options, 1):
            print(f"  {i}. {opt}")
        if allow_other:
            print(f"  0. Khác (nhập tên)")

        while True:
            try:
                answer = input("Chọn số: ").strip()
                if allow_other and answer == "0":
                    return -1
                idx = int(answer) - 1
                if 0 <= idx < len(options):
                    return idx
            except ValueError:
                pass
            max_opt = len(options) if not allow_other else f"0-{len(options)}"
            print(f"Nhập số từ 1-{len(options)}." if not allow_other else f"Nhập số từ {max_opt}.")

    def ask_number(self, question: str, min_val: int = 0, max_val: int = 12) -> int:
        """Ask user to input a number (e.g., dice roll)."""
        print(f"\n{question}")
        while True:
            try:
                answer = input(f"({min_val}-{max_val}): ").strip()
                num = int(answer)
                if min_val <= num <= max_val:
                    return num
            except ValueError:
                pass
            print(f"Nhập số từ {min_val}-{max_val}.")

    def ask_text(self, question: str) -> str:
        """Ask user to input text."""
        print(f"\n{question}")
        return input("> ").strip()

    def ask_room(self, question: str, include_new: bool = True) -> str:
        """Ask user to select a room from discovered rooms or enter new."""
        discovered = self.game_state["discovered_rooms"]

        print(f"\n{question}")
        print("Phòng đã khám phá:")
        for i, room_id in enumerate(discovered, 1):
            room = get_room_by_id(room_id)
            name = room["name"] if room else room_id
            print(f"  {i}. {name}")

        if include_new:
            print(f"  0. Phòng mới (chưa khám phá)")

        while True:
            try:
                answer = input("Chọn số: ").strip()
                if include_new and answer == "0":
                    # Show all rooms to pick
                    return self._select_new_room()
                idx = int(answer) - 1
                if 0 <= idx < len(discovered):
                    return discovered[idx]
            except ValueError:
                pass
            print(f"Nhập số từ {'0' if include_new else '1'}-{len(discovered)}.")

    def _select_new_room(self) -> str:
        """Select a new room from the full list."""
        all_rooms = list_all_rooms()
        discovered = set(self.game_state["discovered_rooms"])

        # Filter out already discovered
        available = [r for r in all_rooms if r["id"] not in discovered]

        print("\nChọn phòng mới:")
        for i, room in enumerate(available, 1):
            tokens = ", ".join(room["tokens"]) if room["tokens"] else "none"
            special = f" ({room['special']})" if room.get("special") else ""
            print(f"  {i}. {room['name']} [{room['floor']}] - {tokens}{special}")

        while True:
            try:
                answer = input("Chọn số: ").strip()
                idx = int(answer) - 1
                if 0 <= idx < len(available):
                    room_id = available[idx]["id"]
                    # Add to discovered
                    self.game_state["discovered_rooms"].append(room_id)
                    return room_id
            except ValueError:
                pass
            print(f"Nhập số từ 1-{len(available)}.")

    def setup_game(self):
        """Setup game with initial questions."""
        print("\n" + "=" * 50)
        print("BETRAYAL AT HOUSE ON THE HILL - AI AGENT")
        print("=" * 50)

        # Total players
        self.game_state["total_players"] = self.ask_number(
            "Có bao nhiêu người chơi (bao gồm cả AI)?", 3, 6
        )
        total = self.game_state["total_players"]
        other_count = total - 1  # Excluding AI

        # Agent's position in turn order
        self.game_state["agent_position"] = self.ask_number(
            f"AI đứng thứ mấy trong turn order? (1-{total})",
            1,
            total,
        )

        # Character selection for AI
        print("\n--- CHỌN NHÂN VẬT CHO AI ---")
        char_list = list(CHARACTERS.keys())
        char_names = [CHARACTERS[c]["name"] for c in char_list]
        char_idx = self.ask_option("AI chơi nhân vật nào?", char_names)
        self.game_state["agent_character"] = char_list[char_idx]
        used_chars = {char_list[char_idx]}

        # Initialize AI stats
        char_id = self.game_state["agent_character"]
        for stat in ["speed", "might", "sanity", "knowledge"]:
            start_idx = CHARACTERS[char_id]["stats"][stat]["start"]
            start_val = CHARACTERS[char_id]["stats"][stat]["track"][start_idx]
            self.game_state["agent_stats"][stat] = {
                "index": start_idx,
                "value": start_val,
            }

        # Other players info
        print(f"\n--- THÔNG TIN {other_count} NGƯỜI CHƠI KHÁC ---")
        self.game_state["other_players"] = []

        for i in range(other_count):
            print(f"\n[Người chơi {i + 1}]")
            name = self.ask_text("Tên người chơi?")

            # Filter out used characters
            available_chars = [(k, v) for k, v in CHARACTERS.items() if k not in used_chars]
            available_names = [v["name"] for _, v in available_chars]
            char_idx = self.ask_option(f"{name} chơi nhân vật nào?", available_names)
            player_char = available_chars[char_idx][0]
            used_chars.add(player_char)

            self.game_state["other_players"].append({
                "name": name,
                "character": player_char,
                "character_name": CHARACTERS[player_char]["name"],
                "room": "entrance-hall",
                "floor": "ground",
            })

        self.game_state["phase"] = "exploration"
        self.save_history()

        # Print summary
        print(f"\n{'='*50}")
        print("✓ GAME SETUP HOÀN TẤT!")
        print(f"{'='*50}")
        print(f"\n[AI - Vị trí {self.game_state['agent_position']}]")
        print(f"  Nhân vật: {CHARACTERS[char_id]['name']}")
        stats = self.game_state["agent_stats"]
        print(f"  Stats: Speed={stats['speed']['value']}, Might={stats['might']['value']}, "
              f"Sanity={stats['sanity']['value']}, Knowledge={stats['knowledge']['value']}")

        print(f"\n[Người chơi khác]")
        for p in self.game_state["other_players"]:
            print(f"  - {p['name']}: {p['character_name']}")

    def wait_for_turn(self) -> bool:
        """Wait for agent's turn. Returns True if it's agent's turn."""
        if self.ask_yes_no("Đã đến lượt của AI chưa?"):
            return True
        return False

    def update_other_players(self):
        """Quick update on other players' positions."""
        if self.ask_yes_no("Cập nhật vị trí người chơi khác?"):
            for p in self.game_state["other_players"]:
                print(f"\n[{p['name']} - {p['character_name']}]")
                print(f"  Phòng hiện tại: {p['room']}")
                if self.ask_yes_no("Đã di chuyển?"):
                    new_room = self.ask_room(f"{p['name']} đang ở phòng nào?")
                    p["room"] = new_room
                    room_info = get_room_by_id(new_room)
                    if room_info:
                        p["floor"] = room_info["floor"]

    def _parse_ai_decision(self, response: str) -> dict | None:
        """Parse AI's JSON decision from response."""
        # Try to find JSON in response
        json_match = re.search(r'\{[^{}]*"action"[^{}]*\}', response, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        return None

    def play_turn(self):
        """Play a single turn - AI decides all actions autonomously."""
        self.game_state["turn_number"] += 1
        turn_num = self.game_state["turn_number"]
        self.current_turn_actions = []

        char_name = CHARACTERS[self.game_state["agent_character"]]["name"]
        print(f"\n{'='*50}")
        print(f"LƯỢT {turn_num} - {char_name}")
        print(f"{'='*50}")

        # Show current state
        stats = self.game_state["agent_stats"]
        current_room = self.game_state["agent_room"]
        room_info = get_room_by_id(current_room)
        room_name = room_info["name"] if room_info else current_room

        print(f"\n📍 Phòng: {room_name} ({self.game_state['agent_floor']})")
        print(f"📊 Stats: Speed={stats['speed']['value']}, Might={stats['might']['value']}, "
              f"Sanity={stats['sanity']['value']}, Knowledge={stats['knowledge']['value']}")
        if self.game_state["agent_items"]:
            print(f"🎒 Items: {', '.join(self.game_state['agent_items'])}")
        if self.game_state["agent_omens"]:
            print(f"⚠️ Omens: {', '.join(self.game_state['agent_omens'])}")

        # Update other players (optional - can skip)
        self.update_other_players()

        # Build discovered rooms context (only rooms AI knows about)
        discovered_rooms = self.game_state["discovered_rooms"]
        room_context = "Phòng đã khám phá:\n"
        for room_id in discovered_rooms:
            room = get_room_by_id(room_id)
            if room:
                tokens = f" [{', '.join(room['tokens'])}]" if room.get('tokens') else ""
                doors = f" - cửa: {', '.join(room.get('doors', []))}" if room.get('doors') else ""
                room_context += f"  - {room_id}: {room['name']} ({room['floor']}){tokens}{doors}\n"

        # Build other players context
        other_players_info = "\n".join([
            f"  - {p['name']} ({p['character_name']}): {p['room']}"
            for p in self.game_state["other_players"]
        ])

        # Direction translation for display
        dir_vn = {"left": "trái", "right": "phải", "top": "trên", "bottom": "dưới", "up": "lên tầng", "down": "xuống tầng"}

        # AI movement loop
        speed = stats["speed"]["value"]
        moves_left = speed
        self.current_turn_actions.append({"type": "start", "room": current_room})

        while moves_left > 0:
            # Build context for this decision
            current_room_info = get_room_by_id(self.game_state["agent_room"])
            current_room_name = current_room_info["name"] if current_room_info else self.game_state["agent_room"]
            current_doors = current_room_info.get("doors", []) if current_room_info else []
            doors_str = ", ".join([dir_vn.get(d, d) for d in current_doors])

            decision_context = f"""
Lượt {turn_num}. Tôi là {char_name}.
Phòng hiện tại: {current_room_name} ({self.game_state['agent_floor']})
Cửa có sẵn: [{doors_str}]
Số bước còn lại: {moves_left}/{speed}
Items: {', '.join(self.game_state['agent_items']) or 'Không có'}
Omens: {', '.join(self.game_state['agent_omens']) or 'Không có'}
Haunt: {'Đã bắt đầu' if self.game_state['haunt_started'] else 'Chưa'}

Người chơi khác:
{other_players_info}

{room_context}

Quyết định hành động tiếp theo. CHỈ được đi qua cửa: [{', '.join(current_doors)}]
Trả lời ĐÚNG format JSON:
- Khám phá cửa mới: {{"action": "explore", "direction": "left/right/top/bottom/up/down", "reason": "..."}}
- Di chuyển đến phòng đã khám phá: {{"action": "move_to", "target_room": "room-id", "reason": "..."}}
- Dùng item: {{"action": "use_item", "item": "tên item", "reason": "..."}}
- Kết thúc: {{"action": "end_turn", "reason": "..."}}
"""
            response = self.call_llm(decision_context)
            print(f"\n🤖 AI: {response}")

            # Parse decision
            decision = self._parse_ai_decision(response)

            if not decision:
                print("⚠️ Không parse được quyết định, kết thúc lượt.")
                break

            action = decision.get("action", "end_turn")
            reason = decision.get("reason", "")

            # Handle move_to (to discovered room)
            if action == "move_to" or action == "move":
                target_room = decision.get("target_room", "")

                # Check if room is discovered
                if target_room not in self.game_state["discovered_rooms"]:
                    # Try to find by name
                    from game_data import get_room_by_name
                    room_info = get_room_by_name(target_room)
                    if room_info and room_info["id"] in self.game_state["discovered_rooms"]:
                        target_room = room_info["id"]
                    else:
                        print(f"⚠️ Phòng '{target_room}' chưa được khám phá. Dùng 'explore' để mở cửa mới.")
                        continue

                room_info = get_room_by_id(target_room)
                if room_info:
                    room_name = room_info["name"]
                    self.game_state["agent_room"] = target_room
                    self.game_state["agent_floor"] = room_info["floor"]
                    moves_left -= 1
                    self.current_turn_actions.append({"type": "move_to", "to": target_room})
                    print(f"✓ Di chuyển đến {room_name} ({reason})")
                else:
                    print(f"⚠️ Không tìm thấy phòng '{target_room}'")

            # Handle explore (discover new room)
            elif action == "explore":
                direction = decision.get("direction", "left")

                # Validate direction against available doors
                current_room_info = get_room_by_id(self.game_state["agent_room"])
                current_doors = current_room_info.get("doors", []) if current_room_info else []

                if direction not in current_doors:
                    print(f"⚠️ Phòng hiện tại không có cửa hướng '{direction}'. Cửa có sẵn: {current_doors}")
                    continue

                # Vietnamese direction for display
                dir_display = dir_vn.get(direction, direction)
                print(f"🚪 Từ {current_room_name}, đi về hướng {dir_display} ({reason})")

                # Check if this direction has a pre-connected room (default rooms)
                connects = current_room_info.get("connects", {}) if current_room_info else {}
                if direction in connects:
                    # Pre-connected room - no need to draw
                    connected_room_id = connects[direction]
                    room_info = get_room_by_id(connected_room_id)
                    if room_info:
                        room_name = room_info["name"]
                        print(f"✓ Đi đến phòng kết nối sẵn: {room_name}")

                        # Add to discovered if not already
                        if connected_room_id not in self.game_state["discovered_rooms"]:
                            self.game_state["discovered_rooms"].append(connected_room_id)

                        # Move to connected room
                        self.game_state["agent_room"] = connected_room_id
                        self.game_state["agent_floor"] = room_info["floor"]
                        moves_left -= 1
                        self.current_turn_actions.append({
                            "type": "move_connected",
                            "direction": direction,
                            "room": connected_room_id
                        })

                        # Handle token if room has one (default rooms usually don't)
                        if room_info.get("tokens"):
                            token_options = room_info["tokens"]
                            unique_tokens = list(set(token_options))
                            if len(unique_tokens) == 1:
                                token_type = unique_tokens[0]
                                print(f"📦 Phòng có token [{token_type.upper()}] - rút thẻ...")
                            else:
                                token_idx = self.ask_option(
                                    f"Phòng có nhiều loại token, chọn:",
                                    [t.capitalize() for t in unique_tokens]
                                )
                                token_type = unique_tokens[token_idx]

                            self._handle_token_draw(token_type)
                            moves_left = 0  # Must stop after drawing

                        continue  # Continue to next move decision

                # No pre-connection - ask user what room was drawn
                room_name_input = self.ask_text("Rút được room gì? (nhập tên room):")

                # Find room info
                from game_data import get_room_by_name
                room_info = get_room_by_name(room_name_input)

                if not room_info:
                    # Try partial match
                    all_rooms = list_all_rooms()
                    for r in all_rooms:
                        if room_name_input.lower() in r["name"].lower():
                            room_info = r
                            break

                if room_info:
                    new_room_id = room_info["id"]
                    room_name = room_info["name"]

                    # Add to discovered rooms
                    if new_room_id not in self.game_state["discovered_rooms"]:
                        self.game_state["discovered_rooms"].append(new_room_id)

                    # Move to new room
                    self.game_state["agent_room"] = new_room_id
                    self.game_state["agent_floor"] = room_info["floor"]
                    moves_left -= 1
                    self.current_turn_actions.append({
                        "type": "explore",
                        "direction": direction,
                        "room": new_room_id
                    })

                    print(f"✓ Vào phòng mới: {room_name} ({room_info['floor']})")

                    # Handle token if room has one
                    if room_info.get("tokens"):
                        token_options = room_info["tokens"]
                        unique_tokens = list(set(token_options))
                        if len(unique_tokens) == 1:
                            token_type = unique_tokens[0]
                            print(f"📦 Phòng có token [{token_type.upper()}] - rút thẻ...")
                        else:
                            token_idx = self.ask_option(
                                f"Phòng có nhiều loại token, chọn:",
                                [t.capitalize() for t in unique_tokens]
                            )
                            token_type = unique_tokens[token_idx]

                        self._handle_token_draw(token_type)
                        moves_left = 0  # Must stop after drawing

                    # Check special room effect
                    if room_info.get("special"):
                        print(f"⚠️ Phòng đặc biệt: {room_info['special']}")
                        self._handle_special_room(room_info)
                else:
                    print(f"⚠️ Không tìm thấy room '{room_name_input}' trong database")
                    # Still count as a move but don't update position
                    moves_left -= 1

            elif action == "use_item":
                item_name = decision.get("item", "")
                if item_name in self.game_state["agent_items"]:
                    self._use_item(item_name)
                else:
                    print(f"⚠️ Không có item '{item_name}'")

            elif action == "end_turn":
                print(f"✓ Kết thúc di chuyển ({reason})")
                break

        # End turn
        self._end_turn()

    def _handle_special_room(self, room_info: dict):
        """Handle special room effects that may require dice rolls."""
        special = room_info.get("special", "")
        room_name = room_info["name"]

        if "Roll" in special:
            # Extract stat from special text
            stat = None
            if "Speed" in special:
                stat = "speed"
            elif "Sanity" in special:
                stat = "sanity"
            elif "Might" in special:
                stat = "might"
            elif "Knowledge" in special:
                stat = "knowledge"

            if stat:
                stat_val = self.game_state["agent_stats"][stat]["value"]
                roll_result = self.ask_number(
                    f"Roll {stat.capitalize()} ({stat_val} dice) cho {room_name} - kết quả?",
                    0, stat_val * 2
                )
                self.current_turn_actions.append({
                    "type": "room_roll",
                    "room": room_info["id"],
                    "stat": stat,
                    "result": roll_result,
                })

                # Let AI interpret result
                interpret_context = f"Roll {stat} = {roll_result} cho phòng {room_name} ({special}). Kết quả?"
                response = self.call_llm(interpret_context)
                print(f"🤖 AI: {response}")

    def _handle_token_draw(self, token_type: str):
        """Handle drawing a token (event/item/omen)."""
        print(f"\n--- Rút {token_type.upper()} ---")

        # Get card list based on token type
        if token_type == "item":
            card_list = list_all_items()
        elif token_type == "event":
            card_list = list_all_events()
        elif token_type == "omen":
            card_list = list_all_omens()
        else:
            card_list = []

        # Let user select from list
        if card_list:
            card_idx = self.ask_option(
                f"Chọn thẻ {token_type} rút được:",
                card_list,
                allow_other=True
            )
            if card_idx == -1:
                # User chose "other"
                card_name = self.ask_text("Nhập tên thẻ:")
            else:
                card_name = card_list[card_idx]
        else:
            card_name = self.ask_text(f"Nhập tên thẻ {token_type}:")

        card_info = get_card_info(card_name)

        if card_info:
            print(f"\n📋 {card_info['name']}: {card_info['text']}")
        else:
            print(f"(Thẻ '{card_name}' không có trong database - AI vẫn tiếp tục)")

        self.current_turn_actions.append({
            "type": "draw",
            "token_type": token_type,
            "card_name": card_name,
        })

        if token_type == "item":
            self.game_state["agent_items"].append(card_name)
            print(f"✓ Đã thêm '{card_name}' vào inventory.")

        elif token_type == "omen":
            self.game_state["agent_omens"].append(card_name)
            print(f"✓ Đã thêm omen '{card_name}'.")

            # Haunt roll at end of turn
            if not self.game_state["haunt_started"]:
                total_omens = self.ask_number("Tổng số Omen đã rút trong game?", 1, 13)
                haunt_roll = self.ask_number("Roll 6 dice cho Haunt - kết quả?", 0, 12)

                if haunt_roll < total_omens:
                    print(f"\n⚠️ HAUNT BẮT ĐẦU! (Roll {haunt_roll} < {total_omens} omens)")
                    self.game_state["haunt_started"] = True
                    is_traitor = self.ask_yes_no("AI có phải là kẻ phản bội không?")
                    self.game_state["is_traitor"] = is_traitor
                else:
                    print(f"✓ Chưa haunt (Roll {haunt_roll} >= {total_omens} omens)")

        elif token_type == "event":
            # Let LLM handle event
            event_context = f"Event '{card_name}' được rút. Hãy hướng dẫn xử lý."
            response = self.call_llm(event_context)
            print(f"\n🤖 AI: {response}")

            # Ask for roll if needed
            if card_info and card_info.get("roll_stat"):
                stat = card_info["roll_stat"]
                stat_val = self.game_state["agent_stats"][stat]["value"]
                roll_result = self.ask_number(
                    f"Roll {stat.capitalize()} ({stat_val} dice) - kết quả?",
                    0, stat_val * 2
                )
                self.current_turn_actions.append({
                    "type": "roll",
                    "stat": stat,
                    "result": roll_result,
                })

    def _use_item(self, item_name: str):
        """Use an item."""
        print(f"\n--- Sử dụng {item_name} ---")
        card_info = get_card_info(item_name)

        if card_info:
            print(f"📋 {card_info['text']}")

            # Let LLM decide how to use
            use_context = f"Đang sử dụng item '{item_name}'. Hãy hướng dẫn sử dụng."
            response = self.call_llm(use_context)
            print(f"\n🤖 AI: {response}")

            # Check if consumable
            if card_info.get("consumable"):
                self.game_state["agent_items"].remove(item_name)
                print(f"✓ Item '{item_name}' đã bị hủy sau khi sử dụng.")

        self.current_turn_actions.append({
            "type": "use_item",
            "item": item_name,
        })

    def _end_turn(self):
        """End the current turn and save state."""
        print(f"\n--- Kết thúc lượt {self.game_state['turn_number']} ---")

        # Record turn history
        turn_record = {
            "turn": self.game_state["turn_number"],
            "actions": self.current_turn_actions,
            "end_state": {
                "room": self.game_state["agent_room"],
                "stats": dict(self.game_state["agent_stats"]),
                "items": list(self.game_state["agent_items"]),
                "omens": list(self.game_state["agent_omens"]),
                "other_players": list(self.game_state["other_players"]),
            },
        }
        self.turn_history.append(turn_record)
        self.save_history()

        # Print summary
        room_info = get_room_by_id(self.game_state["agent_room"])
        room_name = room_info["name"] if room_info else self.game_state["agent_room"]
        stats = self.game_state["agent_stats"]

        print(f"\n📍 Phòng: {room_name}")
        print(f"📊 Stats: Sp={stats['speed']['value']}, Mi={stats['might']['value']}, "
              f"Sa={stats['sanity']['value']}, Kn={stats['knowledge']['value']}")
        print(f"🎒 Items: {', '.join(self.game_state['agent_items']) or 'Không'}")
        print(f"✓ Đã lưu game state.")

    def run(self):
        """Main game loop."""
        # Connect to LM Studio
        print("Kết nối LM Studio...")
        models = self.fetch_models()
        if not models:
            print("Không tìm thấy model. Hãy chắc chắn LM Studio đang chạy.")
            sys.exit(1)

        self.model_name = self.select_model(models)
        if not self.model_name:
            print("Không chọn model. Thoát.")
            sys.exit(1)

        print(f"✓ Sử dụng model: {self.model_name}")

        # Setup or continue game
        if self.game_state["phase"] == "setup":
            self.setup_game()

        # Main game loop
        print("\n" + "=" * 50)
        print("BẮT ĐẦU GAME LOOP")
        print("(Nhấn Ctrl+C để thoát và lưu)")
        print("=" * 50)

        try:
            while True:
                if self.wait_for_turn():
                    self.play_turn()
                else:
                    # Not agent's turn - wait
                    print("Chờ đến lượt...")

        except KeyboardInterrupt:
            print("\n\nĐang lưu game...")
            self.save_history()
            print("✓ Game đã được lưu. Tạm biệt!")


def main():
    agent = GameAgent()
    agent.run()


if __name__ == "__main__":
    main()
