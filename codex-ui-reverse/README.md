# Codex UI Reverse Workspace

This folder contains a project-local extraction of `/Applications/Codex.app` for UI reconstruction.

## Useful Starting Points

- `ai-dossiers/00-overview.md`
- `ai-dossiers/01-css-theme-tokens.md`
- `ai-dossiers/02-layout-and-shell.md`
- `ai-dossiers/03-components.md`
- `indexes/css-inventory.md`
- `indexes/js-inventory.md`
- `raw/asar/webview/index.html`
- `raw/asar/webview/assets/app-main-DT9r06ux.css`
- `raw/asar/webview/assets/app-main-Bucm979x.js`

## Regenerate

```sh
npx asar extract /Applications/Codex.app/Contents/Resources/app.asar codex-ui-reverse/raw/asar
rsync -a /Applications/Codex.app/Contents/Resources/app.asar.unpacked/ codex-ui-reverse/raw/unpacked/
node codex-ui-reverse/tools/analyze.mjs
node codex-ui-reverse/tools/capture-live.mjs
```

`capture-live.mjs` may need macOS Accessibility and Screen Recording permissions for the app running this command.
