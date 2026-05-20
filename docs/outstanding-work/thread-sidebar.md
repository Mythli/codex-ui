# Thread Sidebar Outstanding Work Research

This note covers the README items for the left sidebar, thread list, selection, and sidebar-facing thread index. It is based on local code inspection on 2026-05-21.

Primary files:

- `apps/coder/app/features/threads/components/ChatSwitcher/ChatSwitcher.tsx`
- `apps/coder/app/features/threads/components/ChatSwitcher/ChatSwitcherPrimitives.tsx`
- `apps/coder/app/features/threads/components/ProjectPicker/ProjectPicker.tsx`
- `apps/coder/app/features/threads/hooks/useChatSelectionController.ts`
- `apps/coder/app/features/threads/state/threadSelectionSlice.ts`
- `apps/coder/app/features/threads/state/threadIndexReducer/CodexThreadIndexReducer.ts`
- `apps/coder/app/features/threads/state/threadListMetaSlice.ts`
- `apps/coder/app/store/configureStore.ts`
- `apps/coder/e2e/click/latest-threads.spec.ts`
- `apps/coder/e2e/click/sidebar-status.spec.ts`

## Architecture Snapshot

The product area is the thread sidebar. Some implementation names still use the older chat vocabulary, especially `ChatSwitcher` and `ChatRow`; this note uses thread sidebar/thread row for ownership and only uses the old names when referring to concrete files or symbols.

The left sidebar receives the already-reduced `threadIndex`, projects, unread ids, loading state, selected thread or draft, and a view mode from `CoderShell`.

The current data path is:

```text
Codex transport traffic
  -> codexTrafficReceived
  -> threadIndexSlice / threadSelectionSlice / threadListMetaSlice / listener middleware
  -> CoderWorkspace selectors
  -> CoderShell
  -> ChatSwitcher
  -> ChatRow
```

Selection is kept separately in `threadSelectionSlice`. Route synchronization and auto-selection live in `useChatSelectionController`. The meta file is now `threadListMetaSlice.ts`, although the Redux key still uses the legacy `chatListMeta` name.

<a id="stabilize-thread-sidebar-ordering-and-selection"></a>
## Stabilize Thread Sidebar Ordering And Selection

Status: Confirmed.

Current behavior:

- `ChatSwitcher` renders thread groups from `projectSections(threadIndex, hiddenProjects, renamedProjects)`.
- `projectSections` uses `threadIndex.projectOrder` and `projectsByCwd[cwd].threadIds`.
- `CodexThreadIndexReducer.finalizeState` sorts every thread by `updatedAt` descending, then by `threadId`.
- Opening, reading, resuming, or starting turns can touch thread metadata and trigger a new sort.
- `useChatSelectionController` can auto-select the first thread when there is no route, no draft, and the current thread is not running.

Important snippets:

```ts
// ChatSwitcher.tsx
const decoratedGroups = useMemo(
  () => projectSections(threadIndex, hiddenProjects, renamedProjects),
  [hiddenProjects, renamedProjects, threadIndex]
);

const visibleGroups = decoratedGroups.map((group) => ({
  ...group,
  chats: group.threadIds.map((threadId) => threadIndex.threadsById[threadId])
}));
```

```ts
// CodexThreadIndexReducer.ts
const sortedThreadOrder = unique([...state.threadOrder, ...Object.keys(state.threadsById)])
  .filter((threadId) => Boolean(state.threadsById[threadId]))
  .sort((a, b) => compareThreadActivity(state.threadsById[a], state.threadsById[b]));

function compareThreadActivity(a, b) {
  const timestampDelta = timestampMs(b?.updatedAt) - timestampMs(a?.updatedAt);
  return timestampDelta !== 0 ? timestampDelta : (b?.threadId ?? "").localeCompare(a?.threadId ?? "");
}
```

Why the user-observed jumping is plausible:

- `turn/start`, `thread/status/changed`, and `turn/started` patch `updatedAt` to now for active/running threads.
- `thread/read`, `thread/start`, and `thread/resume` responses upsert thread metadata and can replace `updatedAt`.
- Because `threadOrder` and project order are recomputed on every relevant traffic item, active thread rows can move while the user is trying to click.

Files involved:

- `ChatSwitcher.tsx`: thread grouping, visible rows, local hidden/renamed/collapsed state.
- `ChatSwitcherPrimitives.tsx`: `ChatRow` rendering and status indicators.
- `useChatSelectionController.ts`: route sync and first-thread auto-selection.
- `CodexThreadIndexReducer.ts`: all ordering and group construction.
- `latest-threads.spec.ts`: existing click coverage for top-down and repeated switching.

Recommended implementation:

1. Define the product rule first: either strict "latest updated" ordering, stable server order until explicit refresh, or stable order while a switcher session is open.
2. Split "display sort timestamp" from "runtime status timestamp". Running status should not necessarily re-rank the thread list.
3. Add a reducer-level invariant test: opening/reading a thread must not reorder rows unless the backend supplies a real updated timestamp newer than the current one.
4. Add a switcher-level e2e assertion that captures row order before clicking and proves it remains stable through the click/hydration window.
5. Avoid using active loading events as sort keys. Prefer a separate `activity` flag for spinners.

