#!/usr/bin/env python3
"""
Entry point for the BAHOTH Game Info MCP Server.

Run with:
    python run_mcp_server.py

Or configure in Claude Desktop/Code as an MCP server.
"""

import asyncio
import sys
from pathlib import Path

# Add the ai_server directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from mcp_server.server import run_server


def main():
    """Main entry point."""
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
