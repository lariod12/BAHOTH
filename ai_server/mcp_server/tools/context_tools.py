"""
Context tracking tools for multi-player awareness.

Handles tracking other players' actions, asking questions, and maintaining
game context for AI decision-making.
"""

import uuid
from typing import Any
from ..history_manager import load_history_file, save_history_file, add_action_to_log


def _get_ai_player(state: dict) -> dict | None:
    """Get the AI player from game state."""
    for player in state.get("players", []):
        if player.get("isAI"):
            return player
    return None


def request_other_player_context(
    session_id: str,
    player_id: str,
    questions: list[str],
) -> dict:
    """
    Request context about another player's turn.

    AI uses this to ask about what happened during other players' turns.

    Args:
        session_id: The game session ID
        player_id: The player to ask about
        questions: List of questions about the player's turn

    Returns:
        Request ID for tracking the response
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    # Validate player exists
    player_exists = any(p.get("id") == player_id for p in state.get("players", []))
    if not player_exists:
        return {"error": f"Player not found: {player_id}"}

    # Get player name
    player_name = None
    for p in state.get("players", []):
        if p.get("id") == player_id:
            player_name = p.get("name", player_id)
            break

    # Generate request ID
    request_id = f"ctx-{str(uuid.uuid4())[:8]}"

    # Create context request
    context_request = {
        "requestId": request_id,
        "playerId": player_id,
        "playerName": player_name,
        "questions": questions,
        "status": "pending",
        "answers": None,
        "turn": state.get("turnState", {}).get("currentTurnNumber", 1),
    }

    # Add to context requests
    if "contextRequests" not in state:
        state["contextRequests"] = []
    state["contextRequests"].append(context_request)

    save_history_file(session_id, state)

    return {
        "requestId": request_id,
        "playerId": player_id,
        "playerName": player_name,
        "questions": questions,
        "status": "pending",
        "message": f"Please answer the following questions about {player_name}'s turn:",
        "questionList": [f"{i+1}. {q}" for i, q in enumerate(questions)],
    }


def record_player_context(
    session_id: str,
    request_id: str,
    answers: list[str],
) -> dict:
    """
    Record answers to context questions.

    User provides answers to AI's questions about other players.

    Args:
        session_id: The game session ID
        request_id: The context request ID
        answers: List of answers corresponding to questions

    Returns:
        Confirmation of recorded context
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    # Find the context request
    context_requests = state.get("contextRequests", [])
    request_index = None
    request = None

    for i, req in enumerate(context_requests):
        if req.get("requestId") == request_id:
            request_index = i
            request = req
            break

    if request is None:
        return {
            "error": f"Context request not found: {request_id}",
            "pendingRequests": [r.get("requestId") for r in context_requests if r.get("status") == "pending"],
        }

    # Update the request
    request["answers"] = answers
    request["status"] = "answered"
    context_requests[request_index] = request

    # Also add to other players context for long-term tracking
    if "otherPlayersContext" not in state:
        state["otherPlayersContext"] = []

    # Build Q&A summary
    qa_pairs = []
    questions = request.get("questions", [])
    for i, q in enumerate(questions):
        a = answers[i] if i < len(answers) else "No answer"
        qa_pairs.append({"question": q, "answer": a})

    context_entry = {
        "turn": request.get("turn", 1),
        "playerId": request.get("playerId"),
        "playerName": request.get("playerName"),
        "context": qa_pairs,
        "summary": "; ".join([f"{qa['question']}: {qa['answer']}" for qa in qa_pairs]),
    }
    state["otherPlayersContext"].append(context_entry)

    state["contextRequests"] = context_requests
    save_history_file(session_id, state)

    return {
        "success": True,
        "requestId": request_id,
        "playerId": request.get("playerId"),
        "playerName": request.get("playerName"),
        "contextRecorded": qa_pairs,
        "message": f"Context recorded for {request.get('playerName')}'s turn",
    }


def get_player_context(session_id: str, player_id: str = None) -> dict:
    """
    Get recorded context for a player or all players.

    Args:
        session_id: The game session ID
        player_id: Optional player ID to filter by

    Returns:
        Context history for the player(s)
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    all_context = state.get("otherPlayersContext", [])

    if player_id:
        context = [c for c in all_context if c.get("playerId") == player_id]
        player_name = None
        for p in state.get("players", []):
            if p.get("id") == player_id:
                player_name = p.get("name")
                break

        return {
            "playerId": player_id,
            "playerName": player_name,
            "contextEntries": context,
            "count": len(context),
        }

    # Return all context grouped by player
    by_player = {}
    for entry in all_context:
        pid = entry.get("playerId")
        if pid not in by_player:
            by_player[pid] = {
                "playerName": entry.get("playerName"),
                "entries": [],
            }
        by_player[pid]["entries"].append(entry)

    return {
        "allContext": by_player,
        "totalEntries": len(all_context),
    }


def record_other_player_action(
    session_id: str,
    player_id: str,
    action: str,
    details: dict = None,
) -> dict:
    """
    Record a specific action taken by another player.

    Used for tracking important game events during other players' turns.

    Args:
        session_id: The game session ID
        player_id: The player who took the action
        action: Action type (move, draw_card, attack, use_item, etc.)
        details: Additional action details

    Returns:
        Confirmation of recorded action
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    # Get player name
    player_name = None
    for p in state.get("players", []):
        if p.get("id") == player_id:
            player_name = p.get("name")
            break

    if player_name is None:
        return {"error": f"Player not found: {player_id}"}

    turn_number = state.get("turnState", {}).get("currentTurnNumber", 1)

    # Record in action log
    action_entry = {
        "turn": turn_number,
        "playerId": player_id,
        "playerName": player_name,
        "action": action,
        "details": details or {},
        "isOtherPlayer": True,
    }

    add_action_to_log(session_id, action_entry)

    # Also add to other players context
    if "otherPlayersContext" not in state:
        state["otherPlayersContext"] = []

    # Find or create entry for this player this turn
    existing_entry = None
    for entry in state["otherPlayersContext"]:
        if entry.get("playerId") == player_id and entry.get("turn") == turn_number:
            existing_entry = entry
            break

    if existing_entry:
        if "actions" not in existing_entry:
            existing_entry["actions"] = []
        existing_entry["actions"].append({"action": action, "details": details})
    else:
        state["otherPlayersContext"].append({
            "turn": turn_number,
            "playerId": player_id,
            "playerName": player_name,
            "actions": [{"action": action, "details": details}],
        })

    save_history_file(session_id, state)

    return {
        "success": True,
        "playerId": player_id,
        "playerName": player_name,
        "action": action,
        "details": details,
        "turn": turn_number,
        "message": f"Recorded: {player_name} - {action}",
    }


