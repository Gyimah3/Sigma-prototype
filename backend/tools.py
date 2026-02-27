"""Custom tools for SIGMA canvas management.

Tools use a shared contextvar to access per-thread canvas state.
No InjectedState — works with any LangChain agent executor.
"""

from __future__ import annotations

import json
from typing import Optional

from langchain_core.tools import tool

from models import (
    ActionOutcome,
    BMCCanvas,
    CanvasItem,
    CanvasType,
    CanvasVersion,
    ChangeAction,
    CustomerSegment,
    Importance,
    ProposedChange,
    SegmentImportance,
    VPCCanvas,
)
from state import current_thread_id, get_canvas_state


# ── Think Tool (strategic reflection) ──────────────────────────────


@tool(parse_docstring=True)
def think(reflection: str) -> str:
    """Tool for strategic reflection on experiment outcomes and canvas decisions.

    Use this tool to pause and reason carefully before proposing canvas updates.
    This creates a deliberate thinking step for quality decision-making.

    When to use:
    - After hearing an experiment outcome: What does this mean for the business model?
    - Before proposing changes: Which canvases should be updated and why?
    - When assessing evidence quality: Is this strong enough to warrant a canvas change?
    - Before concluding: Have I covered all implications of this learning?

    Reflection should address:
    1. What concrete evidence did the founder share?
    2. Which canvas fields are affected and how?
    3. Are there any existing items that would be duplicated?
    4. What is the connection between the evidence and each proposed change?

    Args:
        reflection: Your detailed reasoning about the experiment outcome and its
            implications for the business canvases.

    Returns:
        Confirmation that reflection was recorded.
    """
    return f"Reflection recorded. Proceeding with analysis."


# ── Canvas Tools ───────────────────────────────────────────────────


@tool
def get_canvases() -> str:
    """Get the current state of all canvases (BMC, VPC, Customer Segments).

    Returns the full content of the Business Model Canvas, Value Proposition Canvas,
    and Customer Segments so you can see what is currently on each canvas.
    """
    tid = current_thread_id.get()
    state = get_canvas_state(tid)
    result = {
        "bmc": state["bmc"],
        "vpc": state["vpc"],
        "segments": state["segments"],
        "auto_mode": state.get("auto_mode", False),
        "rejected_changes": state.get("rejected_changes", []),
    }
    return json.dumps(result, indent=2)


@tool
def propose_canvas_update(
    canvas_type: str,
    field: str,
    action: str,
    new_value: Optional[str] = None,
    old_value: Optional[str] = None,
    reason: str = "",
) -> str:
    """Propose an update to a canvas (BMC, VPC, or Segments).

    Args:
        canvas_type: Which canvas to update - "bmc", "vpc", or "segments"
        field: Which field/section to update (e.g. "key_partners", "customer_jobs", "name")
        action: Type of change - "add", "update", or "remove"
        new_value: The new value to add or update to
        old_value: The existing value being updated or removed. For segments, this must always be the segment's NAME (used to identify which segment to modify), regardless of which field is being updated.
        reason: Why this change is proposed, linked to evidence from experiments
    """
    tid = current_thread_id.get()
    state = get_canvas_state(tid)

    change = ProposedChange(
        canvas_type=CanvasType(canvas_type),
        field=field,
        action=ChangeAction(action),
        old_value=old_value,
        new_value=new_value,
        reason=reason,
    )

    # Idempotency check
    existing_hashes = {v["change_hash"] for v in state.get("versions", [])}
    if change.change_hash in existing_hashes:
        return f"This change has already been applied (hash: {change.change_hash}). Skipping duplicate."

    auto_mode = state.get("auto_mode", False)
    print(f"[PROPOSE] thread={tid} auto_mode={auto_mode} canvas_type={canvas_type} field={field}")

    if auto_mode:
        result = _apply_single_change(state, change)
        return f"[Auto-applied] {result}"
    else:
        pending = state.setdefault("pending_changes", [])
        pending.append(change.model_dump())
        return (
            f"Proposed change:\n"
            f"  Canvas: {canvas_type}\n"
            f"  Field: {field}\n"
            f"  Action: {action}\n"
            f"  Old: {old_value or '(none)'}\n"
            f"  New: {new_value or '(none)'}\n"
            f"  Reason: {reason}\n"
            f"[change_id:{change.id}] Waiting for founder approval."
        )


