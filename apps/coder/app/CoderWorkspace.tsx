import { useEffect, useRef, type MutableRefObject } from 'react'
import type { CodexRenderBlock, CodexThreadIndexState } from '@taylordb/codex'
import { useCoderUIConfig } from './common/providers/CoderUIProvider'
import {
  selectHydratingThreadIds,
  selectUnreadThreadIds,
} from './features/conversation/state/chatListSelectors'
import {
  selectActiveThread,
  selectIsRunning,
  selectSelectedThreadId,
  selectSelection,
  selectShouldLoadSelectedThread,
} from './features/conversation/state/threadSelectors'
import type { CoderSelection } from './features/navigation/types'
import { useChatSelectionController } from './features/navigation/hooks/useChatSelectionController'
import {
  selectActiveChat,
  selectCurrentProject,
} from './features/navigation/state/workspaceSelectors'
import { newDraftSelected, threadSelected } from './features/navigation/state/selectionSlice'
import { useAppDispatch, useAppSelector } from './store/hooks'
import {
  attachmentRemoved,
  attachmentsAdded,
  composerPromptSet,
  composerThreadHydrated,
  modelSelected,
  permissionModeSelected,
  reasoningEffortSelected,
} from './features/composer/state/composerSlice'
import { archiveThread, openThread } from './features/conversation/state/threadThunks'
import { submitPrompt } from './features/composer/state/turnThunks'
import { CoderShell } from './features/workspace/components/Shell/CoderShell'

export type CoderWorkspaceProps = {
  initialChatId?: string
  routeChatId?: string
  onSelectChatRoute?: (chatId: string) => void
  onNewChatRoute?: () => void
  previewUrl?: string | null
}

export function CoderWorkspace({
  initialChatId,
  routeChatId,
  onNewChatRoute,
  onSelectChatRoute,
  previewUrl = 'http://localhost:4321',
}: CoderWorkspaceProps = {}) {
  const dispatch = useAppDispatch()

  const { markdownComponents } = useCoderUIConfig()
  const effectiveRouteChatId = routeChatId ?? initialChatId
  const activeChat = useAppSelector(selectActiveChat)
  const activeThread = useAppSelector(selectActiveThread)
  const composer = useAppSelector((state) => state.composer)
  const currentProject = useAppSelector(selectCurrentProject)
  const hydratingThreadIds = useAppSelector(selectHydratingThreadIds)
  const isRunning = useAppSelector(selectIsRunning)
  const selectedThreadId = useAppSelector(selectSelectedThreadId)
  const selection = useAppSelector(selectSelection)
  const shouldLoadSelectedThread = useAppSelector(selectShouldLoadSelectedThread)
  const threadIndex = useAppSelector((state) => state.threadIndex)
  const unreadThreadIds = useAppSelector(selectUnreadThreadIds)
  const models = composer.models
  const lastReadyPaneRef = useRef<
    { key: string; blocks: readonly CodexRenderBlock[] } | undefined
  >(undefined)
  const selectedChatId = selection.kind === 'thread' ? selection.threadId : undefined
  const selectedDraftId = selection.kind === 'draft' ? selection.draftId : undefined
  const activeRenderBlocks = activeThread?.renderBlocks ?? []
  const stableRenderBlocks = stabilizeRenderBlocks(
    activeRenderBlocks,
    selectionKey(selection),
    lastReadyPaneRef
  )

  useEffect(() => {
    dispatch(composerThreadHydrated(activeThread))
  }, [activeThread, dispatch])

  useEffect(() => {
    if (!selectedThreadId || !shouldLoadSelectedThread) {
      return
    }
    void dispatch(openThread(selectedThreadId)).catch(() => undefined)
  }, [dispatch, selectedThreadId, shouldLoadSelectedThread])

  const { createDraftChat, selectRoutedChat, submitPromptFromSelection } =
    useChatSelectionController({
      routeChatId: effectiveRouteChatId,
      threadIndex,
      isRunning,
      selection,
      threadIndexStatus: threadIndex.status,
      newChat: (projectId) =>
        dispatch(newDraftSelected({ projectId: projectId ?? currentProject.cwd })),
      onNewChatRoute,
      onSelectChatRoute,
      selectChat: (chatId, projectId) => dispatch(threadSelected({ threadId: chatId, projectId })),
      submitPrompt: () => dispatch(submitPrompt()),
    })

  return (
    <CoderShell
      activeThread={activeThread}
      currentChatId={selectedChatId}
      currentChatTitle={activeChat?.title ?? activeThread?.title ?? 'New chat'}
      hydratingThreadIds={hydratingThreadIds}
      isHydratingThread={selectedChatId ? hydratingThreadIds.includes(selectedChatId) : false}
      isRunning={isRunning}
      isLoading={threadIndex.status === 'loading' && threadIndex.threadOrder.length === 0}
      markdownComponents={markdownComponents}
      models={models}
      onAddAttachments={(attachments) => dispatch(attachmentsAdded(attachments))}
      onDeleteChat={async (chatId, projectId) => {
        const activeThreadId = selection.kind === 'thread' ? selection.threadId : undefined
        const fallbackChat = nextChatAfterDelete(threadIndex, chatId, projectId)
        await dispatch(archiveThread(chatId))
        if (activeThreadId !== chatId) {
          return
        }
        if (fallbackChat) {
          dispatch(
            threadSelected({ threadId: fallbackChat.chatId, projectId: fallbackChat.projectId })
          )
          onSelectChatRoute?.(fallbackChat.chatId)
          return
        }
        dispatch(newDraftSelected({ projectId }))
        onNewChatRoute?.()
      }}
      onNewChat={createDraftChat}
      onPromptChange={(value) => dispatch(composerPromptSet(value))}
      onRemoveAttachment={(attachmentId) => dispatch(attachmentRemoved(attachmentId))}
      onSelectChat={selectRoutedChat}
      onSelectModel={(model) => dispatch(modelSelected(model))}
      onSelectPermissionMode={(mode) => dispatch(permissionModeSelected(mode))}
      onSelectReasoningEffort={(effort) => dispatch(reasoningEffortSelected(effort))}
      onSubmitPrompt={submitPromptFromSelection}
      previewUrl={previewUrl ?? undefined}
      prompt={composer.prompt}
      project={currentProject}
      renderBlocks={stableRenderBlocks}
      attachments={composer.attachments}
      selectedDraftId={selectedDraftId}
      selectedPermissionMode={composer.selectedPermissionMode}
      selectedModel={composer.selectedModel}
      selectedReasoningEffort={composer.selectedReasoningEffort}
      threadIndex={threadIndex}
      threadIndexError={threadIndex.error}
      tokenUsage={composer.tokenUsage}
      unreadThreadIds={unreadThreadIds}
    />
  )
}