def get_all_player_positions(session_id: str) -> dict:
    """
    Get current positions of all players.

    Args:
        session_id: The game session ID

    Returns:
        Map of player positions
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    players = state.get("players", [])
    positions = []

    # Get room names from map
    room_names = {}
    for room in state.get("map", {}).get("placedRooms", []):
        room_names[room.get("instanceId")] = room.get("roomName")

    for player in players:
        pos = player.get("currentPosition", {})
        room_id = pos.get("roomId")

        positions.append({
            "playerId": player.get("id"),
            "playerName": player.get("name"),
            "characterId": player.get("characterId"),
            "isAI": player.get("isAI", False),
            "position": {
                "floor": pos.get("floor"),
                "roomId": room_id,
                "roomName": room_names.get(room_id, "Unknown"),
                "x": pos.get("x"),
                "y": pos.get("y"),
            },
        })

    # Group by room for convenience
    by_room = {}
    for p in positions:
        room_id = p["position"]["roomId"]
        if room_id not in by_room:
            by_room[room_id] = {
                "roomName": p["position"]["roomName"],
                "floor": p["position"]["floor"],
                "players": [],
            }
        by_room[room_id]["players"].append({
            "id": p["playerId"],
            "name": p["playerName"],
            "isAI": p["isAI"],
        })

    return {
        "positions": positions,
        "byRoom": by_room,
        "totalPlayers": len(positions),
    }


def ask_question(
    session_id: str,
    question: str,
    options: list[str] = None,
) -> dict:
    """
    AI asks a free-form question to the user.

    Args:
        session_id: The game session ID
        question: The question to ask
        options: Optional list of suggested answers

    Returns:
        Question ID for tracking the response
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    # Generate question ID
    question_id = f"q-{str(uuid.uuid4())[:8]}"

    # Create pending question
    pending_question = {
        "questionId": question_id,
        "question": question,
        "options": options,
        "status": "pending",
        "answer": None,
        "turn": state.get("turnState", {}).get("currentTurnNumber", 1),
    }

    # Add to pending questions
    if "pendingQuestions" not in state:
        state["pendingQuestions"] = []
    state["pendingQuestions"].append(pending_question)

    save_history_file(session_id, state)

    response = {
        "questionId": question_id,
        "question": question,
        "status": "pending",
        "message": f"AI asks: {question}",
    }

    if options:
        response["options"] = options
        response["message"] += f" Options: {', '.join(options)}"

    return response


def answer_question(session_id: str, question_id: str, answer: str) -> dict:
    """
    User answers a pending question from AI.

    Args:
        session_id: The game session ID
        question_id: The question ID to answer
        answer: The user's answer

    Returns:
        Confirmation with the Q&A
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    pending_questions = state.get("pendingQuestions", [])

    # Find the question
    question_index = None
    question = None
    for i, q in enumerate(pending_questions):
        if q.get("questionId") == question_id:
            question_index = i
            question = q
            break

    if question is None:
        return {
            "error": f"Question not found: {question_id}",
            "pendingQuestions": [q.get("questionId") for q in pending_questions if q.get("status") == "pending"],
        }

    # Update the question
    question["answer"] = answer
    question["status"] = "answered"
    pending_questions[question_index] = question

    state["pendingQuestions"] = pending_questions
    save_history_file(session_id, state)

    return {
        "success": True,
        "questionId": question_id,
        "question": question.get("question"),
        "answer": answer,
        "message": f"Q: {question.get('question')} → A: {answer}",
    }


def get_pending_questions(session_id: str) -> dict:
    """
    Get all pending questions that need answers.

    Args:
        session_id: The game session ID

    Returns:
        List of pending questions
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    pending = [
        q for q in state.get("pendingQuestions", [])
        if q.get("status") == "pending"
    ]

    if not pending:
        return {
            "hasPendingQuestions": False,
            "questions": [],
            "message": "No pending questions",
        }

    return {
        "hasPendingQuestions": True,
        "count": len(pending),
        "questions": pending,
    }


def get_pending_context_requests(session_id: str) -> dict:
    """
    Get all pending context requests that need answers.

    Args:
        session_id: The game session ID

    Returns:
        List of pending context requests
    """
    state = load_history_file(session_id)
    if state is None:
        return {"error": f"Session not found: {session_id}"}

    pending = [
        r for r in state.get("contextRequests", [])
        if r.get("status") == "pending"
    ]

    if not pending:
        return {
            "hasPendingRequests": False,
            "requests": [],
            "message": "No pending context requests",
        }

    return {
        "hasPendingRequests": True,
        "count": len(pending),
        "requests": pending,
    }
