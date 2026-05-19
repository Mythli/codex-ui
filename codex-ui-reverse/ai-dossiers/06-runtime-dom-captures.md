
# 06 Runtime DOM Captures

Runtime capture artifacts are expected in `live-captures/`.

Current static capture facts:
- Startup DOM exists in `raw/asar/webview/index.html`.
- Startup CSS is inline in the HTML and mirrored into `01-css-theme-tokens.md`.

After running `node codex-ui-reverse/tools/capture-live.mjs`, check:
- `live-captures/codex-window.png`
- `live-captures/codex-window-bounds.json`
- `live-captures/runtime-notes.md`
