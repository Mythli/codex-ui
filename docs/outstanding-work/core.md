# Core Client And Protocol Outstanding Work Research

This note covers the README Core Client & Protocol items. It is based on local code inspection on 2026-05-21.

Primary files:

- `apps/coder/types/index.ts`
- `apps/coder/types/appServer.ts`
- `apps/coder/types/transport.ts`
- `apps/coder/client/codexClient.ts`
- `apps/coder/client/CodexSocketIoTransport.ts`
- `apps/coder/client/codexTransport.ts`
- `apps/coder/protocol/index.ts`
- `apps/coder/protocol/responses.ts`
- `apps/coder/types/generated/app-server/v2/ThreadStartParams.ts`
- `apps/coder/types/generated/app-server/v2/TurnStartParams.ts`
- `apps/coder/types/generated/app-server/v2/TurnInterruptParams.ts`
- `apps/coder/backend/socketNamespace.ts`
- `apps/coder/appSocket.ts`
- `apps/coder/dependencies.ts`
- `apps/coder/app/features/connection/state/codexConnectionSlice.ts`
- `apps/coder/app/features/connection/state/codexTrafficActions.ts`

## Architecture Snapshot

The migration split the old connection bucket into clearer core surfaces:

- `apps/coder/types` / `@coder/types`: public app types, generated app-server aliases, transport types, and feature state types.
- `apps/coder/protocol` / `@coder/protocol`: parsing, packet normalization, traffic envelopes, request/response/event helpers, and thread-item projection around generated Codex shapes.
- `apps/coder/client` / `@coder/client`: browser request helper and Socket.IO transport for sending generated protocol methods.
- `apps/coder/app/features/connection`: React/Redux socket status, bounded diagnostics, and shared `codexTrafficReceived` ingestion. It should not own generated types or protocol parsing.

The browser talks to Codex through a generic client/transport interface:

```text
requestCodex()
  -> getCodexTransport().request(method, params, metadata)
  -> CodexSocketIoTransport
  -> Socket.IO /codex namespace
  -> AppCodexSocketServer
  -> LiveCodexBackendProvider
  -> managed or socket app-server transport
```

The transport layer is generic enough to send generated methods, but app-level features still need typed helpers and UI-owned flows.

<a id="support-codex-system-prompt-customization"></a>
## Support Codex System Prompt Customization

Status: Not implemented in the app. The generated protocol has instruction fields that could be used.

Current behavior:

