# SIGMA Prototype — Approach Note

## Problem / Gap in Current SIGMA

SIGMA guides entrepreneurs through a structured journey: ideation → business model canvas (BMC) → value proposition canvas (VPC) → customer segments → experimentation → iteration. Two AI features exist today:

1. **Horo (Chat Assistant)** — A conversational AI that brainstorms and suggests ideas. The entrepreneur must manually copy-paste suggestions into their canvases. There is no direct link between what Horo recommends and what appears on the canvas.

2. **"Generate" Button** — A one-shot generation that fills canvas sections in bulk. It is not interactive, not iterative, and disconnected from experiment outcomes. Once generated, there is no structured way to refine based on real-world evidence.

**The gap:** Neither feature supports a tight Build-Measure-Learn loop. When a founder runs an experiment, discovers something new, and needs to update their business model, the process is entirely manual. There is no mechanism for an AI to _propose_ specific, evidence-based changes to canvases, let the founder review them, and track what changed and why.

---

## Our Approach

We built an **agentic, tool-calling AI co-pilot** that reads and writes canvases directly. Instead of generating text for the user to copy, the agent:

1. Receives experiment outcomes and founder observations via chat
2. Reflects on the evidence using a dedicated `think` tool
3. Reads the current canvas state (`get_canvases`)
4. Proposes structured changes to specific canvas sections (`propose_canvas_update`)
5. Applies changes only after founder approval — or automatically if auto-mode is on (`apply_proposed_changes`)
6. Maintains full version history with undo/redo support

The agent uses a **ReAct (Reason + Act) pattern** via LangGraph, meaning it decides which tools to call and in what order based on the conversation context. This makes it genuinely iterative — each experiment outcome can trigger a targeted canvas update rather than a full regeneration.

---

## Key Features

### Apply / Reject Workflow
When the agent proposes a canvas change, the founder sees a preview of exactly what will change (before → after) and can **Apply** or **Reject** each proposal. Changes are not applied silently — the founder stays in control.

### Auto-Mode Toggle
- **OFF (default):** Every proposed change requires explicit approval. The agent presents changes and waits.
- **ON:** The agent applies changes immediately after proposing them, useful for founders who trust the AI's judgment during rapid iteration.

### Idempotent Behavior
Each proposed change is hashed. If the agent proposes the same change twice (e.g., due to a retry or repeated message), the system detects the duplicate and skips it. This prevents accidental double-updates.

### Version History & Undo/Redo
Every applied change creates a versioned snapshot. The founder can:
- Browse the full version history with timestamps and descriptions
- **Undo** the last change to revert the canvas
- **Redo** a reverted change if they change their mind

All changes are attributed (applied by agent vs. applied by user) and timestamped.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│          Next.js + React + TypeScript            │
│                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ Thread   │  │ Canvas Panel │  │   Chat     │  │
│  │ List     │  │ BMC/VPC/Seg  │  │ Interface  │  │
│  │          │  │ + Previews   │  │ + Streaming│  │
│  └──────────┘  └──────────────┘  └───────────┘  │
│         Communicates via LangGraph SDK           │
└──────────────────┬──────────────────────────────┘
                   │ HTTP + SSE
┌──────────────────▼──────────────────────────────┐
│                  Backend                         │
│              FastAPI (Python)                    │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │         LangGraph ReAct Agent              │  │
│  │                                            │  │
│  │  Tools:                                    │  │
│  │   think · get_canvases · propose_update    │  │
│  │   apply_changes · get_history              │  │
│  │   undo · redo · log_action_outcome         │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Canvas State │  │ Memory Checkpointing     │  │
│  │ (per-thread) │  │ (LangGraph)              │  │
│  └──────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

- **Frontend:** Next.js static export served by the backend at `/sigma`. Three-panel resizable layout (threads, canvas, chat). Uses `@langchain/langgraph-sdk` for API communication and SSE streaming.
- **Backend:** FastAPI server exposing LangGraph-compatible endpoints (threads, assistants, runs). The ReAct agent is built with LangGraph and powered by GPT-4o. Canvas state is stored in-memory per thread.
- **Streaming:** Agent responses stream via Server-Sent Events so the founder sees tool calls and reasoning in real time.

---

## How to Run

### Prerequisites
- Python 3.11+
- Node.js 18+
- An OpenAI API key

### Backend

```bash
cd sigma-prototype/backend

# Install dependencies (using uv)
uv sync

# Set your OpenAI key
echo "OPENAI_API_KEY=sk-..." > .env

# Start the server
uv run uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd sigma-prototype/frontend

# Install dependencies
npm install

# Build the static export
npm run build

# The static output (out/) is served by the backend at /sigma
```

### Access

Open `http://localhost:8000/sigma` in your browser. Create a new thread and start chatting with Horo about experiment outcomes to see canvas proposals in action.

> **Tip:** Switch to the canvas tab you want the agent to modify (BMC, VPC, or Segments) so you can see the agent's live activity — proposed changes, apply/reject buttons, and updates — as they happen on that section in real time.
