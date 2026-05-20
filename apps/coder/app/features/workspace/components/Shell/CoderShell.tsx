import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { Group,
  Panel,
  Separator } from 'react-resizable-panels'
import { FiMenu } from 'react-icons/fi'
import { Button } from '@app/common/pure'
import type { MarkdownComponents } from '@app/common/pure'
import type {
  CodexRenderBlock,
  CodexThreadState,
  CodexThreadTokenUsage
} from "@coder/types";
import type { CodexProjectIndexItem } from "@coder/types";
import type { CodexThreadIndexState } from "@coder/types";
import type { CodexAppServerModel } from '@coder/types'
import type {
  CoderComposerAttachment,
  CoderPermissionMode,
  CoderReasoningEffort,
} from '@coder/types'
import { ChatSwitcher } from '@app/features/threads/components/ChatSwitcher/ChatSwitcher'
import type { CoderShellViewMode, PreviewViewport } from '@coder/types'
import { PreviewPanel } from '../PreviewFrame/PreviewPanel'
import { CoderSidebar } from '../Sidebar/CoderSidebar'
import styles from './CoderShell.module.css'

const SWITCHER_ANIMATION_MS = 220

export function CoderShell({
  attachments = [],
  activeThread,
  currentChatId,
  currentChatTitle,
  hydratingThreadIds,
  isHydratingThread = false,
  isLoading = false,
  isRunning = false,
  initialViewMode = 'both',
  initialSwitcherOpen = false,
  loadingError,
  markdownComponents,
  models,
  onAddAttachments,
  onDeleteChat,
  onNewChat,
  onPromptChange,
  onRemoveAttachment,
  onSelectChat,
  onSelectModel,
  onSelectPermissionMode,
  onSelectReasoningEffort,
  onBeforeSubmitPrompt,
  onSubmitPrompt,
  previewUrl,
  prompt,
  project,
  renderBlocks,
  selectedDraftId,
  selectedPermissionMode = 'default',
  selectedModel,
  selectedReasoningEffort,
  threadIndex,
  threadIndexError,
  transcriptFollowSignal,
  tokenUsage,
  transcriptNowMs,
  unreadThreadIds,
}: {
  attachments?: CoderComposerAttachment[]
  activeThread?: CodexThreadState
  currentChatId?: string
  currentChatTitle: string
  hydratingThreadIds: readonly string[]
  isHydratingThread?: boolean
  isLoading?: boolean
  isRunning?: boolean
  initialViewMode?: CoderShellViewMode
  initialSwitcherOpen?: boolean
  loadingError?: string
  markdownComponents?: MarkdownComponents
  models: CodexAppServerModel[]
  onAddAttachments?: (attachments: CoderComposerAttachment[]) => void
  onDeleteChat?: (chatId: string, projectId: string) => Promise<void> | void
  onNewChat?: (projectId?: string) => void
  onPromptChange: (value: string) => void
  onRemoveAttachment?: (attachmentId: string) => void
  onSelectChat?: (id: string, projectId: string) => void
  onSelectModel: (id: string) => void
  onSelectPermissionMode?: (value: CoderPermissionMode) => void
  onSelectReasoningEffort: (value: CoderReasoningEffort) => void
  onBeforeSubmitPrompt?: () => void
  onSubmitPrompt?: () => void
  previewUrl?: string
  prompt: string
  project: CodexProjectIndexItem
  renderBlocks: readonly CodexRenderBlock[]
  selectedDraftId?: string
  selectedPermissionMode?: CoderPermissionMode
  selectedModel: string
  selectedReasoningEffort: CoderReasoningEffort
  threadIndex: CodexThreadIndexState
  threadIndexError?: string
  transcriptFollowSignal?: number
  tokenUsage?: CodexThreadTokenUsage
  transcriptNowMs?: number
  unreadThreadIds: readonly string[]
}) {
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(initialSwitcherOpen)
  const [isSwitcherClosing, setIsSwitcherClosing] = useState(false)
  const [hasOpenedSwitcher, setHasOpenedSwitcher] = useState(initialSwitcherOpen)
  const [switcherQuery, setSwitcherQuery] = useState('')
  const [viewMode, setViewMode] = useState<CoderShellViewMode>(initialViewMode)
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>('desktop')
  const [previewReloadKey, setPreviewReloadKey] = useState(0)
  const [hasHydrated, setHasHydrated] = useState(false)
  const closeTimerRef = useRef<number | undefined>(undefined)

  const openSwitcher = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }

    setHasOpenedSwitcher(true)
    setIsSwitcherClosing(false)
    setIsSwitcherOpen(true)
  }, [])

  const closeSwitcher = useCallback(() => {
    if (!isSwitcherOpen || isSwitcherClosing) {
      return
    }

    setIsSwitcherClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setIsSwitcherOpen(false)
      setIsSwitcherClosing(false)
      closeTimerRef.current = undefined
    }, SWITCHER_ANIMATION_MS)
  }, [isSwitcherClosing, isSwitcherOpen])

  useEffect(() => {
    setHasHydrated(true)
  }, [])

  useEffect(() => {
    if (!isSwitcherOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSwitcher()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeSwitcher, isSwitcherOpen])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  const projectOptions = projectList(threadIndex, project)

  const sidebar = (
    <CoderSidebar
      attachments={attachments}
      activeThread={activeThread}
      currentChatTitle={currentChatTitle}
      hydratingThreadIds={hydratingThreadIds}
      isHydratingThread={isHydratingThread}
      isRunning={isRunning}
      markdownComponents={markdownComponents}
      models={models}
      onAddAttachments={onAddAttachments}
      onNewChat={onNewChat}
      onPromptChange={onPromptChange}
      onRemoveAttachment={onRemoveAttachment}
      onSelectModel={onSelectModel}
      onSelectPermissionMode={onSelectPermissionMode}
      onSelectReasoningEffort={onSelectReasoningEffort}
      onBeforeSubmitPrompt={onBeforeSubmitPrompt}
      onSubmitPrompt={onSubmitPrompt}
      onToggleSwitcher={() => {
        if (isSwitcherOpen && !isSwitcherClosing) {
          closeSwitcher()
        } else {
          openSwitcher()
        }
      }}
      project={project}
      projects={projectOptions}
      prompt={prompt}
      renderBlocks={renderBlocks}
      selectedChatId={currentChatId}
      selectedDraftId={selectedDraftId}
      selectedPermissionMode={selectedPermissionMode}
      selectedModel={selectedModel}
      selectedReasoningEffort={selectedReasoningEffort}
      threadIndexError={threadIndexError}
      transcriptFollowSignal={transcriptFollowSignal}
      tokenUsage={tokenUsage}
      transcriptNowMs={transcriptNowMs}
    />
  )

  const preview = (
    <PreviewPanel
      onOpenExternal={() => {
        if (previewUrl) {
          window.open(previewUrl, '_blank', 'noopener,noreferrer')
        }
      }}
      onReload={() => setPreviewReloadKey((key) => key + 1)}
      onViewportChange={setPreviewViewport}
      previewReloadKey={previewReloadKey}
      previewUrl={previewUrl}
      previewViewport={previewViewport}
    />
  )
  const switcherState = isSwitcherClosing ? 'closing' : isSwitcherOpen ? 'open' : 'closed'

  return (
    <main
      aria-label="Coder workspace"
      className={styles.shell}
      data-current-chat-id={currentChatId}
      data-current-project-id={project.cwd}
      data-hydrated={hasHydrated ? 'true' : undefined}
      data-testid="coder-shell"
    >
      {hasOpenedSwitcher ? (
        <>
          <button
            aria-label="Close chats"
            className={[styles.switcherScrim, isSwitcherClosing ? styles.switcherScrimClosing : '']
              .filter(Boolean)
              .join(' ')}
            data-state={switcherState}
            disabled={!isSwitcherOpen || isSwitcherClosing}
            onClick={closeSwitcher}
            type="button"
          />
          <dialog
            open
            aria-hidden={!isSwitcherOpen}
            aria-label="Chat switcher"
            className={[styles.switcherPanel, isSwitcherClosing ? styles.switcherPanelClosing : '']
              .filter(Boolean)
              .join(' ')}
            data-state={switcherState}
            data-testid="chat-switcher-panel"
          >
            <ChatSwitcher
              activeChatId={currentChatId}
              error={loadingError}
              isLoading={isLoading}
              onClose={closeSwitcher}
              onCreateChat={(projectId) => {
                onNewChat?.(projectId)
                closeSwitcher()
              }}
              onDeleteChat={onDeleteChat}
              projects={projectOptions}
              onQueryChange={setSwitcherQuery}
              onSelectChat={(chatId, projectId) => {
                onSelectChat?.(chatId, projectId)
                closeSwitcher()
              }}
              onViewModeChange={setViewMode}
              query={switcherQuery}
              threadIndex={threadIndex}
              unreadThreadIds={unreadThreadIds}
              viewMode={viewMode}
            />
          </dialog>
        </>
      ) : null}

      {viewMode === 'preview' ? (
        <div className={styles.modeDock}>
          <Button
            aria-label="Open sidebar"
            data-testid="workspace-menu-button"
            iconOnly
            onClick={() => {
              if (isSwitcherOpen && !isSwitcherClosing) {
                closeSwitcher()
              } else {
                openSwitcher()
              }
            }}
            title="Open sidebar"
            type="button"
            variant="ghost"
          >
            <FiMenu aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {viewMode === 'chat' ? sidebar : null}
      {viewMode === 'preview' ? preview : null}
      {viewMode === 'both' ? (
        <Group
          className={styles.panels}
          defaultLayout={{ chat: 1, preview: 1 }}
          id="coder-shell-layout"
          orientation="horizontal"
          resizeTargetMinimumSize={{ coarse: 44, fine: 12 }}
        >
          <Panel className={styles.panel} collapsible defaultSize={1} id="chat" minSize={20}>
            {sidebar}
          </Panel>
          <Separator className={styles.resizeHandle}>
            <span className={styles.resizeGrip} />
          </Separator>
          <Panel className={styles.panel} collapsible defaultSize={1} id="preview" minSize={20}>
            {preview}
          </Panel>
        </Group>
      ) : null}
    </main>
  )
}

function projectList(
  threadIndex: CodexThreadIndexState,
  currentProject: CodexProjectIndexItem
): CodexProjectIndexItem[] {
  const projects = threadIndex.projectOrder
    .map((cwd) => threadIndex.projectsByCwd[cwd])
    .filter((project): project is CodexProjectIndexItem => Boolean(project))
  if (!projects.some((project) => project.cwd === currentProject.cwd)) {
    projects.push(currentProject)
  }
  return projects
}
