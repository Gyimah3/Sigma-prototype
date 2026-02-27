"""SIGMA Backend — FastAPI server with LangGraph-compatible API.

Serves the Horo AI agent and mounts the Next.js static frontend.
Run: uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.prebuilt import create_react_agent

from prompts import HORO_SYSTEM_PROMPT
from state import canvas_store, current_thread_id, get_canvas_state
from tools import (
    apply_proposed_changes,
    get_canvases,
    get_version_history,
    log_action_outcome,
    propose_canvas_update,
    redo_change,
    think,
    undo_last_change,
)

load_dotenv()

# ── Agent Setup ───────────────────────────────────────────────────

model = ChatOpenAI(model="gpt-4o", temperature=0)
checkpointer = MemorySaver()

TOOLS = [
    think,
    get_canvases,
    propose_canvas_update,
    apply_proposed_changes,
    get_version_history,
    undo_last_change,
    redo_change,
    log_action_outcome,
]

agent = create_react_agent(
    model,
    tools=TOOLS,
    prompt=HORO_SYSTEM_PROMPT,
    checkpointer=checkpointer,
)

# ── In-memory thread store ────────────────────────────────────────

threads_db: dict[str, dict] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _create_thread(thread_id: str | None = None, metadata: dict | None = None) -> dict:
    tid = thread_id or str(uuid.uuid4())
    now = _now_iso()
    record = {
        "thread_id": tid,
        "created_at": now,
        "updated_at": now,
        "metadata": metadata or {},
        "status": "idle",
        "values": {},
    }
    threads_db[tid] = record
    # Also initialize canvas state for this thread
    get_canvas_state(tid)
    return record


def _get_thread(thread_id: str) -> dict:
    if thread_id not in threads_db:
        raise HTTPException(404, f"Thread {thread_id} not found")
    return threads_db[thread_id]


# ── Serialization ─────────────────────────────────────────────────


def _serialize_message(msg: Any) -> dict:
    """Convert a LangChain message to a JSON-serializable dict
    matching the @langchain/langgraph-sdk Message type."""
    d: dict[str, Any] = {
        "type": msg.type,
        "content": msg.content if isinstance(msg.content, (str, list)) else str(msg.content),
        "id": msg.id or str(uuid.uuid4()),
    }

    # AI message tool calls
    if hasattr(msg, "tool_calls") and msg.tool_calls:
        d["tool_calls"] = []
        for tc in msg.tool_calls:
            if isinstance(tc, dict):
                d["tool_calls"].append({
                    "id": tc.get("id", ""),
                    "name": tc.get("name", ""),
                    "args": tc.get("args", {}),
                    "type": "tool_call",
                })
            else:
                d["tool_calls"].append({
                    "id": getattr(tc, "id", ""),
                    "name": getattr(tc, "name", ""),
                    "args": getattr(tc, "args", {}),
                    "type": "tool_call",
                })

    # Tool message fields
    if hasattr(msg, "tool_call_id") and msg.tool_call_id:
        d["tool_call_id"] = msg.tool_call_id
    if hasattr(msg, "name") and msg.name:
        d["name"] = msg.name

    return d


def _deserialize_messages(msgs: list[dict]) -> list:
    """Convert frontend message dicts to LangChain message objects."""
    result = []
    for m in msgs:
        msg_type = m.get("type", "human")
        content = m.get("content", "")
        msg_id = m.get("id", str(uuid.uuid4()))

        if msg_type == "human":
            result.append(HumanMessage(content=content, id=msg_id))
        elif msg_type == "ai":
            result.append(AIMessage(
                content=content,
                id=msg_id,
                tool_calls=m.get("tool_calls", []),
            ))
        elif msg_type == "tool":
            result.append(ToolMessage(
                content=content,
                id=msg_id,
                tool_call_id=m.get("tool_call_id", ""),
                name=m.get("name", ""),
            ))
        elif msg_type == "system":
            result.append(SystemMessage(content=content, id=msg_id))
    return result


def _merge_state(graph_state: dict, thread_id: str) -> dict:
    """Merge graph state (messages) with canvas state from canvas_store."""
    canvas = get_canvas_state(thread_id)
    messages = [_serialize_message(m) for m in graph_state.get("messages", [])]

    return {
        "messages": messages,
        "bmc": canvas["bmc"],
        "vpc": canvas["vpc"],
        "segments": canvas["segments"],
        "versions": canvas["versions"],
        "pending_changes": canvas["pending_changes"],
        "undo_stack": canvas["undo_stack"],
        "redo_stack": canvas["redo_stack"],
        "auto_mode": canvas["auto_mode"],
        "action_log": canvas["action_log"],
    }


# ── FastAPI App ───────────────────────────────────────────────────

app = FastAPI(
    title="SIGMA - Horo AI Co-pilot",
    description="Agentic AI Actions Co-pilot for business model validation",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────


@app.get("/ok")
async def health():
    return {"status": "ok", "agent": "horo"}


# ── Assistant Endpoints ───────────────────────────────────────────


@app.get("/assistants/{assistant_id}")
async def get_assistant(assistant_id: str):
    return {
        "assistant_id": assistant_id,
        "graph_id": assistant_id,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "config": {},
        "metadata": {"created_by": "system"},
        "version": 1,
        "name": "Horo",
    }


@app.post("/assistants/search")
async def search_assistants(request: Request):
    body = await request.json() if await request.body() else {}
    graph_id = body.get("graph_id", body.get("graphId", "horo"))
    return [
        {
            "assistant_id": graph_id,
            "graph_id": graph_id,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
            "config": {},
            "metadata": {"created_by": "system"},
            "version": 1,
            "name": "Horo",
        }
    ]


# ── Thread Endpoints ──────────────────────────────────────────────


@app.post("/threads")
async def create_thread(request: Request):
    body = await request.json() if await request.body() else {}
    metadata = body.get("metadata", {})
    return _create_thread(metadata=metadata)


@app.get("/threads/{thread_id}")
async def get_thread_endpoint(thread_id: str):
    return _get_thread(thread_id)


@app.patch("/threads/{thread_id}")
async def update_thread(thread_id: str, request: Request):
    thread = _get_thread(thread_id)
    body = await request.json() if await request.body() else {}
    if "metadata" in body:
        thread["metadata"].update(body["metadata"])
    thread["updated_at"] = _now_iso()
    return thread


@app.delete("/threads/{thread_id}")
async def delete_thread(thread_id: str):
    if thread_id in threads_db:
        del threads_db[thread_id]
    if thread_id in canvas_store:
        del canvas_store[thread_id]
    return {"status": "ok"}


@app.post("/threads/search")
async def search_threads(request: Request):
    body = await request.json() if await request.body() else {}
    limit = body.get("limit", 100)
    threads = list(threads_db.values())
    # Sort by updated_at descending
    threads.sort(key=lambda t: t.get("updated_at", ""), reverse=True)
    return threads[:limit]


# ── Thread State Endpoints ────────────────────────────────────────


@app.get("/threads/{thread_id}/state")
async def get_thread_state(thread_id: str):
    # Ensure thread exists
    if thread_id not in threads_db:
        raise HTTPException(404, f"Thread {thread_id} not found")

    config = {"configurable": {"thread_id": thread_id}}

    try:
        state = await agent.aget_state(config)
        merged = _merge_state(state.values, thread_id)
        next_nodes = list(state.next) if state.next else []
    except Exception:
        # No checkpoint yet — return canvas defaults
        canvas = get_canvas_state(thread_id)
        merged = {"messages": [], **{k: v for k, v in canvas.items()}}
        next_nodes = []

    return {
        "values": merged,
        "next": next_nodes,
        "config": config,
        "created_at": threads_db[thread_id].get("created_at"),
        "metadata": {},
        "parent_config": None,
    }


@app.post("/threads/{thread_id}/state")
@app.put("/threads/{thread_id}/state")
async def update_thread_state(thread_id: str, request: Request):
    body = await request.json()
    values = body.get("values", {})

    # Handle auto_mode toggle
    if "auto_mode" in values:
        canvas = get_canvas_state(thread_id)
        canvas["auto_mode"] = values["auto_mode"]
        print(f"[AUTO_MODE] thread={thread_id} auto_mode={values['auto_mode']} canvas_auto_mode={canvas['auto_mode']}")

    return {"configurable": {"thread_id": thread_id}}


# ── Thread History ────────────────────────────────────────────────


@app.api_route("/threads/{thread_id}/history", methods=["GET", "POST"])
async def get_thread_history(thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    history = []

    try:
        async for state in agent.aget_state_history(config):
            messages = [_serialize_message(m) for m in state.values.get("messages", [])]
            canvas = get_canvas_state(thread_id)
            checkpoint = state.config.get("configurable", {})
            history.append({
                "values": {"messages": messages, **{k: v for k, v in canvas.items()}},
                "next": list(state.next) if state.next else [],
                "config": state.config,
                "created_at": getattr(state, "created_at", None),
                "metadata": state.metadata or {},
                "parent_config": getattr(state, "parent_config", None),
                "checkpoint": {
                    "thread_id": checkpoint.get("thread_id", thread_id),
                    "checkpoint_ns": checkpoint.get("checkpoint_ns", ""),
                    "checkpoint_id": checkpoint.get("checkpoint_id", ""),
                },
            })
    except Exception:
        pass  # No history yet

    return history


# ── Canvas Operations (non-agent) ────────────────────────────────


@app.post("/threads/{thread_id}/reject_change")
async def reject_change(thread_id: str, request: Request):
    """Remove a pending change from canvas state (reject without agent)."""
    body = await request.json()
    change_id = body.get("change_id")
    if not change_id:
        raise HTTPException(400, "change_id is required")

    canvas = get_canvas_state(thread_id)
    before = len(canvas.get("pending_changes", []))
    rejected = next((c for c in canvas.get("pending_changes", []) if c["id"] == change_id), None)
    canvas["pending_changes"] = [
        c for c in canvas.get("pending_changes", []) if c["id"] != change_id
    ]
    after = len(canvas["pending_changes"])

    if before == after:
        return {"status": "not_found", "change_id": change_id}

    # Record rejection so the agent knows not to re-propose
    canvas.setdefault("rejected_changes", []).append(rejected)
    return {"status": "rejected", "change_id": change_id, "remaining": after}


# ── Streaming Run Endpoint ────────────────────────────────────────


@app.post("/threads/{thread_id}/runs/stream")
async def stream_run(thread_id: str, request: Request):
    body = await request.json()

    # Auto-create thread if it doesn't exist
    if thread_id not in threads_db:
        _create_thread(thread_id)

    raw_input = body.get("input")
    config = body.get("config", {})
    command = body.get("command")

    # Build agent config with thread_id for checkpointing
    agent_config = {
        "configurable": {
            "thread_id": thread_id,
            **config.get("configurable", {}),
        },
        "recursion_limit": config.get("recursion_limit", 100),
    }

    # Convert input messages from frontend format to LangChain messages
    agent_input: dict | None = None
    if raw_input and "messages" in raw_input:
        lc_messages = _deserialize_messages(raw_input["messages"])
        agent_input = {"messages": lc_messages}

    async def event_stream():
        token = current_thread_id.set(thread_id)
        run_id = str(uuid.uuid4())

        try:
            # Emit metadata event
            yield f"event: metadata\ndata: {json.dumps({'run_id': run_id})}\n\n"

            # Handle "goto end" command
            if command and command.get("goto") == "__end__":
                canvas = get_canvas_state(thread_id)
                final_state = {"messages": [], **{k: v for k, v in canvas.items()}}
                yield f"event: values\ndata: {json.dumps(final_state)}\n\n"
                yield 'event: end\ndata: {}\n\n'
                return

            # Handle resume command
            if command and "resume" in command:
                # For resume, invoke with None input to continue from checkpoint
                async for state in agent.astream(
                    None,
                    config=agent_config,
                    stream_mode="values",
                ):
                    merged = _merge_state(state, thread_id)
                    yield f"event: values\ndata: {json.dumps(merged)}\n\n"
                yield 'event: end\ndata: {}\n\n'
                return

            # Normal run — stream agent with input
            if agent_input is None:
                # Resume from checkpoint (e.g., continue after interrupt)
                async for state in agent.astream(
                    None,
                    config=agent_config,
                    stream_mode="values",
                ):
                    merged = _merge_state(state, thread_id)
                    yield f"event: values\ndata: {json.dumps(merged)}\n\n"
            else:
                async for state in agent.astream(
                    agent_input,
                    config=agent_config,
                    stream_mode="values",
                ):
                    merged = _merge_state(state, thread_id)
                    yield f"event: values\ndata: {json.dumps(merged)}\n\n"

            # Update thread timestamp
            if thread_id in threads_db:
                threads_db[thread_id]["updated_at"] = _now_iso()

            yield 'event: end\ndata: {}\n\n'

        except Exception as e:
            error_data = json.dumps({"error": str(e), "type": type(e).__name__})
            yield f"event: error\ndata: {error_data}\n\n"
        finally:
            current_thread_id.reset(token)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Mount Static Frontend ────────────────────────────────────────

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "out")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/sigma", StaticFiles(directory=FRONTEND_DIR, html=True), name="sigma")


# ── Run ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
