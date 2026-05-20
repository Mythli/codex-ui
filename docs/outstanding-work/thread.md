# Thread Outstanding Work Research

This note covers the README items for the selected thread/transcript area. It is based on local code inspection on 2026-05-21.

Primary files:

- `apps/coder/app/features/thread/state/loadedThreadsSlice.ts`
- `apps/coder/app/features/thread/state/threadReducer/CodexThreadReducer.ts`
- `apps/coder/app/features/thread/state/threadReducer/internal/eventStrategies.ts`
- `apps/coder/app/features/thread/state/threadReducer/internal/renderBlocks.ts`
- `apps/coder/app/features/thread/state/threadReducer/fileChangePatch.ts`
- `apps/coder/app/features/thread/components/Transcript/*`
- `apps/coder/app/features/thread/components/Files/FileChangeCard.tsx`
- `apps/coder/app/features/thread/pure/thread/FileChangeCardView.tsx`
- `apps/coder/app/features/thread/pure/thread/FileReviewSidebar.tsx`
- `apps/coder/app/features/composer/state/turnThunks.ts`
- `apps/coder/e2e/click/*`

## Architecture Snapshot

This product area is the selected thread/transcript. Sidebar index, row ordering, unread status, and project grouping are covered in `docs/outstanding-work/thread-sidebar.md`.

Selected-thread state is centered on:

- `loadedThreadsSlice`: collection of loaded threads, active thread id, provisional-thread promotion, and request/turn/session correlation maps.
- `CodexThreadReducer`: per-thread request lifecycle, response hydration, live event application, session metadata, transcript state, and token usage.
- `renderBlocks.ts`: projection from normalized transcript state into renderable transcript, work, file, and artifact blocks.

The main traffic path is:

```text
requestCodex / socket traffic
  -> codexTrafficReceived
  -> loadedThreadsSlice
  -> CodexThreadReducer
  -> transcript state
  -> buildCodexRenderBlocks
  -> TranscriptBlockList / AssistantTurn / WorkSection
```

`turnThunks.submitPrompt()` currently creates optimistic request traffic before the real Codex response arrives. The selected-thread doc owns the transcript/provisional-thread side of that flow; sidebar index reconciliation belongs to the thread sidebar research.

<a id="implement-file-change-revert"></a>
## Implement File-Change Revert

Status: Confirmed not wired. A patch builder exists, but the UI has no active undo flow or API endpoint.

Current behavior:

- `FileChangeCardView` accepts `onUndo`, `undoDisabled`, and `undoLabel`.
- `FileChangeCard` never passes `onUndo`.
- `buildFileChangePatch()` can build a patch from file changes, but it is unused.
- Generated app-server `thread/rollback` explicitly says it does not revert local file changes; clients are responsible for reverting files.

Important snippets:

```tsx
// FileChangeCardView.tsx
{onUndo ? (
  <button disabled={undoDisabled} onClick={onUndo} type="button">
    {undoLabel ?? "Undo"}
  </button>
) : null}
```

```ts
// fileChangePatch.ts
export function buildFileChangePatch(changes: readonly CodexFilePatchChange[]): string {
  const patch = changes.map(filePatch).filter(Boolean).join("\n");
  if (!patch.trim()) {
    throw new Error("Cannot revert file changes without patch data.");
  }
  return patch.endsWith("\n") ? patch : `${patch}\n`;
}
```

Recommended implementation:

1. Add an app-owned API endpoint, for example `POST /codex-workspace/revert-file-change`.
2. Request body should include `cwd`, changed files, and a stable turn/file-change id for audit/logging.
3. Build the patch using `buildFileChangePatch()`, then apply the reverse patch in the target workspace.
4. Prefer a structured patch library or `git apply -R --whitespace=nowarn` with carefully validated cwd/path handling.
5. Return a typed result with per-file success/failure details.
6. Wire `FileChangeCard` to call the endpoint and update UI state.
7. Refresh transcript or file-change card state after a successful revert.

Files involved:

- `FileChangeCard.tsx`
- `FileChangeCardView.tsx`
- `fileChangePatch.ts`
- a new app API route/middleware
- possibly a new thread thunk or mutation hook

Tests to add:

