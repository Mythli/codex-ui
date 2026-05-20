# API Outstanding Work Research

This note covers the README API items. It is based on local code inspection on 2026-05-21.

Primary files:

- `apps/coder/dependencies.ts`
- `apps/coder/env.ts`
- `apps/coder/backend/backendProvider.ts`
- `apps/coder/backend/socketNamespace.ts`
- `apps/coder/backend/middlewareTransport.ts`
- `apps/coder/middlewares/createCodexProtocolMiddlewareStack.ts`
- `apps/coder/middlewares/*`
- `apps/coder/client/CodexSocketIoTransport.ts`
- `apps/coder/app/features/connection/state/codexConnectionSlice.ts`
- `apps/coder/app/store/configureStore.ts`

## Architecture Snapshot

The API layer owns:

- Environment parsing.
- Asset helper construction.
- Socket.IO server creation.
- Live Codex backend construction.
- App-session backend registry.
- Backend protocol middleware stack.

`createCoderApiDependencies()` is already the top-level composition root, but lower-level factories still construct concrete dependencies internally.

<a id="centralize-instance-creation-in-createcoderapidependencies"></a>
## Centralize Instance Creation In createCoderApiDependencies

Status: Partially implemented. A composition root exists, but instance creation is still spread across lower-level factories.

Current behavior:

- `createCoderApiDependencies()` creates `assetHelper`, `createMiddlewareStack`, `LiveCodexBackendProvider`, `AppCodexSessionRegistry`, and a Socket.IO server factory.
- `createManagedCodexBackendTransport()` constructs `new AppServerClient(...)`.
- `createSocketCodexBackendTransport()` constructs `new CodexSocketIoTransport(...)` and a Unix socket `Agent` if needed.
- `createSocketServer()` constructs `new SocketIoServer(...)` inside the dependency object.
- `AppCodexSessionRegistry` owns backend lifecycle details.

Important snippets:

```ts
// dependencies.ts
const liveBackend = new LiveCodexBackendProvider({
  createTransport: createBackendTransport,
  logger
});

const sessions = new AppCodexSessionRegistry({
  largeOutgoingPacketBytes: env.socketLargeOutgoingPacketBytes,
  logger,
  shouldCloseBackend: (backend) => backend !== liveBackend
});
```

```ts
// backendProvider.ts
const client = new AppServerClient(input.codexBin ?? options.codexBin, ...);
const socketTransport = new CodexSocketIoTransport(io(options.url, socketOptions));
```

Recommended implementation:

1. Define `createCoderApiDependencies()` as the explicit composition root.
2. Keep lower-level factories pure where practical by injecting constructors or factory functions.
3. Move Socket.IO client creation, `AppServerClient` creation, and Unix socket agent creation behind injectable dependencies.
4. Preserve a simple default path so production setup remains readable.
5. Add tests that construct dependencies with fake transports, fake sessions, fake middleware, and fake logger.
6. Document which instances are singleton per dev server vs per app session vs per request.

Target ownership:

- App/server singleton: env, logger, asset helper, Socket.IO server, live backend provider.
- Session-scoped: app-server backend transport, session registry records, socket subscriptions.
- Request-scoped: metadata, timeout tracking, request params.

Files involved:

- `dependencies.ts`
- `backendProvider.ts`
- `socketNamespace.ts`
- `middlewareTransport.ts`
- `appSocket.ts`

<a id="clarify-appcodexsessionregistry-ownership"></a>
## Clarify AppCodexSessionRegistry Ownership

Status: Needs design review. The class exists and works, but its name undersells the amount of backend lifecycle and forwarding behavior it owns.

Current behavior:

- `AppCodexSessionRegistry` tracks app sessions by id.
- It binds sessions to the current backend transport.
- It subscribes to backend traffic and diagnostic streams.
- It forwards traffic and diagnostics through the socket namespace.
- It owns backend cleanup policy through `shouldCloseBackend`.
- It handles large outgoing packet behavior through `largeOutgoingPacketBytes`.

Implementation questions:

- Is this class meant to be only a session registry, or is it the app-session lifecycle owner?
- Should backend binding and traffic subscription live in the socket namespace instead?
- Should backend cleanup policy live in `LiveCodexBackendProvider` or the dependency composition root?
- Are diagnostics and protocol traffic separate enough to deserve distinct forwarding paths?
- Would a name like `AppCodexSessionManager` better describe the current responsibility if the design is otherwise correct?

Recommended implementation:

1. Map the exact responsibilities of `AppCodexSessionRegistry` against the architecture boundary in `docs/architecture.md`.
2. Decide whether to keep it as a single lifecycle manager or split registry, backend binding, and socket forwarding responsibilities.
3. If it remains the lifecycle owner, rename it to match that role and document singleton/session/request ownership.
4. If it is split, keep socket emission in the socket namespace and backend creation/teardown in the backend provider or composition root.
5. Preserve the current session reconnection behavior and large-packet handling while refactoring.
6. Validate with the click e2e suite rather than adding broad unit-test coverage unless a small characterization test is needed to lock down a fragile edge.

