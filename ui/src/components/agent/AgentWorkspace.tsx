import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import {
  cancelAgentQueueItem,
  createAgentSession,
  deleteAgentSession,
  enqueueAgentTurn,
  getAgentWorkspace,
  retryAgentQueueItem,
  updateAgentSession,
} from "../../lib/agentApi";
import { withAgentGenerationDefaults } from "../../lib/agentGenerationSettings";
import { useAppStore } from "../../store/useAppStore";
import type { GenerateItem } from "../../types";
import { useAgentWorkspaceLayout } from "../../hooks/useAgentWorkspaceLayout";
import { AgentChatPane } from "./AgentChatPane";
import { AgentImageSheet } from "./AgentImageSheet";
import { AgentQueueSheet } from "./AgentQueueSheet";
import { AgentRightSidebar } from "./AgentRightSidebar";
import { AgentSessionDrawer } from "./AgentSessionDrawer";
import { AgentSessionRail } from "./AgentSessionRail";
import { AgentStagePane } from "./AgentStagePane";
import { AgentTopBar } from "./AgentTopBar";
import { attachAgentImageFiles } from "./agentAttachFiles";
import {
  isLocalPendingTurn,
  isLocalTurn,
  localErrorTurn,
  localPendingTurn,
  localUserTurn,
} from "./agentLocalTurns";
import { deriveAgentRunProgress } from "./agentRunProgress";
import type {
  AgentContextTab,
  AgentGenerationSettings,
  AgentImageHandle,
  AgentRuntimeStatus,
  AgentSidebarTab,
  AgentTurn,
  AgentWorkspacePayload,
} from "./agentTypes";

function emptyWorkspace(): AgentWorkspacePayload {
  return {
    sessions: [],
    turnsBySession: {},
    imagesById: {},
    imageIdsBySession: {},
    selectedSessionId: null,
    currentImageId: null,
    allowedTools: [
      "ima2.get_image_context",
      "ima2.web_search",
      "ima2.generate_image",
      "ima2.generate_video",
      "ima2.get_generation_errors",
    ],
    manifest: null,
    queueBySession: {},
    runSummaryBySession: {},
  };
}

function historyItemFromAgentImage(handle: AgentImageHandle): GenerateItem {
  const isVideo = handle.filename.endsWith(".mp4");
  return {
    image: handle.url,
    url: handle.url,
    filename: handle.filename,
    thumb: handle.thumbUrl ?? undefined,
    prompt: handle.prompt ?? undefined,
    revisedPrompt: handle.revisedPrompt ?? null,
    createdAt: handle.createdAt,
    mediaType: isVideo ? "video" : "image",
    kind: "agent",
  };
}

function appendTurns(current: AgentWorkspacePayload, sessionId: string, turns: AgentTurn[]): AgentWorkspacePayload {
  return {
    ...current,
    turnsBySession: {
      ...current.turnsBySession,
      [sessionId]: [...(current.turnsBySession[sessionId] ?? []), ...turns],
    },
  };
}

function replacePendingWithError(
  current: AgentWorkspacePayload,
  sessionId: string,
  pendingTurnId: string,
  message: string,
): AgentWorkspacePayload {
  const turns = current.turnsBySession[sessionId] ?? [];
  return {
    ...current,
    turnsBySession: {
      ...current.turnsBySession,
      [sessionId]: [...turns.filter((turn) => turn.id !== pendingTurnId), localErrorTurn(message)],
    },
  };
}

