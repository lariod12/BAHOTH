"""
Turn order management tools for multi-player games.

Handles player turn sequence, AI position tracking, and turn advancement.
"""

from typing import Any
from ..history_manager import load_history_file, save_history_file


def _get_ai_player(state: dict) -> dict | None:
    """Get the AI player from game state."""
    for player in state.get("players", []):
        if player.get("isAI"):
            return player
    return None


def _get_ai_player_id(state: dict) -> str | None:
    """Get the AI player ID."""
    ai_player = _get_ai_player(state)
    return ai_player.get("id") if ai_player else None


def set_turn_order(session_id: str, player_order: list[str]) -> dict:
    """
    Set the turn order for the game.

    Args:
        session_id: The game session ID
        player_order: List of player IDs in turn order

    Returns:
        Turn order configuration with AI position
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    # Validate all players exist
    player_ids = {p.get("id") for p in state.get("players", [])}
    for pid in player_order:
        if pid not in player_ids:
            return {"error": f"Player not found: {pid}"}

    # Find AI player index in the order
    ai_player_id = _get_ai_player_id(state)
    ai_index = None
    if ai_player_id and ai_player_id in player_order:
        ai_index = player_order.index(ai_player_id)

    # Create turn order structure
    turn_order = {
        "playerSequence": player_order,
        "aiPlayerIndex": ai_index,
        "currentTurnIndex": 0,
    }

    state["turnOrder"] = turn_order

    # Update turnState to match
    if player_order:
        state["turnState"] = state.get("turnState", {})
        state["turnState"]["currentPlayerId"] = player_order[0]

    save_history_file(session_id, state)

    # Get player names for readability
    player_names = {p.get("id"): p.get("name") for p in state.get("players", [])}

    return {
        "success": True,
        "turnOrder": turn_order,
        "playerNames": [player_names.get(pid, pid) for pid in player_order],
        "aiPosition": ai_index + 1 if ai_index is not None else None,
        "totalPlayers": len(player_order),
        "firstPlayer": player_names.get(player_order[0], player_order[0]),
        "isAIFirst": ai_index == 0 if ai_index is not None else False,
    }


def get_turn_order(session_id: str) -> dict:
    """
    Get the current turn order and AI's position.

    Args:
        session_id: The game session ID

    Returns:
        Turn order info including AI position and current turn
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    turn_order = state.get("turnOrder")
    if not turn_order:
        return {
            "error": "Turn order not set. Use set_turn_order first.",
            "hasTurnOrder": False,
        }

    player_sequence = turn_order.get("playerSequence", [])
    ai_index = turn_order.get("aiPlayerIndex")
    current_index = turn_order.get("currentTurnIndex", 0)

    # Get player names
    player_names = {p.get("id"): p.get("name") for p in state.get("players", [])}

    current_player_id = player_sequence[current_index] if player_sequence else None
    ai_player_id = _get_ai_player_id(state)

    return {
        "hasTurnOrder": True,
        "playerSequence": player_sequence,
        "playerNames": [player_names.get(pid, pid) for pid in player_sequence],
        "aiPlayerIndex": ai_index,
        "aiPosition": ai_index + 1 if ai_index is not None else None,
        "currentTurnIndex": current_index,
        "currentPlayerId": current_player_id,
        "currentPlayerName": player_names.get(current_player_id, current_player_id),
        "isAITurn": current_player_id == ai_player_id,
        "totalPlayers": len(player_sequence),
        "turnNumber": state.get("turnState", {}).get("currentTurnNumber", 1),
    }


