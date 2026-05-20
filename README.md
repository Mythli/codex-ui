# Coder Outstanding Work

This README is currently a working checklist for the Coder app. The items are grouped by product ownership. `Thread Sidebar` owns the left sidebar, thread list, selection, and thread index in `apps/coder/app/features/threads`. `Thread` owns the selected transcript, file/work rendering, and loaded thread state in `apps/coder/app/features/thread`. `Composer` owns message entry and turn-start controls. `Core Client & Protocol` owns the shared app surface in `apps/coder/types`, `apps/coder/protocol`, and `apps/coder/client`; the React `connection` feature is only socket status, diagnostics, and traffic ingestion.

## Thread Sidebar

- [ ] Stabilize thread sidebar ordering and selection.

  Threads in the left sidebar currently move in ways that feel random. Opening or resuming a thread appears to update thread metadata, which then changes project/thread ordering through the thread index. Make ordering predictable, especially while the selected thread is loading or running.

  AI feedback: [Thread sidebar research](docs/outstanding-work/thread-sidebar.md#stabilize-thread-sidebar-ordering-and-selection).

- [ ] Verify running and unread state in the thread sidebar.

  Thread rows render running and unread indicators, and there is some test coverage, but the current coverage may not prove the real lifecycle. Audit the events that flip `activity` and unread state, then add end-to-end coverage for running, completed, unread, selected, and hydrated threads.

  AI feedback: [Thread sidebar research](docs/outstanding-work/thread-sidebar.md#verify-running-and-unread-state-in-the-thread-sidebar).

- [ ] Add focused project mode for the thread sidebar.

  The app is multi-project today. Add a mode that focuses one project, filters the thread list to that project, and lets the new-thread action create a draft in that project without asking the user to choose a project again.

  AI feedback: [Thread sidebar research](docs/outstanding-work/thread-sidebar.md#add-focused-project-mode-for-the-thread-sidebar).

- [ ] Fix new-thread visibility and title propagation in `threadIndexReducer`.

  New threads can appear in the left sidebar as empty, fail to appear, or only receive their title after a refresh. Audit `CodexThreadIndexReducer`, `threadIndexSlice`, and related traffic metadata so `thread/start`, `turn/start`, `thread/started`, and `thread/name/updated` consistently update the index.

  AI feedback: [Thread sidebar research](docs/outstanding-work/thread-sidebar.md#fix-new-thread-visibility-and-title-propagation-in-threadindexreducer).

- [ ] Expand reducer tests around sidebar-facing events.

  Add focused tests for thread creation, resume, read hydration, turn start/completion, name updates, and project grouping. These should cover both server events and optimistic client traffic.

  AI feedback: [Thread sidebar research](docs/outstanding-work/thread-sidebar.md#expand-reducer-tests-around-sidebar-facing-events).

- [ ] Split the thread sidebar index reducer into understandable units.

  `CodexThreadIndexReducer` is large and combines list loading, thread upsert, activity, project grouping, sorting, turn id mapping, and optimistic sidebar state. Break it into smaller, named modules with clear ownership and characterization tests.

  AI feedback: [Thread sidebar research](docs/outstanding-work/thread-sidebar.md#split-the-thread-sidebar-index-reducer-into-understandable-units).

## Composer

- [ ] Implement stop for running turns.

  The composer disables submit while a turn is running, but it does not expose a real stop action yet. Wire the running state to a stop button and send the appropriate Codex interruption request for the active thread/turn.

  AI feedback: [Composer research](docs/outstanding-work/composer.md#implement-stop-for-running-turns).

- [ ] Implement plan mode end to end.

  Plan mode is not usable yet: the composer cannot start it, and plan tags/content can render verbatim instead of becoming first-class UI. Use the existing Codex plan events/items as the protocol source, send the selected mode through turn-start params, then render plan updates as structured transcript state.

  AI feedback: [Composer research](docs/outstanding-work/composer.md#implement-plan-mode-end-to-end).

- [ ] Change submit keyboard behavior.

  Sending currently relies on the command/enter hotkey path. Make plain Enter submit the composer and reserve Shift+Enter for inserting a newline, with tests covering the textarea behavior.

  AI feedback: [Composer research](docs/outstanding-work/composer.md#change-submit-keyboard-behavior).

- [ ] Implement voice message input.

  The microphone button is present but not implemented. Add recording, send the audio to a custom app endpoint, transcribe it through the OpenAI audio API via Azure/LiteLLM if available, and insert or submit the resulting text through the composer flow.

  AI feedback: [Composer research](docs/outstanding-work/composer.md#implement-voice-message-input).

- [ ] Make model, reasoning, and permission selections reliable.

  The selected model, reasoning effort, and permission mode can be lost or rehydrated inconsistently. Decide whether the UI should own these as local user preferences and persist them client-side, then make the composer ignore stale backend defaults when that would surprise the user.

  AI feedback: [Composer research](docs/outstanding-work/composer.md#make-model-reasoning-and-permission-selections-reliable).

- [ ] Rework permission mode options and icons.

  The permission selector currently presents modes with the same shield icon and the available options do not fully match the desired behavior. Add an explicit optional/default mode and a forced full-access mode, then make each option visually distinct and clearly selectable.

  AI feedback: [Composer research](docs/outstanding-work/composer.md#rework-permission-mode-options-and-icons).

## Thread

- [ ] Implement file-change revert.

  Diff cards expose the review surface, but reverting a file change is not implemented. Add a small app API endpoint that accepts the selected file-change patch, applies the reverse patch in the target workspace, and returns a clear success/error result that `FileChangeCard` can surface.

  AI feedback: [Thread research](docs/outstanding-work/thread.md#implement-file-change-revert).

- [ ] Restore the file review side panel behavior.

  The review button exists, but the file review panel styling and placement need another pass. It should feel like a deliberate right-side pop-out panel for reviewing diffs, with clean sizing, overlay behavior, and visual separation from the transcript.

  AI feedback: [Thread research](docs/outstanding-work/thread.md#restore-the-file-review-side-panel-behavior).

- [ ] Refactor optimistic thread and turn handling.

  Sending a message optimistically works in the main transcript, but the surrounding architecture is too fragile. Rework the provisional thread, optimistic turn, promotion, and hydration flow so the UI does not rely on accidental event ordering.

  AI feedback: [Thread research](docs/outstanding-work/thread.md#refactor-optimistic-thread-and-turn-handling).

- [ ] Replace custom optimistic traffic with Codex-native events.

  The optimistic path should work by emitting the same Codex request/event shapes the rest of the app already reduces. Use Codex request metadata to correlate client-created optimistic traffic with server traffic and prevent duplicates, instead of mixing custom events with partial request handling.

  AI feedback: [Thread research](docs/outstanding-work/thread.md#replace-custom-optimistic-traffic-with-codex-native-events).

- [ ] Split the selected-thread reducer and render projection into understandable units.

  `CodexThreadReducer`, `loadedThreadsSlice`, and `renderBlocks.ts` are large AI-generated paths that pass tests but are difficult to reason about. Break them into smaller, named modules with clear ownership for hydration, live events, optimistic selected-thread state, metadata, and render-block projection.

  AI feedback: [Thread research](docs/outstanding-work/thread.md#split-the-selected-thread-reducer-and-render-projection-into-understandable-units).

- [ ] Optimize transcript state connections.

  The transcript should not reconnect the whole message list for every active-token update. Keep static historical messages in a stable selector, and connect the active tail separately: the latest editable user message and latest assistant turn should update through their own slice/selector path to reduce flicker and improve transcript performance.

  AI feedback: [Thread research](docs/outstanding-work/thread.md#optimize-transcript-state-connections).

- [ ] Clean up work timeline titles and thinking indicators.

  Command/work rows currently mix grouped labels and individual command titles, which makes it unclear whether the collective title or single-entry title should be displayed. Audit `ActivitySummaryRow`, `CommandTimelineRow`, and current activity rendering so command titles are consistent, and align the "thinking in Codex" row with Codex Desktop, including removing the extra icon if the source UI has none.

  AI feedback: [Thread research](docs/outstanding-work/thread.md#clean-up-work-timeline-titles-and-thinking-indicators).

- [ ] Keep the useful click e2e tests and remove stragglers.

  The click e2e suite has useful coverage for live activity, sidebar state, latest-thread switching, SSR hydration, and work timelines. Audit tests that were added only to satisfy a narrow AI-generated change and remove any that do not protect real product behavior.

  AI feedback: [Thread research](docs/outstanding-work/thread.md#keep-the-useful-click-e2e-tests-and-remove-stragglers).

## Core Client & Protocol

- [ ] Support Codex system prompt customization.

  Codex has a real system prompt available and it should be used as the baseline. Add a clean way to inspect and modify the prompt/instructions sent to Codex without losing the quality of the default prompt or hiding the effective prompt from the app. Also evaluate prompt-quality improvements against references such as [asgeirtj/system_prompts_leaks OpenAI Codex GPT-5.5](https://github.com/asgeirtj/system_prompts_leaks/blob/main/OpenAI/codex/gpt-5.5.md), without blindly copying leaked prompt text into the product.

  AI feedback: [Core research](docs/outstanding-work/core.md#support-codex-system-prompt-customization).

  ```http
  # TODO: replace with the real Codex system prompt request.
  GET {{CODEX_SYSTEM_PROMPT_URL}} HTTP/1.1
  Accept: text/plain
  ```

- [ ] Add an app-owned audio transcription endpoint.

  Voice input should not be bolted directly into the composer. Add a small endpoint in the app API layer that accepts audio, forwards it to the configured audio transcription provider, and returns plain transcription results that the composer can consume.

  AI feedback: [Core research](docs/outstanding-work/core.md#add-an-app-owned-audio-transcription-endpoint).

- [ ] Confirm interruption support in the protocol client.

  The generated protocol includes `turn/interrupt`. Verify the browser transport and request routing can send it for the active thread, then expose a narrow helper for composer stop.

  AI feedback: [Core research](docs/outstanding-work/core.md#confirm-interruption-support-in-the-protocol-client).

## API

- [ ] Centralize instance creation in `createCoderApiDependencies`.

  The API uses factory functions and dependency injection, but the pattern is not applied consistently. Instances such as transports, middleware helpers, registries, and server adapters should be created or provided from `createCoderApiDependencies` instead of being constructed opportunistically inside lower-level factories.

  AI feedback: [API research](docs/outstanding-work/api.md#centralize-instance-creation-in-createcoderapidependencies).

- [ ] Clarify `AppCodexSessionRegistry` ownership.

  `AppCodexSessionRegistry` currently sits at the center of app-session lifecycle, backend binding, traffic forwarding, diagnostics, and teardown. Audit whether those responsibilities belong in one registry, the socket namespace, the backend provider, or the top-level dependency composition root, then rename or split the class if its ownership is unclear.

  AI feedback: [API research](docs/outstanding-work/api.md#clarify-appcodexsessionregistry-ownership).

- [ ] Make middleware ownership explicit.

  Codex protocol middleware is currently a backend-only concept. Document that boundary and keep middleware stack construction server-side unless there is a deliberate shared frontend/backend middleware design.

  AI feedback: [API research](docs/outstanding-work/api.md#make-middleware-ownership-explicit).

- [ ] Filter backend traffic before it reaches Redux.

  The frontend currently receives too much Codex diagnostic noise, and Redux Toolkit can be overwhelmed by events that are not useful for UI state. Add a backend allowlist/denylist for traffic sent over Socket.IO so only UI-relevant requests, responses, events, and bounded diagnostics reach the browser.

  AI feedback: [API research](docs/outstanding-work/api.md#filter-backend-traffic-before-it-reaches-redux).

## Common

- [ ] Add image preview slideshow.

  Clicking any rendered image should open a polished preview that can navigate through all images in the current transcript or rendered context, similar to Codex Desktop. Include keyboard navigation, responsive sizing, captions/paths where useful, and a clean close/focus flow.

  AI feedback: [Common research](docs/outstanding-work/common.md#add-image-preview-slideshow).

- [ ] Render videos from Markdown image syntax.

  `Markdown` currently only customizes link rendering. When Markdown uses image syntax for a video target, render it as a safe controlled video preview rather than a broken image, matching how Codex prompts reference video media. Include controls, responsive sizing, and asset-route compatibility for local/generated files.

  AI feedback: [Common research](docs/outstanding-work/common.md#render-videos-from-markdown-image-syntax).

## Workspace

- [ ] Persist workspace UI state.

  View mode, transcript/preview layout choice, panel sizes, preview viewport, and related shell preferences currently live only in component state. Add a small UI storage adapter, likely backed by local storage, so these preferences survive reloads without scattering storage calls through workspace components.

  AI feedback: [Workspace research](docs/outstanding-work/workspace.md#persist-workspace-ui-state).

- [ ] Review preview URL configuration.

  `CoderWorkspace` currently provides the preview pane URL, with a hard-coded localhost default. Confirm the intended source of truth, preferably environment/config-driven, and make the URL shown in `PreviewControls` match the actual app being previewed.

  AI feedback: [Workspace research](docs/outstanding-work/workspace.md#review-preview-url-configuration).

- [ ] Auto-refresh the preview pane after completed work.

  The right preview pane has manual reload support through `previewReloadKey`, but it does not update when Codex finishes a turn. Add a Redux-side effect, thunk, or selector-derived reload token that changes on completed UI-relevant work, such as a completed turn/message hash or completion timestamp, while avoiding iframe reloads on every streaming delta.

  AI feedback: [Workspace research](docs/outstanding-work/workspace.md#auto-refresh-the-preview-pane-after-completed-work).

- [ ] Thread focused project mode through the shell.

  Focused project behavior needs shell-level state, not only a visual filter. `CoderShell`, `CoderSidebar`, and `SidebarHeader` should agree on the active project so the thread sidebar, new-thread flow, draft selection, and route updates behave as one feature.

  AI feedback: [Workspace research](docs/outstanding-work/workspace.md#thread-focused-project-mode-through-the-shell).

- [ ] Make the app usable on mobile.

  The current shell and thread flow are effectively desktop-only. Add responsive layout behavior for the sidebar, thread list, transcript, composer, and preview controls so the core thread workflow works cleanly on small screens.

  AI feedback: [Workspace research](docs/outstanding-work/workspace.md#make-the-app-usable-on-mobile).
