import { CoderShell } from "../../CoderInterface";
import { useCoderUIConfig } from "../../../system";
import { deriveChatPaneState } from "../../CoderCore/store/derivedState";
import { useChatSelectionController } from "./useChatSelectionController";
import {
  selectActiveChat,
  selectChatGroups,
  selectActiveTranscript,
  selectIsRunning,
  useCoderStore
} from "../../CoderCore/store";

export type CoderPageProps = {
  initialChatId?: string;
  routeChatId?: string;
  onSelectChatRoute?: (chatId: string) => void;
  onNewChatRoute?: () => void;
  previewUrl?: string | null;
};

export function CoderWorkspace({
  initialChatId,
  routeChatId,
  onNewChatRoute,
  onSelectChatRoute,
  previewUrl = "http://localhost:4321"
}: CoderPageProps = {}) {
  const { markdownComponents } = useCoderUIConfig();
  const effectiveRouteChatId = routeChatId ?? initialChatId;
  const activeChat = useCoderStore(selectActiveChat);
  const addAttachments = useCoderStore((state) => state.addAttachments);
  const chatGroups = useCoderStore(selectChatGroups);
  const composer = useCoderStore((state) => state.composer);
  const models = composer.models;
  const defaultCwd = useCoderStore((state) => state.defaultCwd);
  const isRunning = useCoderStore(selectIsRunning);
  const hydratingThreadIds = useCoderStore((state) => state.hydratingThreadIds);
  const newChat = useCoderStore((state) => state.newChat);
  const removeAttachment = useCoderStore((state) => state.removeAttachment);
  const selectChat = useCoderStore((state) => state.selectChat);
  const selection = useCoderStore((state) => state.selection);
  const setPrompt = useCoderStore((state) => state.setPrompt);
  const setSelectedModel = useCoderStore((state) => state.setSelectedModel);
  const setSelectedPermissionMode = useCoderStore((state) => state.setSelectedPermissionMode);
  const setSelectedReasoningEffort = useCoderStore((state) => state.setSelectedReasoningEffort);
  const submitPrompt = useCoderStore((state) => state.submitPrompt);
  const runtimeState = useCoderStore((state) => state.runtimeState);
  const threadIndex = useCoderStore((state) => state.threadIndex);
  const transcript = useCoderStore(selectActiveTranscript);
  const loadingError = transcript?.error ?? threadIndex.error;
  const selectedProjectId = selection.kind === "none" ? undefined : selection.projectId;
  const activeGroup = chatGroups.find((group) =>
    selectedProjectId
      ? group.id === selectedProjectId
      : group.chats.some((chat) => chat.id === activeChat?.id)
  );
  const currentProject = activeGroup
    ? { id: activeGroup.id, name: activeGroup.name }
    : fallbackProject(defaultCwd);
  const chatPane = deriveChatPaneState({
    selection,
    activeChatTitle: activeChat?.title,
    error: loadingError,
    isHydratingSelectedThread: selection.kind === "thread" && hydratingThreadIds.includes(selection.threadId),
    runtimeState
  });
  const {
    createDraftChat,
    selectRoutedChat,
    submitPromptFromSelection
  } = useChatSelectionController({
    routeChatId: effectiveRouteChatId,
    chatGroups,
    isRunning,
    runtimeState,
    selection,
    threadIndexStatus: threadIndex.status,
    newChat,
    onNewChatRoute,
    onSelectChatRoute,
    selectChat,
    submitPrompt
  });

  return (
    <CoderShell
      chatGroups={chatGroups}
      chatPane={chatPane}
      currentChatId={activeChat?.id}
      currentChatTitle={activeChat?.title ?? "New chat"}
      isRunning={isRunning}
      isLoading={threadIndex.status === "loading" && chatGroups.length === 0}
      loadingError={loadingError}
      markdownComponents={markdownComponents}
      models={models}
      onAddAttachments={addAttachments}
      onNewChat={createDraftChat}
      onPromptChange={setPrompt}
      onRemoveAttachment={removeAttachment}
      onSelectChat={selectRoutedChat}
      onSelectModel={setSelectedModel}
      onSelectPermissionMode={setSelectedPermissionMode}
      onSelectReasoningEffort={setSelectedReasoningEffort}
      onSubmitPrompt={submitPromptFromSelection}
      previewUrl={previewUrl ?? undefined}
      prompt={composer.prompt}
      project={currentProject}
      attachments={composer.attachments}
      selectedPermissionMode={composer.selectedPermissionMode}
      selectedModel={composer.selectedModel}
      selectedReasoningEffort={composer.selectedReasoningEffort}
      contextUsage={composer.contextUsage}
    />
  );
}

export function CoderPage({
  initialChatId,
  routeChatId,
  onNewChatRoute,
  onSelectChatRoute,
  previewUrl = "http://localhost:4321"
}: CoderPageProps = {}) {
  return <CoderWorkspace
    initialChatId={initialChatId}
    routeChatId={routeChatId}
    onNewChatRoute={onNewChatRoute}
    onSelectChatRoute={onSelectChatRoute}
    previewUrl={previewUrl}
  />;
}

function fallbackProject(cwd?: string) {
  const id = cwd ?? "workspace";
  return {
    id,
    name: cwd ? cwd.split("/").filter(Boolean).at(-1) ?? cwd : "Workspace"
  };
}
