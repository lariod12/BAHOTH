"""
Dice rolling tools for stat checks and events.

Handles dice roll requests and recording results from the user.
"""

import uuid
from typing import Any
from ..history_manager import load_history_file, save_history_file, add_action_to_log


def _get_ai_player(state: dict) -> dict | None:
    """Get the AI player from game state."""
    for player in state.get("players", []):
        if player.get("isAI"):
            return player
    return None


def _get_stat_value(player: dict, stat: str) -> int:
    """Get current value of a stat for a player."""
    stat_data = player.get("stats", {}).get(stat, {})
    return stat_data.get("currentValue", 0)


def request_dice_roll(
    session_id: str,
    purpose: str,
    stat: str = None,
    dice_count: int = None,
    target: int = None,
) -> dict:
    """
    Request a dice roll from the user.

    Args:
        session_id: The game session ID
        purpose: Reason for the roll (stat_check, attack, room_effect, item_use, haunt_roll, event)
        stat: Which stat to use (speed, might, knowledge, sanity) - determines dice count if not specified
        dice_count: Optional override for number of dice
        target: Optional target number to beat

    Returns:
        Roll request with ID and description
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    ai_player = _get_ai_player(state)
    if ai_player is None:
        return {"error": "No AI player found in this session"}

    turn_state = state.get("turnState", {})

    # Calculate dice count from stat if not provided
    actual_dice_count = dice_count
    stat_value = None

    if stat and actual_dice_count is None:
        stat_value = _get_stat_value(ai_player, stat)
        actual_dice_count = stat_value

    if actual_dice_count is None or actual_dice_count <= 0:
        actual_dice_count = 1  # Minimum 1 die

    # Generate roll request ID
    roll_id = str(uuid.uuid4())[:8]

    # Create pending roll
    pending_roll = {
        "rollId": roll_id,
        "purpose": purpose,
        "stat": stat,
        "statValue": stat_value,
        "diceCount": actual_dice_count,
        "target": target,
        "status": "pending",
    }

    # Add to pending rolls
    if "pendingRolls" not in turn_state:
        turn_state["pendingRolls"] = []
    turn_state["pendingRolls"].append(pending_roll)

    state["turnState"] = turn_state
    save_history_file(session_id, state)

    # Build description
    description_parts = [f"Roll {actual_dice_count} dice"]
    if stat:
        description_parts.append(f"for {stat.capitalize()}")
    if purpose:
        description_parts.append(f"({purpose})")
    if target:
        description_parts.append(f"- need {target}+")

    return {
        "rollId": roll_id,
        "diceCount": actual_dice_count,
        "stat": stat,
        "statValue": stat_value,
        "purpose": purpose,
        "target": target,
        "description": " ".join(description_parts),
        "message": f"Please roll {actual_dice_count} dice and report the result using 'record_dice_result'",
    }


def record_dice_result(session_id: str, roll_id: str, result: int) -> dict:
    """
    Record the result of a dice roll.

    Args:
        session_id: The game session ID
        roll_id: The roll request ID
        result: The total roll result

    Returns:
        Interpretation of the result (success/fail, effects)
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    ai_player = _get_ai_player(state)
    if ai_player is None:
        return {"error": "No AI player found in this session"}

    turn_state = state.get("turnState", {})
    pending_rolls = turn_state.get("pendingRolls", [])

    # Find the pending roll
    roll_index = None
    roll_request = None
    for i, roll in enumerate(pending_rolls):
        if roll.get("rollId") == roll_id:
            roll_index = i
            roll_request = roll
            break

    if roll_request is None:
        return {
            "error": f"Roll request not found: {roll_id}",
            "pendingRolls": [r.get("rollId") for r in pending_rolls],
        }

    # Determine success/fail
    target = roll_request.get("target")
    success = None
    if target is not None:
        success = result >= target

    # Remove from pending
    pending_rolls.pop(roll_index)
    turn_state["pendingRolls"] = pending_rolls

    # Record in action log
    action_details = {
        "rollId": roll_id,
        "purpose": roll_request.get("purpose"),
        "stat": roll_request.get("stat"),
        "statValue": roll_request.get("statValue"),
        "diceCount": roll_request.get("diceCount"),
        "result": result,
        "target": target,
        "success": success,
    }

    state["turnState"] = turn_state
    save_history_file(session_id, state)

    add_action_to_log(session_id, {
        "turn": turn_state.get("currentTurnNumber", 1),
        "playerId": ai_player.get("id"),
        "action": "dice_roll",
        "details": action_details,
    })

    # Build response
    response = {
        "rollId": roll_id,
        "result": result,
        "purpose": roll_request.get("purpose"),
        "stat": roll_request.get("stat"),
        "diceCount": roll_request.get("diceCount"),
    }

    if target is not None:
        response["target"] = target
        response["success"] = success
        response["message"] = f"Rolled {result} vs target {target}: {'SUCCESS' if success else 'FAIL'}"
    else:
        response["message"] = f"Rolled {result}"

    # Add any remaining pending rolls
    if pending_rolls:
        response["remainingPendingRolls"] = len(pending_rolls)

    return response