- Patch builder handles add/delete/modify diffs.
- Endpoint rejects paths outside cwd.
- UI shows undo state, success, and failure.
- Reverted files actually change on disk.

<a id="restore-the-file-review-side-panel-behavior"></a>
## Restore The File Review Side Panel Behavior

Status: Partially confirmed. A right-side review sidebar exists, but the requested visual/interaction polish is not guaranteed by current code.

Current behavior:

- `FileChangeCard` opens `FileReviewSidebar` using local `reviewOpen` state.
- `FileReviewSidebar` uses common `SlidingSidebar` with `side="right"`.
- The common sidebar is fixed-position with a scrim and panel.
- Width is split between `SlidingSidebar.module.css` and `FileReviewSidebar.module.css`.

Important snippets:

```tsx
// FileReviewSidebar.tsx
<SlidingSidebar
  aria-label="Review file changes"
  className={styles.sidebar}
  onClose={onClose}
  open={open}
  side="right"
>
```

```css
/* FileReviewSidebar.module.css */
.sidebar {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(820px, 56vw);
}
```

Potential mismatch with desired behavior:

- The panel is technically right-side, but the exact "pop out from the right" styling depends on `SlidingSidebar` and the review CSS together.
- There is no transcript-level ownership of the review panel. Each file card owns its own sidebar state.
- There is no route/state persistence for the selected review target.
- The current implementation has basic Escape and scrim close, but no focus trap.

Recommended implementation:

1. Decide whether review belongs to a global transcript overlay state rather than each card.
2. Audit the final CSS in browser at desktop and mobile sizes.
3. Make right-side placement and width explicit in one owner.
4. Add focus management and keyboard close behavior.
5. Add visual separation from the transcript and prevent layout shifts.
6. Add e2e screenshot coverage for opening, scrolling, and closing review.

Files involved:

- `FileChangeCard.tsx`
- `FileReviewSidebar.tsx`
- `FileReviewSidebar.module.css`
- `SlidingSidebar.tsx`
- `SlidingSidebar.module.css`
- `Transcript.module.css`

<a id="refactor-optimistic-thread-and-turn-handling"></a>
## Refactor Optimistic Thread And Turn Handling

Status: Confirmed fragile.

Current behavior:

- Draft submission creates a `local-thread:*` provisional thread.
- The thunk emits an optimistic `turn/start` request before `thread/start` returns.
- After `thread/start`, `promoteProvisionalThread()` moves local transcript state to the real thread id.
- Existing thread submission also dispatches an optimistic `turn/start`, then does `thread/resume`, then real `turn/start`.
- Several maps correlate request ids, turn ids, session paths, target thread ids, and provisional thread ids.

Important snippet:

```ts
// turnThunks.ts
const provisionalThreadId = `local-thread:${++provisionalThreadSequence}`;
dispatch(createProvisionalThread({ threadId: provisionalThreadId, cwd }));
dispatchOptimisticTurnStart(dispatch, provisionalTurnParams, {
  clientRequestId: provisionalRequestId,
  provisionalThreadId
});
const startResponse = await requestCodex(dispatch, "thread/start", ...);
dispatch(promoteProvisionalThread({ provisionalThreadId, threadId }));
void requestCodex(dispatch, "turn/start", ..., {
  metadata: { clientRequestId: provisionalRequestId, provisionalThreadId },
  alreadyDispatched: true,
  targetThreadId: threadId
});
```

Why this is risky:

- State correctness depends on order: provisional thread creation, optimistic request, thread start response, promotion, real turn response, live events.
- Real backend traffic can arrive with shapes that do not match optimistic traffic.
- The current architecture uses metadata and local maps, but responsibility is scattered.

Recommended implementation:

1. Design an explicit optimistic turn state machine.
2. Separate "draft thread", "provisional real thread pending", "real thread hydrated", and "live turn" states.
3. Keep optimistic entities in their own slice or a clearly named submodule.
4. Make promotion idempotent and test it with out-of-order traffic.
5. Publish enough reconciliation metadata for the thread sidebar to represent provisional threads without duplicating transcript logic.
6. Avoid spreading selected-thread correlation logic across `turnThunks`, `loadedThreadsSlice`, `trafficRouting`, and reducer internals.

Files involved:

- `turnThunks.ts`
- `loadedThreadsSlice.ts`
- `trafficRouting.ts`
- `CodexThreadReducer.ts`