Risk:

- If `updatedAt` is used both for "latest changed" and "currently touched by UI", fixes can regress the "new thread appears first" behavior. Preserve the new-thread flow with explicit tests.

<a id="verify-running-and-unread-state-in-the-thread-sidebar"></a>
## Verify Running And Unread State In The Thread Sidebar

Status: Partially confirmed. The state exists and there is click e2e coverage, but the lifecycle is not completely proven.

Current behavior:

- `ChatRow` shows a spinner when `chat.activity === "running"`.
- `ChatRow` shows an unread dot when `unreadThreadIds` contains the row thread id.
- Running state comes from `CodexThreadIndexReducer`.
- Unread state is local UI metadata in `threadListMetaSlice`, driven by listener middleware in `configureStore.ts`.

Important snippets:

```tsx
// ChatSwitcherPrimitives.tsx
{chat.activity === "running" ? (
  <output data-testid="chat-switcher-chat-running" />
) : unread ? (
  <span data-testid="chat-switcher-chat-unread" />
) : updatedLabel ? (
  <span>{updatedLabel}</span>
) : null}
```

```ts
// configureStore.ts
if (selectedThreadId === threadId) {
  listenerApi.dispatch(threadUnreadCleared(threadId));
  return;
}
if (method === "turn/completed" || (method === "thread/status/changed" && !isActiveThreadStatus(params.status))) {
  listenerApi.dispatch(threadUnreadMarked(threadId));
}
```

Known gaps:

- Unread is only marked on `turn/completed` and inactive `thread/status/changed`; other message-producing events do not mark unread.
- Running state can come from request traffic, status events, or turn events. Those paths are not covered equally.
- `threadListMetaSlice` also tracks `hydratingThreadIds`, but hydration is separate from `threadIndex.activity`; a row can be loading in the transcript pane without a row-specific sidebar status.
- There is no reducer unit test suite for unread or activity transitions.

Existing e2e:

- `sidebar-status.spec.ts` covers a background sleep turn becoming running, then unread, then clearing when opened.
- This is valuable, but it is a live click test with a narrow path.

Recommended implementation:

1. Add unit tests for `CodexThreadIndexReducer` covering `turn/start`, `turn/started`, `thread/status/changed`, `turn/completed`, response errors, and archive.
2. Add tests for the listener middleware unread rules, especially selected thread vs background thread.
3. Add a UI test for hydration state separately from running state.
4. Decide whether streaming deltas on background threads should mark unread immediately or only after completion.
5. If diagnostics are filtered later, ensure unread and running events remain allowlisted.

Files involved:

- `apps/coder/app/features/threads/state/threadIndexReducer/CodexThreadIndexReducer.ts`
- `apps/coder/app/features/threads/state/threadListMetaSlice.ts`
- `apps/coder/app/store/configureStore.ts`
- `apps/coder/app/features/thread/state/threadThunks.ts`
- `apps/coder/e2e/click/sidebar-status.spec.ts`

<a id="add-focused-project-mode-for-the-thread-sidebar"></a>
## Add Focused Project Mode For The Thread Sidebar

Status: Confirmed not implemented.

Current behavior:

- The app is multi-project by default.
- `CoderShell.projectList()` builds all project options from `threadIndex.projectOrder`.
- `ChatSwitcher` renders all projects unless the user hides one locally.
- New thread creation is currently mediated through `ProjectPicker` in both `ChatSwitcher` and `SidebarHeader`.
- `useChatSelectionController.createDraftChat(projectId?)` accepts an optional project but has no active focused-project state.

Important snippets:

```tsx
// ChatSwitcher.tsx
<ProjectPicker
  onSelectProject={(projectId) => onCreateChat?.(projectId)}
  projects={projects}
>
  New chat in
</ProjectPicker>
```

```tsx
// SidebarHeader.tsx
<ProjectPicker
  onSelectProject={(projectId) => onNewChat?.(projectId)}
  projects={projects}
>
  New chat in
</ProjectPicker>
```

```ts
// useChatSelectionController.ts
const createDraftChat = useCallback((projectId?: string) => {
  pendingRouteChatIdRef.current = undefined;
  newChat(projectId);
  onNewChatRoute?.();
}, [newChat, onNewChatRoute]);
```

Recommended implementation:

1. Add shell-level focused project state in the workspace layer, not inside `ChatSwitcher`.
2. Pass `focusedProjectId` and `onFocusedProjectChange` through `CoderShell`, `CoderSidebar`, `SidebarHeader`, and `ChatSwitcher`.
3. Filter `projectOptions` and visible groups when focus mode is active.
4. Make the new-thread action call `onNewChat(focusedProjectId)` directly while focused, without opening `ProjectPicker`.
5. Ensure route auto-selection only chooses from the focused project when focus mode is active.
6. Persist the focused project with the workspace UI storage adapter from the workspace backlog.

Files involved:

