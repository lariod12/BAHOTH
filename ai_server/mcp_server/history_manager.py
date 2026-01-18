"""
History Manager for game state persistence.

Handles read/write operations for game session history files.
Files are stored in data/game_history/<session_id>.json
"""

import json
import os
import uuid
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any


# Path to game history directory
HISTORY_DIR = Path(__file__).parent.parent / "data" / "game_history"


def _ensure_history_dir():
    """Ensure the history directory exists."""
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)


def _get_history_path(session_id: str) -> Path:
    """Get the full path for a session's history file."""
    return HISTORY_DIR / f"{session_id}.json"


def generate_session_id() -> str:
    """Generate a new unique session ID."""
    return str(uuid.uuid4())


def create_history_file(session_id: str, initial_state: dict) -> str:
    """
    Create a new history file for a game session.

    Args:
        session_id: Unique identifier for the session
        initial_state: Initial game state dictionary

    Returns:
        The session_id if successful

    Raises:
        FileExistsError: If session already exists
    """
    _ensure_history_dir()
    path = _get_history_path(session_id)

    if path.exists():
        raise FileExistsError(f"Session {session_id} already exists")

    # Add metadata
    state = {
        "meta": {
            "sessionId": session_id,
            "createdAt": datetime.utcnow().isoformat() + "Z",
            "lastUpdated": datetime.utcnow().isoformat() + "Z",
            "gamePhase": "exploration",
            "hauntNumber": None,
        },
        **initial_state,
    }

    _atomic_write(path, state)
    return session_id


def load_history_file(session_id: str) -> dict | None:
    """
    Load a game session's history file.

    Args:
        session_id: The session ID to load

    Returns:
        The game state dictionary, or None if not found
    """
    path = _get_history_path(session_id)

    if not path.exists():
        return None

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_history_file(session_id: str, state: dict) -> bool:
    """
    Save game state to history file.

    Args:
        session_id: The session ID
        state: The game state to save

    Returns:
        True if successful, False otherwise
    """
    path = _get_history_path(session_id)

    if not path.exists():
        return False

    # Update lastUpdated timestamp
    if "meta" in state:
        state["meta"]["lastUpdated"] = datetime.utcnow().isoformat() + "Z"

    _atomic_write(path, state)
    return True


def delete_history_file(session_id: str) -> bool:
    """
    Delete a game session's history file.

    Args:
        session_id: The session ID to delete

    Returns:
        True if deleted, False if not found
    """
    path = _get_history_path(session_id)

    if not path.exists():
        return False

    path.unlink()
    return True


def list_sessions() -> list[dict]:
    """
    List all available game sessions.

    Returns:
        List of session info dictionaries with id, createdAt, gamePhase
    """
    _ensure_history_dir()
    sessions = []

    for file_path in HISTORY_DIR.glob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                meta = data.get("meta", {})
                sessions.append({
                    "sessionId": meta.get("sessionId", file_path.stem),
                    "createdAt": meta.get("createdAt"),
                    "lastUpdated": meta.get("lastUpdated"),
                    "gamePhase": meta.get("gamePhase"),
                    "playerCount": len(data.get("players", [])),
                })
        except (json.JSONDecodeError, IOError):
            continue

    # Sort by lastUpdated descending
    sessions.sort(key=lambda x: x.get("lastUpdated", ""), reverse=True)
    return sessions


def session_exists(session_id: str) -> bool:
    """Check if a session exists."""
    return _get_history_path(session_id).exists()


def _atomic_write(path: Path, data: dict):
    """
    Write data to file atomically using temp file + rename.

    This ensures data integrity even if the process crashes mid-write.
    """
    # Write to temp file in same directory
    fd, temp_path = tempfile.mkstemp(
        dir=path.parent,
        prefix=".tmp_",
        suffix=".json"
    )

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Atomic rename (works on same filesystem)
        temp_path_obj = Path(temp_path)
        temp_path_obj.replace(path)
    except Exception:
        # Clean up temp file on error
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise


def add_action_to_log(session_id: str, action: dict) -> bool:
    """
    Add an action to the session's action log.

    Args:
        session_id: The session ID
        action: Action dictionary with turn, playerId, action type, details

    Returns:
        True if successful
    """
    state = load_history_file(session_id)
    if state is None:
        return False

    if "actionLog" not in state:
        state["actionLog"] = []

    # Add timestamp if not present
    if "timestamp" not in action:
        action["timestamp"] = datetime.utcnow().isoformat() + "Z"

    state["actionLog"].append(action)
    return save_history_file(session_id, state)


def get_action_log(session_id: str, last_n: int = None) -> list[dict]:
    """
    Get the action log for a session.

    Args:
        session_id: The session ID
        last_n: Optional limit to last N actions

    Returns:
        List of actions, or empty list if session not found
    """
    state = load_history_file(session_id)
    if state is None:
        return []

    log = state.get("actionLog", [])

    if last_n is not None:
        return log[-last_n:]

    return log