function nextChatAfterDelete(
  threadIndex: CodexThreadIndexState,
  chatId: string,
  projectId: string
): { chatId: string; projectId: string } | undefined {
  const groupThreadIds = threadIndex.projectsByCwd[projectId]?.threadIds ?? threadIndex.threadOrder
  const index = groupThreadIds.findIndex((candidateId) => candidateId === chatId)
  const siblingId = index >= 0 ? (groupThreadIds[index + 1] ?? groupThreadIds[index - 1]) : undefined
  const sibling = siblingId ? threadIndex.threadsById[siblingId] : undefined
  if (sibling) {
    return { chatId: sibling.threadId, projectId }
  }
  for (const candidateId of threadIndex.threadOrder) {
    if (candidateId !== chatId && threadIndex.threadsById[candidateId]) {
      return {
        chatId: candidateId,
        projectId: projectIdForThread(threadIndex, candidateId) ?? 'uncategorized',
      }
    }
  }
  return undefined
}

function stabilizeRenderBlocks(
  blocks: readonly CodexRenderBlock[],
  key: string,
  lastReadyPaneRef: MutableRefObject<
    { key: string; blocks: readonly CodexRenderBlock[] } | undefined
  >
): readonly CodexRenderBlock[] {
  if (blocks.length > 0) {
    lastReadyPaneRef.current = { key, blocks }
    return blocks
  }
  if (lastReadyPaneRef.current?.key === key) {
    return lastReadyPaneRef.current.blocks
  }
  return blocks
}

function selectionKey(selection: CoderSelection): string {
  if (selection.kind === 'thread') {
    return `thread:${selection.threadId}`
  }
  if (selection.kind === 'draft') {
    return `draft:${selection.draftId}`
  }
  return 'none'
}

function projectIdForThread(threadIndex: CodexThreadIndexState, threadId: string): string | undefined {
  for (const projectId of threadIndex.projectOrder) {
    if (threadIndex.projectsByCwd[projectId]?.threadIds.includes(threadId)) {
      return projectId
    }
  }
  return threadIndex.threadsById[threadId]?.cwd
}
