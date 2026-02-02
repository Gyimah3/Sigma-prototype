"use client";

import { useCallback, useState } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  type Message,
  type Assistant,
  type Checkpoint,
} from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import type { UseStreamThread } from "@langchain/langgraph-sdk/react";
import type {
  TodoItem,
  BMCCanvas,
  VPCCanvas,
  CustomerSegment,
  CanvasVersion,
  ProposedChange,
} from "@/app/types/types";
import { useClient } from "@/providers/ClientProvider";
import { useQueryState } from "nuqs";

export type StateType = {
  messages: Message[];
  todos: TodoItem[];
  files: Record<string, string>;
  email?: {
    id?: string;
    subject?: string;
    page_content?: string;
  };
  ui?: any;
  // SIGMA canvas state
  bmc?: BMCCanvas;
  vpc?: VPCCanvas;
  segments?: CustomerSegment[];
  versions?: CanvasVersion[];
  pending_changes?: ProposedChange[];
  undo_stack?: CanvasVersion[];
  redo_stack?: CanvasVersion[];
  auto_mode?: boolean;
  action_log?: Array<{
    id: string;
    timestamp: string;
    action_name: string;
    outcome: string;
    learnings: string;
  }>;
};

export function useChat({
  activeAssistant,
  onHistoryRevalidate,
  thread,
}: {
  activeAssistant: Assistant | null;
  onHistoryRevalidate?: () => void;
  thread?: UseStreamThread<StateType>;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const client = useClient();
  // Local override for auto_mode so the toggle is instant
  const [autoModeLocal, setAutoModeLocal] = useState<boolean | null>(null);

  const stream = useStream<StateType>({
    assistantId: activeAssistant?.assistant_id || "",
    client: client ?? undefined,
    reconnectOnMount: true,
    threadId: threadId ?? null,
    onThreadId: setThreadId,
    defaultHeaders: { "x-auth-scheme": "langsmith" },
    fetchStateHistory: true,
    onFinish: onHistoryRevalidate,
    onError: onHistoryRevalidate,
    onCreated: onHistoryRevalidate,
    experimental_thread: thread,
  });

  const sendMessage = useCallback(
    (content: string) => {
      const newMessage: Message = { id: uuidv4(), type: "human", content };
      stream.submit(
        { messages: [newMessage] },
        {
          optimisticValues: (prev) => ({
            messages: [...(prev.messages ?? []), newMessage],
          }),
          config: { ...(activeAssistant?.config ?? {}), recursion_limit: 100 },
        }
      );
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const runSingleStep = useCallback(
    (
      messages: Message[],
      checkpoint?: Checkpoint,
      isRerunningSubagent?: boolean,
      optimisticMessages?: Message[]
    ) => {
      if (checkpoint) {
        stream.submit(undefined, {
          ...(optimisticMessages
            ? { optimisticValues: { messages: optimisticMessages } }
            : {}),
          config: activeAssistant?.config,
          checkpoint: checkpoint,
          ...(isRerunningSubagent
            ? { interruptAfter: ["tools"] }
            : { interruptBefore: ["tools"] }),
        });
      } else {
        stream.submit(
          { messages },
          { config: activeAssistant?.config, interruptBefore: ["tools"] }
        );
      }
    },
    [stream, activeAssistant?.config]
  );

  const setFiles = useCallback(
    async (files: Record<string, string>) => {
      if (!threadId) return;
      await client.threads.updateState(threadId, { values: { files } });
    },
    [client, threadId]
  );

  const setAutoMode = useCallback(
    async (auto_mode: boolean) => {
      // Optimistically update local state so UI reflects immediately
      setAutoModeLocal(auto_mode);
      if (!threadId) return;
      await client.threads.updateState(threadId, {
        values: { auto_mode },
      });
    },
    [client, threadId]
  );

  const rejectChange = useCallback(
    async (changeId: string) => {
      if (!threadId) return;
      // Call the backend reject endpoint directly (bypasses agent)
      const baseUrl =
        (client as any).apiUrl || "http://localhost:8000";
      await fetch(`${baseUrl}/threads/${threadId}/reject_change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ change_id: changeId }),
      });
      // Trigger a re-fetch of state so pendingChanges updates in the UI
      onHistoryRevalidate?.();
    },
    [client, threadId, onHistoryRevalidate]
  );

  const continueStream = useCallback(
    (hasTaskToolCall?: boolean) => {
      stream.submit(undefined, {
        config: {
          ...(activeAssistant?.config || {}),
          recursion_limit: 100,
        },
        ...(hasTaskToolCall
          ? { interruptAfter: ["tools"] }
          : { interruptBefore: ["tools"] }),
      });
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const markCurrentThreadAsResolved = useCallback(() => {
    stream.submit(null, { command: { goto: "__end__", update: null } });
    onHistoryRevalidate?.();
  }, [stream, onHistoryRevalidate]);

  const resumeInterrupt = useCallback(
    (value: any) => {
      stream.submit(null, { command: { resume: value } });
      onHistoryRevalidate?.();
    },
    [stream, onHistoryRevalidate]
  );

  const stopStream = useCallback(() => {
    stream.stop();
  }, [stream]);

  return {
    stream,
    todos: stream.values.todos ?? [],
    files: stream.values.files ?? {},
    email: stream.values.email,
    ui: stream.values.ui,
    // SIGMA canvas state
    bmc: stream.values.bmc ?? null,
    vpc: stream.values.vpc ?? null,
    segments: stream.values.segments ?? [],
    versions: stream.values.versions ?? [],
    pendingChanges: stream.values.pending_changes ?? [],
    undoStack: stream.values.undo_stack ?? [],
    redoStack: stream.values.redo_stack ?? [],
    autoMode: autoModeLocal ?? stream.values.auto_mode ?? false,
    actionLog: stream.values.action_log ?? [],
    setFiles,
    setAutoMode,
    rejectChange,
    messages: stream.messages,
    isLoading: stream.isLoading,
    isThreadLoading: stream.isThreadLoading,
    interrupt: stream.interrupt,
    getMessagesMetadata: stream.getMessagesMetadata,
    sendMessage,
    runSingleStep,
    continueStream,
    stopStream,
    markCurrentThreadAsResolved,
    resumeInterrupt,
  };
}