def get_pending_rolls(session_id: str) -> dict:
    """
    Get all pending dice rolls.

    Args:
        session_id: The game session ID

    Returns:
        List of pending roll requests
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    turn_state = state.get("turnState", {})
    pending_rolls = turn_state.get("pendingRolls", [])

    if not pending_rolls:
        return {
            "hasPendingRolls": False,
            "pendingRolls": [],
            "message": "No pending dice rolls",
        }

    return {
        "hasPendingRolls": True,
        "count": len(pending_rolls),
        "pendingRolls": pending_rolls,
        "message": f"{len(pending_rolls)} dice roll(s) pending",
    }


def cancel_pending_roll(session_id: str, roll_id: str) -> dict:
    """
    Cancel a pending dice roll.

    Args:
        session_id: The game session ID
        roll_id: The roll request ID to cancel

    Returns:
        Cancellation result
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    turn_state = state.get("turnState", {})
    pending_rolls = turn_state.get("pendingRolls", [])

    # Find and remove the roll
    new_pending = [r for r in pending_rolls if r.get("rollId") != roll_id]

    if len(new_pending) == len(pending_rolls):
        return {"error": f"Roll request not found: {roll_id}"}

    turn_state["pendingRolls"] = new_pending
    state["turnState"] = turn_state
    save_history_file(session_id, state)

    return {
        "success": True,
        "cancelledRollId": roll_id,
        "remainingPendingRolls": len(new_pending),
    }


def get_roll_requirements(
    session_id: str,
    room_id: str = None,
    item_id: str = None,
) -> dict:
    """
    Get dice roll requirements for a room or item.

    Args:
        session_id: The game session ID
        room_id: Optional room ID to check
        item_id: Optional item ID to check

    Returns:
        Roll requirements including stat, dice count, and target
    """
    from ..data_loader import get_maps_data, get_cards_data

    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    ai_player = _get_ai_player(state)
    if ai_player is None:
        return {"error": "No AI player found in this session"}

    requirements = []

    # Check room requirements
    if room_id or (not item_id):
        if not room_id:
            room_id = ai_player.get("currentPosition", {}).get("roomId")

        # Find room in placed rooms
        room = None
        for r in state.get("map", {}).get("placedRooms", []):
            if r.get("instanceId") == room_id:
                room = r
                break

        if room:
            room_name_en = room.get("roomName", {}).get("en", "")
            maps_data = get_maps_data()

            # Find room data
            for room_data in maps_data.get("ROOMS", []):
                if room_data.get("name", {}).get("en", "").lower() == room_name_en.lower():
                    text = room_data.get("text", {})

                    # Parse room text for roll requirements
                    # Common patterns: "roll X dice", "make a X roll"
                    en_text = text.get("en", "").lower()
                    vi_text = text.get("vi", "").lower()

                    # Check for stat-based rolls
                    for stat in ["speed", "might", "knowledge", "sanity"]:
                        if stat in en_text:
                            requirements.append({
                                "source": "room",
                                "roomId": room_id,
                                "roomName": room.get("roomName"),
                                "stat": stat,
                                "description": text.get("en", ""),
                            })

                    # Check for token types that trigger draws
                    tokens = room.get("tokens", [])
                    if tokens and not room.get("tokenCollected"):
                        requirements.append({
                            "source": "token",
                            "roomId": room_id,
                            "tokenTypes": tokens,
                            "description": f"Draw {', '.join(tokens)} card(s)",
                        })

                    break

    # Check item requirements
    if item_id:
        cards_data = get_cards_data()

        for card in cards_data.get("CARDS", []):
            if card.get("id") == item_id:
                effect = card.get("effect", {})

                if effect.get("usage"):
                    usage = effect.get("usage", {})
                    if usage.get("roll"):
                        roll_info = usage.get("roll", {})
                        requirements.append({
                            "source": "item",
                            "itemId": item_id,
                            "itemName": card.get("name"),
                            "stat": roll_info.get("stat"),
                            "diceCount": roll_info.get("dice"),
                            "description": card.get("text", {}).get("en", ""),
                        })
                break

    if not requirements:
        return {
            "hasRequirements": False,
            "requirements": [],
            "message": "No roll requirements found",
        }

    return {
        "hasRequirements": True,
        "requirements": requirements,
        "count": len(requirements),
    }


