"""
MCP Tools for Betrayal at House on the Hill game data.
"""

from .cards_tools import (
    get_all_items,
    get_item_by_id,
    get_item_by_name,
    get_items_by_type,
    get_usable_items,
    get_item_effect,
)
from .characters_tools import (
    get_all_characters,
    get_character_by_id,
    get_character_by_name,
    get_character_traits,
    get_character_bio,
)
from .maps_tools import (
    get_all_rooms,
    get_room_by_name,
    get_rooms_by_floor,
    get_room_doors,
    get_starting_rooms,
)
from .rules_tools import (
    translate_term,
    get_trait_translation,
    get_all_translations,
)
from .haunt_tools import (
    get_haunt_page,
    get_traitor_for_haunt,
    get_all_omens,
)

__all__ = [
    # Cards/Items
    "get_all_items",
    "get_item_by_id",
    "get_item_by_name",
    "get_items_by_type",
    "get_usable_items",
    "get_item_effect",
    # Characters
    "get_all_characters",
    "get_character_by_id",
    "get_character_by_name",
    "get_character_traits",
    "get_character_bio",
    # Maps/Rooms
    "get_all_rooms",
    "get_room_by_name",
    "get_rooms_by_floor",
    "get_room_doors",
    "get_starting_rooms",
    # Rules/Translation
    "translate_term",
    "get_trait_translation",
    "get_all_translations",
    # Haunt/Traitor
    "get_haunt_page",
    "get_traitor_for_haunt",
    "get_all_omens",
]
