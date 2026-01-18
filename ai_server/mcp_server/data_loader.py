"""
Data loader for game info JSON files.
Provides cached access to all game data.
"""

import json
from pathlib import Path
from typing import Any

# Cache for loaded data
_cache: dict[str, Any] = {}

def _get_data_dir() -> Path:
    """Get the path to the game_info data directory."""
    return Path(__file__).parent.parent / "data" / "game_info"


def _load_json(filename: str) -> Any:
    """Load a JSON file from the data directory with caching."""
    if filename in _cache:
        return _cache[filename]

    filepath = _get_data_dir() / filename
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    _cache[filename] = data
    return data


def get_items_data() -> dict:
    """Load items/cards data."""
    return _load_json("cardsData.json")


def get_characters_data() -> dict:
    """Load characters data."""
    return _load_json("charactersData.json")


def get_maps_data() -> dict:
    """Load rooms/maps data."""
    return _load_json("mapsData.json")


def get_translations_data() -> dict:
    """Load translation reference data."""
    return _load_json("rulesBookVietnameseEnglishTableData.json")


def get_haunt_reference_data() -> dict:
    """Load haunt reference table data."""
    return _load_json("traitorsTomeReferenceTableData.json")


def get_traitor_map_data() -> dict:
    """Load traitor determination map data."""
    return _load_json("traitorsTomeTraitorMap.json")


def clear_cache() -> None:
    """Clear the data cache."""
    _cache.clear()
