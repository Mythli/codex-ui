import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { CodexRenderBlock } from "@taylordb/codex";
import { CoderShell } from "../../CoderInterface";
import { useCoderUIConfig } from "../../../system";
import { useChatSelectionController } from "./useChatSelectionController";
import type { CoderInitialData } from "../../../../features/Coder/store/reducers/initialData";
import type { ChatPaneState, CoderProjectChatGroup, CoderSelection } from "../../CoderCore/types";
import { hydrateCoderInitialData } from "../../../../features/Coder/store/reducers/hydrateInitialData";
import { useAppDispatch, useAppSelector } from "../../../../features/Coder/store/hooks";
import { selectChatGroups } from "../../../../features/Coder/store/selectors/chatListSelectors";
import {
  selectActiveThread,
  selectIsRunning,
  selectSelectedThreadId,
  selectSelection,
  selectShouldLoadSelectedThread
} from "../../../../features/Coder/store/selectors/threadSelectors";
import {
  selectActiveChat,
  selectChatPane,
  selectCurrentProject
} from "../../../../features/Coder/store/selectors/workspaceSelectors";
import {
  attachmentRemoved,
  attachmentsAdded,
  composerPromptSet,
  composerThreadHydrated,
  modelSelected,
  permissionModeSelected,
  reasoningEffortSelected
} from "../../../../features/Coder/store/slices/composerSlice";
import { newDraftSelected, threadSelected } from "../../../../features/Coder/store/slices/selectionSlice";
import { archiveThread, openThread } from "../../../../features/Coder/store/thunks/threadThunks";
import { submitPrompt } from "../../../../features/Coder/store/thunks/turnThunks";

export type CoderPageProps = {
  initialChatId?: string;
  initialData?: CoderInitialData;
  routeChatId?: string;
  onSelectChatRoute?: (chatId: string) => void;
  onNewChatRoute?: () => void;
  previewUrl?: string | null;
};

