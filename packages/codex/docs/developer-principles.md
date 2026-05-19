# Codex Developer Principles

This package exists to turn Codex protocol traffic into UI-ready conversation state.
Every layer should make the next layer simpler, more typed, and less aware of wire
format details.

## The Pipeline

The intended flow is:

```txt
raw Codex JSON
  -> protocol parsing
  -> CodexProtocolTraffic
  -> transport/runtime traffic stream
  -> CodexThreadReducer
  -> CodexThreadState.renderBlocks
  -> React rendering
```

The direction matters. Data should move forward through this pipeline. Higher layers
must not reach backward into raw protocol shapes to recover meaning.

## Public Contract

The core application contract is intentionally small:

```ts
export type CodexProtocolTraffic =
  | CodexProtocolRequestTraffic
  | CodexProtocolResponseTraffic
  | CodexProtocolErrorResponseTraffic
  | CodexProtocolEventTraffic
  | CodexProtocolServerRequestTraffic
  | CodexProtocolDiagnosticTraffic;
```

```ts
export class CodexThreadReducer {
  constructor(options: { threadId: string });

  reduce(
    previous: CodexThreadState | undefined,
    traffic: CodexProtocolTraffic
  ): CodexThreadState;
}
```

```ts
export type CodexUIRuntime = {
  readonly state: CodexThreadState;
  readonly actions: CodexUIRuntimeActions;
  dispatch(traffic: CodexProtocolTraffic): void;
  subscribe(listener: (state: CodexThreadState) => void): () => void;
  close(): void;
};
```

UI code should normally use `createCodexUIRuntime(...)`, subscribe to state changes,
render `state.renderBlocks`, and call runtime actions. It should not parse protocol,
shape transcript items, or infer activity grouping.

## The Principles

### 1. Raw Exists Only At The Boundary

Raw Codex JSON may exist only long enough to be parsed by the protocol layer.
After parsing, the rest of the package works with trusted protocol types.

Allowed:

```ts
const traffic = parseCodexWireLine(line, context);
emitTraffic(traffic);
```

Not allowed outside protocol parsing:

```ts
const method = (value as Record<string, unknown>).method;
```

If a future Codex shape is not understood, protocol parsing must produce an explicit
typed fallback variant. Do not leak arbitrary raw records upward as a shortcut.

### 2. Zod Owns Runtime Trust

Protocol schemas are the runtime trust boundary. Public protocol types should be
inferred from schemas or kept structurally aligned with them.

The goal is not to make every caller validate defensively. The goal is that after
protocol parsing succeeds, callers can write straightforward typed code.

### 3. Traffic Is The Unit Of Integration

Requests, responses, errors, notifications, server requests, and diagnostics are all
`CodexProtocolTraffic`.

Transports should emit traffic for everything they see or send:

```ts
transport.onTraffic((traffic) => {
  runtime.dispatch(traffic);
});
```

Avoid parallel event systems such as loose `event` callbacks, partial transcript
deltas, or bespoke UI action protocols that duplicate Codex protocol concepts.

### 4. Runtime Owns Connections And Actions

The runtime owns socket/transport subscription and exposes user-facing actions.
Actions send Codex protocol requests. They do not directly mutate transcript or render
state.

Good:

```ts
await runtime.actions.openThread(threadId);
await runtime.actions.sendMessage(input);
```

Bad:

```ts
setLocalUiState(fakeUserMessage);
```

If the backend emits the right traffic, the runtime and reducer should naturally
arrive at the right UI state.

### 5. A Thread Reducer Is Scoped

`CodexThreadReducer` is created for one thread:

```ts
const reducer = new CodexThreadReducer({ threadId });
state = reducer.reduce(state, traffic);
```

The reducer may accept unscoped diagnostics, active request responses, or active turn
traffic, but it must not silently switch threads. Switching threads is a runtime or
consumer concern: discard the old reducer or keep separate reducer instances.

### 6. Reducers Are Pure

`CodexThreadReducer.reduce(...)` is pure and synchronous. It does not query the
backend, stage files, read assets, or open sockets.

Inputs:

- previous thread state
- typed protocol traffic

Output:

- complete UI-ready thread state, including `renderBlocks`

### 7. Render Blocks Are The UI Data Contract

React renders render primitives. It does not infer protocol meaning.

The render projection must provide complete primitives for:

- user and assistant messages
- work headers
- running/completed expansion defaults
- grouped activity summaries
- child activity rows and details
- file changes
- image assets

If the UI needs to know something, add it to the render contract. Do not make the UI
rediscover it from transcript internals.

### 8. Work Rendering Is Deterministic

Work sections must appear whenever the turn has work metadata, even if there are no
tool calls.

Activity grouping should be stable and data-driven:

- local command calls
- MCP calls
- OpenAI developer docs calls
- web/search/open/find calls
- dynamic function namespace calls
- collaborator agent calls
- unknown future calls as raw-but-typed fallback entries

