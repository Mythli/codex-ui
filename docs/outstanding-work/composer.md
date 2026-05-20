# Composer Outstanding Work Research

This note covers the README composer items. It is based on local code inspection on 2026-05-21.

Primary files:

- `apps/coder/app/features/composer/components/Composer/Composer.tsx`
- `apps/coder/app/features/composer/components/ChatBox/CodexChatBox.tsx`
- `apps/coder/app/features/composer/components/ChatBox/ComposerMenus.tsx`
- `apps/coder/app/features/composer/state/composerState.ts`
- `apps/coder/app/features/composer/state/composerSlice.ts`
- `apps/coder/app/features/composer/state/turnThunks.ts`
- `apps/coder/app/features/composer/io/attachmentIO.ts`
- `apps/coder/app/features/thread/state/threadReducer/internal/eventStrategies.ts`
- `apps/coder/app/features/thread/state/threadReducer/internal/renderBlocks.ts`
- `apps/coder/client/codexClient.ts`
- `apps/coder/types/generated/app-server/v2/TurnStartParams.ts`
- `apps/coder/types/generated/app-server/v2/TurnInterruptParams.ts`

## Architecture Snapshot

The composer renders through `CoderWorkspace -> CoderShell -> CoderSidebar -> Composer -> CodexChatBox`.

`CodexChatBox` owns purely local interaction state such as drag depth and attachment error. Persistent composer data is stored in Redux through `composerSlice` and `composerState`.

Prompt submission is handled by the thunk `submitPrompt()` in `turnThunks.ts`. It clears the prompt, applies model/reasoning/permission values from composer state, emits optimistic traffic, and then calls Codex through `requestCodex`.

<a id="implement-stop-for-running-turns"></a>
## Implement Stop For Running Turns

Status: Confirmed not implemented.

Current behavior:

- `CodexChatBox` disables send while `isRunning` is true.
- No stop button is rendered.
- `submitPrompt()` returns early when the selected thread is already running.
- The protocol client can send arbitrary generated methods, and generated protocol types include `turn/interrupt`.

Important snippets:

```tsx
// CodexChatBox.tsx
const canSubmit = (Boolean(prompt.trim()) || attachments.length > 0) && !isRunning;

<IconButton
  disabled={!canSubmit}
  data-testid="send-prompt-button"
  label="Send message"
/>
```

```ts
// turnThunks.ts
if (selection.kind === "thread" && state.threads.byId[selection.threadId]?.status === "running") {
  return undefined;
}
```

```ts
// generated app-server protocol
export type TurnInterruptParams = { threadId: string, turnId: string };
```

Recommended implementation:

1. Add a `stopRunningTurn()` thunk near `submitPrompt()`.
2. Read `selection.current`, `threads.byId[threadId]`, and `activeTurnId`.
3. If no active turn id exists, disable the stop action and surface a non-fatal reason in UI if needed.
4. Call `requestCodex(dispatch, "turn/interrupt", { threadId, turnId }, { targetThreadId: threadId, prefix: "turn-interrupt" })`.
5. Render a stop button in `CodexChatBox` when `isRunning` is true. This should replace or sit in the send-button slot, not leave a disabled send button as the only affordance.
6. Add reducer handling if Codex emits an interrupted status that is not currently mapped to ready/failed.

Files involved:

- `CodexChatBox.tsx`: button surface.
- `Composer.tsx`, `CoderSidebar.tsx`, `CoderShell.tsx`, `CoderWorkspace.tsx`: callback plumbing.
- `turnThunks.ts`: stop thunk.
- `CodexThreadReducer.ts`: status outcome after interrupt if protocol events require it.
- `CodexThreadIndexReducer.ts`: row activity should clear after interruption.

Tests to add:

- Button switches from send to stop while a turn is running.
- Stop sends `turn/interrupt` with the active `threadId` and `turnId`.
- A stopped turn clears running state in the composer and thread sidebar.

<a id="implement-plan-mode-end-to-end"></a>
## Implement Plan Mode End To End

Status: Partially implemented at protocol parsing level, not implemented as a composer/product feature.

Current behavior:

- The generated protocol includes plan items and events such as `item/plan/delta` and `turn/plan/updated`.
- `eventStrategies.ts` accepts `item/plan/delta`.
- Plan text becomes a `CodexPlanItem`.
- `renderBlocks.ts` treats `plan` exactly like `reasoning`, pushing plain text into the work timeline.
- There is no composer control to start plan mode.
- `turn/start` supports `collaborationMode`, but `turnThunks.ts` does not send it.

