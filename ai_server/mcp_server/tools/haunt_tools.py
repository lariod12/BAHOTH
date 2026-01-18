"""
MCP Tools for querying Haunt/Traitor data.
"""

from typing import Any
from ..data_loader import get_haunt_reference_data, get_traitor_map_data


def get_haunt_page(omen: str, room: str) -> dict | None:
    """
    Look up the haunt page number based on omen and room combination.

    Args:
        omen: The omen name/key (e.g., "skull", "bite", "Đầu Lâu").
        room: The room name (Vietnamese).

    Returns:
        Dict with haunt number and lookup details if found.
    """
    data = get_haunt_reference_data()
    rows = data.get("REFERENCE_ROWS", [])
    omen_defs = data.get("OMEN_DEFS", [])

    # Normalize omen input to key
    omen_key = None
    omen_lower = omen.lower()

    for omen_def in omen_defs:
        if omen_def.get("key") == omen_lower:
            omen_key = omen_def.get("key")
            break
        # Check aliases
        for alias in omen_def.get("aliases", []):
            if alias.lower() == omen_lower:
                omen_key = omen_def.get("key")
                break
        if omen_key:
            break

    if not omen_key:
        return {"error": f"Omen '{omen}' not found", "available_omens": get_all_omens()}

    # Find room
    room_lower = room.lower()
    for row in rows:
        row_room = row.get("room", "").lower()
        if room_lower in row_room or row_room in room_lower:
            haunt_number = row.get(omen_key)
            if haunt_number:
                return {
                    "omen": omen,
                    "omenKey": omen_key,
                    "room": row.get("room"),
                    "hauntNumber": haunt_number,
                }

    return {"error": f"Room '{room}' not found in haunt reference table"}


def get_traitor_for_haunt(haunt_number: int) -> dict | None:
    """
    Determine who becomes the traitor for a specific haunt.

    Args:
        haunt_number: The haunt number (1-50).

    Returns:
        Dict with traitor determination rule.
    """
    data = get_traitor_map_data()
    traitor_map = data.get("TRAITOR_BY_HAUNT_NUMBER", {})

    haunt_str = str(haunt_number)
    if haunt_str in traitor_map:
        return {
            "hauntNumber": haunt_number,
            "traitorRule": traitor_map[haunt_str],
        }

    return {"error": f"Haunt number {haunt_number} not found (valid range: 1-50)"}


def get_all_omens() -> list[dict]:
    """
    Get a list of all omens with their keys and labels.

    Returns:
        List of omen definitions with keys, labels, and aliases.
    """
    data = get_haunt_reference_data()
    return data.get("OMEN_DEFS", [])


def get_all_haunt_rooms() -> list[str]:
    """
    Get a list of all rooms in the haunt reference table.

    Returns:
        List of room names (Vietnamese).
    """
    data = get_haunt_reference_data()
    rows = data.get("REFERENCE_ROWS", [])

    return [row.get("room") for row in rows if row.get("room")]


def get_haunt_table_for_room(room: str) -> dict | None:
    """
    Get the full haunt lookup table for a specific room.

    Args:
        room: The room name (Vietnamese).

    Returns:
        Dict with all omen -> haunt number mappings for that room.
    """
    data = get_haunt_reference_data()
    rows = data.get("REFERENCE_ROWS", [])
    omen_defs = data.get("OMEN_DEFS", [])

    room_lower = room.lower()
    for row in rows:
        row_room = row.get("room", "").lower()
        if room_lower in row_room or row_room in room_lower:
            result = {"room": row.get("room"), "haunts": {}}
            for omen_def in omen_defs:
                key = omen_def.get("key")
                label = omen_def.get("label")
                haunt_num = row.get(key)
                if haunt_num:
                    result["haunts"][label] = haunt_num
            return result

    return None
