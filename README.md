# SIGMA Prototype — Agentic Canvas Co-pilot

A prototype demonstrating an AI agent that directly proposes and applies structured changes to SIGMA's Business Model Canvas (BMC), Value Proposition Canvas (VPC), and Customer Segments — based on real experiment outcomes reported by the founder.

> For a detailed write-up of the approach and how it contrasts with SIGMA's current AI features, see [APPROACH.md](./APPROACH.md).

---

## Quick Start

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Node.js 18+
- OpenAI API key

### 1. Backend

```bash
cd backend

# Install dependencies
uv sync

# Configure environment
cp .env.example .env   # or create .env manually
# Add your OpenAI key:
#   OPENAI_API_KEY=sk-...

# Start the server
uv run uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build static export (served by the backend)
npm run build
```

### 3. Open the App

Navigate to **http://localhost:8000/sigma** in your browser.

> **Tip:** Switch to the canvas tab (BMC, VPC, or Segments) that you want the agent to modify so you can see its live activity — proposed changes, apply/reject buttons, and real-time updates — as they happen.

---

## Usage

1. **Create a thread** from the sidebar.
2. **Tell Horo about an experiment outcome** — e.g. _"We interviewed 10 restaurant owners and found that most care more about reducing food waste than cutting labor costs."_
3. **Review proposed changes** — The agent will propose specific updates to canvas sections. You'll see a before/after preview with Apply and Reject buttons.
4. **Apply or reject** each change, or toggle **Auto-mode** to let the agent apply changes automatically.
5. **Browse version history** and use **Undo/Redo** to navigate between canvas states.

---

## Project Structure

```
sigma-prototype/
├── backend/
│   ├── main.py          # FastAPI server & LangGraph endpoints
│   ├── agent.py         # LangGraph ReAct agent configuration
│   ├── tools.py         # Agent tools (propose, apply, undo, redo, etc.)
│   ├── models.py        # Pydantic models for BMC, VPC, Segments
│   ├── state.py         # In-memory canvas state management
│   ├── prompts.py       # System prompt for Horo
│   └── pyproject.toml   # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main app layout
│   │   │   ├── components/     # React components
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── types/          # TypeScript types
│   │   │   └── utils/          # Utilities
│   │   └── providers/          # Context providers (Chat, Client)
│   ├── package.json
│   └── next.config.ts
├── APPROACH.md          # Detailed approach note
└── README.md            # This file
```

---

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| LLM      | OpenAI GPT-4o                          |
| Agent    | LangGraph (ReAct pattern)               |
| Backend  | FastAPI + Uvicorn                       |
| Frontend | Next.js + React + TypeScript + Tailwind |
| Comms    | LangGraph SDK + Server-Sent Events      |

---

## Key Concepts

- **Agentic canvas editing** — The AI doesn't just suggest; it proposes structured diffs to specific canvas sections.
- **Evidence-based updates** — Every change is tied to an experiment outcome or founder observation.
- **Apply/Reject workflow** — The founder reviews each proposed change before it takes effect.
- **Auto-mode** — Toggle to let the agent apply changes without manual approval.
- **Idempotency** — Duplicate proposals are detected via hashing and skipped.
- **Version history** — Full audit trail of every canvas change with undo/redo support.