def interpret_roll_result(
    session_id: str,
    roll_id: str = None,
    result: int = None,
    context: str = None,
) -> dict:
    """
    Interpret the result of a dice roll based on game rules.

    Args:
        session_id: The game session ID
        roll_id: Optional roll ID to look up context
        result: The roll result (if not using roll_id)
        context: Description of what the roll was for

    Returns:
        Interpretation of the roll result
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    # Get roll info from action log if roll_id provided
    roll_info = None
    if roll_id:
        action_log = state.get("actionLog", [])
        for action in reversed(action_log):
            if action.get("action") == "dice_roll":
                details = action.get("details", {})
                if details.get("rollId") == roll_id:
                    roll_info = details
                    result = details.get("result")
                    break

    if result is None:
        return {"error": "No result provided and roll not found in log"}

    ai_player = _get_ai_player(state)

    interpretation = {
        "result": result,
        "rollId": roll_id,
    }

    # Basic interpretation based on purpose
    purpose = roll_info.get("purpose") if roll_info else context
    stat = roll_info.get("stat") if roll_info else None
    target = roll_info.get("target") if roll_info else None

    if purpose == "stat_check" and stat:
        stat_value = roll_info.get("statValue") if roll_info else None
        if stat_value:
            if result >= stat_value:
                interpretation["outcome"] = "success"
                interpretation["message"] = f"Success! Rolled {result} (needed {stat_value})"
            else:
                interpretation["outcome"] = "failure"
                interpretation["message"] = f"Failed. Rolled {result} (needed {stat_value})"

    elif purpose == "attack":
        if target:
            if result >= target:
                interpretation["outcome"] = "hit"
                interpretation["damage"] = result - target
                interpretation["message"] = f"Hit! {result - target} damage dealt"
            else:
                interpretation["outcome"] = "miss"
                interpretation["message"] = f"Miss! Rolled {result}, needed {target}"

    elif purpose == "haunt_roll":
        # Haunt roll: need to roll higher than number of omens
        omens_revealed = state.get("tokenDecks", {}).get("omensRevealed", 0)
        if result >= omens_revealed:
            interpretation["outcome"] = "safe"
            interpretation["message"] = f"Safe! Rolled {result} vs {omens_revealed} omens"
        else:
            interpretation["outcome"] = "haunt_triggered"
            interpretation["message"] = f"HAUNT! Rolled {result}, only {omens_revealed} omens revealed"

    elif purpose == "event":
        # Event interpretation varies widely, provide generic
        if result >= 4:
            interpretation["outcome"] = "good"
            interpretation["message"] = f"Good outcome (rolled {result})"
        elif result >= 2:
            interpretation["outcome"] = "neutral"
            interpretation["message"] = f"Neutral outcome (rolled {result})"
        else:
            interpretation["outcome"] = "bad"
            interpretation["message"] = f"Bad outcome (rolled {result})"

    else:
        # Generic interpretation
        if target:
            interpretation["success"] = result >= target
            interpretation["message"] = f"Rolled {result} vs target {target}: {'SUCCESS' if result >= target else 'FAIL'}"
        else:
            interpretation["message"] = f"Rolled {result}"

    return interpretation


def get_dice_roll_history(session_id: str, limit: int = 10) -> dict:
    """
    Get recent dice roll history.

    Args:
        session_id: The game session ID
        limit: Maximum number of rolls to return

    Returns:
        List of recent dice rolls
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    action_log = state.get("actionLog", [])

    # Filter for dice rolls
    dice_rolls = [
        action for action in action_log
        if action.get("action") == "dice_roll"
    ]

    # Get most recent
    recent_rolls = dice_rolls[-limit:] if len(dice_rolls) > limit else dice_rolls

    return {
        "rolls": recent_rolls,
        "count": len(recent_rolls),
        "totalRolls": len(dice_rolls),
    }