Tests to add:

- Draft send appears in the transcript before server response.
- Server response promotes the provisional thread once.
- Duplicate real events do not duplicate user messages.
- Failure during `thread/start` or `turn/start` leaves recoverable UI.

<a id="replace-custom-optimistic-traffic-with-codex-native-events"></a>
## Replace Custom Optimistic Traffic With Codex-Native Events

Status: Confirmed mixed architecture.

Current behavior:

- Optimistic UI is implemented by dispatching parsed Codex request traffic from the client.
- `requestCodex()` can skip dispatching the real request with `alreadyDispatched`.
- Server/backend traffic still emits real request/response/event traffic over Socket.IO.
- Dedupe exists for events by stringifying the whole event, not by semantic client correlation.

Important snippets:

```ts
// codexClient.ts
if (!options.alreadyDispatched) {
  dispatch(codexTrafficReceived(parseCodexProtocolRequestTraffic(method, params, {
    id: clientRequestId,
    metadata,
    timestampMs: Date.now()
  })));
}
```

```ts
// eventStrategies.ts
const eventKey = stableStringify(event);
if (isEventApplied(state, eventKey)) {
  return state;
}
```

Recommended implementation:

1. Define the canonical optimistic packet shape. Prefer the same Codex request/event shapes that reducers already consume.
2. Use metadata such as `clientRequestId`, `targetThreadId`, and `provisionalThreadId` consistently.
3. Add a reducer-level correlation table keyed by client request id, not by full event JSON.
4. Treat server acknowledgements as reconciliation, not as another independent source of truth.
5. Document which events are client-created vs backend-created.
6. Consider moving optimistic event creation behind a small `codexOptimisticTraffic` module.

Files involved:

- `codexClient.ts`
- `turnThunks.ts`
- `trafficRouting.ts`
- `loadedThreadsSlice.ts`
- `eventStrategies.ts`
- `CodexThreadReducer.ts`

<a id="split-the-selected-thread-reducer-and-render-projection-into-understandable-units"></a>
## Split The Selected-Thread Reducer And Render Projection Into Understandable Units

Status: Confirmed. The selected-thread reducer and render projection are large and combine multiple responsibilities.

Current file sizes:

```text
635  CodexThreadReducer.ts
340  eventStrategies.ts
1082 renderBlocks.ts
317  loadedThreadsSlice.ts
230  turnThunks.ts
```

Current responsibility mix:

- `CodexThreadReducer.ts`: request lifecycle, response hydration, event application, session metadata, token usage, model reroutes, render block projection.
- `renderBlocks.ts`: duplicate suppression, timeline grouping, file-change projection, command titles, current activity, work headlines, artifact construction.
- `loadedThreadsSlice.ts`: thread activation, provisional promotion, request/turn/session maps, reducer caching, hydration metadata.

Recommended split:

1. Thread reducer:
   - `requestLifecycle.ts`
   - `responseHydration.ts`
   - `metadataEvents.ts`
   - `threadStatus.ts`
   - `transcriptProjection.ts`
2. Render blocks:
   - `turnBlocks.ts`
   - `workEntries.ts`
   - `activityGrouping.ts`
   - `titles.ts`
   - `fileChangeArtifacts.ts`

Guardrails:

- Split with characterization tests first.
- Keep exported types stable while moving internals.
- Avoid changing behavior and structure in the same patch unless tests pin the behavior.
- Keep sidebar index splitting in `docs/outstanding-work/thread-sidebar.md`.

<a id="optimize-transcript-state-connections"></a>
## Optimize Transcript State Connections

Status: Confirmed performance risk.

Current behavior:

- `CoderWorkspace` selects the active thread and passes `activeThread.renderBlocks` into the shell.
- `CodexThreadReducer.finalizeState()` rebuilds render blocks whenever transcript identity changes.
- `TranscriptBlockList` is memoized, but it receives the full blocks array.
- Streaming deltas update transcript identity, so the full active transcript path is reselected.

Important snippets:

```ts
// CodexThreadReducer.ts
const renderBlocks = previous && state.transcript === previous.transcript
  ? previous.renderBlocks
  : buildCodexRenderBlocks(state.transcript);
```

