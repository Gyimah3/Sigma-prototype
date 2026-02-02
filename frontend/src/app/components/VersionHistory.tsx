"use client";

import React, { useState } from "react";
import { useChatContext } from "@/providers/ChatProvider";
import type { CanvasVersion } from "@/app/types/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { History, Undo2, Redo2, X } from "lucide-react";
import { format } from "date-fns";

const canvasTypeColors: Record<string, string> = {
  bmc: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  vpc: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  segments: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function formatTimestamp(ts: string): string {
  try {
    return format(new Date(ts), "MMM d, HH:mm");
  } catch {
    return ts;
  }
}

export function VersionHistoryButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 text-xs"
      >
        <History size={14} className="mr-1" />
        History
      </Button>
      {open && <VersionHistoryDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

function VersionHistoryDrawer({ onClose }: { onClose: () => void }) {
  const { versions, undoStack, redoStack, sendMessage } = useChatContext();

  const handleUndo = () => {
    sendMessage("Please undo the last canvas change.");
  };

  const handleRedo = () => {
    sendMessage("Please redo the last undone canvas change.");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative z-10 flex h-full w-80 flex-col border-l border-border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="text-sm font-semibold">Version History</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="h-7 px-2"
              title="Undo last change"
            >
              <Undo2 size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="h-7 px-2"
              title="Redo last undone change"
            >
              <Redo2 size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 px-2"
            >
              <X size={14} />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {versions.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">
              No changes recorded yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {[...versions].reverse().map((version: CanvasVersion, idx: number) => (
                <div
                  key={version.id || idx}
                  className="rounded border border-border bg-card p-2"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded px-1 py-0.5 text-[9px] font-semibold uppercase",
                        canvasTypeColors[version.canvas_type] || "bg-gray-100"
                      )}
                    >
                      {version.canvas_type}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTimestamp(version.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground">
                    {version.change_description}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Applied: {version.applied_by}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