export function CoderWorkspace({
  initialChatId,
  initialData,
  routeChatId,
  onNewChatRoute,
  onSelectChatRoute,
  previewUrl = "http://localhost:4321"
}: CoderPageProps = {}) {
  const dispatch = useAppDispatch();
  const hydratedInitialDataRef = useRef<CoderInitialData | undefined>(undefined);
  useEffect(() => {
    if (initialData && hydratedInitialDataRef.current !== initialData) {
      hydrateCoderInitialData(dispatch, initialData);
      hydratedInitialDataRef.current = initialData;
    }
  }, [dispatch, initialData]);

  const { markdownComponents } = useCoderUIConfig();
  const effectiveRouteChatId = routeChatId ?? initialChatId;
  const activeChat = useAppSelector(selectActiveChat);
  const activeThread = useAppSelector(selectActiveThread);
  const chatGroups = useAppSelector(selectChatGroups);
  const chatPane = useAppSelector(selectChatPane);
  const composer = useAppSelector((state) => state.composer);
  const currentProject = useAppSelector(selectCurrentProject);
  const isRunning = useAppSelector(selectIsRunning);
  const selectedThreadId = useAppSelector(selectSelectedThreadId);
  const selection = useAppSelector(selectSelection);
  const shouldLoadSelectedThread = useAppSelector(selectShouldLoadSelectedThread);
  const threadIndex = useAppSelector((state) => state.threadIndex);
  const models = composer.models;
  const loadingError = chatPane.kind === "error" ? chatPane.message : threadIndex.error;
  const [preSubmitPreview, setPreSubmitPreview] = useState<{
    createdAtMs: number;
    key: number;
    text: string;
  } | undefined>();
  const lastReadyPaneRef = useRef<{ key: string; pane: Extract<ChatPaneState, { kind: "ready" }> } | undefined>(undefined);

  useEffect(() => {
    dispatch(composerThreadHydrated(activeThread));
  }, [activeThread, dispatch]);

  useEffect(() => {
    if (!selectedThreadId || !shouldLoadSelectedThread) {
      return;
    }
    void dispatch(openThread(selectedThreadId)).catch(() => undefined);
  }, [dispatch, selectedThreadId, shouldLoadSelectedThread]);

  const {
    createDraftChat,
    selectRoutedChat,
    submitPromptFromSelection
  } = useChatSelectionController({
    routeChatId: effectiveRouteChatId,
    chatGroups,
    isRunning,
    selection,
    threadIndexStatus: threadIndex.status,
    newChat: (projectId) => dispatch(newDraftSelected({ projectId: projectId ?? currentProject.id })),
    onNewChatRoute,
    onSelectChatRoute,
    selectChat: (chatId, projectId) => dispatch(threadSelected({ threadId: chatId, projectId })),
    submitPrompt: () => dispatch(submitPrompt())
  });

  const showPreSubmitPreview = useCallback(() => {
    const text = composer.prompt.trim();
    if (!text && composer.attachments.length === 0) {
      return;
    }
    setPreSubmitPreview({
      createdAtMs: Date.now(),
      key: Date.now(),
      text: text || composer.attachments.map((attachment) => attachment.name).join("\n")
    });
  }, [composer.attachments, composer.prompt]);

  useEffect(() => {
    if (!preSubmitPreview) {
      return;
    }
    const previewKey = preSubmitPreview.key;
    const timeout = window.setTimeout(() => {
      setPreSubmitPreview((current) => current?.key === previewKey ? undefined : current);
    }, 5_000);
    return () => window.clearTimeout(timeout);
  }, [preSubmitPreview]);

  const previewChatPane = useMemo(() =>
    appendPreSubmitPreview(chatPane, preSubmitPreview, selection),
  [chatPane, preSubmitPreview, selection]);
  const stableChatPane = stabilizeChatPane(previewChatPane, selectionKey(selection), lastReadyPaneRef);

  return (
    <CoderShell
      chatGroups={chatGroups}
      chatPane={stableChatPane}
      currentChatId={activeChat?.id}
      currentChatTitle={activeChat?.title ?? "New chat"}
      isRunning={isRunning}
      isLoading={threadIndex.status === "loading" && chatGroups.length === 0}
      loadingError={loadingError}
      markdownComponents={markdownComponents}
      models={models}
      onAddAttachments={(attachments) => dispatch(attachmentsAdded(attachments))}
      onDeleteChat={async (chatId, projectId) => {
        const activeThreadId = selection.kind === "thread" ? selection.threadId : undefined;
        const fallbackChat = nextChatAfterDelete(chatGroups, chatId, projectId);
        await dispatch(archiveThread(chatId));
        if (activeThreadId !== chatId) {
          return;
        }
        if (fallbackChat) {
          dispatch(threadSelected({ threadId: fallbackChat.chatId, projectId: fallbackChat.projectId }));
          onSelectChatRoute?.(fallbackChat.chatId);
          return;
        }
        dispatch(newDraftSelected({ projectId }));
        onNewChatRoute?.();
      }}
      onNewChat={createDraftChat}
      onPromptChange={(value) => dispatch(composerPromptSet(value))}
      onRemoveAttachment={(attachmentId) => dispatch(attachmentRemoved(attachmentId))}
      onSelectChat={selectRoutedChat}
      onSelectModel={(model) => dispatch(modelSelected(model))}
      onSelectPermissionMode={(mode) => dispatch(permissionModeSelected(mode))}
      onSelectReasoningEffort={(effort) => dispatch(reasoningEffortSelected(effort))}
      onBeforeSubmitPrompt={showPreSubmitPreview}
      onSubmitPrompt={submitPromptFromSelection}
      previewUrl={previewUrl ?? undefined}
      prompt={composer.prompt}
      project={currentProject}
      attachments={composer.attachments}
      selectedPermissionMode={composer.selectedPermissionMode}
      selectedModel={composer.selectedModel}
      selectedReasoningEffort={composer.selectedReasoningEffort}
      contextUsage={composer.contextUsage}
      transcriptNowMs={initialData?.generatedAtMs}
    />
  );
}