Important snippets:

```ts
// eventStrategies.ts
"item/plan/delta": forMethod("item/plan/delta", (state, event, source) =>
  updateTextItem(state, event.params, source, "plan")
)
```

```ts
// renderBlocks.ts
if (item.type === "reasoning" || item.type === "plan") {
  if (item.text) {
    pendingWorkEntries.push({ type: "reasoning", id: item.id, text: item.text });
  }
  continue;
}
```

```ts
// generated TurnStartParams.ts
collaborationMode?: CollaborationMode | null
```

What this means:

- If Codex emits structured plan events, they are not first-class UI.
- If Codex emits plan-like tags as ordinary assistant text, the Markdown path will render them verbatim because no parser upgrades them.
- The composer cannot intentionally start a plan-mode turn.

Recommended implementation:

1. Add a composer mode control for plan mode.
2. Decide whether plan mode is a `collaborationMode` preset, a turn instruction, or both.
3. Extend `turnStartParams()` to send the selected plan mode through the generated protocol shape.
4. Add `CodexPlanEntry` or a dedicated render segment instead of coercing plan to `reasoning`.
5. Handle `turn/plan/updated`, not only `item/plan/delta`, if Codex uses step arrays.
6. Render plan steps with status, update events, and completion state.
7. Add tests for live `item/plan/delta`, hydrated plan items, and start-plan-mode request params.

Files involved:

- `turnThunks.ts`
- `composerState.ts`
- `ComposerMenus.tsx` or a new mode control
- `eventStrategies.ts`
- `renderBlocks.ts`
- `model.ts`
- transcript UI components

<a id="change-submit-keyboard-behavior"></a>
## Change Submit Keyboard Behavior

Status: Confirmed current behavior is not the desired behavior.

Current behavior:

- Submission uses `react-hotkeys-hook` for `mod+enter`.
- The textarea does not handle plain Enter.
- Shift+Enter naturally creates a newline because there is no Enter override.

Important snippet:

```ts
// CodexChatBox.tsx
useHotkeys("mod+enter", (event) => {
  event.preventDefault();
  handleSubmit();
}, {
  enableOnFormTags: ["TEXTAREA"],
  enabled: canSubmit
}, [canSubmit, handleSubmit]);
```

Recommended implementation:

1. Add `onKeyDown` to the textarea.
2. On `Enter` without `Shift`, `Meta`, `Ctrl`, or `Alt`, prevent default and call `handleSubmit()`.
3. Leave Shift+Enter as the newline path.
4. Consider preserving `mod+enter` as an alternate shortcut if users already rely on it.
5. Add tests for empty prompt, prompt with attachments, running state, Enter submit, and Shift+Enter newline.

Files involved:

- `CodexChatBox.tsx`
- `apps/coder/e2e/click/support/ClickAppPage.ts`
- A future component/unit test location if introduced.

<a id="implement-voice-message-input"></a>
## Implement Voice Message Input

Status: Confirmed not implemented.

Current behavior:

- `CodexChatBox` accepts an optional `onMicClick`.
- `Composer` does not pass `onMicClick`.
- No app code references `MediaRecorder`, `navigator.mediaDevices`, `getUserMedia`, `transcribe`, or a transcription endpoint.
- Attachments upload to `/codex-assets/upload`, which is not a transcription flow.

Important snippet:

```tsx
// CodexChatBox.tsx
<IconButton className={styles.iconButton} label="Dictate" onClick={onMicClick}>
  <FiMic aria-hidden="true" />
</IconButton>
```

Recommended implementation:

1. Add a dedicated voice input controller/component rather than placing all recorder state in `CodexChatBox`.
2. Use `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder` where available.
3. Show recording, stopping, transcribing, success, and error states in the composer.
4. Send the recorded blob to an app-owned transcription endpoint. Do not call provider APIs directly from the browser.
5. On transcription success, either insert text into the composer or submit it directly. The safer first version is "insert and let user send".
6. Include browser support and permission-denied handling.

Backend/API dependency:

- See `docs/outstanding-work/core.md#add-an-app-owned-audio-transcription-endpoint`.

Files involved:

- `CodexChatBox.tsx`
- `Composer.tsx`
- `CoderSidebar.tsx`
- `CoderWorkspace.tsx`
- A new composer hook/component, for example `features/composer/hooks/useVoiceRecorder.ts`
- A new app API endpoint or Vite middleware route.

Tests to add:

- Mic button enters recording state.
- Stopping sends audio to the app endpoint.
- Successful transcription updates the prompt.
- Endpoint failures and denied microphone permission are surfaced without losing typed text.

<a id="make-model-reasoning-and-permission-selections-reliable"></a>
## Make Model, Reasoning, And Permission Selections Reliable

Status: Confirmed unreliable by architecture. User selections are Redux-only and can be overwritten by hydration/session data.

Current behavior:

- Initial composer state defaults to `gpt-5.5`, medium reasoning, and default permissions.
- Model and reasoning use `userSelection` in Redux.
- Permission mode is only `selectedPermissionMode`; it is not represented in `userSelection`, config defaults, or active thread state.
- No local storage or persistence adapter is used.
- `composerThreadHydrated(activeThread)` runs whenever `activeThread` changes and hydrates model/reasoning from thread session metadata.

Important snippets:

```ts
// composerState.ts
const model = firstString(
  state.userSelection.model,
  state.activeThread.model,
  state.configDefaults.model,
  models.find((candidate) => candidate.isDefault)?.id,
  models[0]?.id,
  fallbackComposerModel.id
);
```

```ts
// composerState.ts
case "selectPermissionMode":
  return { ...state, selectedPermissionMode: action.permissionMode };
```

Why reloads are unreliable:

- `userSelection` exists only in Redux memory.
- SSR/client hydration loads models and config from Codex.
- Thread changes hydrate active session model/reasoning.
- Permission mode has no persisted source at all.

Recommended implementation:

1. Decide ownership: local user preference should probably win over backend defaults after the user chooses it.
2. Add a small storage adapter, not direct `localStorage` calls in components.
3. Persist `selectedModel`, `selectedReasoningEffort`, and `selectedPermissionMode` as UI preferences.
4. Hydrate preferences before or during store initial state creation.
5. Reconcile invalid persisted model/effort values against the current model list.
6. Track whether the user explicitly selected values. Avoid treating backend hydration as an explicit user choice.

Files involved:

- `composerState.ts`
- `composerSlice.ts`
- `CoderWorkspace.tsx`
- `store/provider.tsx`
- A new storage adapter shared with workspace UI persistence.

Tests to add:

- User-selected model survives reload.
- User-selected reasoning survives reload and is clamped if unsupported by a new model.
- Permission mode survives reload.
- Thread hydration does not overwrite explicit local preference.

<a id="rework-permission-mode-options-and-icons"></a>
## Rework Permission Mode Options And Icons

Status: Confirmed current UI is too shallow.

Current behavior:

- Permission modes are exactly `"default"`, `"auto-review"`, and `"full-access"`.
- All menu options use `FiShield`.
- Default mode sends no override.
- `auto-review` maps to workspace-write with on-request approval.
- `full-access` maps to danger-full-access with never approval.

Important snippets:

```ts
// composerState.ts
export const coderPermissionModes = [
  "default",
  "auto-review",
  "full-access"
];

export function permissionModeToRequestOverrides(mode) {
  if (mode === "auto-review") {
    return { sandbox: "workspace-write", approvalPolicy: "on-request" };
  }
  if (mode === "full-access") {
    return { sandbox: "danger-full-access", approvalPolicy: "never" };
  }
  return {};
}
```

```tsx
// ComposerMenus.tsx
const options: CoderPermissionMode[] = ["default", "auto-review", "full-access"];
leadingIcon={<FiShield aria-hidden="true" />}
```

Recommended implementation:

1. Rename modes around user intent, not internal transport values. For example: `default`, `ask`, `auto-review`, `full-access`, depending on the final product decision.
2. Make "optional/default" explicit: it should mean "do not force a permission override; use thread/backend defaults".
3. Make "force full access" explicit: it should intentionally send `dangerFullAccess`/`never` style overrides.
4. Use distinct icons for modes. Examples: default/inherit, lock/read-only, edit/workspace, shield/review, unlocked/full-access.
5. Model the selected permission as a typed option object rather than spreading labels and overrides across files.
6. Confirm whether new app-server `permissions` profile fields should replace older `sandbox`/`approvalPolicy` fields for new work.

Files involved:

- `apps/coder/types/composer.ts`
- `composerState.ts`
- `ComposerMenus.tsx`
- `turnThunks.ts`
- Tests using `permission-option-*` ids.

Risk:

- Existing e2e selects `permission-option-full-access` in `work-timeline.spec.ts`. Keep stable test ids or update tests with the new mode names.