- `thread/start` supports `baseInstructions` and `developerInstructions`.
- `turn/start` supports `collaborationMode`, whose docs mention developer instructions for a selected mode.
- `turnThunks.ts` never sends `baseInstructions`, `developerInstructions`, or `collaborationMode`.
- `modelsConfigThunks.ts` loads `config/read`, but only returns model and reasoning effort.
- There is no UI or API path for fetching, showing, modifying, or sending an effective Codex system prompt.
- There is a candidate external reference for prompt quality comparison: [asgeirtj/system_prompts_leaks OpenAI Codex GPT-5.5](https://github.com/asgeirtj/system_prompts_leaks/blob/main/OpenAI/codex/gpt-5.5.md). Treat it as a comparison point, not source text to copy verbatim.

Important snippets:

```ts
// generated ThreadStartParams.ts
baseInstructions?: string | null,
developerInstructions?: string | null,
personality?: Personality | null
```

```ts
// generated TurnStartParams.ts
collaborationMode?: CollaborationMode | null
```

```ts
// modelsConfigThunks.ts
return {
  model: response.config.model,
  model_reasoning_effort: response.config.model_reasoning_effort
};
```

Implementation questions:

- Where does the "real Codex system prompt" come from in the running app-server?
- Should the app show the base prompt, developer instructions, or the combined effective prompt?
- Should prompt customization be global, per project, per thread, or per turn?
- Should local UI edits be stored in app config, Codex config, local storage, or thread metadata?
- What prompt-quality improvements are useful from the GPT-5.5 reference, and which belong in app-owned developer instructions rather than the baseline prompt?

Recommended implementation:

1. Add a protocol/client helper that can fetch the effective prompt from the real source once that endpoint/request is known.
2. Keep the default Codex prompt visible and recoverable.
3. Store user modifications separately from the baseline prompt so future baseline updates are not overwritten.
4. Send custom instructions through `thread/start` and possibly `turn/start` using generated fields.
5. Add a preview of the effective prompt before starting a thread.
6. Log or expose which prompt source was used for a thread.
7. Derive any improved prompt text from the owned baseline and product needs; do not paste leaked/private prompt text directly into the app.

Placeholder request:

```http
# TODO: replace with the real Codex system prompt request.
GET {{CODEX_SYSTEM_PROMPT_URL}} HTTP/1.1
Accept: text/plain
```

Files involved:

- `turnThunks.ts`
- `modelsConfigThunks.ts`
- `codexClient.ts`
- new core client/API helper
- new UI surface for prompt settings

<a id="add-an-app-owned-audio-transcription-endpoint"></a>
## Add An App-Owned Audio Transcription Endpoint

Status: Confirmed not implemented.

Current behavior:

- There is an asset upload route in `appSocket.ts`.
- There is no `/transcribe`, `/audio`, or provider-specific transcription route.
- The composer mic button is not wired to a recorder or endpoint.

Existing endpoint pattern:

```ts
// appSocket.ts
server.middlewares.use(`${assetHelper.routeBase}/upload`, (request, response) => {
  const mimeType = request.headers["content-type"]?.split(";")[0] || "application/octet-stream";
  const staged = assetHelper.stageBytesAsFile(Buffer.concat(chunks), { mimeType, originalName });
  response.end(JSON.stringify({ input, path: staged.path, asset: staged.asset }));
});
```

Recommended implementation:

1. Add a small server-side route, for example `POST /codex-audio/transcribe`.
2. Accept `multipart/form-data` or raw audio bytes with a content type.
3. Enforce size and duration limits.
4. Resolve provider configuration server-side. The browser should not receive provider credentials.
5. Support Azure/OpenAI/LiteLLM through an adapter interface rather than hard-coding one provider into the composer.
6. Return a typed response: `{ text, language?, durationMs?, providerMetadata? }`.
7. Keep the endpoint independent from turn submission so the composer can insert text without sending it.

Files involved:

- `appSocket.ts`
- `env.ts`
- `dependencies.ts`
- a new provider adapter module
- composer voice UI from `docs/outstanding-work/composer.md#implement-voice-message-input`

Tests to add:

- Endpoint rejects unsupported methods/content types.
- Endpoint enforces max size.
- Provider adapter is mockable in tests.
- Composer handles success/failure without losing prompt text.

<a id="confirm-interruption-support-in-the-protocol-client"></a>
## Confirm Interruption Support In The Protocol Client

Status: Partially confirmed. The generated protocol and generic transport support it, but there is no app helper or UI.

Current behavior:

- `responses.ts` includes `"turn/interrupt": RecordValue`.
- `TurnInterruptParams.ts` requires `{ threadId, turnId }`.
- `CodexSocketIoTransport.request()` forwards any generated method to Socket.IO.
- `AppCodexSocketServer.handleRequest()` forwards the method and parsed params to the backend.
- No app code calls `requestCodex(..., "turn/interrupt", ...)`.

Important snippets:

```ts
// CodexSocketIoTransport.ts
this.socket.emit("request", { method, params, metadata }, (response) => {
  ...
});
```

```ts
// socketNamespace.ts
const method = request.method as CodexRequestMethod;
return transport.request(method, requestParams(method, request.params), { metadata: request.metadata });
```

```ts
// generated TurnInterruptParams.ts
export type TurnInterruptParams = { threadId: string, turnId: string };
```

Recommended implementation:

1. Add a typed helper in the client/composer layer, for example `interruptTurn(dispatch, threadId, turnId)`.
2. Add a composer thunk that resolves the active turn id from state.
3. Add reducer handling for interruption-related follow-up traffic if Codex emits a distinct status.
4. Add e2e coverage using a long-running turn.
5. Ensure backend traffic filtering keeps `turn/interrupt`, `turn/completed`, and `thread/status/changed` visible to Redux.

Files involved:

- `codexClient.ts`
- `turnThunks.ts`
- `CodexThreadReducer.ts`
- `CodexThreadIndexReducer.ts`
- `CodexSocketIoTransport.ts`
- `socketNamespace.ts`