@tool
def apply_proposed_changes(change_ids: list[str]) -> str:
    """Apply one or more proposed changes that the founder has approved.

    Args:
        change_ids: List of change IDs to apply from pending_changes.
            Pass an empty list to apply ALL pending changes.
    """
    tid = current_thread_id.get()
    state = get_canvas_state(tid)
    pending = state.get("pending_changes", [])
    results = []

    if not change_ids:
        change_ids = [c["id"] for c in pending]

    for cid in change_ids:
        change_dict = next((c for c in pending if c["id"] == cid), None)
        if not change_dict:
            results.append(f"Change {cid} not found in pending changes.")
            continue

        existing_hashes = {v["change_hash"] for v in state.get("versions", [])}
        if change_dict["change_hash"] in existing_hashes:
            results.append(f"Change {cid} already applied (duplicate). Skipping.")
            continue

        change = ProposedChange(**change_dict)
        result = _apply_single_change(state, change)
        results.append(result)

    applied_ids = set(change_ids)
    state["pending_changes"] = [c for c in pending if c["id"] not in applied_ids]
    return "\n".join(results)


@tool
def get_version_history(canvas_type: Optional[str] = None, limit: int = 10) -> str:
    """Get the version history of canvas changes.

    Args:
        canvas_type: Optional filter - "bmc", "vpc", or "segments"
        limit: Maximum number of versions to return
    """
    tid = current_thread_id.get()
    state = get_canvas_state(tid)
    versions = state.get("versions", [])

    if canvas_type:
        versions = [v for v in versions if v["canvas_type"] == canvas_type]

    recent = versions[-limit:]
    if not recent:
        return "No version history yet."

    lines = ["Version History:"]
    for v in reversed(recent):
        lines.append(
            f"  [{v['timestamp']}] {v['change_description']} "
            f"(by: {v.get('applied_by', 'unknown')})"
        )
    return "\n".join(lines)


@tool
def undo_last_change() -> str:
    """Undo the last canvas change, reverting to the previous state."""
    tid = current_thread_id.get()
    state = get_canvas_state(tid)
    undo_stack = state.get("undo_stack", [])

    if not undo_stack:
        return "Nothing to undo."

    last_version = undo_stack.pop()
    state["undo_stack"] = undo_stack
    state.setdefault("redo_stack", []).append(last_version)

    # Remove hash from versions so the change can be re-proposed after undo
    state["versions"] = [v for v in state.get("versions", []) if v["change_hash"] != last_version["change_hash"]]

    canvas_type = last_version["canvas_type"]
    snapshot_before = last_version["snapshot_before"]

    if canvas_type == "bmc":
        state["bmc"] = snapshot_before
    elif canvas_type == "vpc":
        state["vpc"] = snapshot_before
    elif canvas_type == "segments":
        state["segments"] = snapshot_before.get("items", snapshot_before) if isinstance(snapshot_before, dict) else snapshot_before

    return f"Undone: {last_version['change_description']}"


@tool
def redo_change() -> str:
    """Re-apply the last undone canvas change."""
    tid = current_thread_id.get()
    state = get_canvas_state(tid)
    redo_stack = state.get("redo_stack", [])

    if not redo_stack:
        return "Nothing to redo."

    version = redo_stack.pop()
    state["redo_stack"] = redo_stack
    state.setdefault("undo_stack", []).append(version)

    # Re-add to versions so idempotency check knows this change is active again
    versions = state.setdefault("versions", [])
    if not any(v["change_hash"] == version["change_hash"] for v in versions):
        versions.append(version)

    canvas_type = version["canvas_type"]
    snapshot_after = version["snapshot_after"]

    if canvas_type == "bmc":
        state["bmc"] = snapshot_after
    elif canvas_type == "vpc":
        state["vpc"] = snapshot_after
    elif canvas_type == "segments":
        state["segments"] = snapshot_after.get("items", snapshot_after) if isinstance(snapshot_after, dict) else snapshot_after

    return f"Redone: {version['change_description']}"


@tool
def log_action_outcome(
    action_name: str,
    outcome: str,
    learnings: str = "",
) -> str:
    """Log the outcome of an experiment or action the founder completed.

    Use this when the founder reports completing an action, experiment,
    or customer interaction. Then analyze and propose canvas updates.

    Args:
        action_name: Name/title of the action or experiment
        outcome: What happened - the result
        learnings: Key takeaways or insights
    """
    tid = current_thread_id.get()
    state = get_canvas_state(tid)

    entry = ActionOutcome(
        action_name=action_name,
        outcome=outcome,
        learnings=learnings,
    )
    state.setdefault("action_log", []).append(entry.model_dump())

    return (
        f"Logged action outcome:\n"
        f"  Action: {action_name}\n"
        f"  Outcome: {outcome}\n"
        f"  Learnings: {learnings}\n"
        f"Now analyzing implications for your business canvases..."
    )


