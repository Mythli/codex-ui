# Workspace Outstanding Work Research

This note covers the README workspace items. It is based on local code inspection on 2026-05-21.

Primary files:

- `apps/coder/app/CoderWorkspace.tsx`
- `apps/coder/app/features/workspace/components/Shell/CoderShell.tsx`
- `apps/coder/app/features/workspace/components/Shell/CoderShell.module.css`
- `apps/coder/app/features/workspace/components/Sidebar/CoderSidebar.tsx`
- `apps/coder/app/features/workspace/components/Sidebar/SidebarHeader.tsx`
- `apps/coder/app/features/workspace/components/PreviewFrame/PreviewPanel.tsx`
- `apps/coder/app/features/workspace/components/PreviewFrame/PreviewFrame.tsx`
- `apps/coder/app/features/workspace/components/TopBar/PreviewControls.tsx`
- `apps/coder/app/features/threads/components/ChatSwitcher/ChatSwitcher.tsx`
- `apps/coder/app/features/thread/state/threadSelectors.ts`

## Architecture Snapshot

`CoderWorkspace` is the main container that selects Redux state and passes it into `CoderShell`. `CoderShell` owns shell-only UI state such as:

- thread sidebar drawer open/closed,
- thread sidebar query,
- workspace view mode,
- preview viewport,
- preview reload key,
- hydrated marker.

None of those shell states are persisted today.

<a id="persist-workspace-ui-state"></a>
## Persist Workspace UI State

Status: Confirmed not implemented.

Current behavior:

- `CoderShell` stores layout state in local React state.
- `react-resizable-panels` uses `defaultLayout`, not a persisted layout.
- `ChatSwitcher` stores collapsed/hidden/renamed project state locally.
- No `localStorage`, `sessionStorage`, or UI storage adapter usage was found in the app code.

Important snippets:

```tsx
// CoderShell.tsx
const [isSwitcherOpen, setIsSwitcherOpen] = useState(initialSwitcherOpen);
const [switcherQuery, setSwitcherQuery] = useState("");
const [viewMode, setViewMode] = useState<CoderShellViewMode>(initialViewMode);
const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");
const [previewReloadKey, setPreviewReloadKey] = useState(0);
```

```tsx
// CoderShell.tsx
<Group
  defaultLayout={{ chat: 1, preview: 1 }}
  id="coder-shell-layout"
  orientation="horizontal"
>
```

Recommended implementation:

1. Add a small UI storage adapter, for example `common/storage/uiStorage.ts`.
2. Keep adapter usage in hooks, not scattered component code.
3. Persist:
   - `viewMode`,
   - panel sizes,
   - preview viewport,
   - focused project id,
   - optional switcher group collapse state if desired.
4. Version the storage key so incompatible layout changes can reset cleanly.
5. Guard storage access for SSR.
6. Add tests for invalid JSON, missing storage, and migration/reset behavior.

Files involved:

- `CoderShell.tsx`
- `ChatSwitcher.tsx`
- `SidebarHeader.tsx`
- new storage adapter/hook

<a id="review-preview-url-configuration"></a>
## Review Preview URL Configuration

Status: Confirmed hard-coded default.

Current behavior:

- `CoderWorkspace` defaults `previewUrl` to `http://localhost:4321`.
- Routes do not pass a preview URL.
- `PreviewControls` displays the `previewUrl` prop or `No preview URL`.
- No env/config source of truth for preview URL was found.

Important snippets:

```tsx
// CoderWorkspace.tsx
export function CoderWorkspace({
  previewUrl = 'http://localhost:4321',
}: CoderWorkspaceProps = {}) {
  ...
  <CoderShell previewUrl={previewUrl ?? undefined} />
}
```

```tsx
// PreviewControls.tsx
const label = previewUrl ?? 'No preview URL';
<UrlBar value={label} />
```

Recommended implementation:

1. Decide the preview URL source of truth:
   - environment variable,
   - Codex config,
   - project metadata,
   - user editable UI setting,
   - dev-server discovery.
2. Avoid hard-coding one local port in the component.
3. Make the URL shown in `PreviewControls` exactly match the iframe `src`.
4. Add validation and a helpful unavailable state when no URL exists.
5. Persist per-project preview URL if the app is truly multi-project.

Files involved:

- `CoderWorkspace.tsx`
- `routes/index.tsx`
- `routes/chats.$chatId.tsx`
- `PreviewControls.tsx`
- `PreviewFrame.tsx`
- API/env config if server-sourced

<a id="auto-refresh-the-preview-pane-after-completed-work"></a>
## Auto-Refresh The Preview Pane After Completed Work

Status: Confirmed not implemented.

