"""
Turn management tools for game flow.

Handles turn phases, movement calculation, and available actions.
"""

from typing import Any
from ..history_manager import load_history_file, save_history_file, add_action_to_log


def _get_ai_player(state: dict) -> dict | None:
    """Get the AI player from game state."""
    for player in state.get("players", []):
        if player.get("isAI"):
            return player
    return None


def _get_player_by_id(state: dict, player_id: str) -> dict | None:
    """Get a player by ID."""
    for player in state.get("players", []):
        if player.get("id") == player_id:
            return player
    return None


def _get_current_speed(player: dict) -> int:
    """Get current speed value for a player."""
    speed_stat = player.get("stats", {}).get("speed", {})
    return speed_stat.get("currentValue", 4)


def start_turn(session_id: str) -> dict:
    """
    Start the AI player's turn.

    Calculates movement points from Speed stat and sets phase to movement.

    Args:
        session_id: The game session ID

    Returns:
        Turn info including movement points, current position, and available actions
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    ai_player = _get_ai_player(state)
    if ai_player is None:
        return {"error": "No AI player found in this session"}

    turn_state = state.get("turnState", {})
    current_player_id = turn_state.get("currentPlayerId")

    # Check if it's AI's turn
    if current_player_id != ai_player.get("id"):
        current_player = _get_player_by_id(state, current_player_id)
        return {
            "error": "Not AI's turn",
            "currentPlayer": current_player.get("name") if current_player else current_player_id,
            "aiPlayerId": ai_player.get("id"),
        }

    # Calculate movement from Speed
    movement = _get_current_speed(ai_player)

    # Update turn state
    turn_state["phase"] = "movement"
    turn_state["movementRemaining"] = movement
    turn_state["actionsThisTurn"] = []

    state["turnState"] = turn_state
    save_history_file(session_id, state)

    # Log action
    add_action_to_log(session_id, {
        "turn": turn_state.get("currentTurnNumber", 1),
        "playerId": ai_player.get("id"),
        "action": "start_turn",
        "details": {
            "movementPoints": movement,
            "position": ai_player.get("currentPosition"),
        },
    })

    # Get current room info
    current_pos = ai_player.get("currentPosition", {})
    current_room_id = current_pos.get("roomId")
    current_room = None
    for room in state.get("map", {}).get("placedRooms", []):
        if room.get("instanceId") == current_room_id:
            current_room = room
            break

    return {
        "turnNumber": turn_state.get("currentTurnNumber", 1),
        "phase": "movement",
        "movementRemaining": movement,
        "currentPosition": current_pos,
        "currentRoom": {
            "name": current_room.get("roomName") if current_room else None,
            "floor": current_pos.get("floor"),
        },
        "message": f"Turn {turn_state.get('currentTurnNumber', 1)} started. You have {movement} movement points.",
    }


def end_turn(session_id: str) -> dict:
    """
    End the AI player's turn.

    Advances to the next player and increments turn number if needed.

    Args:
        session_id: The game session ID

    Returns:
        Turn summary and next player info
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    ai_player = _get_ai_player(state)
    if ai_player is None:
        return {"error": "No AI player found in this session"}

    turn_state = state.get("turnState", {})
    players = state.get("players", [])

    # Get current turn info for summary
    turn_number = turn_state.get("currentTurnNumber", 1)
    actions_this_turn = turn_state.get("actionsThisTurn", [])

    # Find next player
    current_player_id = turn_state.get("currentPlayerId")
    current_index = next(
        (i for i, p in enumerate(players) if p.get("id") == current_player_id),
        0
    )
    next_index = (current_index + 1) % len(players)
    next_player = players[next_index]

    # If we wrapped around to first player, increment turn number
    new_turn_number = turn_number
    if next_index == 0:
        new_turn_number = turn_number + 1

    # Update turn state
    turn_state["currentPlayerId"] = next_player.get("id")
    turn_state["currentTurnNumber"] = new_turn_number
    turn_state["phase"] = "waiting"
    turn_state["movementRemaining"] = 0
    turn_state["actionsThisTurn"] = []

    state["turnState"] = turn_state
    save_history_file(session_id, state)

    # Log action
    add_action_to_log(session_id, {
        "turn": turn_number,
        "playerId": ai_player.get("id"),
        "action": "end_turn",
        "details": {
            "actionsCount": len(actions_this_turn),
            "nextPlayer": next_player.get("id"),
        },
    })

    return {
        "turnEnded": turn_number,
        "actionsThisTurn": len(actions_this_turn),
        "nextPlayer": {
            "id": next_player.get("id"),
            "name": next_player.get("name"),
            "isAI": next_player.get("isAI"),
        },
        "nextTurnNumber": new_turn_number,
        "message": f"Turn {turn_number} ended. Next: {next_player.get('name')}",
    }


