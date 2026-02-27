"""Shared in-memory state for SIGMA backend.

Stores canvas state per thread and provides the contextvar
for tools to know which thread they're operating on.
"""

from __future__ import annotations

from contextvars import ContextVar

from models import get_seed_bmc, get_seed_segments, get_seed_vpc

# Context variable — set before each agent invocation so tools
# know which thread's canvas state to read/write.
current_thread_id: ContextVar[str] = ContextVar("current_thread_id")

# In-memory canvas state keyed by thread_id.
canvas_store: dict[str, dict] = {}


def get_canvas_state(thread_id: str) -> dict:
    """Get or initialize canvas state for a thread."""
    if thread_id not in canvas_store:
        canvas_store[thread_id] = {
            "bmc": get_seed_bmc().model_dump(),
            "vpc": get_seed_vpc().model_dump(),
            "segments": [s.model_dump() for s in get_seed_segments()],
            "versions": [],
            "pending_changes": [],
            "rejected_changes": [],
            "undo_stack": [],
            "redo_stack": [],
            "auto_mode": False,
            "action_log": [],
        }
    return canvas_store[thread_id]
