"""
Main MCP Server for Betrayal at House on the Hill game data.

This server provides game data access and gameplay tools for AI players.
"""

import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .tools import cards_tools, characters_tools, maps_tools, rules_tools, haunt_tools
from .tools import session_tools, turn_tools, movement_tools, dice_tools
from .tools import turn_order_tools, context_tools

# Create the MCP server instance
server = Server("bahoth-game-info")


def _json_response(data) -> list[TextContent]:
    """Convert data to JSON text content response."""
    return [TextContent(type="text", text=json.dumps(data, ensure_ascii=False, indent=2))]


@server.list_tools()
async def list_tools() -> list[Tool]:
    """List all available tools."""
    return [
        # Items/Cards tools
        Tool(
            name="get_all_items",
            description="Get a list of all items/cards in the game with basic info (id, name, type, usable, consumable).",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        Tool(
            name="get_item_by_id",
            description="Get detailed information about a specific item by its unique ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "item_id": {"type": "string", "description": "The unique ID of the item (e.g., 'long_vu_thien_than')"}
                },
                "required": ["item_id"],
            },
        ),
        Tool(
            name="get_item_by_name",
            description="Search for items by name (supports Vietnamese). Returns all matching items.",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The name or partial name to search (case-insensitive)"}
                },
                "required": ["name"],
            },
        ),
        Tool(
            name="get_items_by_type",
            description="Get all items of a specific type (item, omen, event).",
            inputSchema={
                "type": "object",
                "properties": {
                    "item_type": {"type": "string", "description": "The type to filter by (e.g., 'item', 'omen', 'event')"}
                },
                "required": ["item_type"],
            },
        ),
        Tool(
            name="get_usable_items",
            description="Get all items that can be actively used by players (usable=true).",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        Tool(
            name="get_item_effect",
            description="Get detailed effect information for a specific item including usage rules and modifiers.",
            inputSchema={
                "type": "object",
                "properties": {
                    "item_id": {"type": "string", "description": "The unique ID of the item"}
                },
                "required": ["item_id"],
            },
        ),
        # Characters tools
        Tool(
            name="get_all_characters",
            description="Get a list of all playable characters with id, name (en/vi), and color.",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        Tool(
            name="get_character_by_id",
            description="Get full details of a character by ID including traits, bio, and profile.",
            inputSchema={
                "type": "object",
                "properties": {
                    "character_id": {"type": "string", "description": "The character ID (e.g., 'professor-longfellow')"}
                },
                "required": ["character_id"],
            },
        ),
        Tool(
            name="get_character_by_name",
            description="Search for characters by name (supports Vietnamese/English/nickname).",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The name to search for (case-insensitive)"}
                },
                "required": ["name"],
            },
        ),
        Tool(
            name="get_character_traits",
            description="Get the stat traits (Speed, Might, Knowledge, Sanity) of a character with track values and starting indices.",
            inputSchema={
                "type": "object",
                "properties": {
                    "character_id": {"type": "string", "description": "The character ID"}
                },
                "required": ["character_id"],
            },
        ),
        Tool(
            name="get_character_bio",
            description="Get biographical info (age, height, weight, hobbies, backstory) of a character.",
            inputSchema={
                "type": "object",
                "properties": {
                    "character_id": {"type": "string", "description": "The character ID"},
                    "lang": {"type": "string", "description": "Language preference: 'vi' or 'en' (default: 'vi')"}
                },
                "required": ["character_id"],
            },
        ),
        # Maps/Rooms tools
        Tool(
            name="get_all_rooms",
            description="Get a list of all rooms/tiles with name, allowed floors, tokens, and starting room status.",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        Tool(
            name="get_room_by_name",
            description="Search for rooms by name (supports Vietnamese/English).",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The room name to search for"}
                },
                "required": ["name"],
            },
        ),
        Tool(
            name="get_rooms_by_floor",
            description="Get all rooms that can be placed on a specific floor.",
            inputSchema={
                "type": "object",
                "properties": {
                    "floor": {"type": "string", "description": "Floor name: 'ground', 'upper', or 'basement'"}
                },
                "required": ["floor"],
            },
        ),
        Tool(
            name="get_room_doors",
            description="Get door configuration for a specific room (sides and types).",
            inputSchema={
                "type": "object",
                "properties": {
                    "room_name": {"type": "string", "description": "The room name (Vietnamese or English)"}
                },
                "required": ["room_name"],
            },
        ),
        Tool(
            name="get_starting_rooms",
            description="Get all starting room tiles (Entrance Hall, Foyer, Grand Staircase).",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        # Translation tools
        Tool(
            name="translate_term",
            description="Translate a game term between Vietnamese and English.",
            inputSchema={
                "type": "object",
                "properties": {
                    "term": {"type": "string", "description": "The term to translate"},
                    "to_lang": {"type": "string", "description": "Target language: 'en' or 'vi' (default: 'en')"}
                },
                "required": ["term"],
            },
        ),
        Tool(
            name="get_trait_translation",
            description="Get translation for a specific trait name (Speed, Might, Sanity, Knowledge).",
            inputSchema={
                "type": "object",
                "properties": {
                    "trait": {"type": "string", "description": "Trait name in any language"}
                },
                "required": ["trait"],
            },
        ),
        Tool(
            name="get_all_translations",
            description="Get all translation sections (traits, items, omens, rooms) with their entries.",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        # Haunt/Traitor tools
        Tool(
            name="get_haunt_page",
            description="Look up the haunt number based on omen and room combination from the traitor's tome.",
            inputSchema={
                "type": "object",
                "properties": {
                    "omen": {"type": "string", "description": "Omen name/key (e.g., 'skull', 'bite', 'Đầu Lâu')"},
                    "room": {"type": "string", "description": "Room name (Vietnamese)"}
                },
                "required": ["omen", "room"],
            },
        ),
        Tool(
            name="get_traitor_for_haunt",
            description="Determine who becomes the traitor for a specific haunt number (1-50).",
            inputSchema={
                "type": "object",
                "properties": {
                    "haunt_number": {"type": "integer", "description": "The haunt number (1-50)"}
                },
                "required": ["haunt_number"],
            },
        ),
        Tool(
            name="get_all_omens",
            description="Get a list of all omens with their keys, Vietnamese labels, and aliases.",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        # ========== GAMEPLAY TOOLS ==========
        # Session Management Tools
        Tool(
            name="create_game_session",
            description="Create a new game session with specified players. AI will be one of the players.",
            inputSchema={
                "type": "object",
                "properties": {
                    "players": {
                        "type": "array",
                        "description": "List of players with characterId, name (optional), isAI (boolean)",
                        "items": {
                            "type": "object",
                            "properties": {
                                "characterId": {"type": "string"},
                                "name": {"type": "string"},
                                "isAI": {"type": "boolean"},
                            },
                            "required": ["characterId"],
                        },
                    }
                },
                "required": ["players"],
            },
        ),
        Tool(
            name="load_game_session",
            description="Load an existing game session by its ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID to load"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_game_state",
            description="Get current game state summary or specific sections.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "include": {
                        "type": "array",
                        "description": "Sections to include: players, map, turnState, inventory, actionLog",
                        "items": {"type": "string"},
                    },
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="delete_game_session",
            description="Delete a game session.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID to delete"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="list_game_sessions",
            description="List all available game sessions.",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        # Turn Management Tools
        Tool(
            name="start_turn",
            description="Start the AI player's turn. Calculates movement points from Speed stat.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="end_turn",
            description="End the AI player's turn and advance to next player.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_turn_state",
            description="Get current turn state: whose turn, phase, movement remaining.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_available_actions",
            description="Get list of actions the AI player can currently take.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        # Movement Tools
        Tool(
            name="get_movement_options",
            description="Get available movement directions from current room.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="move_direction",
            description="Move the AI player in a direction (up/down/left/right).",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "direction": {"type": "string", "description": "Direction: up, down, left, right"},
                },
                "required": ["session_id", "direction"],
            },
        ),
        Tool(
            name="reveal_room",
            description="Place a revealed room tile on the map when entering unexplored area.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "room_name": {"type": "string", "description": "Name of the room tile drawn"},
                    "rotation": {"type": "integer", "description": "Rotation in degrees: 0, 90, 180, 270"},
                },
                "required": ["session_id", "room_name"],
            },
        ),
        Tool(
            name="use_stairs",
            description="Use stairs to move between floors.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "target_floor": {"type": "string", "description": "Target floor: upper, ground, basement"},
                },
                "required": ["session_id", "target_floor"],
            },
        ),
        Tool(
            name="get_room_effects",
            description="Get effects/rules for current or specified room.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "room_id": {"type": "string", "description": "Optional room ID (defaults to current room)"},
                },
                "required": ["session_id"],
            },
        ),
        # Dice Tools
        Tool(
            name="request_dice_roll",
            description="Request a dice roll for stat check, attack, or other purpose.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "purpose": {"type": "string", "description": "Reason: stat_check, attack, room_effect, item_use, haunt_roll, event"},
                    "stat": {"type": "string", "description": "Stat to use: speed, might, knowledge, sanity"},
                    "dice_count": {"type": "integer", "description": "Optional override for number of dice"},
                    "target": {"type": "integer", "description": "Optional target number to beat"},
                },
                "required": ["session_id", "purpose"],
            },
        ),
        Tool(
            name="record_dice_result",
            description="Record the result of a dice roll from the user.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "roll_id": {"type": "string", "description": "The roll request ID"},
                    "result": {"type": "integer", "description": "The total roll result"},
                },
                "required": ["session_id", "roll_id", "result"],
            },
        ),
        Tool(
            name="get_pending_rolls",
            description="Get all pending dice rolls that need results.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        # ========== PHASE 2 TOOLS ==========
        # Turn Order Tools
        Tool(
            name="set_turn_order",
            description="Set the turn order for the game. User provides player sequence.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "player_order": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of player IDs in turn order",
                    },
                },
                "required": ["session_id", "player_order"],
            },
        ),
        Tool(
            name="get_turn_order",
            description="Get current turn order and AI's position in sequence.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="advance_turn",
            description="Advance to the next player's turn.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_players_before_ai",
            description="Get list of players who play before AI in current round.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_current_player_info",
            description="Get detailed info about whose turn it currently is.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        # Context Tools
        Tool(
            name="request_other_player_context",
            description="Request context about another player's turn (AI asks user).",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "player_id": {"type": "string", "description": "Player to ask about"},
                    "questions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Questions about the player's turn",
                    },
                },
                "required": ["session_id", "player_id", "questions"],
            },
        ),
        Tool(
            name="record_player_context",
            description="Record answers to context questions (user responds).",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "request_id": {"type": "string", "description": "Context request ID"},
                    "answers": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Answers to the questions",
                    },
                },
                "required": ["session_id", "request_id", "answers"],
            },
        ),
        Tool(
            name="get_player_context",
            description="Get recorded context for a player or all players.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "player_id": {"type": "string", "description": "Optional player ID"},
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="record_other_player_action",
            description="Record a specific action taken by another player.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "player_id": {"type": "string", "description": "Player who acted"},
                    "action": {"type": "string", "description": "Action type"},
                    "details": {"type": "object", "description": "Action details"},
                },
                "required": ["session_id", "player_id", "action"],
            },
        ),
        Tool(
            name="get_all_player_positions",
            description="Get current positions of all players.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="ask_question",
            description="AI asks a free-form question to the user.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "question": {"type": "string", "description": "The question to ask"},
                    "options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional suggested answers",
                    },
                },
                "required": ["session_id", "question"],
            },
        ),
        Tool(
            name="answer_question",
            description="User answers a pending question from AI.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "question_id": {"type": "string", "description": "Question ID"},
                    "answer": {"type": "string", "description": "The answer"},
                },
                "required": ["session_id", "question_id", "answer"],
            },
        ),
        Tool(
            name="get_pending_questions",
            description="Get all pending questions that need answers.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_pending_context_requests",
            description="Get all pending context requests that need answers.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"}
                },
                "required": ["session_id"],
            },
        ),
        # Enhanced Movement Tools
        Tool(
            name="get_room_doors_detailed",
            description="Get detailed door information for a room.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "room_id": {"type": "string", "description": "Optional room ID"},
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="calculate_valid_rotations",
            description="Calculate valid rotations for placing a new room (door-to-door rule).",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "room_name": {"type": "string", "description": "Room to place"},
                    "entry_direction": {"type": "string", "description": "Direction entering from"},
                },
                "required": ["session_id", "room_name", "entry_direction"],
            },
        ),
        Tool(
            name="get_door_connections",
            description="Get detailed connection info for all doors in a room.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "room_id": {"type": "string", "description": "Optional room ID"},
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="set_pending_room_reveal",
            description="Set direction for pending room reveal.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "direction": {"type": "string", "description": "Direction to reveal"},
                },
                "required": ["session_id", "direction"],
            },
        ),
        # Enhanced Dice Tools
        Tool(
            name="get_roll_requirements",
            description="Get dice roll requirements for a room or item.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "room_id": {"type": "string", "description": "Optional room ID"},
                    "item_id": {"type": "string", "description": "Optional item ID"},
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="interpret_roll_result",
            description="Interpret the result of a dice roll based on game rules.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "roll_id": {"type": "string", "description": "Optional roll ID"},
                    "result": {"type": "integer", "description": "Roll result"},
                    "context": {"type": "string", "description": "Roll context"},
                },
                "required": ["session_id"],
            },
        ),
        Tool(
            name="get_dice_roll_history",
            description="Get recent dice roll history.",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {"type": "string", "description": "The session ID"},
                    "limit": {"type": "integer", "description": "Max rolls to return"},
                },
                "required": ["session_id"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Handle tool calls."""

    # Items/Cards tools
    if name == "get_all_items":
        result = cards_tools.get_all_items()
        return _json_response(result)

    elif name == "get_item_by_id":
        result = cards_tools.get_item_by_id(arguments["item_id"])
        return _json_response(result or {"error": "Item not found"})

    elif name == "get_item_by_name":
        result = cards_tools.get_item_by_name(arguments["name"])
        return _json_response(result)

    elif name == "get_items_by_type":
        result = cards_tools.get_items_by_type(arguments["item_type"])
        return _json_response(result)

    elif name == "get_usable_items":
        result = cards_tools.get_usable_items()
        return _json_response(result)

    elif name == "get_item_effect":
        result = cards_tools.get_item_effect(arguments["item_id"])
        return _json_response(result or {"error": "Item not found"})

    # Characters tools
    elif name == "get_all_characters":
        result = characters_tools.get_all_characters()
        return _json_response(result)

    elif name == "get_character_by_id":
        result = characters_tools.get_character_by_id(arguments["character_id"])
        return _json_response(result or {"error": "Character not found"})

    elif name == "get_character_by_name":
        result = characters_tools.get_character_by_name(arguments["name"])
        return _json_response(result)

    elif name == "get_character_traits":
        result = characters_tools.get_character_traits(arguments["character_id"])
        return _json_response(result or {"error": "Character not found"})

    elif name == "get_character_bio":
        lang = arguments.get("lang", "vi")
        result = characters_tools.get_character_bio(arguments["character_id"], lang)
        return _json_response(result or {"error": "Character not found"})

    # Maps/Rooms tools
    elif name == "get_all_rooms":
        result = maps_tools.get_all_rooms()
        return _json_response(result)

    elif name == "get_room_by_name":
        result = maps_tools.get_room_by_name(arguments["name"])
        return _json_response(result)

    elif name == "get_rooms_by_floor":
        result = maps_tools.get_rooms_by_floor(arguments["floor"])
        return _json_response(result)

    elif name == "get_room_doors":
        result = maps_tools.get_room_doors(arguments["room_name"])
        return _json_response(result or {"error": "Room not found"})

    elif name == "get_starting_rooms":
        result = maps_tools.get_starting_rooms()
        return _json_response(result)

    # Translation tools
    elif name == "translate_term":
        to_lang = arguments.get("to_lang", "en")
        result = rules_tools.translate_term(arguments["term"], to_lang)
        return _json_response(result or {"error": "Term not found"})

    elif name == "get_trait_translation":
        result = rules_tools.get_trait_translation(arguments["trait"])
        return _json_response(result or {"error": "Trait not found"})

    elif name == "get_all_translations":
        result = rules_tools.get_all_translations()
        return _json_response(result)

    # Haunt/Traitor tools
    elif name == "get_haunt_page":
        result = haunt_tools.get_haunt_page(arguments["omen"], arguments["room"])
        return _json_response(result)

    elif name == "get_traitor_for_haunt":
        result = haunt_tools.get_traitor_for_haunt(arguments["haunt_number"])
        return _json_response(result)

    elif name == "get_all_omens":
        result = haunt_tools.get_all_omens()
        return _json_response(result)

    # ========== GAMEPLAY TOOLS ==========
    # Session Management Tools
    elif name == "create_game_session":
        result = session_tools.create_game_session(arguments["players"])
        return _json_response(result)

    elif name == "load_game_session":
        result = session_tools.load_game_session(arguments["session_id"])
        return _json_response(result)

    elif name == "get_game_state":
        include = arguments.get("include")
        result = session_tools.get_game_state(arguments["session_id"], include)
        return _json_response(result)

    elif name == "delete_game_session":
        result = session_tools.delete_game_session(arguments["session_id"])
        return _json_response(result)

    elif name == "list_game_sessions":
        result = session_tools.list_game_sessions()
        return _json_response(result)

    # Turn Management Tools
    elif name == "start_turn":
        result = turn_tools.start_turn(arguments["session_id"])
        return _json_response(result)

    elif name == "end_turn":
        result = turn_tools.end_turn(arguments["session_id"])
        return _json_response(result)

    elif name == "get_turn_state":
        result = turn_tools.get_turn_state(arguments["session_id"])
        return _json_response(result)

    elif name == "get_available_actions":
        result = turn_tools.get_available_actions(arguments["session_id"])
        return _json_response(result)

    # Movement Tools
    elif name == "get_movement_options":
        result = movement_tools.get_movement_options(arguments["session_id"])
        return _json_response(result)

    elif name == "move_direction":
        result = movement_tools.move_direction(arguments["session_id"], arguments["direction"])
        return _json_response(result)

    elif name == "reveal_room":
        rotation = arguments.get("rotation", 0)
        result = movement_tools.reveal_room(arguments["session_id"], arguments["room_name"], rotation)
        return _json_response(result)

    elif name == "use_stairs":
        result = movement_tools.use_stairs(arguments["session_id"], arguments["target_floor"])
        return _json_response(result)

    elif name == "get_room_effects":
        room_id = arguments.get("room_id")
        result = movement_tools.get_room_effects(arguments["session_id"], room_id)
        return _json_response(result)

    # Dice Tools
    elif name == "request_dice_roll":
        result = dice_tools.request_dice_roll(
            arguments["session_id"],
            arguments["purpose"],
            arguments.get("stat"),
            arguments.get("dice_count"),
            arguments.get("target"),
        )
        return _json_response(result)

    elif name == "record_dice_result":
        result = dice_tools.record_dice_result(
            arguments["session_id"],
            arguments["roll_id"],
            arguments["result"],
        )
        return _json_response(result)

    elif name == "get_pending_rolls":
        result = dice_tools.get_pending_rolls(arguments["session_id"])
        return _json_response(result)

    # ========== PHASE 2 TOOL HANDLERS ==========
    # Turn Order Tools
    elif name == "set_turn_order":
        result = turn_order_tools.set_turn_order(
            arguments["session_id"],
            arguments["player_order"],
        )
        return _json_response(result)

    elif name == "get_turn_order":
        result = turn_order_tools.get_turn_order(arguments["session_id"])
        return _json_response(result)

    elif name == "advance_turn":
        result = turn_order_tools.advance_turn(arguments["session_id"])
        return _json_response(result)

    elif name == "get_players_before_ai":
        result = turn_order_tools.get_players_before_ai(arguments["session_id"])
        return _json_response(result)

    elif name == "get_current_player_info":
        result = turn_order_tools.get_current_player_info(arguments["session_id"])
        return _json_response(result)

    # Context Tools
    elif name == "request_other_player_context":
        result = context_tools.request_other_player_context(
            arguments["session_id"],
            arguments["player_id"],
            arguments["questions"],
        )
        return _json_response(result)

    elif name == "record_player_context":
        result = context_tools.record_player_context(
            arguments["session_id"],
            arguments["request_id"],
            arguments["answers"],
        )
        return _json_response(result)

    elif name == "get_player_context":
        player_id = arguments.get("player_id")
        result = context_tools.get_player_context(arguments["session_id"], player_id)
        return _json_response(result)

    elif name == "record_other_player_action":
        details = arguments.get("details")
        result = context_tools.record_other_player_action(
            arguments["session_id"],
            arguments["player_id"],
            arguments["action"],
            details,
        )
        return _json_response(result)

    elif name == "get_all_player_positions":
        result = context_tools.get_all_player_positions(arguments["session_id"])
        return _json_response(result)

    elif name == "ask_question":
        options = arguments.get("options")
        result = context_tools.ask_question(
            arguments["session_id"],
            arguments["question"],
            options,
        )
        return _json_response(result)

    elif name == "answer_question":
        result = context_tools.answer_question(
            arguments["session_id"],
            arguments["question_id"],
            arguments["answer"],
        )
        return _json_response(result)

    elif name == "get_pending_questions":
        result = context_tools.get_pending_questions(arguments["session_id"])
        return _json_response(result)

    elif name == "get_pending_context_requests":
        result = context_tools.get_pending_context_requests(arguments["session_id"])
        return _json_response(result)

    # Enhanced Movement Tools
    elif name == "get_room_doors_detailed":
        room_id = arguments.get("room_id")
        result = movement_tools.get_room_doors(arguments["session_id"], room_id)
        return _json_response(result)

    elif name == "calculate_valid_rotations":
        result = movement_tools.calculate_valid_rotations(
            arguments["session_id"],
            arguments["room_name"],
            arguments["entry_direction"],
        )
        return _json_response(result)

    elif name == "get_door_connections":
        room_id = arguments.get("room_id")
        result = movement_tools.get_door_connections(arguments["session_id"], room_id)
        return _json_response(result)

    elif name == "set_pending_room_reveal":
        result = movement_tools.set_pending_room_reveal(
            arguments["session_id"],
            arguments["direction"],
        )
        return _json_response(result)

    # Enhanced Dice Tools
    elif name == "get_roll_requirements":
        room_id = arguments.get("room_id")
        item_id = arguments.get("item_id")
        result = dice_tools.get_roll_requirements(
            arguments["session_id"],
            room_id,
            item_id,
        )
        return _json_response(result)

    elif name == "interpret_roll_result":
        result = dice_tools.interpret_roll_result(
            arguments["session_id"],
            arguments.get("roll_id"),
            arguments.get("result"),
            arguments.get("context"),
        )
        return _json_response(result)

    elif name == "get_dice_roll_history":
        limit = arguments.get("limit", 10)
        result = dice_tools.get_dice_roll_history(arguments["session_id"], limit)
        return _json_response(result)

    else:
        return _json_response({"error": f"Unknown tool: {name}"})


async def run_server():
    """Run the MCP server using stdio transport."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())
