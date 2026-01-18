"""
Movement tools for navigating the house.

Handles player movement, room discovery, and stairs traversal.
"""

from typing import Any
from ..history_manager import load_history_file, save_history_file, add_action_to_log
from ..data_loader import get_maps_data


# Direction to coordinate offset mapping
DIRECTION_OFFSETS = {
    "up": (0, 1),
    "down": (0, -1),
    "left": (-1, 0),
    "right": (1, 0),
    "top": (0, 1),    # Alias
    "bottom": (0, -1), # Alias
}

# Direction to door side mapping
DIRECTION_TO_SIDE = {
    "up": "top",
    "down": "bottom",
    "left": "left",
    "right": "right",
    "top": "top",
    "bottom": "bottom",
}

# Opposite directions for door connections
OPPOSITE_SIDE = {
    "top": "bottom",
    "bottom": "top",
    "left": "right",
    "right": "left",
}


def _get_ai_player(state: dict) -> dict | None:
    """Get the AI player from game state."""
    for player in state.get("players", []):
        if player.get("isAI"):
            return player
    return None


def _get_room_at_position(state: dict, floor: str, x: int, y: int) -> dict | None:
    """Find a room at the given position."""
    for room in state.get("map", {}).get("placedRooms", []):
        if (room.get("floor") == floor and
            room.get("x") == x and
            room.get("y") == y):
            return room
    return None


def _get_room_by_id(state: dict, room_id: str) -> dict | None:
    """Get a room by its instance ID."""
    for room in state.get("map", {}).get("placedRooms", []):
        if room.get("instanceId") == room_id:
            return room
    return None


def _get_room_data_by_name(room_name: str) -> dict | None:
    """Get room template data by name."""
    data = get_maps_data()
    room_name_lower = room_name.lower()

    for room in data.get("ROOMS", []):
        en_name = room.get("name", {}).get("en", "").lower()
        vi_name = room.get("name", {}).get("vi", "").lower()
        if room_name_lower in en_name or room_name_lower in vi_name:
            return room
    return None


def _update_player_position(state: dict, player_id: str, new_pos: dict) -> None:
    """Update a player's position in the state."""
    for player in state.get("players", []):
        if player.get("id") == player_id:
            player["currentPosition"] = new_pos
            break