Current behavior:

- `CoderShell` owns `previewReloadKey`.
- The reload key changes only when the user clicks manual reload.
- `PreviewFrame` uses the key in the iframe key to force reload.
- No effect listens to Codex turn completion or file-change completion.

Important snippets:

```tsx
// CoderShell.tsx
const [previewReloadKey, setPreviewReloadKey] = useState(0);

<PreviewPanel
  onReload={() => setPreviewReloadKey((key) => key + 1)}
  previewReloadKey={previewReloadKey}
/>
```

```tsx
// PreviewFrame.tsx
<iframe
  key={`${previewUrl}-${reloadKey}`}
  src={previewUrl}
/>
```

Recommended implementation:

1. Add a selector for the active thread's last completed turn or last completed file-changing turn.
2. Prefer a coarse reload token such as `{ threadId, completedAtMs, changedFilesHash }`.
3. Trigger reload only when work completes, not on every streaming delta.
4. Consider reloading only when files changed, not for message-only answers.
5. Avoid reloading while the user is interacting with the preview if that becomes a problem.
6. Add tests for no reload during stream, reload on completion, and no reload on manual message-only completion if that is the chosen policy.

Files involved:

- `CoderWorkspace.tsx`
- `CoderShell.tsx`
- `threadSelectors.ts`
- `CodexThreadReducer.ts`
- `renderBlocks.ts` or transcript metadata helpers

<a id="thread-focused-project-mode-through-the-shell"></a>
## Thread Focused Project Mode Through The Shell

Status: Confirmed not implemented as shell-level state.

Current behavior:

- `CoderShell` derives `projectOptions` from all projects in `threadIndex`.
- `CoderSidebar` receives the current project and all projects.
- `SidebarHeader` always wraps the new-thread action in `ProjectPicker`.
- `ChatSwitcher` has local hidden-project state, but that is not focused project mode.

Important snippet:

```ts
// CoderShell.tsx
function projectList(threadIndex, currentProject) {
  const projects = threadIndex.projectOrder
    .map((cwd) => threadIndex.projectsByCwd[cwd])
    .filter(Boolean);
  if (!projects.some((project) => project.cwd === currentProject.cwd)) {
    projects.push(currentProject);
  }
  return projects;
}
```

Recommended implementation:

1. Add `focusedProjectId` to shell state.
2. Pass it into `CoderSidebar`, `SidebarHeader`, and `ChatSwitcher`.
3. Make thread creation, route selection, thread list filtering, and auto-selection consume the same focused project value.
4. Persist focused project id through the UI storage adapter.
5. Ensure focus mode handles project deletion/hiding and unknown route thread ids gracefully.

Related thread sidebar note:

- See `docs/outstanding-work/thread-sidebar.md#add-focused-project-mode-for-the-thread-sidebar`.

Files involved:

- `CoderShell.tsx`
- `CoderSidebar.tsx`
- `SidebarHeader.tsx`
- `ChatSwitcher.tsx`
- `useChatSelectionController.ts`
- UI storage adapter

<a id="make-the-app-usable-on-mobile"></a>
## Make The App Usable On Mobile

Status: Confirmed mostly desktop-only.

Current behavior:

- `CoderShell` uses horizontal resizable panels for `viewMode === "both"`.
- CSS has only small mobile adjustments for switcher scrim and preview button width.
- The thread sidebar uses a drawer width constrained by `100vw`, but the rest of the shell is still desktop-first.
- Preview pane, composer, transcript, and panel layout do not have a complete mobile workflow.

Important snippets:

```tsx
// CoderShell.tsx
<Group
  orientation="horizontal"
  resizeTargetMinimumSize={{ coarse: 44, fine: 12 }}
>
```

```css
/* CoderShell.module.css */
@media (max-width: 900px) {
  .switcherScrim {
    background: var(--coder-scrim-strong);
  }
}
```

Recommended implementation:

1. Define the mobile product flow:
   - transcript-only default,
   - preview as separate mode,
   - switcher as full-screen drawer,
   - composer always reachable.
2. Switch from horizontal panels to single-pane mode below a breakpoint.
3. Make view-mode controls reachable without relying on desktop drawer layout.
4. Test composer textarea, attachment tray, and model/permission popovers on narrow widths.
5. Ensure transcript scrolling and preview iframe sizing do not trap the page.
6. Add Playwright mobile viewport screenshots after implementation.

Files involved:

- `CoderShell.tsx`
- `CoderShell.module.css`
- `CoderSidebar.module.css`
- `ChatSwitcher.module.css`
- `CodexChatBox.module.css`
- `PreviewFrame.module.css`
- `PreviewControls.module.css`