# ── Internal Helpers ───────────────────────────────────────────────


def _apply_single_change(state: dict, change: ProposedChange) -> str:
    """Apply a single change to canvas state and record a version."""
    canvas_type = change.canvas_type.value
    field = change.field
    action = change.action.value

    if canvas_type == "bmc":
        canvas_dict = dict(state["bmc"])
        snapshot_before = dict(canvas_dict)

        if field not in canvas_dict:
            return f"Invalid BMC field: {field}"

        if action == "add" and change.new_value:
            if change.new_value not in canvas_dict[field]:
                canvas_dict[field] = [*canvas_dict[field], change.new_value]
        elif action == "remove" and change.old_value:
            canvas_dict[field] = [v for v in canvas_dict[field] if v != change.old_value]
        elif action == "update" and change.old_value and change.new_value:
            canvas_dict[field] = [
                change.new_value if v == change.old_value else v
                for v in canvas_dict[field]
            ]

        state["bmc"] = canvas_dict
        snapshot_after = dict(canvas_dict)

    elif canvas_type == "vpc":
        canvas_dict = dict(state["vpc"])
        snapshot_before = dict(canvas_dict)

        if field not in canvas_dict:
            return f"Invalid VPC field: {field}"

        if action == "add" and change.new_value:
            existing_texts = [item["text"] for item in canvas_dict[field]]
            if change.new_value not in existing_texts:
                canvas_dict[field] = [
                    *canvas_dict[field],
                    {"text": change.new_value, "importance": Importance.fairly_essential.value},
                ]
        elif action == "remove" and change.old_value:
            canvas_dict[field] = [item for item in canvas_dict[field] if item["text"] != change.old_value]
        elif action == "update" and change.old_value and change.new_value:
            canvas_dict[field] = [
                {**item, "text": change.new_value} if item["text"] == change.old_value else item
                for item in canvas_dict[field]
            ]

        state["vpc"] = canvas_dict
        snapshot_after = dict(canvas_dict)

    elif canvas_type == "segments":
        segments = [CustomerSegment(**s) for s in state["segments"]]
        snapshot_before = {"items": [s.model_dump() for s in segments]}

        if action == "add" and change.new_value:
            if not any(s.name == change.new_value for s in segments):
                segments.append(CustomerSegment(
                    name=change.new_value,
                    description=field if field != "name" else "",
                ))
        elif action == "remove" and change.old_value:
            segments = [s for s in segments if s.name != change.old_value]
        elif action == "update" and change.old_value and change.new_value:
            # old_value is always the segment's NAME (used to identify which segment to update)
            # field specifies which attribute to change, new_value is the new value for that field
            for seg in segments:
                if seg.name == change.old_value:
                    if field == "name":
                        seg.name = change.new_value
                    elif field == "description":
                        seg.description = change.new_value
                    elif field == "persona":
                        seg.persona = change.new_value
                    elif field == "importance":
                        seg.importance = SegmentImportance(change.new_value)
                    break
            else:
                return (
                    f"No segment found with name '{change.old_value}'. "
                    f"Pass the segment's name as old_value to identify which segment to update."
                )

        state["segments"] = [s.model_dump() for s in segments]
        snapshot_after = {"items": state["segments"]}
    else:
        return f"Unknown canvas type: {canvas_type}"

    # Record version
    version = CanvasVersion(
        canvas_type=CanvasType(canvas_type),
        change_description=f"{action} '{change.new_value or change.old_value}' in {canvas_type}.{field}",
        change_hash=change.change_hash,
        snapshot_before=snapshot_before,
        snapshot_after=snapshot_after,
        applied_by="auto" if state.get("auto_mode") else "manual",
    )
    state.setdefault("versions", []).append(version.model_dump())
    state["redo_stack"] = []
    state.setdefault("undo_stack", []).append(version.model_dump())

    return f"Applied: {action} '{change.new_value or change.old_value}' in {canvas_type}.{field}. Reason: {change.reason}"
