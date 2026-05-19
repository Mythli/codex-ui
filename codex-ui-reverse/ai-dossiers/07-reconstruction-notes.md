
# 07 Reconstruction Notes

## Recommended AI Feeding Order
1. `00-overview.md`
2. `01-css-theme-tokens.md`
3. `02-layout-and-shell.md`
4. `03-components.md`
5. `05-renderer-entrypoints.md`
6. `04-icons-and-assets.md`
7. `06-runtime-dom-captures.md`

## Reconstruction Priorities
- Recreate the window shell from `webview/index.html`, `app-main-*.css`, and layout/thread chunks.
- Use CSS variables and global selectors before guessing component styling.
- Treat copied JS files in `js/` as focused evidence, while `raw/asar/` remains the source of truth.
- Use `assets/` for fonts, icons, spritesheets, and product-specific media.

## Useful Source Paths
- `raw/asar/webview/index.html`
- `raw/asar/webview/assets/app-main-DT9r06ux.css`
- `raw/asar/webview/assets/app-main-Bucm979x.js`
- `raw/asar/webview/assets/index-BCyxq2Zd.js`
- `raw/asar/package.json`