def get_movement_options(session_id: str) -> dict:
    """
    Get available movement directions for the AI player.

    Args:
        session_id: The game session ID

    Returns:
        Dict with available directions and whether they lead to explored/unexplored areas
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    ai_player = _get_ai_player(state)
    if ai_player is None:
        return {"error": "No AI player found in this session"}

    turn_state = state.get("turnState", {})
    if turn_state.get("currentPlayerId") != ai_player.get("id"):
        return {"error": "Not AI's turn"}

    movement_remaining = turn_state.get("movementRemaining", 0)
    if movement_remaining <= 0:
        return {
            "movementRemaining": 0,
            "options": [],
            "message": "No movement remaining",
        }

    current_pos = ai_player.get("currentPosition", {})
    current_room_id = current_pos.get("roomId")
    current_room = _get_room_by_id(state, current_room_id)

    if current_room is None:
        return {"error": "Current room not found"}

    options = []
    current_x = current_room.get("x", 0)
    current_y = current_room.get("y", 0)
    current_floor = current_room.get("floor", "ground")

    # Check each door in the current room
    for side, door_info in current_room.get("doors", {}).items():
        if door_info is None:
            continue

        kind = door_info.get("kind")
        connected_to = door_info.get("connectedTo")

        # Calculate target position
        dx, dy = 0, 0
        if side == "top":
            dy = 1
        elif side == "bottom":
            dy = -1
        elif side == "left":
            dx = -1
        elif side == "right":
            dx = 1

        target_x = current_x + dx
        target_y = current_y + dy

        # Check if there's a room there
        if connected_to:
            target_room = _get_room_by_id(state, connected_to)
            options.append({
                "direction": side,
                "explored": True,
                "targetRoom": {
                    "id": connected_to,
                    "name": target_room.get("roomName") if target_room else None,
                    "floor": current_floor,
                },
                "doorKind": kind,
            })
        elif kind == "door":
            # Unexplored door
            options.append({
                "direction": side,
                "explored": False,
                "targetPosition": {"x": target_x, "y": target_y, "floor": current_floor},
                "doorKind": kind,
                "message": "Moving here will reveal a new room",
            })
        elif kind == "stairs":
            # Stairs to another floor
            options.append({
                "direction": side,
                "explored": False,
                "doorKind": "stairs",
                "message": "Use 'use_stairs' to change floors",
            })

    return {
        "currentRoom": {
            "id": current_room_id,
            "name": current_room.get("roomName"),
            "floor": current_floor,
            "x": current_x,
            "y": current_y,
        },
        "movementRemaining": movement_remaining,
        "options": options,
    }


def move_direction(session_id: str, direction: str) -> dict:
    """
    Move the AI player in a direction.

    Args:
        session_id: The game session ID
        direction: Direction to move (up/down/left/right or top/bottom)

    Returns:
        Result of movement, or request to reveal room if unexplored
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    ai_player = _get_ai_player(state)
    if ai_player is None:
        return {"error": "No AI player found in this session"}

    turn_state = state.get("turnState", {})
    if turn_state.get("currentPlayerId") != ai_player.get("id"):
        return {"error": "Not AI's turn"}

    movement_remaining = turn_state.get("movementRemaining", 0)
    if movement_remaining <= 0:
        return {"error": "No movement remaining"}

    # Normalize direction
    side = DIRECTION_TO_SIDE.get(direction.lower())
    if side is None:
        return {"error": f"Invalid direction: {direction}. Use up/down/left/right"}

    current_pos = ai_player.get("currentPosition", {})
    current_room_id = current_pos.get("roomId")
    current_room = _get_room_by_id(state, current_room_id)

    if current_room is None:
        return {"error": "Current room not found"}

    # Check if there's a door in that direction
    door_info = current_room.get("doors", {}).get(side)
    if door_info is None:
        return {
            "error": f"No door in direction: {direction}",
            "availableDoors": list(current_room.get("doors", {}).keys()),
        }

    kind = door_info.get("kind")
    connected_to = door_info.get("connectedTo")

    # Handle stairs separately
    if kind == "stairs":
        return {
            "error": "Use 'use_stairs' tool to traverse stairs",
            "doorKind": "stairs",
        }

    # Handle front door (cannot exit)
    if kind == "front-door":
        return {"error": "Cannot exit through the front door"}

    # If connected to an explored room, move there
    if connected_to:
        target_room = _get_room_by_id(state, connected_to)
        if target_room is None:
            return {"error": "Connected room not found"}

        # Update position
        new_pos = {
            "floor": target_room.get("floor"),
            "roomId": connected_to,
            "x": target_room.get("x"),
            "y": target_room.get("y"),
        }
        _update_player_position(state, ai_player.get("id"), new_pos)

        # Decrease movement
        turn_state["movementRemaining"] = movement_remaining - 1
        state["turnState"] = turn_state

        save_history_file(session_id, state)

        # Log action
        add_action_to_log(session_id, {
            "turn": turn_state.get("currentTurnNumber", 1),
            "playerId": ai_player.get("id"),
            "action": "move",
            "details": {
                "from": current_pos,
                "to": new_pos,
                "direction": side,
                "targetRoom": target_room.get("roomName"),
            },
        })

        # Check for room effects
        room_data = _get_room_data_by_name(
            target_room.get("roomName", {}).get("en", "")
        )
        tokens = target_room.get("tokens", [])
        token_collected = target_room.get("tokenCollected", True)

        return {
            "success": True,
            "newPosition": new_pos,
            "room": {
                "id": connected_to,
                "name": target_room.get("roomName"),
            },
            "movementRemaining": movement_remaining - 1,
            "hasToken": not token_collected and bool(tokens),
            "tokenTypes": tokens if not token_collected else [],
            "message": f"Moved to {target_room.get('roomName', {}).get('en', 'room')}",
        }

    # Unexplored door - need to reveal a room
    current_x = current_room.get("x", 0)
    current_y = current_room.get("y", 0)
    dx, dy = DIRECTION_OFFSETS.get(side, (0, 0))
    target_x = current_x + dx
    target_y = current_y + dy

    return {
        "awaitingRoomReveal": True,
        "direction": side,
        "targetPosition": {
            "floor": current_room.get("floor"),
            "x": target_x,
            "y": target_y,
        },
        "message": "A new room needs to be revealed. Use 'reveal_room' with the drawn room name.",
    }


