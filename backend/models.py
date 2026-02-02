"""Data models for SIGMA Agentic AI Co-pilot.

Defines Pydantic models for BMC, VPC, Customer Segments,
versioning, and proposed changes.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --- Enums ---

class Importance(str, Enum):
    """Importance level for VPC items and customer segments."""

    very_essential = "very_essential"
    fairly_essential = "fairly_essential"
    not_essential = "not_essential"


class SegmentImportance(str, Enum):
    """Importance level for customer segments."""

    very_important = "very_important"
    fairly_important = "fairly_important"
    not_important = "not_important"


class CanvasType(str, Enum):
    """Types of canvases."""

    bmc = "bmc"
    vpc = "vpc"
    segments = "segments"


class ChangeAction(str, Enum):
    """Types of changes that can be made."""

    add = "add"
    update = "update"
    remove = "remove"


# --- VPC Item ---

class CanvasItem(BaseModel):
    """An item in a VPC canvas section with importance rating."""

    text: str
    importance: Importance = Importance.fairly_essential


# --- BMC Canvas ---

class BMCCanvas(BaseModel):
    """Business Model Canvas with 9 building blocks."""

    key_partners: list[str] = Field(default_factory=list)
    key_activities: list[str] = Field(default_factory=list)
    key_resources: list[str] = Field(default_factory=list)
    value_propositions: list[str] = Field(default_factory=list)
    customer_relationships: list[str] = Field(default_factory=list)
    channels: list[str] = Field(default_factory=list)
    customer_segments: list[str] = Field(default_factory=list)
    cost_structure: list[str] = Field(default_factory=list)
    revenue_streams: list[str] = Field(default_factory=list)


# --- VPC Canvas ---

class VPCCanvas(BaseModel):
    """Value Proposition Canvas with 6 sections."""

    customer_jobs: list[CanvasItem] = Field(default_factory=list)
    pains: list[CanvasItem] = Field(default_factory=list)
    gains: list[CanvasItem] = Field(default_factory=list)
    products_services: list[CanvasItem] = Field(default_factory=list)
    pain_relievers: list[CanvasItem] = Field(default_factory=list)
    gain_creators: list[CanvasItem] = Field(default_factory=list)


# --- Customer Segment ---

class CustomerSegment(BaseModel):
    """A customer segment with persona information."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    description: str = ""
    persona: str = ""
    importance: SegmentImportance = SegmentImportance.fairly_important


# --- Version History ---

class CanvasVersion(BaseModel):
    """A version entry tracking a canvas change."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    canvas_type: CanvasType
    change_description: str
    change_hash: str
    snapshot_before: dict
    snapshot_after: dict
    applied_by: str = "manual"  # "manual" | "auto"


# --- Proposed Change ---

class ProposedChange(BaseModel):
    """A proposed change to a canvas, pending user approval."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    canvas_type: CanvasType
    field: str
    action: ChangeAction
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    reason: str = ""
    change_hash: str = ""

    def compute_hash(self) -> str:
        """Compute idempotency hash for this change."""
        raw = f"{self.canvas_type.value}|{self.field}|{self.action.value}|{self.new_value or ''}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def model_post_init(self, __context: object) -> None:
        """Auto-compute hash after initialization."""
        if not self.change_hash:
            self.change_hash = self.compute_hash()


# --- Action Log ---

class ActionOutcome(BaseModel):
    """Log entry for an experiment or action outcome."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    action_name: str
    outcome: str
    learnings: str = ""


# --- Seed Data ---

def get_seed_bmc() -> BMCCanvas:
    """Return pre-populated BMC for demo purposes."""
    return BMCCanvas(
        key_partners=["Cloud infrastructure providers", "University incubators"],
        key_activities=["Product development", "Customer discovery interviews"],
        key_resources=["Engineering team", "Customer research data"],
        value_propositions=["AI-powered business model validation for founders"],
        customer_relationships=["Self-service platform", "Guided onboarding"],
        channels=["Direct web app", "Startup community events"],
        customer_segments=["Early-stage tech founders", "Accelerator programs"],
        cost_structure=["Cloud hosting", "AI API costs", "Team salaries"],
        revenue_streams=["SaaS subscription"],
    )


def get_seed_vpc() -> VPCCanvas:
    """Return pre-populated VPC for demo purposes."""
    return VPCCanvas(
        customer_jobs=[
            CanvasItem(text="Validate business model assumptions", importance=Importance.very_essential),
            CanvasItem(text="Track experiment outcomes", importance=Importance.very_essential),
            CanvasItem(text="Iterate on value proposition", importance=Importance.fairly_essential),
        ],
        pains=[
            CanvasItem(text="Manual canvas updates are tedious", importance=Importance.very_essential),
            CanvasItem(text="Hard to connect experiment results to model changes", importance=Importance.fairly_essential),
        ],
        gains=[
            CanvasItem(text="Faster iteration cycles", importance=Importance.very_essential),
            CanvasItem(text="Evidence-based business model decisions", importance=Importance.fairly_essential),
        ],
        products_services=[
            CanvasItem(text="AI co-pilot for canvas management", importance=Importance.very_essential),
        ],
        pain_relievers=[
            CanvasItem(text="Automatic canvas updates from experiment results", importance=Importance.very_essential),
        ],
        gain_creators=[
            CanvasItem(text="Version history with undo/redo", importance=Importance.fairly_essential),
        ],
    )


def get_seed_segments() -> list[CustomerSegment]:
    """Return pre-populated customer segments for demo purposes."""
    return [
        CustomerSegment(
            name="Technical Founders",
            description="Founders with engineering backgrounds building B2B SaaS",
            persona="Alex, 28, ex-FAANG engineer, building dev tools startup",
            importance=SegmentImportance.very_important,
        ),
        CustomerSegment(
            name="Accelerator Teams",
            description="Teams in accelerator programs needing structured validation",
            persona="Priya, 32, leading a 3-person team in Y Combinator",
            importance=SegmentImportance.fairly_important,
        ),
    ]
