"""
MCP Server for Betrayal at House on the Hill Game Info

This module provides an MCP (Model Context Protocol) server that exposes
game data through various tools for querying characters, items, rooms,
translations, and haunt/traitor information.

Phase 1 adds gameplay tools for AI to play the game:
- Session management (create, load, save game state)
- Turn management (start/end turn, track movement)
- Movement tools (move, reveal rooms, use stairs)
- Dice tools (request rolls, record results)
"""

__version__ = "2.0.0"
