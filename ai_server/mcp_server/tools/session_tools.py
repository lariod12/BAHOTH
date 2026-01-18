"""
Session management tools for game state.

Provides tools to create, load, and manage game sessions.
"""

from typing import Any
from ..history_manager import (
    generate_session_id,
    create_history_file,
    load_history_file,
    save_history_file,
    delete_history_file,
    list_sessions,
    session_exists,
)
from ..data_loader import get_characters_data, get_maps_data


def _get_character_by_id(character_id: str) -> dict | None:
    """Get character data by ID."""
    data = get_characters_data()
    for char in data.get("CHARACTERS", []):
        if char.get("id") == character_id:
            return char
    return None


def _get_starting_rooms() -> list[dict]:
    """Get the three starting room tiles."""
    data = get_maps_data()
    return [room for room in data.get("ROOMS", []) if room.get("isStartingRoom")]


def _init_player_stats(character: dict) -> dict:
    """Initialize player stats from character traits."""
    stats = {}
    traits = character.get("traits", {})

    for trait_name, trait_data in traits.items():
        track = trait_data.get("track", [])
        start_index = trait_data.get("startIndex", 0)
        current_value = track[start_index] if start_index < len(track) else 0

        stats[trait_name] = {
            "currentIndex": start_index,
            "currentValue": current_value,
            "track": track,
        }

    return stats


def _create_initial_map() -> dict:
    """Create initial map with starting rooms."""
    starting_rooms = _get_starting_rooms()

    # Fixed starting layout:
    # Entrance Hall (0, -1) -> Foyer (0, 0) -> Grand Staircase (0, 1)
    placed_rooms = []

    room_configs = [
        {"name": "Entrance Hall", "x": 0, "y": -1, "floor": "ground"},
        {"name": "Foyer", "x": 0, "y": 0, "floor": "ground"},
        {"name": "Grand Staircase", "x": 0, "y": 1, "floor": "ground"},
    ]

    for i, config in enumerate(room_configs):
        room_data = next(
            (r for r in starting_rooms if config["name"] in r.get("name", {}).get("en", "")),
            None
        )
        if room_data:
            # Build doors dict from room data
            doors = {}
            for door in room_data.get("doors", []):
                side = door.get("side")
                doors[side] = {
                    "kind": door.get("kind"),
                    "connectedTo": None,  # Will be set below
                }

            placed_rooms.append({
                "instanceId": f"room-{i+1:03d}",
                "roomName": room_data.get("name"),
                "floor": config["floor"],
                "x": config["x"],
                "y": config["y"],
                "rotation": 0,
                "doors": doors,
                "tokenCollected": True,  # Starting rooms have no tokens
                "roomBonusUsed": False,
            })

    # Connect the starting rooms
    # Entrance Hall (room-001) top -> Foyer (room-002)
    # Foyer (room-002) bottom -> Entrance Hall, top -> Grand Staircase
    # Grand Staircase (room-003) bottom -> Foyer
    if len(placed_rooms) >= 3:
        placed_rooms[0]["doors"]["top"]["connectedTo"] = "room-002"  # Entrance -> Foyer
        placed_rooms[1]["doors"]["bottom"]["connectedTo"] = "room-001"  # Foyer -> Entrance
        placed_rooms[1]["doors"]["top"]["connectedTo"] = "room-003"  # Foyer -> Grand Staircase
        placed_rooms[2]["doors"]["bottom"]["connectedTo"] = "room-002"  # Grand Staircase -> Foyer

    return {
        "placedRooms": placed_rooms,
        "nextRoomId": len(placed_rooms) + 1,
    }