```tsx
// CoderWorkspace.tsx
const activeRenderBlocks = activeThread?.renderBlocks ?? [];
...
<CoderShell renderBlocks={stableRenderBlocks} />
```

Existing mitigation:

- `renderBlocks.ts` has a WeakMap cache per `CodexTranscriptTurnState`.
- `TranscriptBlock` and `TranscriptBlockList` are memoized.
- This helps, but the top-level array and selector path still change frequently.

Recommended implementation:

1. Split transcript state into stable historical blocks and active tail blocks.
2. Connect historical messages through a selector that remains stable during streaming.
3. Connect the last editable user message and current assistant turn separately.
4. Keep render block projection closer to the component boundary, or cache it per turn with explicit selectors.
5. Add profiling before/after for streaming deltas.
6. Add a flicker regression e2e if the current flicker is user-visible.

Files involved:

- `CoderWorkspace.tsx`
- `threadSelectors.ts`
- `CodexThreadReducer.ts`
- `renderBlocks.ts`
- `TranscriptBlockList.tsx`
- `AssistantTurn.tsx`

<a id="clean-up-work-timeline-titles-and-thinking-indicators"></a>
## Clean Up Work Timeline Titles And Thinking Indicators

Status: Confirmed inconsistent title/icon behavior.

Current behavior:

- Individual commands use `commandTitle()`, for example `Ran ${compact}` or `Listed files`.
- Command groups use the generic label `Ran command` as a grouping fallback and later become `Ran N commands` or `Running N commands`.
- Current activity titles use `Running ${commandTitleText(command)}`.
- Thinking placeholder renders a `WorkIcon kind="other"` and the text `Thinking`.

Important snippets:

```ts
// renderBlocks.ts
function commandTitle(command: string | undefined): string {
  if (!command) return "Ran command";
  if (/^ls(?:\s|$)/.test(compact.trim())) return "Listed files";
  return `Ran ${compact}`;
}

if (entry.type === "reasoning") {
  return { title: "Thinking", icon: "other" };
}
```

```tsx
// AssistantTurn.tsx
<WorkIcon kind="other" />
<TextShimmer>Thinking</TextShimmer>
```

Recommended implementation:

1. Define a title matrix for running vs completed, grouped vs single, command vs file vs tool.
2. Move title generation into a small `workTitles.ts` module with tests.
3. Decide whether grouped command rows should expose the collective title only, individual titles only when expanded, or both.
4. Align thinking placeholder with Codex Desktop. If Desktop has no icon, remove `WorkIcon` from the thinking row.
5. Update `work-timeline.spec.ts` after the title contract is finalized.

Files involved:

- `renderBlocks.ts`
- `ActivityRows.tsx`
- `AssistantTurn.tsx`
- `WorkEntryList.tsx`
- `work-timeline.spec.ts`

<a id="keep-the-useful-click-e2e-tests-and-remove-stragglers"></a>
## Keep The Useful Click E2E Tests And Remove Stragglers

Status: Needs product/test-owner audit. The suite is small and mostly product-facing, but some tests are stateless backend/unit behavior placed in the click suite.

Current e2e suite:

```text
asset-markdown.spec.ts
latest-threads.spec.ts
live-chat-activity.spec.ts
sidebar-status.spec.ts
ssr-initial-hydration.spec.ts
work-timeline.spec.ts
```

Likely keep:

- `latest-threads.spec.ts`: directly protects switching stability and row order.
- `sidebar-status.spec.ts`: directly protects running/unread behavior.
- `ssr-initial-hydration.spec.ts`: protects route hydration.
- `live-chat-activity.spec.ts`: protects send, reload, attachments, duplicate UI.
- `work-timeline.spec.ts`: protects the current timeline and file-change UI.

Audit/move candidate:

- `asset-markdown.spec.ts` uses Playwright's test runner but mostly tests pure asset helper and markdown rewrite functions. It may belong in unit/integration tests rather than click e2e, except for any browser asset fetch behavior the team wants to preserve there.

Recommended implementation:

1. Label each test with the product behavior it protects.
2. Move pure helper tests out of click e2e once a unit test runner exists.
3. Keep screenshot/video attachment requirements for e2e per `AGENTS.md`.
4. Add missing e2e only after reducer/unit coverage is in place, so click tests do not become the only safety net.
