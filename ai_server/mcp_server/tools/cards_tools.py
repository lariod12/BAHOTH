"""
MCP Tools for querying Items/Cards data.
"""

from typing import Any
from ..data_loader import get_items_data


def get_all_items() -> list[dict]:
    """
    Get a list of all items in the game.

    Returns:
        List of all item objects with id, name, type, and basic info.
    """
    data = get_items_data()
    items = data.get("ITEMS", [])
    # Return simplified list for overview
    return [
        {
            "id": item.get("id"),
            "name": item.get("name", {}),
            "type": item.get("type"),
            "usable": item.get("usable", False),
            "consumable": item.get("consumable", False),
        }
        for item in items
    ]


def get_item_by_id(item_id: str) -> dict | None:
    """
    Get detailed information about an item by its ID.

    Args:
        item_id: The unique identifier of the item.

    Returns:
        Full item object if found, None otherwise.
    """
    data = get_items_data()
    items = data.get("ITEMS", [])

    for item in items:
        if item.get("id") == item_id:
            return item

    return None


def get_item_by_name(name: str) -> list[dict]:
    """
    Search for items by name (supports Vietnamese).

    Args:
        name: The name or partial name to search for (case-insensitive).

    Returns:
        List of matching items.
    """
    data = get_items_data()
    items = data.get("ITEMS", [])
    name_lower = name.lower()

    results = []
    for item in items:
        item_name = item.get("name", {})
        vi_name = item_name.get("vi", "").lower()
        en_name = item_name.get("en", "").lower()

        if name_lower in vi_name or name_lower in en_name:
            results.append(item)

    return results


def get_items_by_type(item_type: str) -> list[dict]:
    """
    Get all items of a specific type.

    Args:
        item_type: The type of items to filter (e.g., "item", "omen", "event").

    Returns:
        List of items matching the specified type.
    """
    data = get_items_data()
    items = data.get("ITEMS", [])

    return [item for item in items if item.get("type") == item_type]


def get_usable_items() -> list[dict]:
    """
    Get all items that can be actively used by players.

    Returns:
        List of items with usable=True.
    """
    data = get_items_data()
    items = data.get("ITEMS", [])

    return [item for item in items if item.get("usable", False)]


def get_item_effect(item_id: str) -> dict | None:
    """
    Get the effect details of a specific item.

    Args:
        item_id: The unique identifier of the item.

    Returns:
        Dict containing effect information, usage rules, and modifiers.
    """
    item = get_item_by_id(item_id)
    if not item:
        return None

    return {
        "id": item.get("id"),
        "name": item.get("name"),
        "text": item.get("text"),
        "effect": item.get("effect"),
        "useOnRoll": item.get("useOnRoll", False),
        "usePerTurn": item.get("usePerTurn"),
        "useBeforeRoll": item.get("useBeforeRoll", False),
        "useBeforeMove": item.get("useBeforeMove", False),
        "consumable": item.get("consumable", False),
        "toggleable": item.get("toggleable", False),
        "passive": item.get("passive", False),
        "damageReduction": item.get("damageReduction"),
        "onGain": item.get("onGain"),
        "onLose": item.get("onLose"),
        "rollStat": item.get("rollStat"),
        "canTargetAllyInRoom": item.get("canTargetAllyInRoom", False),
        "cannotSteal": item.get("cannotSteal", False),
    }