function mergeWorkspaceWithLocalTurns(
  current: AgentWorkspacePayload,
  incoming: AgentWorkspacePayload,
  settledLocalIds: Set<string>,
): AgentWorkspacePayload {
  const turnsBySession = { ...incoming.turnsBySession };
  for (const [sessionId, currentTurns] of Object.entries(current.turnsBySession)) {
    const incomingTurns = turnsBySession[sessionId] ?? [];
    const incomingIds = new Set(incomingTurns.map((turn) => turn.id));
    const newestIncomingCreatedAt = Math.max(0, ...incomingTurns.map((turn) => turn.createdAt ?? 0));
    const carryTurns = currentTurns.filter((turn) => {
      if (settledLocalIds.has(turn.id) || incomingIds.has(turn.id)) return false;
      if (isLocalTurn(turn) || turn.status === "streaming") return true;
      return (turn.createdAt ?? 0) >= newestIncomingCreatedAt;
    });
    if (carryTurns.length > 0) turnsBySession[sessionId] = [...incomingTurns, ...carryTurns];
  }
  return { ...incoming, turnsBySession };
}

export function AgentWorkspace() {
  const { t } = useI18n();
  const layoutMode = useAgentWorkspaceLayout();
  const currentGeneratedImage = useAppStore((s) => s.currentImage);
  const importLocalImageToHistory = useAppStore((s) => s.importLocalImageToHistory);
  const addHistoryItem = useAppStore((s) => s.addHistoryItem);
  const selectHistory = useAppStore((s) => s.selectHistory);
  const showToast = useAppStore((s) => s.showToast);
  const bootstrapped = useRef(false);
  const workspaceRequestSeq = useRef(0);
  const pendingTurnsRef = useRef(0);
  const knownImageIdsRef = useRef<Set<string> | null>(null);
  const [workspace, setWorkspace] = useState<AgentWorkspacePayload>(() => emptyWorkspace());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AgentContextTab>("image");
  const [sidebarTab, setSidebarTab] = useState<AgentSidebarTab>("image");
  const [insertedPrompt, setInsertedPrompt] = useState<{ id: number; text: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [imageSheetOpen, setImageSheetOpen] = useState(false);
  const [queueSheetOpen, setQueueSheetOpen] = useState(false);
  const [toolsPanelOpen, setToolsPanelOpen] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<AgentRuntimeStatus>("reconnecting");
  const [bootError, setBootError] = useState<string | null>(null);

  const errorMessage = useCallback((error: unknown) => error instanceof Error ? error.message : String(error), []);
  const closeToolsPanel = useCallback(() => setToolsPanelOpen(false), []);
  const toggleToolsPanel = useCallback(() => setToolsPanelOpen((open) => !open), []);
  const reportMutationError = useCallback((error: unknown) => {
    showToast(t("agent.workspaceActionFailed", { reason: errorMessage(error) }), true);
  }, [errorMessage, showToast, t]);

  const applyWorkspace = useCallback((payload: AgentWorkspacePayload) => {
    setWorkspace({ ...emptyWorkspace(), ...payload });
    setSelectedSessionId(payload.selectedSessionId ?? null);
  }, []);

  const applyWorkspaceWithLocalTurns = useCallback((payload: AgentWorkspacePayload, settledLocalIds: Set<string>) => {
    const normalized = { ...emptyWorkspace(), ...payload };
    setWorkspace((current) => mergeWorkspaceWithLocalTurns(current, normalized, settledLocalIds));
    setSelectedSessionId(payload.selectedSessionId ?? null);
  }, []);

  const applyMutationWorkspace = useCallback((payload: AgentWorkspacePayload) => {
    workspaceRequestSeq.current += 1;
    applyWorkspace(payload);
  }, [applyWorkspace]);

  const applyMutationWorkspaceWithLocalTurns = useCallback((payload: AgentWorkspacePayload, settledLocalIds: Set<string>) => {
    workspaceRequestSeq.current += 1;
    applyWorkspaceWithLocalTurns(payload, settledLocalIds);
  }, [applyWorkspaceWithLocalTurns]);

  const beginGeneration = () => {
    pendingTurnsRef.current += 1;
    setRuntimeStatus("generating");
  };

  const finishGeneration = () => {
    pendingTurnsRef.current = Math.max(0, pendingTurnsRef.current - 1);
    if (pendingTurnsRef.current === 0) setRuntimeStatus("ready");
  };

  const loadWorkspace = useCallback(async (preferredId?: string | null) => {
    const requestSeq = ++workspaceRequestSeq.current;
    setRuntimeStatus("reconnecting");
    setBootError(null);
    const loaded = await getAgentWorkspace(preferredId);
    if (requestSeq !== workspaceRequestSeq.current) return;
    if (loaded.sessions.length > 0) {
      applyWorkspace(loaded);
      setRuntimeStatus("ready");
      return;
    }
    const created = await createAgentSession({
      title: t("agent.newSession"),
      currentImage: currentGeneratedImage,
    });
    if (requestSeq !== workspaceRequestSeq.current) return;
    applyWorkspace(created);
    setRuntimeStatus("ready");
  }, [applyWorkspace, currentGeneratedImage, t]);

  const refreshWorkspace = useCallback(async (preferredId?: string | null) => {
    const requestSeq = ++workspaceRequestSeq.current;
    const loaded = await getAgentWorkspace(preferredId);
    if (requestSeq !== workspaceRequestSeq.current) return;
    // Poll refreshes must keep local optimistic turns (pending spinner) alive;
    // a full replace would wipe them between enqueue and completion.
    applyWorkspaceWithLocalTurns(loaded, new Set());
    setRuntimeStatus("ready");
  }, [applyWorkspaceWithLocalTurns]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void loadWorkspace().catch((error) => {
      setBootError(errorMessage(error));
      setRuntimeStatus("reconnecting");
    });
  }, [errorMessage, loadWorkspace]);

  const selectedSession = workspace.sessions.find((session) => session.id === selectedSessionId) ?? null;
  const currentImage = workspace.currentImageId ? workspace.imagesById[workspace.currentImageId] ?? null : null;
  const images = selectedSessionId
    ? (workspace.imageIdsBySession[selectedSessionId] ?? []).map((imageId) => workspace.imagesById[imageId]).filter((image): image is AgentImageHandle => !!image)
    : [];
  const turns = selectedSession ? workspace.turnsBySession[selectedSession.id] ?? [] : [];
  const localPendingCount = turns.filter(isLocalPendingTurn).length;
  const displayTurns = turns.filter((turn) => !isLocalPendingTurn(turn));
  const queueItems = selectedSessionId ? workspace.queueBySession[selectedSessionId] ?? [] : [];
  const selectedRunSummary = selectedSessionId ? workspace.runSummaryBySession[selectedSessionId] : undefined;
  const activeJobCount = queueItems.filter((item) => item.status === "queued" || item.status === "running").length;
  const runProgress = deriveAgentRunProgress({
    turns,
    queueItems,
    runSummary: selectedRunSummary,
    localPendingCount,
  });
  const selectedSettings = withAgentGenerationDefaults(selectedSession?.generationSettings);
  const derivedRuntimeStatus: AgentRuntimeStatus =
    runtimeStatus === "reconnecting"
      ? "reconnecting"
      : pendingTurnsRef.current > 0 || selectedRunSummary?.status === "queued" || selectedRunSummary?.status === "running"
        ? "generating"
        : "ready";
  const showRightSidebar = layoutMode !== "mobile-chat-image-sheet";
  const isDesktop = layoutMode === "desktop-three-pane" || layoutMode === "desktop-rail";
  const showAgentTopBar = layoutMode === "tablet-stacked" || layoutMode === "mobile-chat-image-sheet";
  const useSessionRail = layoutMode === "desktop-three-pane" || layoutMode === "desktop-rail";

  useEffect(() => {
    // Mirror freshly generated agent results into the main history store so
    // they also show up on the Canvas. The first loaded payload only seeds the
    // known-id set — pre-existing session images must not hijack the canvas.
    const ids = Object.keys(workspace.imagesById);
    if (!knownImageIdsRef.current) {
      if (ids.length > 0 || workspace.sessions.length > 0) knownImageIdsRef.current = new Set(ids);
      return;
    }
    const known = knownImageIdsRef.current;
    const freshHandles = ids
      .filter((id) => !known.has(id))
      .map((id) => workspace.imagesById[id])
      .filter((handle): handle is AgentImageHandle => !!handle);
    if (freshHandles.length === 0) return;
    for (const id of ids) known.add(id);
    const items = freshHandles.map(historyItemFromAgentImage);
    for (const item of items) addHistoryItem(item);
    const newest = items.reduce((a, b) => ((b.createdAt ?? 0) > (a.createdAt ?? 0) ? b : a));
    selectHistory(newest);
  }, [workspace.imagesById, workspace.sessions.length, addHistoryItem, selectHistory]);

  useEffect(() => {
    // Drop local pending bubbles only after the session run settles. Planner
    // prelude replies may arrive while image/video tools are still running.
    setWorkspace((current) => {
      if (pendingTurnsRef.current > 0) return current;
      let changed = false;
      const turnsBySession = { ...current.turnsBySession };
      for (const [sessionId, turns] of Object.entries(turnsBySession)) {
        const pendingTurns = turns.filter(isLocalPendingTurn);
        if (pendingTurns.length === 0) continue;
        const summary = current.runSummaryBySession[sessionId];
        const busy = summary?.status === "queued" || summary?.status === "running";
        if (busy) continue;
        turnsBySession[sessionId] = turns.filter((turn) => !isLocalPendingTurn(turn));
        changed = true;
      }
      return changed ? { ...current, turnsBySession } : current;
    });
  }, [workspace.turnsBySession, workspace.runSummaryBySession]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const hasActiveJobs = selectedRunSummary?.status === "queued" || selectedRunSummary?.status === "running";
    const timer = window.setInterval(() => {
      void refreshWorkspace(selectedSessionId).catch(() => setRuntimeStatus("reconnecting"));
    }, hasActiveJobs ? 1500 : 4000);
    return () => window.clearInterval(timer);
  }, [
    refreshWorkspace,
    selectedSessionId,
    selectedRunSummary?.queuedCount,
    selectedRunSummary?.runningCount,
    selectedRunSummary?.status,
  ]);

  const selectSession = (id: string) => {
    setDrawerOpen(false);
    setQueueSheetOpen(false);
    void loadWorkspace(id).catch(reportMutationError);
  };
  const createSession = () => {
    void createAgentSession({ title: t("agent.newSession"), currentImage: null })
      .then(applyMutationWorkspace)
      .catch(reportMutationError);
  };
  const renameSession = (id: string) => {
    const session = workspace.sessions.find((item) => item.id === id);
    const title = window.prompt(t("agent.renameSession"), session?.title ?? "");
    if (!title?.trim()) return;
    void updateAgentSession(id, { title: title.trim() }).then(applyMutationWorkspace).catch(reportMutationError);
  };
  const deleteSession = (id: string) => {
    const session = workspace.sessions.find((item) => item.id === id);
    if (!session || !window.confirm(t("agent.deleteConfirm", { title: session.title }))) return;
    void deleteAgentSession(id).then(applyMutationWorkspace).catch(reportMutationError);
  };
  const updateGenerationSettings = (patch: Partial<AgentGenerationSettings>) => {
    if (!selectedSessionId) return;
    const nextSettings = withAgentGenerationDefaults({ ...selectedSettings, ...patch });
    setWorkspace((current) => ({
      ...current,
      sessions: current.sessions.map((session) => session.id === selectedSessionId
        ? { ...session, generationSettings: nextSettings, webSearchEnabled: nextSettings.webSearchEnabled }
        : session),
    }));
    void updateAgentSession(selectedSessionId, { generationSettings: patch }).then(applyMutationWorkspace).catch(reportMutationError);
  };
  const setSessionWebSearch = (enabled: boolean) => {
    updateGenerationSettings({ webSearchEnabled: enabled });
  };
  const selectImage = (imageId: string) => {
    if (!selectedSessionId || workspace.currentImageId === imageId) return;
    const sessionId = selectedSessionId;
    setWorkspace((current) => ({ ...current, currentImageId: imageId }));
    void updateAgentSession(sessionId, { currentImageId: imageId }).then(applyMutationWorkspace).catch(reportMutationError);
  };
  const insertPrompt = (text: string) => {
    setInsertedPrompt({ id: Date.now(), text });
  };
  const cancelQueue = (itemId: string) => {
    void cancelAgentQueueItem(itemId).then(applyMutationWorkspace).catch(reportMutationError);
  };
  const retryQueue = (itemId: string) => {
    void retryAgentQueueItem(itemId).then(applyMutationWorkspace).catch(reportMutationError);
  };
  // UX-STATE-01: a failed run must expose recovery where the user sees it. Retrying
  // used to require opening the queue panel and finding the row by hand.
  const failedQueueItemId = selectedRunSummary?.status === "error"
    ? queueItems.find((item) => item.status === "failed")?.id
    : undefined;
  const retryFailedRun = failedQueueItemId ? () => retryQueue(failedQueueItemId) : undefined;
  const attachFiles = (files: File[]) => {
    if (!selectedSessionId || files.length === 0) return;
    void attachAgentImageFiles({
      sessionId: selectedSessionId,
      files,
      importLocalImageToHistory,
      applyWorkspace: applyMutationWorkspace,
    }).catch(reportMutationError);
  };
  const sendMessage = (text: string) => {
    if (!selectedSessionId) return;
    const sessionId = selectedSessionId;
    const createdAt = Date.now();
    const userTurn = localUserTurn(text, createdAt);
    const pendingTurn = localPendingTurn(t("agent.pending"), createdAt + 1);
    // Settle only the user turn on the 202 — the pending spinner must stay
    // visible while the queue item is queued/running. The cleanup effect
    // below removes it once the server replies or the run settles.
    const settledLocalIds = new Set([userTurn.id]);

    beginGeneration();
    setWorkspace((current) => appendTurns(current, sessionId, [userTurn, pendingTurn]));
    void enqueueAgentTurn(sessionId, text, selectedSettings)
      .then((payload) => applyMutationWorkspaceWithLocalTurns(payload.workspace, settledLocalIds))
      .catch((error) => {
        const message = errorMessage(error);
        setWorkspace((current) => replacePendingWithError(current, sessionId, pendingTurn.id, message));
        reportMutationError(error);
      })
      .finally(finishGeneration);
  };

  if (bootError) {
    return (
      <main className={`agent-workspace agent-workspace--${layoutMode} agent-workspace--boot-error`} data-layout={layoutMode} aria-label={t("agent.workspace")}>
        {showAgentTopBar ? (
          <AgentTopBar layoutMode={layoutMode} session={null} currentImage={null} activeJobCount={0} onOpenSessions={() => {}} onOpenImage={() => {}} onOpenQueue={() => {}} />
        ) : null}
        <section className="agent-workspace__boot-error" role="alert">
          <strong>{t("agent.bootFailed")}</strong>
          <span title={bootError}>{bootError}</span>
          <button type="button" onClick={() => void loadWorkspace().catch((error) => setBootError(errorMessage(error)))}>{t("agent.bootRetry")}</button>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`agent-workspace agent-workspace--${layoutMode}${isDesktop && toolsPanelOpen ? " agent-workspace--tools-docked" : ""}`}
      data-layout={layoutMode}
      aria-label={t("agent.workspace")}
    >
      {useSessionRail ? (
        <div className="agent-session-rail-wrap">
          <AgentSessionRail sessions={workspace.sessions} selectedId={selectedSessionId ?? ""} imagesById={workspace.imagesById} runSummaryBySession={workspace.runSummaryBySession} onCreate={createSession} onSelect={selectSession} onOpenDrawer={() => setDrawerOpen(true)} />
        </div>
      ) : null}
      {showAgentTopBar ? (
        <AgentTopBar
          layoutMode={layoutMode}
          session={selectedSession}
          currentImage={currentImage}
          activeJobCount={activeJobCount}
          onOpenSessions={() => setDrawerOpen(true)}
          onOpenImage={() => setImageSheetOpen(true)}
          onOpenQueue={() => setQueueSheetOpen(true)}
        />
      ) : null}
      <div className="agent-workspace__body">
        <AgentChatPane
          session={selectedSession}
          turns={displayTurns}
          imagesById={workspace.imagesById}
          currentImageId={workspace.currentImageId}
          runtimeStatus={derivedRuntimeStatus}
          runProgress={runProgress}
          settings={selectedSettings}
          insertedPrompt={insertedPrompt}
          onSettingsChange={updateGenerationSettings}
          onOpenModelTab={() => { setSidebarTab("model"); setToolsPanelOpen(true); }}
          onWebSearchChange={setSessionWebSearch}
          onAttachFiles={attachFiles}
          onImageSelect={selectImage}
          onSend={sendMessage}
          onRetryRun={retryFailedRun}
        />
        {isDesktop ? (
          <AgentStagePane currentImage={currentImage} images={images} onImageSelect={selectImage} onOpenPanel={toggleToolsPanel} toolsPanelOpen={toolsPanelOpen} />
        ) : showRightSidebar ? (
          <AgentRightSidebar
            currentImage={currentImage}
            images={images}
            contextTab={activeTab}
            sidebarTab={sidebarTab}
            queueItems={queueItems}
            runSummary={selectedRunSummary}
            settings={selectedSettings}
            onContextTabChange={setActiveTab}
            onSidebarTabChange={setSidebarTab}
            onImageSelect={selectImage}
            onSettingsChange={updateGenerationSettings}
            onInsertPrompt={insertPrompt}
            onCancelQueue={cancelQueue}
            onRetryQueue={retryQueue}
          />
        ) : null}
        {/* Rendered inside the body so the docked layout can give it a column
            instead of covering the stage. */}
        {isDesktop && toolsPanelOpen ? (
          <AgentRightSidebar
            overlay
            onClose={closeToolsPanel}
            currentImage={currentImage}
            images={images}
            contextTab={activeTab}
            sidebarTab={sidebarTab}
            queueItems={queueItems}
            runSummary={selectedRunSummary}
            settings={selectedSettings}
            onContextTabChange={setActiveTab}
            onSidebarTabChange={setSidebarTab}
            onImageSelect={selectImage}
            onSettingsChange={updateGenerationSettings}
            onInsertPrompt={insertPrompt}
            onCancelQueue={cancelQueue}
            onRetryQueue={retryQueue}
          />
        ) : null}
      </div>
      <AgentSessionDrawer open={drawerOpen} sessions={workspace.sessions} selectedId={selectedSessionId ?? ""} imagesById={workspace.imagesById} runSummaryBySession={workspace.runSummaryBySession} onClose={() => setDrawerOpen(false)} onCreate={createSession} onSelect={selectSession} onRename={renameSession} onDelete={deleteSession} />
      <AgentImageSheet open={imageSheetOpen} currentImage={currentImage} images={images} activeTab={activeTab} onTabChange={setActiveTab} onImageSelect={selectImage} onClose={() => setImageSheetOpen(false)} />
      <AgentQueueSheet open={queueSheetOpen} items={queueItems} summary={selectedRunSummary} onCancel={cancelQueue} onRetry={retryQueue} onClose={() => setQueueSheetOpen(false)} />
    </main>
  );
}