def advance_turn(session_id: str) -> dict:
    """
    Advance to the next player's turn.

    Args:
        session_id: The game session ID

    Returns:
        Next player info and whether it's AI's turn
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    turn_order = state.get("turnOrder")
    if not turn_order:
        return {"error": "Turn order not set. Use set_turn_order first."}

    player_sequence = turn_order.get("playerSequence", [])
    if not player_sequence:
        return {"error": "No players in turn order"}

    current_index = turn_order.get("currentTurnIndex", 0)
    ai_index = turn_order.get("aiPlayerIndex")

    # Calculate next index
    next_index = (current_index + 1) % len(player_sequence)

    # Check if we completed a full round
    completed_round = next_index == 0
    turn_state = state.get("turnState", {})

    if completed_round:
        # Increment turn number
        turn_state["currentTurnNumber"] = turn_state.get("currentTurnNumber", 1) + 1

    # Update turn order
    turn_order["currentTurnIndex"] = next_index
    state["turnOrder"] = turn_order

    # Update turn state
    next_player_id = player_sequence[next_index]
    turn_state["currentPlayerId"] = next_player_id
    turn_state["phase"] = "waiting"  # Reset phase for new player
    state["turnState"] = turn_state

    save_history_file(session_id, state)

    # Get player names
    player_names = {p.get("id"): p.get("name") for p in state.get("players", [])}
    ai_player_id = _get_ai_player_id(state)

    return {
        "success": True,
        "previousPlayerIndex": current_index,
        "currentTurnIndex": next_index,
        "currentPlayerId": next_player_id,
        "currentPlayerName": player_names.get(next_player_id, next_player_id),
        "isAITurn": next_player_id == ai_player_id,
        "completedRound": completed_round,
        "turnNumber": turn_state.get("currentTurnNumber", 1),
        "message": f"Now {player_names.get(next_player_id, next_player_id)}'s turn"
        + (" (AI)" if next_player_id == ai_player_id else ""),
    }


def get_players_before_ai(session_id: str) -> dict:
    """
    Get list of players who play before AI in the current round.

    Useful for AI to know whose context to request at round start.

    Args:
        session_id: The game session ID

    Returns:
        List of players who go before AI
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    turn_order = state.get("turnOrder")
    if not turn_order:
        return {"error": "Turn order not set. Use set_turn_order first."}

    player_sequence = turn_order.get("playerSequence", [])
    ai_index = turn_order.get("aiPlayerIndex")

    if ai_index is None:
        return {
            "error": "AI player not in turn order",
            "playersBeforeAI": [],
        }

    if ai_index == 0:
        return {
            "playersBeforeAI": [],
            "aiGoesFirst": True,
            "message": "AI goes first, no players to wait for",
        }

    # Get players before AI
    players_before = player_sequence[:ai_index]

    # Get player details
    player_map = {p.get("id"): p for p in state.get("players", [])}
    players_info = []

    for pid in players_before:
        player = player_map.get(pid, {})
        players_info.append({
            "id": pid,
            "name": player.get("name", pid),
            "characterId": player.get("characterId"),
            "position": player.get("currentPosition", {}).get("roomId"),
        })

    return {
        "playersBeforeAI": players_info,
        "playerIds": players_before,
        "count": len(players_before),
        "aiGoesFirst": False,
        "aiPosition": ai_index + 1,
        "message": f"{len(players_before)} player(s) go before AI",
    }


def get_current_player_info(session_id: str) -> dict:
    """
    Get detailed info about whose turn it currently is.

    Args:
        session_id: The game session ID

    Returns:
        Current player details and turn state
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    turn_order = state.get("turnOrder")
    turn_state = state.get("turnState", {})

    current_player_id = turn_state.get("currentPlayerId")
    if not current_player_id:
        if turn_order and turn_order.get("playerSequence"):
            current_player_id = turn_order["playerSequence"][0]
        else:
            return {"error": "No current player set"}

    # Find current player
    current_player = None
    for player in state.get("players", []):
        if player.get("id") == current_player_id:
            current_player = player
            break

    if not current_player:
        return {"error": f"Current player not found: {current_player_id}"}

    ai_player_id = _get_ai_player_id(state)
    is_ai_turn = current_player_id == ai_player_id

    return {
        "currentPlayerId": current_player_id,
        "currentPlayerName": current_player.get("name"),
        "characterId": current_player.get("characterId"),
        "isAI": current_player.get("isAI", False),
        "isAITurn": is_ai_turn,
        "position": current_player.get("currentPosition"),
        "turnPhase": turn_state.get("phase", "waiting"),
        "movementRemaining": turn_state.get("movementRemaining", 0),
        "turnNumber": turn_state.get("currentTurnNumber", 1),
    }