Files involved:

- `socketNamespace.ts`
- `backendProvider.ts`
- `dependencies.ts`
- `appSocket.ts`
- `CodexSocketIoTransport.ts`

<a id="make-middleware-ownership-explicit"></a>
## Make Middleware Ownership Explicit

Status: Confirmed backend-only in current architecture.

Current behavior:

- `createCodexProtocolMiddlewareStack()` lives under `apps/coder/middlewares`.
- The stack includes local file read hydration, markdown rewrite, and traffic measurement.
- `createAppCodexMiddlewareTransport()` wraps backend transports with that stack.
- Browser Redux receives already-emitted protocol traffic; it does not run the same middleware stack.

Important snippets:

```ts
// createCodexProtocolMiddlewareStack.ts
return [
  createLocalFileReadMiddleware(...),
  createMarkdownRewriteMiddleware(...),
  createTrafficMeasurementMiddleware(...)
] as const;
```

```ts
// backendProvider.ts
return createCodexMiddlewareTransport(
  transport,
  { hydrateRequestResponses: options.hydrateRequestResponses },
  ...options.createMiddlewareStack({ transport, onDiagnostic })
);
```

Recommended implementation:

1. Document that Codex protocol middleware is server-side only for now.
2. Rename or annotate types so "middleware" does not imply Redux/frontend middleware.
3. Keep frontend transformation in reducers/selectors, not in protocol middleware, unless a shared design is intentionally introduced.
4. Add an ownership diagram in API docs or this backlog once finalized.
5. If any middleware must become shared, create a separate package-level abstraction and tests for both runtimes.

Files involved:

- `createCodexProtocolMiddlewareStack.ts`
- `middlewareTransport.ts`
- `middlewares/types.ts`
- `backendProvider.ts`
- `CodexSocketIoTransport.ts`

<a id="filter-backend-traffic-before-it-reaches-redux"></a>
## Filter Backend Traffic Before It Reaches Redux

Status: Confirmed unfiltered. Diagnostics and traffic are forwarded directly to the browser.

Current behavior:

- `AppCodexSessionRegistry.setBackend()` subscribes to backend traffic and diagnostic streams.
- Every traffic packet is emitted over Socket.IO as `"traffic"`.
- Every diagnostic text is emitted as `"diagnostic"`.
- The browser `CodexSocketIoTransport.emitDiagnostic()` converts diagnostics into `CodexProtocolDiagnosticTraffic` and dispatches it through normal traffic listeners.
- `codexConnectionSlice` stores the last 50 diagnostics, but Redux still sees each diagnostic action.

Important snippets:

```ts
// socketNamespace.ts
session.unsubscribeTraffic = backend.onTraffic((traffic) => {
  this.emit(session.id, "traffic", traffic);
});
session.unsubscribeDiagnostic = backend.onDiagnostic((text) => {
  this.emit(session.id, "diagnostic", text);
});
```

```ts
// CodexSocketIoTransport.ts
private emitDiagnostic(text: string): void {
  this.emitTraffic({ kind: "diagnostic", text, timestampMs: Date.now() });
  for (const listener of this.diagnosticListeners) {
    listener(text);
  }
}
```

Why Redux can be overwhelmed:

- Diagnostic traffic is treated as Redux traffic, even though most diagnostics do not affect UI state.
- `loadedThreadsSlice` ignores diagnostics, but the action still passes through the store.
- `codexConnectionSlice` stores only 50 messages, but it still processes every diagnostic action.
- Backend traffic filtering does not currently distinguish UI-relevant events from low-value noise.

Recommended implementation:

1. Add a server-side traffic filter before `socket.emit`.
2. Use an allowlist for UI-critical methods/events:
   - requests/responses: `thread/list`, `thread/read`, `thread/start`, `thread/resume`, `thread/archive`, `turn/start`, `turn/interrupt`, `fs/readFile`, `model/list`, `config/read`
   - events: thread lifecycle, turn lifecycle, item deltas needed by transcript, file-change updates, token usage, model reroute
3. Use a denylist or sampler for diagnostics and noisy warnings.
4. Keep a bounded diagnostic channel separate from Redux traffic if the UI still needs a debug panel.
5. Add measurement logs for dropped vs forwarded counts.
6. Make the filter configurable through env for debugging.

Files involved:

- `socketNamespace.ts`
- `CodexSocketIoTransport.ts`
- `codexConnectionSlice.ts`
- `configureStore.ts`
- `createTrafficMeasurementMiddleware.ts`
- `env.ts`

Tests to add:

- Filter forwards transcript-critical traffic.
- Filter drops diagnostics by default or rate-limits them.
- Debug config can forward diagnostics.
- Redux no longer receives diagnostic floods under load.