def reveal_room(session_id: str, room_name: str, rotation: int = 0) -> dict:
    """
    Place a revealed room on the map.

    Args:
        session_id: The game session ID
        room_name: Name of the room tile drawn
        rotation: Rotation in degrees (0, 90, 180, 270)

    Returns:
        Room placement result
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    ai_player = _get_ai_player(state)
    if ai_player is None:
        return {"error": "No AI player found in this session"}

    # Get room template data
    room_data = _get_room_data_by_name(room_name)
    if room_data is None:
        return {"error": f"Room not found: {room_name}"}

    current_pos = ai_player.get("currentPosition", {})
    current_room_id = current_pos.get("roomId")
    current_room = _get_room_by_id(state, current_room_id)

    if current_room is None:
        return {"error": "Current room not found"}

    turn_state = state.get("turnState", {})
    current_floor = current_room.get("floor", "ground")

    # Check if room can be placed on this floor
    allowed_floors = room_data.get("floorsAllowed", [])
    if current_floor not in allowed_floors:
        return {
            "error": f"Room '{room_name}' cannot be placed on {current_floor} floor",
            "allowedFloors": allowed_floors,
        }

    # Find the pending reveal direction (last attempted move through unexplored door)
    # For now, we need to determine where to place based on last movement attempt
    # This should be tracked in turn state, but for simplicity we'll calculate from doors

    # Find an unexplored door direction
    reveal_direction = None
    for side, door_info in current_room.get("doors", {}).items():
        if door_info and door_info.get("connectedTo") is None and door_info.get("kind") == "door":
            reveal_direction = side
            break

    if reveal_direction is None:
        return {"error": "No unexplored door to place room"}

    # Calculate target position
    current_x = current_room.get("x", 0)
    current_y = current_room.get("y", 0)
    dx, dy = DIRECTION_OFFSETS.get(reveal_direction, (0, 0))
    target_x = current_x + dx
    target_y = current_y + dy

    # Check if position is already occupied
    existing = _get_room_at_position(state, current_floor, target_x, target_y)
    if existing:
        return {"error": f"Position ({target_x}, {target_y}) already has a room"}

    # Generate new room ID
    map_data = state.get("map", {})
    next_id = map_data.get("nextRoomId", 4)
    new_room_id = f"room-{next_id:03d}"

    # Build doors dict with rotation applied
    base_doors = room_data.get("doors", [])
    rotated_doors = _rotate_doors(base_doors, rotation)

    # Connect the new room to current room
    opposite_side = OPPOSITE_SIDE.get(reveal_direction)
    for side in rotated_doors:
        if side == opposite_side:
            rotated_doors[side]["connectedTo"] = current_room_id

    # Update current room's door to connect to new room
    current_room["doors"][reveal_direction]["connectedTo"] = new_room_id

    # Create new room entry
    new_room = {
        "instanceId": new_room_id,
        "roomName": room_data.get("name"),
        "floor": current_floor,
        "x": target_x,
        "y": target_y,
        "rotation": rotation,
        "doors": rotated_doors,
        "tokens": room_data.get("tokens", []),
        "tokenCollected": len(room_data.get("tokens", [])) == 0,
        "roomBonusUsed": False,
    }

    # Add to map
    map_data["placedRooms"].append(new_room)
    map_data["nextRoomId"] = next_id + 1
    state["map"] = map_data

    # Move player to new room
    new_pos = {
        "floor": current_floor,
        "roomId": new_room_id,
        "x": target_x,
        "y": target_y,
    }
    _update_player_position(state, ai_player.get("id"), new_pos)

    # Decrease movement
    turn_state["movementRemaining"] = turn_state.get("movementRemaining", 1) - 1
    state["turnState"] = turn_state

    save_history_file(session_id, state)

    # Log action
    add_action_to_log(session_id, {
        "turn": turn_state.get("currentTurnNumber", 1),
        "playerId": ai_player.get("id"),
        "action": "reveal_room",
        "details": {
            "roomName": room_data.get("name"),
            "position": {"x": target_x, "y": target_y, "floor": current_floor},
            "rotation": rotation,
            "tokens": room_data.get("tokens", []),
        },
    })

    tokens = room_data.get("tokens", [])
    return {
        "success": True,
        "room": {
            "id": new_room_id,
            "name": room_data.get("name"),
            "floor": current_floor,
            "position": {"x": target_x, "y": target_y},
        },
        "newPosition": new_pos,
        "movementRemaining": turn_state.get("movementRemaining", 0),
        "hasToken": bool(tokens),
        "tokenTypes": tokens,
        "roomText": room_data.get("text", {}),
        "message": f"Revealed {room_data.get('name', {}).get('en', room_name)}",
    }


def _rotate_doors(base_doors: list[dict], rotation: int) -> dict:
    """Rotate door positions by given degrees."""
    # Rotation order: top -> right -> bottom -> left -> top
    rotation_map = {
        0: {"top": "top", "right": "right", "bottom": "bottom", "left": "left"},
        90: {"top": "right", "right": "bottom", "bottom": "left", "left": "top"},
        180: {"top": "bottom", "right": "left", "bottom": "top", "left": "right"},
        270: {"top": "left", "right": "top", "bottom": "right", "left": "bottom"},
    }

    mapping = rotation_map.get(rotation % 360, rotation_map[0])
    result = {}

    for door in base_doors:
        original_side = door.get("side")
        new_side = mapping.get(original_side, original_side)
        result[new_side] = {
            "kind": door.get("kind"),
            "connectedTo": None,
        }

    return result


def use_stairs(session_id: str, target_floor: str) -> dict:
    """
    Use stairs to move between floors.

    Args:
        session_id: The game session ID
        target_floor: Target floor (upper, ground, basement)

    Returns:
        Result of stair traversal
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    ai_player = _get_ai_player(state)
    if ai_player is None:
        return {"error": "No AI player found in this session"}

    turn_state = state.get("turnState", {})
    if turn_state.get("currentPlayerId") != ai_player.get("id"):
        return {"error": "Not AI's turn"}

    current_pos = ai_player.get("currentPosition", {})
    current_room_id = current_pos.get("roomId")
    current_room = _get_room_by_id(state, current_room_id)

    if current_room is None:
        return {"error": "Current room not found"}

    # Check if current room has stairs
    has_stairs = False
    for door_info in current_room.get("doors", {}).values():
        if door_info and door_info.get("kind") == "stairs":
            has_stairs = True
            break

    if not has_stairs:
        return {"error": "Current room does not have stairs"}

    room_name = current_room.get("roomName", {}).get("en", "")

    # Handle specific stair connections
    # Grand Staircase -> Upper Landing
    # Stairs From Basement -> Foyer (and vice versa)
    valid_transitions = {
        "Grand Staircase": {"upper": "Upper Landing"},
        "Upper Landing": {"ground": "Grand Staircase"},
        "Foyer": {"basement": "Stairs From Basement"},
        "Stairs From Basement": {"ground": "Foyer"},
    }

    transitions = valid_transitions.get(room_name, {})
    if target_floor not in transitions:
        return {
            "error": f"Cannot go to {target_floor} from {room_name}",
            "validFloors": list(transitions.keys()),
        }

    target_room_name = transitions[target_floor]

    # Find or create target room
    target_room = None
    for room in state.get("map", {}).get("placedRooms", []):
        if target_room_name in room.get("roomName", {}).get("en", ""):
            target_room = room
            break

    if target_room is None:
        return {
            "error": f"Target room {target_room_name} not yet placed on map",
            "needsReveal": True,
        }

    # Move to target room
    new_pos = {
        "floor": target_floor,
        "roomId": target_room.get("instanceId"),
        "x": target_room.get("x"),
        "y": target_room.get("y"),
    }
    _update_player_position(state, ai_player.get("id"), new_pos)

    # Stairs use 1 movement
    movement = turn_state.get("movementRemaining", 1) - 1
    turn_state["movementRemaining"] = max(0, movement)
    state["turnState"] = turn_state

    save_history_file(session_id, state)

    # Log action
    add_action_to_log(session_id, {
        "turn": turn_state.get("currentTurnNumber", 1),
        "playerId": ai_player.get("id"),
        "action": "use_stairs",
        "details": {
            "from": current_pos,
            "to": new_pos,
            "targetFloor": target_floor,
        },
    })

    return {
        "success": True,
        "newPosition": new_pos,
        "room": {
            "id": target_room.get("instanceId"),
            "name": target_room.get("roomName"),
            "floor": target_floor,
        },
        "movementRemaining": turn_state.get("movementRemaining", 0),
        "message": f"Moved to {target_floor} floor via stairs",
    }


