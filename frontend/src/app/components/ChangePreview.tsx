"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import type { ProposedChange } from "@/app/types/types";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

interface ChangePreviewProps {
  change: ProposedChange;
  autoMode: boolean;
  onApply: (changeId: string) => void;
  onReject: (changeId: string) => void;
}

const canvasTypeBadge: Record<string, string> = {
  bmc: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  vpc: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  segments: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const actionLabel: Record<string, string> = {
  add: "Add",
  update: "Update",
  remove: "Remove",
};

export function ChangePreview({ change, autoMode, onApply, onReject }: ChangePreviewProps) {
  return (
    <div className="my-2 rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            canvasTypeBadge[change.canvas_type] || "bg-gray-100 text-gray-600"
          )}
        >
          {change.canvas_type}
        </span>
        <span className="text-xs text-muted-foreground">
          {change.field.replace(/_/g, " ")}
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            change.action === "add" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            change.action === "update" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
            change.action === "remove" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}
        >
          {actionLabel[change.action] || change.action}
        </span>
      </div>

      <div className="mb-2 space-y-1 text-xs">
        {change.old_value && (
          <div className="flex items-start gap-1.5">
            <span className="font-medium text-red-600 dark:text-red-400">-</span>
            <span className="text-red-600 line-through dark:text-red-400">{change.old_value}</span>
          </div>
        )}
        {change.new_value && (
          <div className="flex items-start gap-1.5">
            <span className="font-medium text-green-600 dark:text-green-400">+</span>
            <span className="text-green-600 dark:text-green-400">{change.new_value}</span>
          </div>
        )}
      </div>

      {change.reason && (
        <p className="mb-2 text-xs italic text-muted-foreground">{change.reason}</p>
      )}

      {!autoMode && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            className="h-7 bg-[#2F6868] text-xs hover:bg-[#2F6868]/80"
            onClick={() => onApply(change.id)}
          >
            <Check size={12} className="mr-1" />
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onReject(change.id)}
          >
            <X size={12} className="mr-1" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
