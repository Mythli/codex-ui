# @taylordb/codex

Reusable TypeScript library for running Codex through the app-server transport.

## Developer Principles

This package has a deliberately narrow architecture:

```txt
raw Codex JSON
  -> protocol parsing
  -> CodexProtocolTraffic
  -> runtime
  -> CodexThreadReducer
  -> CodexThreadState.renderBlocks
  -> UI
```

App-specific behavior such as upload staging, `/codex-assets` serving, and image URL
normalization belongs in the consuming app as typed traffic transforms.

Read [Codex Developer Principles](./docs/developer-principles.md) before changing
protocol parsing, transport, transcript reduction, render projection, runtime actions,
or UI-facing contracts.