Completed work is collapsed by default. Running work is expanded by default. Group
rows are collapsed by default unless the render primitive says otherwise.

### 9. Asset Policy Is App-Owned

The core library may carry portable asset references in transcript and render
primitives, but it must not own app-specific asset policy.

Core may define and preserve:

```ts
type CodexAssetRef = {
  url: string;
  kind: "file" | "bytes";
  mimeType?: string;
  originalPath?: string;
  sizeBytes?: number;
};
```

Apps own:

- upload staging
- local file registration
- generated image storage
- HTTP routes such as `/codex-assets`
- markdown URL rewriting
- stripping `data:image` or generated base64 before browser transfer

An app may normalize images and files into URLs such as:

```txt
/codex-assets/file-...
```

Those transforms operate on typed protocol traffic, not generic unknown object walks,
and they live in the app or an optional adapter package rather than this core library.

### 10. Middleware Is Not A Raw Escape Hatch

Generic middleware over arbitrary protocol objects is not part of the architecture.
It tends to blur the most important boundary in the package: raw wire data must be
parsed before anything else sees it.

Allowed:

- typed traffic transforms
- transparent transport decorators
- runtime subscribers that consume `CodexProtocolTraffic`

Not allowed:

- middleware that accepts `unknown`
- middleware that walks `Record<string, unknown>`
- middleware that rewrites raw protocol objects before parsing
- middleware that emits partial transcript/UI deltas

If behavior needs to sit between transport and reducer, model it as:

```ts
type CodexTrafficTransform = (
  traffic: CodexProtocolTraffic
) => CodexProtocolTraffic | Promise<CodexProtocolTraffic>;
```

If behavior needs IO, put it in an environment-specific app transport decorator. If
it needs pure state updates, put it in the reducer. If it needs parsing, it belongs
in protocol.

### 11. Preserve Identity

Stable IDs matter. Grouping and projection must preserve child item IDs, titles,
statuses, arguments, results, output, errors, file paths, and asset data.

If render output changes order or identity, that is a contract change and should be
tested as such.

### 12. Historical And Live Paths Must Match

Live socket traffic, historical `thread/read`, and reconciled live-plus-history state
must produce the same ordering, work-block presence, group labels, child IDs, file
changes, and asset URLs.

There should not be one transcript model for live mode and another for history.

### 13. Delete Compatibility Shims Aggressively

This package favors a small, sharp contract over legacy convenience APIs.

Do not reintroduce:

- generic `request<T>()` casts
- loose `onEvent` callbacks
- public `.raw` escape hatches
- transcript hydration helpers as public API
- UI deltas that invent transcript rows
- middleware that walks arbitrary unknown records

If an old abstraction does not serve the protocol-to-render pipeline, remove it.

## Layer Responsibilities

### Protocol

Owns raw parsing, Zod schemas, generated-type alignment, typed fallbacks, and wire
line/object conversion.

May use:

- `unknown`
- Zod
- JSON parsing
- opaque fallback payloads

Must emit:

- `CodexProtocolTraffic`

### Transport

Owns process/socket IO and request correlation.

May receive raw lines or socket payloads only long enough to call protocol parsing.
After that, it stores and emits typed traffic.

Must expose:

```ts
request(method, params): Promise<response>
onTraffic(listener): unsubscribe
```

### App Traffic Transforms

Own typed traffic normalization that depends on environment services, such as file
asset staging or rollout hydration. These are app-level concerns, not core-library
protocol concerns.

Must accept and return:

```ts
CodexProtocolTraffic
```

These replace the old idea of generic transport middleware. They may transform typed
traffic, but they must not parse raw JSON, inspect arbitrary records, or invent UI
deltas. In this repository, the app implements asset traffic transforms next to its
socket server.

### Runtime

Owns subscription, lifecycle, active reducer selection, thread switching, and user
actions.

Must not invent transcript content. It dispatches protocol traffic into the reducer.

### Thread Reducer

Owns conversion from typed traffic to thread state. It is scoped to one thread and is
pure.

Must return:

```ts
CodexThreadState
```

with `renderBlocks` ready for UI consumption.

### UI

Owns presentation and interaction controls.

Consumes:

- runtime state
- render blocks
- runtime actions

Must not consume raw protocol objects, reshape transcript data, or infer work grouping.

## Review Checklist

Before merging changes to this package, ask:

- Does raw JSON stop at the protocol boundary?
- Is the new behavior represented as `CodexProtocolTraffic`?
- Can the UI render this from `renderBlocks` without inference?
- Does the thread reducer stay scoped to one thread?
- Are live and historical paths using the same model?
- Are IDs and ordering stable?
- If the app sends browser traffic, are images asset-backed instead of base64-backed?
- Did we delete obsolete compatibility code instead of routing around it?
