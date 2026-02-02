export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "completed" | "error" | "interrupted";
}

export interface SubAgent {
  id: string;
  name: string;
  subAgentName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "pending" | "active" | "completed" | "error";
}

export interface FileItem {
  path: string;
  content: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
  updatedAt?: Date;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterruptData {
  value: any;
  ns?: string[];
  scope?: string;
}

export interface ActionRequest {
  name: string;
  args: Record<string, unknown>;
  description?: string;
}

export interface ReviewConfig {
  actionName: string;
  allowedDecisions?: string[];
}

export interface ToolApprovalInterruptData {
  action_requests: ActionRequest[];
  review_configs?: ReviewConfig[];
}

// --- SIGMA Canvas Types ---

export type ImportanceLevel =
  | "very_essential"
  | "fairly_essential"
  | "not_essential";

export type SegmentImportanceLevel =
  | "very_important"
  | "fairly_important"
  | "not_important";

export type CanvasType = "bmc" | "vpc" | "segments";
export type ChangeAction = "add" | "update" | "remove";

export interface CanvasItem {
  text: string;
  importance: ImportanceLevel;
}

export interface BMCCanvas {
  key_partners: string[];
  key_activities: string[];
  key_resources: string[];
  value_propositions: string[];
  customer_relationships: string[];
  channels: string[];
  customer_segments: string[];
  cost_structure: string[];
  revenue_streams: string[];
}

export interface VPCCanvas {
  customer_jobs: CanvasItem[];
  pains: CanvasItem[];
  gains: CanvasItem[];
  products_services: CanvasItem[];
  pain_relievers: CanvasItem[];
  gain_creators: CanvasItem[];
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  persona: string;
  importance: SegmentImportanceLevel;
}

export interface CanvasVersion {
  id: string;
  timestamp: string;
  canvas_type: CanvasType;
  change_description: string;
  change_hash: string;
  snapshot_before: Record<string, unknown>;
  snapshot_after: Record<string, unknown>;
  applied_by: "manual" | "auto";
}

export interface ProposedChange {
  id: string;
  canvas_type: CanvasType;
  field: string;
  action: ChangeAction;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  change_hash: string;
}