def get_turn_state(session_id: str) -> dict:
    """
    Get current turn state.

    Args:
        session_id: The game session ID

    Returns:
        Current turn information
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    turn_state = state.get("turnState", {})
    current_player_id = turn_state.get("currentPlayerId")
    current_player = _get_player_by_id(state, current_player_id)

    ai_player = _get_ai_player(state)
    is_ai_turn = current_player_id == ai_player.get("id") if ai_player else False

    return {
        "turnNumber": turn_state.get("currentTurnNumber", 1),
        "currentPlayer": {
            "id": current_player_id,
            "name": current_player.get("name") if current_player else None,
            "isAI": current_player.get("isAI") if current_player else False,
        },
        "phase": turn_state.get("phase", "waiting"),
        "movementRemaining": turn_state.get("movementRemaining", 0),
        "isAITurn": is_ai_turn,
        "pendingRolls": turn_state.get("pendingRolls", []),
    }


def get_available_actions(session_id: str) -> dict:
    """
    Get list of available actions for the AI player.

    Args:
        session_id: The game session ID

    Returns:
        List of available actions with descriptions
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    ai_player = _get_ai_player(state)
    if ai_player is None:
        return {"error": "No AI player found in this session"}

    turn_state = state.get("turnState", {})
    current_player_id = turn_state.get("currentPlayerId")

    # Not AI's turn
    if current_player_id != ai_player.get("id"):
        return {
            "isAITurn": False,
            "availableActions": [],
            "message": "Waiting for other players",
        }

    phase = turn_state.get("phase", "waiting")
    movement_remaining = turn_state.get("movementRemaining", 0)
    pending_rolls = turn_state.get("pendingRolls", [])

    actions = []

    # Check for pending rolls first
    if pending_rolls:
        actions.append({
            "action": "resolve_pending_roll",
            "description": "There are pending dice rolls that need to be resolved",
            "pendingRolls": pending_rolls,
        })
        return {
            "isAITurn": True,
            "phase": phase,
            "availableActions": actions,
            "message": "Resolve pending dice rolls first",
        }

    if phase == "waiting":
        actions.append({
            "action": "start_turn",
            "description": "Start your turn",
        })
    elif phase == "movement":
        if movement_remaining > 0:
            actions.append({
                "action": "move",
                "description": f"Move to an adjacent room ({movement_remaining} movement remaining)",
                "movementRemaining": movement_remaining,
            })
            actions.append({
                "action": "use_stairs",
                "description": "Use stairs to change floors (if on stairs)",
            })

        # Can always end turn
        actions.append({
            "action": "end_turn",
            "description": "End your turn",
        })

        # Check if in room with uncollected token
        current_pos = ai_player.get("currentPosition", {})
        current_room_id = current_pos.get("roomId")
        for room in state.get("map", {}).get("placedRooms", []):
            if room.get("instanceId") == current_room_id:
                if not room.get("tokenCollected") and room.get("tokens"):
                    actions.append({
                        "action": "collect_token",
                        "description": f"Draw a token from this room",
                        "availableTokens": room.get("tokens", []),
                    })
                break

    return {
        "isAITurn": True,
        "phase": phase,
        "movementRemaining": movement_remaining,
        "availableActions": actions,
    }
