"use client";

import React, { useState } from "react";
import { useChatContext } from "@/providers/ChatProvider";
import type {
  BMCCanvas,
  VPCCanvas,
  CustomerSegment,
  CanvasItem,
} from "@/app/types/types";
import { cn } from "@/lib/utils";

type CanvasTab = "bmc" | "vpc" | "segments";

const importanceBadge = (importance: string) => {
  const colors: Record<string, string> = {
    very_essential: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    fairly_essential: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    not_essential: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    very_important: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    fairly_important: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    not_important: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const label = importance.replace(/_/g, " ");
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", colors[importance] || "bg-gray-100 text-gray-600")}>
      {label}
    </span>
  );
};

function BMCView({ bmc }: { bmc: BMCCanvas }) {
  return (
    <div className="grid auto-rows-min gap-1.5 p-2" style={{ gridTemplateColumns: "repeat(10, 1fr)" }}>
      {/* Row 1-2: KP | KA/KR | VP | CR/CH | CS */}
      <div className="col-span-2 row-span-2 rounded border border-border bg-card p-2">
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Key Partners</h4>
        <ul className="space-y-0.5">{bmc.key_partners.map((item, i) => <li key={i} className="text-xs text-foreground">{item}</li>)}</ul>
      </div>
      <div className="col-span-2 rounded border border-border bg-card p-2">
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Key Activities</h4>
        <ul className="space-y-0.5">{bmc.key_activities.map((item, i) => <li key={i} className="text-xs text-foreground">{item}</li>)}</ul>
      </div>
      <div className="col-span-2 row-span-2 rounded border border-border bg-card p-2">
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Value Propositions</h4>
        <ul className="space-y-0.5">{bmc.value_propositions.map((item, i) => <li key={i} className="text-xs text-foreground">{item}</li>)}</ul>
      </div>
      <div className="col-span-2 rounded border border-border bg-card p-2">
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customer Relationships</h4>
        <ul className="space-y-0.5">{bmc.customer_relationships.map((item, i) => <li key={i} className="text-xs text-foreground">{item}</li>)}</ul>
      </div>
      <div className="col-span-2 row-span-2 rounded border border-border bg-card p-2">
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customer Segments</h4>
        <ul className="space-y-0.5">{bmc.customer_segments.map((item, i) => <li key={i} className="text-xs text-foreground">{item}</li>)}</ul>
      </div>
      <div className="col-span-2 rounded border border-border bg-card p-2">
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Key Resources</h4>
        <ul className="space-y-0.5">{bmc.key_resources.map((item, i) => <li key={i} className="text-xs text-foreground">{item}</li>)}</ul>
      </div>
      <div className="col-span-2 rounded border border-border bg-card p-2">
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Channels</h4>
        <ul className="space-y-0.5">{bmc.channels.map((item, i) => <li key={i} className="text-xs text-foreground">{item}</li>)}</ul>
      </div>
      {/* Bottom row */}
      <div className="col-span-5 rounded border border-border bg-card p-2">
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cost Structure</h4>
        <ul className="space-y-0.5">{bmc.cost_structure.map((item, i) => <li key={i} className="text-xs text-foreground">{item}</li>)}</ul>
      </div>
      <div className="col-span-5 rounded border border-border bg-card p-2">
        <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Revenue Streams</h4>
        <ul className="space-y-0.5">{bmc.revenue_streams.map((item, i) => <li key={i} className="text-xs text-foreground">{item}</li>)}</ul>
      </div>
    </div>
  );
}

function VPCSection({ title, items }: { title: string; items: CanvasItem[] }) {
  return (
    <div className="rounded border border-border bg-card p-2">
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">No items yet</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
              <span className="flex-1">{item.text}</span>
              {importanceBadge(item.importance)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VPCView({ vpc }: { vpc: VPCCanvas }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-2">
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">Customer Profile</h3>
        <VPCSection title="Customer Jobs" items={vpc.customer_jobs} />
        <VPCSection title="Pains" items={vpc.pains} />
        <VPCSection title="Gains" items={vpc.gains} />
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground">Value Map</h3>
        <VPCSection title="Products & Services" items={vpc.products_services} />
        <VPCSection title="Pain Relievers" items={vpc.pain_relievers} />
        <VPCSection title="Gain Creators" items={vpc.gain_creators} />
      </div>
    </div>
  );
}

function SegmentsView({ segments }: { segments: CustomerSegment[] }) {
  if (segments.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No customer segments defined yet.</p>;
  }
  return (
    <div className="space-y-2 p-2">
      {segments.map((seg) => (
        <div key={seg.id} className="rounded border border-border bg-card p-3">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">{seg.name}</h4>
            {importanceBadge(seg.importance)}
          </div>
          {seg.description && (
            <p className="text-xs text-muted-foreground">{seg.description}</p>
          )}
          {seg.persona && (
            <p className="mt-1 text-xs italic text-muted-foreground">
              Persona: {seg.persona}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function CanvasPanel() {
  const { bmc, vpc, segments } = useChatContext();
  const [activeTab, setActiveTab] = useState<CanvasTab>("bmc");

  const tabs: { id: CanvasTab; label: string }[] = [
    { id: "bmc", label: "BMC" },
    { id: "vpc", label: "VPC" },
    { id: "segments", label: "Segments" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 px-3 py-2 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-[#2F6868] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === "bmc" && bmc && <BMCView bmc={bmc} />}
        {activeTab === "bmc" && !bmc && (
          <p className="p-4 text-sm text-muted-foreground">
            Start a conversation with Horo to populate your Business Model Canvas.
          </p>
        )}
        {activeTab === "vpc" && vpc && <VPCView vpc={vpc} />}
        {activeTab === "vpc" && !vpc && (
          <p className="p-4 text-sm text-muted-foreground">
            Start a conversation with Horo to populate your Value Proposition Canvas.
          </p>
        )}
        {activeTab === "segments" && <SegmentsView segments={segments} />}
      </div>
    </div>
  );
}
