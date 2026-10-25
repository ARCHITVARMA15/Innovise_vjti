"""
In-memory session store for multi-turn conversation.
NOT persistent across server restarts (acceptable for demo).
"""

from collections import defaultdict
from datetime import datetime, timezone

MAX_HISTORY_TURNS = 6
MAX_TURN_CHARS = 500
SESSION_TTL_HOURS = 2


class SessionStore:
    """Server-side session memory keyed by session_id."""

    def __init__(self) -> None:
        self._sessions: dict[str, dict] = {}

    def _ensure_session(self, session_id: str) -> dict:
        if session_id not in self._sessions:
            self._sessions[session_id] = {
                "history": [],
                "last_active": datetime.now(timezone.utc).isoformat(),
            }
        return self._sessions[session_id]

    def get_history(self, session_id: str) -> list[dict[str, str]]:
        """Get conversation history for a session, capped and truncated."""
        self._cleanup_expired()
        session = self._ensure_session(session_id)
        session["last_active"] = datetime.now(timezone.utc).isoformat()
        return session["history"][-MAX_HISTORY_TURNS:]

    def add_turn(self, session_id: str, role: str, content: str) -> None:
        """Add a conversation turn."""
        session = self._ensure_session(session_id)
        truncated = content[:MAX_TURN_CHARS]
        session["history"].append({"role": role, "content": truncated})
        session["last_active"] = datetime.now(timezone.utc).isoformat()

        if len(session["history"]) > MAX_HISTORY_TURNS:
            session["history"] = session["history"][-MAX_HISTORY_TURNS:]

    def clear(self, session_id: str) -> None:
        """Clear a session."""
        self._sessions.pop(session_id, None)

    def list_sessions(self) -> list[dict]:
        """List all active sessions."""
        self._cleanup_expired()
        return [
            {
                "session_id": sid,
                "turns": len(data["history"]),
                "last_active": data["last_active"],
            }
            for sid, data in self._sessions.items()
        ]

    def _cleanup_expired(self) -> None:
        """Remove sessions older than TTL."""
        now = datetime.now(timezone.utc)
        expired = []
        for sid, data in self._sessions.items():
            try:
                last = datetime.fromisoformat(data["last_active"])
                if (now - last).total_seconds() > SESSION_TTL_HOURS * 3600:
                    expired.append(sid)
            except Exception:
                expired.append(sid)
        for sid in expired:
            del self._sessions[sid]