def get_room_effects(session_id: str, room_id: str = None) -> dict:
    """
    Get effects/rules for a room.

    Args:
        session_id: The game session ID
        room_id: Optional room ID (defaults to AI player's current room)

    Returns:
        Room effects including entry/exit requirements and tokens
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    # Get target room
    if room_id:
        room = _get_room_by_id(state, room_id)
    else:
        ai_player = _get_ai_player(state)
        if ai_player is None:
            return {"error": "No AI player found"}
        room_id = ai_player.get("currentPosition", {}).get("roomId")
        room = _get_room_by_id(state, room_id)

    if room is None:
        return {"error": f"Room not found: {room_id}"}

    room_name = room.get("roomName", {}).get("en", "")
    room_data = _get_room_data_by_name(room_name)

    if room_data is None:
        return {
            "roomId": room_id,
            "roomName": room.get("roomName"),
            "effects": None,
            "tokens": room.get("tokens", []),
            "tokenCollected": room.get("tokenCollected", True),
        }

    return {
        "roomId": room_id,
        "roomName": room.get("roomName"),
        "floor": room.get("floor"),
        "text": room_data.get("text", {}),
        "tokens": room.get("tokens", []),
        "tokenCollected": room.get("tokenCollected", True),
        "roomBonusUsed": room.get("roomBonusUsed", False),
        "doors": list(room.get("doors", {}).keys()),
    }


def get_room_doors(session_id: str, room_id: str = None) -> dict:
    """
    Get detailed door information for a room.

    Args:
        session_id: The game session ID
        room_id: Optional room ID (defaults to AI player's current room)

    Returns:
        Door positions and their status (connected/unexplored)
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    # Get target room
    if room_id:
        room = _get_room_by_id(state, room_id)
    else:
        ai_player = _get_ai_player(state)
        if ai_player is None:
            return {"error": "No AI player found"}
        room_id = ai_player.get("currentPosition", {}).get("roomId")
        room = _get_room_by_id(state, room_id)

    if room is None:
        return {"error": f"Room not found: {room_id}"}

    doors_info = {}
    for side, door_info in room.get("doors", {}).items():
        if door_info is None:
            continue

        connected_to = door_info.get("connectedTo")
        connected_room = None
        if connected_to:
            connected_room = _get_room_by_id(state, connected_to)

        doors_info[side] = {
            "hasDoor": True,
            "kind": door_info.get("kind"),
            "isExplored": connected_to is not None,
            "connectedTo": connected_to,
            "connectedRoomName": connected_room.get("roomName") if connected_room else None,
        }

    # Add info about sides without doors
    for side in ["top", "bottom", "left", "right"]:
        if side not in doors_info:
            doors_info[side] = {"hasDoor": False}

    return {
        "roomId": room_id,
        "roomName": room.get("roomName"),
        "floor": room.get("floor"),
        "doors": doors_info,
        "doorCount": sum(1 for d in doors_info.values() if d.get("hasDoor")),
    }


def calculate_valid_rotations(
    session_id: str,
    room_name: str,
    entry_direction: str,
) -> dict:
    """
    Calculate valid rotations for placing a new room.

    Based on door-to-door rule: the new room must have a door facing
    the direction it's being entered from.

    Args:
        session_id: The game session ID
        room_name: Name of the room to be placed
        entry_direction: Direction player is moving (top/bottom/left/right)

    Returns:
        List of valid rotations with resulting door positions
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    # Get room template data
    room_data = _get_room_data_by_name(room_name)
    if room_data is None:
        return {"error": f"Room not found: {room_name}"}

    # Normalize entry direction
    entry_side = DIRECTION_TO_SIDE.get(entry_direction.lower())
    if entry_side is None:
        return {"error": f"Invalid direction: {entry_direction}"}

    # The new room needs a door facing the opposite direction
    # (door-to-door connection)
    required_door = OPPOSITE_SIDE.get(entry_side)

    # Get base doors from room data
    base_doors = room_data.get("doors", [])
    base_door_sides = [d.get("side") for d in base_doors]

    valid_rotations = []
    rotation_descriptions = {
        0: "No rotation",
        90: "90° clockwise",
        180: "180° (upside down)",
        270: "270° clockwise (90° counter-clockwise)",
    }

    for rotation in [0, 90, 180, 270]:
        # Calculate where doors end up after rotation
        rotated_doors = _rotate_doors(base_doors, rotation)
        rotated_sides = list(rotated_doors.keys())

        # Check if required door exists after rotation
        if required_door in rotated_sides:
            valid_rotations.append({
                "rotation": rotation,
                "description": rotation_descriptions[rotation],
                "resultingDoors": rotated_sides,
                "connectionDoor": required_door,
            })

    if not valid_rotations:
        return {
            "error": f"Room '{room_name}' cannot be placed from {entry_direction}",
            "reason": f"No rotation allows a {required_door} door",
            "baseDoors": base_door_sides,
        }

    return {
        "roomName": room_name,
        "entryDirection": entry_side,
        "requiredDoor": required_door,
        "validRotations": valid_rotations,
        "count": len(valid_rotations),
        "recommended": valid_rotations[0]["rotation"],
        "message": f"{len(valid_rotations)} valid rotation(s) for placing {room_name}",
    }


def get_door_connections(session_id: str, room_id: str = None) -> dict:
    """
    Get detailed connection information for all doors in a room.

    Args:
        session_id: The game session ID
        room_id: Optional room ID (defaults to AI player's current room)

    Returns:
        Map of door directions to connected rooms
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    # Get target room
    if room_id:
        room = _get_room_by_id(state, room_id)
    else:
        ai_player = _get_ai_player(state)
        if ai_player is None:
            return {"error": "No AI player found"}
        room_id = ai_player.get("currentPosition", {}).get("roomId")
        room = _get_room_by_id(state, room_id)

    if room is None:
        return {"error": f"Room not found: {room_id}"}

    connections = {}
    unexplored_directions = []
    explored_directions = []

    for side, door_info in room.get("doors", {}).items():
        if door_info is None:
            continue

        connected_to = door_info.get("connectedTo")
        kind = door_info.get("kind")

        if connected_to:
            connected_room = _get_room_by_id(state, connected_to)
            connections[side] = {
                "status": "explored",
                "connectedRoomId": connected_to,
                "connectedRoomName": connected_room.get("roomName") if connected_room else None,
                "floor": connected_room.get("floor") if connected_room else None,
                "doorKind": kind,
            }
            explored_directions.append(side)
        elif kind == "stairs":
            connections[side] = {
                "status": "stairs",
                "doorKind": "stairs",
                "message": "Use use_stairs tool to traverse",
            }
        elif kind == "front-door":
            connections[side] = {
                "status": "blocked",
                "doorKind": "front-door",
                "message": "Front door - cannot exit",
            }
        else:
            connections[side] = {
                "status": "unexplored",
                "doorKind": kind,
                "message": "Moving here will reveal a new room",
            }
            unexplored_directions.append(side)

    return {
        "roomId": room_id,
        "roomName": room.get("roomName"),
        "floor": room.get("floor"),
        "connections": connections,
        "exploredDoors": explored_directions,
        "unexploredDoors": unexplored_directions,
        "summary": {
            "explored": len(explored_directions),
            "unexplored": len(unexplored_directions),
        },
    }


def set_pending_room_reveal(session_id: str, direction: str) -> dict:
    """
    Set the pending direction for room reveal.

    Called before reveal_room to specify which direction the room is being placed.

    Args:
        session_id: The game session ID
        direction: Direction being moved into (top/bottom/left/right)

    Returns:
        Confirmation of pending reveal direction
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    side = DIRECTION_TO_SIDE.get(direction.lower())
    if side is None:
        return {"error": f"Invalid direction: {direction}"}

    turn_state = state.get("turnState", {})
    turn_state["pendingRevealDirection"] = side

    state["turnState"] = turn_state
    save_history_file(session_id, state)

    return {
        "success": True,
        "pendingDirection": side,
        "requiredDoor": OPPOSITE_SIDE.get(side),
        "message": f"Ready to reveal room in {side} direction",
    }