export function CoderPage({
  initialChatId,
  initialData,
  routeChatId,
  onNewChatRoute,
  onSelectChatRoute,
  previewUrl = "http://localhost:4321"
}: CoderPageProps = {}) {
  return <CoderWorkspace
    initialChatId={initialChatId}
    initialData={initialData}
    routeChatId={routeChatId}
    onNewChatRoute={onNewChatRoute}
    onSelectChatRoute={onSelectChatRoute}
    previewUrl={previewUrl}
  />;
}

function nextChatAfterDelete(
  groups: CoderProjectChatGroup[],
  chatId: string,
  projectId: string
): { chatId: string; projectId: string } | undefined {
  const group = groups.find((candidate) => candidate.id === projectId);
  const groupChats = group?.chats ?? [];
  const index = groupChats.findIndex((chat) => chat.id === chatId);
  const sibling = index >= 0
    ? groupChats[index + 1] ?? groupChats[index - 1]
    : undefined;
  if (sibling) {
    return { chatId: sibling.id, projectId };
  }
  for (const candidate of groups) {
    const chat = candidate.chats.find((item) => item.id !== chatId);
    if (chat) {
      return { chatId: chat.id, projectId: candidate.id };
    }
  }
  return undefined;
}

function appendPreSubmitPreview(
  chatPane: ChatPaneState,
  preview: { createdAtMs: number; key: number; text: string } | undefined,
  selection: CoderSelection
): ChatPaneState {
  if (!preview || chatPaneContainsUserText(chatPane, preview.text)) {
    return chatPane;
  }
  const previewBlocks = preSubmitPreviewBlocks(preview);
  if (chatPane.kind === "ready") {
    return {
      ...chatPane,
      blocks: [...chatPane.blocks, ...previewBlocks]
    };
  }
  if (chatPane.kind === "home" || chatPane.kind === "empty" || chatPane.kind === "loading") {
    return {
      kind: "ready",
      chatId: selection.kind === "thread" ? selection.threadId : selection.kind === "draft" ? selection.draftId : "pre-submit",
      blocks: previewBlocks
    };
  }
  return chatPane;
}

function stabilizeChatPane(
  chatPane: ChatPaneState,
  key: string,
  lastReadyPaneRef: MutableRefObject<{ key: string; pane: Extract<ChatPaneState, { kind: "ready" }> } | undefined>
): ChatPaneState {
  if (chatPane.kind === "ready" && chatPane.blocks.length > 0) {
    lastReadyPaneRef.current = { key, pane: chatPane };
    return chatPane;
  }
  if ((chatPane.kind === "loading" || chatPane.kind === "empty" || chatPane.kind === "home") && lastReadyPaneRef.current?.key === key) {
    return lastReadyPaneRef.current.pane;
  }
  return chatPane;
}

function selectionKey(selection: CoderSelection): string {
  if (selection.kind === "thread") {
    return `thread:${selection.threadId}`;
  }
  if (selection.kind === "draft") {
    return `draft:${selection.draftId}`;
  }
  return "none";
}

function chatPaneContainsUserText(chatPane: ChatPaneState, text: string): boolean {
  return chatPane.kind === "ready" &&
    chatPane.blocks.some((block) => block.type === "userMessage" && block.text === text);
}

function preSubmitPreviewBlocks(input: {
  createdAtMs: number;
  key: number;
  text: string;
}): CodexRenderBlock[] {
  const turnId = `pre-submit:${input.key}`;
  return [
    {
      type: "userMessage",
      id: `${turnId}:user`,
      turnId,
      text: input.text,
      attachments: [],
      images: []
    },
    {
      type: "assistantTurn",
      id: `${turnId}:assistant`,
      turnId,
      status: "running",
      source: "live",
      startedAtMs: input.createdAtMs,
      segments: [{
        type: "work",
        id: `${turnId}:work`,
        status: "running",
        startedAtMs: input.createdAtMs,
        headline: {
          label: "Thinking",
          defaultExpanded: false,
          hasEntries: false,
          entryCount: 0
        },
        entries: []
      }],
      artifacts: {}
    }
  ];
}
