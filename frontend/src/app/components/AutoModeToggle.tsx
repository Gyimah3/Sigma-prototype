"use client";

import React from "react";
import { useChatContext } from "@/providers/ChatProvider";
import { cn } from "@/lib/utils";

export function AutoModeToggle() {
  const { autoMode, setAutoMode } = useChatContext();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Auto-mode</span>
      <button
        onClick={() => setAutoMode(!autoMode)}
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          autoMode ? "bg-[#2F6868]" : "bg-gray-300 dark:bg-gray-600"
        )}
        role="switch"
        aria-checked={autoMode}
        title={
          autoMode
            ? "Horo applies safe updates automatically"
            : "Horo asks before applying changes"
        }
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
            autoMode ? "translate-x-[18px]" : "translate-x-[3px]"
          )}
        />
      </button>
      <span className="hidden text-[10px] text-muted-foreground sm:inline">
        {autoMode ? "ON" : "OFF"}
      </span>
    </div>
  );
}
