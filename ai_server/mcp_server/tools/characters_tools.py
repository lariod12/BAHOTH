"""
MCP Tools for querying Characters data.
"""

from typing import Any
from ..data_loader import get_characters_data


def get_all_characters() -> list[dict]:
    """
    Get a list of all playable characters in the game.

    Returns:
        List of character objects with id, name, and color.
    """
    data = get_characters_data()
    characters = data.get("CHARACTERS", [])

    return [
        {
            "id": char.get("id"),
            "name": char.get("name", {}),
            "color": char.get("color"),
        }
        for char in characters
    ]


def get_character_by_id(character_id: str) -> dict | None:
    """
    Get detailed information about a character by ID.

    Args:
        character_id: The unique identifier of the character.

    Returns:
        Full character object if found, None otherwise.
    """
    data = get_characters_data()
    characters = data.get("CHARACTERS", [])

    for char in characters:
        if char.get("id") == character_id:
            return char

    return None


def get_character_by_name(name: str) -> list[dict]:
    """
    Search for characters by name (supports Vietnamese/English).

    Args:
        name: The name or partial name to search for (case-insensitive).

    Returns:
        List of matching characters.
    """
    data = get_characters_data()
    characters = data.get("CHARACTERS", [])
    name_lower = name.lower()

    results = []
    for char in characters:
        char_name = char.get("name", {})
        en_name = char_name.get("en", "").lower()
        vi_name = char_name.get("vi", "").lower()
        nickname = char_name.get("nickname", "").lower()

        if name_lower in en_name or name_lower in vi_name or name_lower in nickname:
            results.append(char)

    return results


def get_character_traits(character_id: str) -> dict | None:
    """
    Get the stat traits of a character (Speed, Might, Knowledge, Sanity).

    Args:
        character_id: The unique identifier of the character.

    Returns:
        Dict containing traits with track values and starting indices.
    """
    char = get_character_by_id(character_id)
    if not char:
        return None

    traits = char.get("traits", {})

    # Calculate starting values for each trait
    result = {
        "id": char.get("id"),
        "name": char.get("name"),
    }

    for trait_name, trait_data in traits.items():
        track = trait_data.get("track", [])
        start_index = trait_data.get("startIndex", 0)
        starting_value = track[start_index] if start_index < len(track) else None

        result[trait_name] = {
            "track": track,
            "startIndex": start_index,
            "startingValue": starting_value,
            "minValue": track[0] if track else None,
            "maxValue": track[-1] if track else None,
        }

    return result


def get_character_bio(character_id: str, lang: str = "vi") -> dict | None:
    """
    Get biographical information about a character.

    Args:
        character_id: The unique identifier of the character.
        lang: Language preference ("vi" for Vietnamese, "en" for English).

    Returns:
        Dict containing bio and profile information.
    """
    char = get_character_by_id(character_id)
    if not char:
        return None

    bio = char.get("bio", {}).get(lang, char.get("bio", {}).get("en", {}))
    profile = char.get("profile", {}).get(lang, char.get("profile", {}).get("en", {}))

    return {
        "id": char.get("id"),
        "name": char.get("name"),
        "color": char.get("color"),
        "bio": bio,
        "profile": profile,
    }
