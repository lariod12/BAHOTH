"""
MCP Tools for querying Rooms/Maps data.
"""

from typing import Any
from ..data_loader import get_maps_data


def get_all_rooms() -> list[dict]:
    """
    Get a list of all rooms/tiles in the game.

    Returns:
        List of room objects with name, floors allowed, and basic info.
    """
    data = get_maps_data()
    rooms = data.get("ROOMS", [])

    return [
        {
            "name": room.get("name", {}),
            "floorsAllowed": room.get("floorsAllowed", []),
            "tokens": room.get("tokens", []),
            "isStartingRoom": room.get("isStartingRoom", False),
        }
        for room in rooms
    ]


def get_room_by_name(name: str) -> list[dict]:
    """
    Search for rooms by name (supports Vietnamese/English).

    Args:
        name: The name or partial name to search for (case-insensitive).

    Returns:
        List of matching rooms with full details.
    """
    data = get_maps_data()
    rooms = data.get("ROOMS", [])
    name_lower = name.lower()

    results = []
    for room in rooms:
        room_name = room.get("name", {})
        en_name = room_name.get("en", "").lower()
        vi_name = room_name.get("vi", "").lower()

        if name_lower in en_name or name_lower in vi_name:
            results.append(room)

    return results


def get_rooms_by_floor(floor: str) -> list[dict]:
    """
    Get all rooms that can be placed on a specific floor.

    Args:
        floor: The floor to filter by ("ground", "upper", "basement").

    Returns:
        List of rooms allowed on the specified floor.
    """
    data = get_maps_data()
    rooms = data.get("ROOMS", [])

    return [room for room in rooms if floor in room.get("floorsAllowed", [])]


def get_room_doors(room_name: str) -> dict | None:
    """
    Get door information for a specific room.

    Args:
        room_name: The name of the room (English or Vietnamese).

    Returns:
        Dict containing room name and door configuration.
    """
    matches = get_room_by_name(room_name)
    if not matches:
        return None

    room = matches[0]
    return {
        "name": room.get("name"),
        "doors": room.get("doors", []),
        "text": room.get("text", {}),
        "notes": room.get("notes", []),
    }


def get_starting_rooms() -> list[dict]:
    """
    Get all starting room tiles.

    Returns:
        List of rooms that are starting tiles (Entrance Hall, Foyer, etc.).
    """
    data = get_maps_data()
    rooms = data.get("ROOMS", [])

    return [room for room in rooms if room.get("isStartingRoom", False)]


def get_rooms_with_tokens(token_type: str | None = None) -> list[dict]:
    """
    Get rooms that have token placements.

    Args:
        token_type: Optional filter for specific token type (e.g., "omen", "event", "item").

    Returns:
        List of rooms with the specified tokens.
    """
    data = get_maps_data()
    rooms = data.get("ROOMS", [])

    if token_type:
        return [room for room in rooms if token_type in room.get("tokens", [])]
    else:
        return [room for room in rooms if room.get("tokens", [])]