def create_game_session(players: list[dict]) -> dict:
    """
    Create a new game session.

    Args:
        players: List of player configs, each with:
            - characterId: ID of the character to use
            - name: Display name (optional, uses character name if not provided)
            - isAI: Whether this player is AI-controlled

    Returns:
        Dict with sessionId and initial game state summary.
    """
    if not players:
        return {"error": "At least one player is required"}

    if len(players) > 6:
        return {"error": "Maximum 6 players allowed"}

    session_id = generate_session_id()

    # Initialize players
    initialized_players = []
    for i, player_config in enumerate(players):
        character_id = player_config.get("characterId")
        character = _get_character_by_id(character_id)

        if not character:
            return {"error": f"Character not found: {character_id}"}

        player_name = player_config.get("name") or character.get("name", {}).get("en", f"Player {i+1}")

        initialized_players.append({
            "id": f"player-{i+1}",
            "characterId": character_id,
            "name": player_name,
            "isAI": player_config.get("isAI", False),
            "isTraitor": False,
            "isDead": False,
            "turnOrder": i,
            "currentPosition": {
                "floor": "ground",
                "roomId": "room-001",  # Start in Entrance Hall
                "x": 0,
                "y": -1,
            },
            "stats": _init_player_stats(character),
            "inventory": [],
        })

    # Create initial state
    initial_state = {
        "players": initialized_players,
        "map": _create_initial_map(),
        "turnState": {
            "currentTurnNumber": 1,
            "currentPlayerId": "player-1",
            "phase": "waiting",  # Will change to "movement" when start_turn is called
            "movementRemaining": 0,
            "pendingRolls": [],
        },
        "tokenDecks": {
            "omensRevealed": 0,
        },
        "actionLog": [],
        "otherPlayersContext": [],
    }

    try:
        create_history_file(session_id, initial_state)
    except Exception as e:
        return {"error": f"Failed to create session: {str(e)}"}

    return {
        "sessionId": session_id,
        "playerCount": len(initialized_players),
        "players": [
            {"id": p["id"], "name": p["name"], "character": p["characterId"], "isAI": p["isAI"]}
            for p in initialized_players
        ],
        "startingRoom": "Entrance Hall",
        "message": "Game session created. All players start in the Entrance Hall.",
    }


def load_game_session(session_id: str) -> dict | None:
    """
    Load an existing game session.

    Args:
        session_id: The session ID to load

    Returns:
        Full game state or error dict
    """
    state = load_history_file(session_id)

    if state is None:
        return {"error": f"Session not found: {session_id}"}

    return state


def get_game_state(session_id: str, include: list[str] = None) -> dict:
    """
    Get current game state summary.

    Args:
        session_id: The session ID
        include: Optional list of sections to include (players, map, turnState, inventory)
                If None, returns a summary of all sections

    Returns:
        Filtered game state
    """
    state = load_history_file(session_id)

    if state is None:
        return {"error": f"Session not found: {session_id}"}

    if include is None:
        # Return summary
        return {
            "sessionId": state.get("meta", {}).get("sessionId"),
            "gamePhase": state.get("meta", {}).get("gamePhase"),
            "currentTurn": state.get("turnState", {}).get("currentTurnNumber"),
            "currentPlayer": state.get("turnState", {}).get("currentPlayerId"),
            "phase": state.get("turnState", {}).get("phase"),
            "playerCount": len(state.get("players", [])),
            "roomsPlaced": len(state.get("map", {}).get("placedRooms", [])),
            "omensRevealed": state.get("tokenDecks", {}).get("omensRevealed", 0),
        }

    # Return requested sections
    result = {"sessionId": session_id}

    if "players" in include:
        result["players"] = state.get("players", [])

    if "map" in include:
        result["map"] = state.get("map", {})

    if "turnState" in include:
        result["turnState"] = state.get("turnState", {})

    if "inventory" in include:
        # Get AI player's inventory
        for player in state.get("players", []):
            if player.get("isAI"):
                result["inventory"] = player.get("inventory", [])
                break

    if "actionLog" in include:
        result["actionLog"] = state.get("actionLog", [])[-10:]  # Last 10 actions

    return result


def delete_game_session(session_id: str) -> dict:
    """
    Delete a game session.

    Args:
        session_id: The session ID to delete

    Returns:
        Success/failure status
    """
    if delete_history_file(session_id):
        return {"success": True, "message": f"Session {session_id} deleted"}

    return {"success": False, "error": f"Session not found: {session_id}"}


def list_game_sessions() -> list[dict]:
    """
    List all available game sessions.

    Returns:
        List of session summaries
    """
    return list_sessions()
