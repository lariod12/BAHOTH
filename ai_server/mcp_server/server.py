"""
Main MCP Server for Betrayal at House on the Hill game data.

This server provides read-only access to game data through various tools.
"""

import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from .tools import cards_tools, characters_tools, maps_tools, rules_tools, haunt_tools

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

    else:
        return _json_response({"error": f"Unknown tool: {name}"})


async def run_server():
    """Run the MCP server using stdio transport."""
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())
