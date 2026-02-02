"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useQueryState } from "nuqs";
import { getConfig, saveConfig, StandaloneConfig } from "@/lib/config";
import { ConfigDialog } from "@/app/components/ConfigDialog";
import { Button } from "@/components/ui/button";
import { Assistant } from "@langchain/langgraph-sdk";
import { ClientProvider, useClient } from "@/providers/ClientProvider";
import { MessagesSquare, SquarePen } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ThreadList } from "@/app/components/ThreadList";
import { ChatProvider } from "@/providers/ChatProvider";
import { ChatInterface } from "@/app/components/ChatInterface";
import { CanvasPanel } from "@/app/components/CanvasPanel";
import { AutoModeToggle } from "@/app/components/AutoModeToggle";
import { VersionHistoryButton } from "@/app/components/VersionHistory";

function SigmaApp({ config }: { config: StandaloneConfig }) {
  const client = useClient();
  const [threadId, setThreadId] = useQueryState("threadId");
  const [sidebar, setSidebar] = useQueryState("sidebar");

  const [mutateThreads, setMutateThreads] = useState<(() => void) | null>(null);
  const [interruptCount, setInterruptCount] = useState(0);
  const [assistant, setAssistant] = useState<Assistant | null>(null);

  const fetchAssistant = useCallback(async () => {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        config.assistantId
      );

    if (isUUID) {
      try {
        const data = await client.assistants.get(config.assistantId);
        setAssistant(data);
      } catch {
        setAssistant({
          assistant_id: config.assistantId,
          graph_id: config.assistantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          config: {},
          metadata: {},
          version: 1,
          name: "Horo",
          context: {},
        });
      }
    } else {
      try {
        const assistants = await client.assistants.search({
          graphId: config.assistantId,
          limit: 100,
        });
        const defaultAssistant = assistants.find(
          (a) => a.metadata?.["created_by"] === "system"
        );
        if (!defaultAssistant) throw new Error("No default assistant found");
        setAssistant(defaultAssistant);
      } catch {
        setAssistant({
          assistant_id: config.assistantId,
          graph_id: config.assistantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          config: {},
          metadata: {},
          version: 1,
          name: "Horo",
          context: {},
        });
      }
    }
  }, [client, config.assistantId]);

  useEffect(() => {
    fetchAssistant();
  }, [fetchAssistant]);

  return (
    <div className="flex h-screen flex-col">
      {/* SIGMA Header */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-[#2F6868]">SIGMA</span>
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              AI Co-pilot
            </span>
          </h1>
          {!sidebar && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebar("1")}
              className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground hover:bg-accent"
            >
              <MessagesSquare className="mr-1.5 h-3 w-3" />
              Threads
              {interruptCount > 0 && (
                <span className="ml-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
                  {interruptCount}
                </span>
              )}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setThreadId(null)}
            disabled={!threadId}
            className="h-7 border-[#2F6868] bg-[#2F6868] text-xs text-white hover:bg-[#2F6868]/80"
          >
            <SquarePen className="mr-1.5 h-3 w-3" />
            New Session
          </Button>
        </div>
      </header>

      {/* Main Content: Canvas Panel | Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatProvider
          activeAssistant={assistant}
          onHistoryRevalidate={() => mutateThreads?.()}
        >
          <ResizablePanelGroup
            direction="horizontal"
            autoSaveId="sigma-layout"
          >
            {sidebar && (
              <>
                <ResizablePanel
                  id="thread-history"
                  order={1}
                  defaultSize={18}
                  minSize={15}
                  className="relative min-w-[280px]"
                >
                  <ThreadList
                    onThreadSelect={async (id) => {
                      await setThreadId(id);
                    }}
                    onMutateReady={(fn) => setMutateThreads(() => fn)}
                    onClose={() => setSidebar(null)}
                    onInterruptCountChange={setInterruptCount}
                  />
                </ResizablePanel>
                <ResizableHandle />
              </>
            )}

            {/* Canvas Panel */}
            <ResizablePanel
              id="canvas"
              order={2}
              defaultSize={35}
              minSize={25}
              className="relative"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Business Canvases
                  </span>
                  <div className="flex items-center gap-2">
                    <AutoModeToggle />
                    <VersionHistoryButton />
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <CanvasPanel />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle />

            {/* Chat Panel */}
            <ResizablePanel
              id="chat"
              className="relative flex flex-col"
              order={3}
              defaultSize={sidebar ? 47 : 65}
            >
              <ChatInterface assistant={assistant} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ChatProvider>
      </div>
    </div>
  );
}

function HomePageContent() {
  const [config, setConfig] = useState<StandaloneConfig | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

  useEffect(() => {
    // Always loads default config — no dialog needed
    const cfg = getConfig();
    setConfig(cfg);
    saveConfig(cfg);
  }, []);

  const handleSaveConfig = useCallback((newConfig: StandaloneConfig) => {
    saveConfig(newConfig);
    setConfig(newConfig);
  }, []);

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading SIGMA...</p>
      </div>
    );
  }

  const langsmithApiKey =
    config.langsmithApiKey || process.env.NEXT_PUBLIC_LANGSMITH_API_KEY || "";

  return (
    <ClientProvider
      deploymentUrl={config.deploymentUrl}
      apiKey={langsmithApiKey}
    >
      {/* Hidden config dialog — only accessible via console for developers */}
      <ConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        onSave={handleSaveConfig}
        initialConfig={config}
      />
      <SigmaApp config={config} />
    </ClientProvider>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading SIGMA...</p>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
