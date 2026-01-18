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

# Gameplay Tools
from .session_tools import (
    create_game_session,
    load_game_session,
    get_game_state,
    delete_game_session,
    list_game_sessions,
)
from .turn_tools import (
    start_turn,
    end_turn,
    get_turn_state,
    get_available_actions,
)
from .movement_tools import (
    get_movement_options,
    move_direction,
    reveal_room,
    use_stairs,
    get_room_effects,
    get_room_doors,
    calculate_valid_rotations,
    get_door_connections,
    set_pending_room_reveal,
)
from .dice_tools import (
    request_dice_roll,
    record_dice_result,
    get_pending_rolls,
    cancel_pending_roll,
    get_roll_requirements,
    interpret_roll_result,
    get_dice_roll_history,
)
from .turn_order_tools import (
    set_turn_order,
    get_turn_order,
    advance_turn,
    get_players_before_ai,
    get_current_player_info,
)
from .context_tools import (
    request_other_player_context,
    record_player_context,
    get_player_context,
    record_other_player_action,
    get_all_player_positions,
    ask_question,
    answer_question,
    get_pending_questions,
    get_pending_context_requests,
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
    # Session Management
    "create_game_session",
    "load_game_session",
    "get_game_state",
    "delete_game_session",
    "list_game_sessions",
    # Turn Management
    "start_turn",
    "end_turn",
    "get_turn_state",
    "get_available_actions",
    # Movement
    "get_movement_options",
    "move_direction",
    "reveal_room",
    "use_stairs",
    "get_room_effects",
    "get_room_doors",
    "calculate_valid_rotations",
    "get_door_connections",
    "set_pending_room_reveal",
    # Dice
    "request_dice_roll",
    "record_dice_result",
    "get_pending_rolls",
    "cancel_pending_roll",
    "get_roll_requirements",
    "interpret_roll_result",
    "get_dice_roll_history",
    # Turn Order
    "set_turn_order",
    "get_turn_order",
    "advance_turn",
    "get_players_before_ai",
    "get_current_player_info",
    # Context
    "request_other_player_context",
    "record_player_context",
    "get_player_context",
    "record_other_player_action",
    "get_all_player_positions",
    "ask_question",
    "answer_question",
    "get_pending_questions",
    "get_pending_context_requests",
]