- `CoderShell.tsx`
- `SidebarHeader.tsx`
- `ChatSwitcher.tsx`
- `ProjectPicker.tsx`
- `useChatSelectionController.ts`
- `threadSelectionSlice.ts`
- `workspaceSelectors.ts`

Tests to add:

- Focus mode filters the switcher to one project.
- Header new-thread action creates a draft in the focused project without showing the picker.
- Route selection and auto-selection do not jump to a thread outside the focused project.
- Clearing focus restores all projects.

<a id="fix-new-thread-visibility-and-title-propagation-in-threadindexreducer"></a>
## Fix New-Thread Visibility And Title Propagation In ThreadIndexReducer

Status: Confirmed plausible from reducer behavior.

Current behavior:

- `threadIndexSlice` ignores traffic targeted at `local-thread:*`.
- Draft submission creates provisional transcript state in `loadedThreadsSlice`, but not in `threadIndex`.
- `CodexThreadIndexReducer.patchOrCreateThread()` creates new rows as `Untitled` when it sees `turn/start` without a title.
- Title updates only apply when `thread/name/updated` includes `threadName`.
- `upsertThreadWithExisting()` falls back through `thread.name`, `thread.preview`, existing title, then `"Untitled"`.

Important snippets:

```ts
// threadIndexSlice.ts
const targetThreadId = packet.threadId ?? metadataThreadId(action.payload);
if (targetThreadId?.startsWith("local-thread:")) {
  return state;
}
```

```ts
// CodexThreadIndexReducer.ts
title: patch.title ?? "Untitled"
```

```ts
// CodexThreadIndexReducer.ts
if (method === "thread/name/updated") {
  const title = stringValue(params.threadName);
  return threadId && title ? finalizeState(patchThread(state, threadId, { title })) : state;
}
```

Recommended implementation:

1. Decide whether provisional threads should appear in `threadIndex` before the server thread id exists.
2. If yes, add explicit provisional index entries and a promotion path matching `loadedThreadsSlice.promoteProvisionalThread()`.
3. Use first user message or request input as an immediate fallback title, not an empty/Untitled row.
4. Listen to `thread/started`, `thread/start` response, `turn/start` metadata, `turn/started`, and `thread/name/updated` in one coherent flow.
5. Add reducer tests for new thread lifecycle and title transitions.

Files involved:

- `threadIndexSlice.ts`
- `CodexThreadIndexReducer.ts`
- `turnThunks.ts`
- `loadedThreadsSlice.ts`
- `trafficRouting.ts`

<a id="expand-reducer-tests-around-sidebar-facing-events"></a>
## Expand Reducer Tests Around Sidebar-Facing Events

Status: Confirmed missing. The app currently has click e2e files, but no focused reducer test files were found under `apps/coder` outside generated/cache output.

Existing coverage:

- `latest-threads.spec.ts`: click ordering and switching real threads.
- `sidebar-status.spec.ts`: running/unread background status.
- `ssr-initial-hydration.spec.ts`: initial route and reload hydration.
- `live-chat-activity.spec.ts`: send, duplicate sentinel, image/file links, reload.
- `work-timeline.spec.ts`: command grouping and file work completion.
- `asset-markdown.spec.ts`: asset and markdown rewrite behavior.

Recommended reducer tests:

1. `thread/list` request/response/error.
2. `thread/start`, `thread/resume`, and `thread/read` response upserts.
3. `turn/start` optimistic request with `targetThreadId`.
4. `turn/started` mapping turn id to thread id.
5. `turn/completed` clearing activity.
6. `thread/name/updated` title propagation.
7. `thread/archived` removal.
8. Project grouping and stable ordering.
9. Provisional/local-thread promotion once that architecture exists.

Suggested location:

- `apps/coder/app/features/threads/state/threadIndexReducer/CodexThreadIndexReducer.test.ts`
- `apps/coder/app/store/configureStore.test.ts` for listener middleware.

<a id="split-the-thread-sidebar-index-reducer-into-understandable-units"></a>
## Split The Thread Sidebar Index Reducer Into Understandable Units

Status: Confirmed. The sidebar index reducer combines multiple responsibilities.

Current responsibility mix:

- `CodexThreadIndexReducer.ts`: list loading, thread upsert, activity, project grouping, sorting, turn id mapping, title updates, archive handling, and optimistic sidebar state.
- `threadListMetaSlice.ts`: unread and hydration metadata.
- `configureStore.ts`: listener middleware that marks and clears unread state.

Recommended split:

1. `listReducer.ts` for `thread/list` loading, responses, and errors.
2. `threadUpsert.ts` for normalized row creation and metadata patching.
3. `activityReducer.ts` for running/completed/failed row state.
4. `projectGrouping.ts` for cwd/project normalization.
5. `threadSorting.ts` for stable display ordering.
6. `turnMapping.ts` for turn id to thread id correlation.
7. `unreadListeners.ts` or equivalent for unread listener middleware.

Guardrails:

- Add characterization tests before moving code.
- Keep the public `threadIndex` state shape stable while splitting internals.
- Do not mix sidebar index refactors with selected-thread reducer changes.
