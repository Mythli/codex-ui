import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const rawAsar = path.join(root, "raw", "asar");
const resources = "/Applications/Codex.app/Contents/Resources";
const infoPlist = "/Applications/Codex.app/Contents/Info.plist";

const dirs = {
  assets: path.join(root, "assets"),
  css: path.join(root, "css"),
  js: path.join(root, "js"),
  maps: path.join(root, "maps"),
  indexes: path.join(root, "indexes"),
  dossiers: path.join(root, "ai-dossiers"),
};

for (const dir of Object.values(dirs)) {
  mkdirSync(dir, { recursive: true });
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(root, file);
}

function relRaw(file) {
  return path.relative(rawAsar, file);
}

function safeName(file) {
  return relRaw(file).replaceAll(path.sep, "__");
}

function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function readText(file, max = 2_000_000) {
  const buf = readFileSync(file);
  return buf.length > max ? buf.subarray(0, max).toString("utf8") : buf.toString("utf8");
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function write(name, text) {
  writeFileSync(path.join(dirs.dossiers, name), text.trimEnd() + "\n");
}

function copySelected(files, dest) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  for (const file of files) {
    copyFileSync(file, path.join(dest, safeName(file)));
  }
}

function plistJson() {
  try {
    const raw = execFileSync("plutil", ["-convert", "json", "-o", "-", infoPlist], { encoding: "utf8" });
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function imageSize(file) {
  const ext = path.extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".gif", ".webp", ".tiff", ".icns"].includes(ext)) return "";
  try {
    const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const width = out.match(/pixelWidth:\s*(\d+)/)?.[1];
    const height = out.match(/pixelHeight:\s*(\d+)/)?.[1];
    return width && height ? `${width}x${height}` : "";
  } catch {
    return "";
  }
}

function mdTable(rows, headers) {
  const esc = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((h) => esc(row[h])).join(" | ")} |`),
  ].join("\n");
}

function topBySize(files, n = 25) {
  return files
    .map((file) => ({ path: relRaw(file), bytes: statSync(file).size }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, n)
    .map((row) => ({ Path: row.path, Size: bytes(row.bytes) }));
}

const allFiles = walk(rawAsar);
const packageJson = JSON.parse(readFileSync(path.join(rawAsar, "package.json"), "utf8"));
const info = plistJson();
const htmlPath = path.join(rawAsar, "webview", "index.html");
const html = existsSync(htmlPath) ? readFileSync(htmlPath, "utf8") : "";
const cssFiles = allFiles.filter((file) => path.extname(file).toLowerCase() === ".css");
const jsFiles = allFiles.filter((file) => path.extname(file).toLowerCase() === ".js");
const mapFiles = allFiles.filter((file) => path.extname(file).toLowerCase() === ".map");
const assetFiles = allFiles.filter((file) => [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".icns", ".woff", ".woff2", ".ttf", ".otf", ".wav", ".mp3", ".wasm"].includes(path.extname(file).toLowerCase()));
const rendererJsFiles = jsFiles.filter((file) => relRaw(file).startsWith("webview/assets/"));
const mainJsFiles = jsFiles.filter((file) => relRaw(file).startsWith(".vite/build/") || relRaw(file).includes("preload"));

copySelected(cssFiles, dirs.css);
copySelected(rendererJsFiles.filter((file) => {
  const name = path.basename(file).toLowerCase();
  return /(^index-|app-main|composer|conversation|thread|sidebar|layout|button|menu|modal|dialog|toast|settings|plugins|worktree|hotkey|scratchpad|avatar|diff|comments|terminal|browser|spreadsheet|presentation)/.test(name);
}), dirs.js);
copySelected(assetFiles, dirs.assets);
copySelected(mapFiles, dirs.maps);

const extRows = Object.entries(allFiles.reduce((acc, file) => {
  const ext = path.extname(file).toLowerCase() || "[none]";
  acc[ext] ??= { count: 0, size: 0 };
  acc[ext].count += 1;
  acc[ext].size += statSync(file).size;
  return acc;
}, {}))
  .map(([ext, value]) => ({ Extension: ext, Count: value.count, Size: bytes(value.size) }))
  .sort((a, b) => b.Count - a.Count);

const cssInventory = cssFiles.map((file) => {
  const text = readText(file);
  return {
    Path: relRaw(file),
    Size: bytes(statSync(file).size),
    Classes: unique([...text.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((m) => m[1])).slice(0, 40).join(", "),
    Vars: unique([...text.matchAll(/(--[_a-zA-Z0-9-]+)/g)].map((m) => m[1])).slice(0, 25).join(", "),
    Media: [...text.matchAll(/@media[^{]+/g)].map((m) => m[0].trim()).slice(0, 8).join("; "),
  };
});

const jsInventory = rendererJsFiles.map((file) => {
  const text = readText(file, 400_000);
  const imports = [...text.matchAll(/(?:from\s*["']([^"']+)["']|import\(["']([^"']+)["']\))/g)].map((m) => m[1] || m[2]);
  return {
    Path: relRaw(file),
    Size: bytes(statSync(file).size),
    Role: classifyJs(path.basename(file)),
    Imports: unique(imports).slice(0, 20).join(", "),
    SourceMap: text.includes("sourceMappingURL") ? "yes" : "",
  };
});

const assetInventory = assetFiles.map((file) => ({
  Path: relRaw(file),
  Type: path.extname(file).toLowerCase().slice(1),
  Size: bytes(statSync(file).size),
  Dimensions: imageSize(file),
}));

function classifyJs(name) {
  const lower = name.toLowerCase();
  if (lower.startsWith("index-")) return "renderer entry";
  if (lower.includes("app-main")) return "main UI shell";
  if (lower.includes("composer")) return "message composer";
  if (lower.includes("conversation") || lower.includes("thread")) return "conversation/thread UI";
  if (lower.includes("sidebar") || lower.includes("layout")) return "layout/navigation";
  if (lower.includes("button") || lower.includes("toggle") || lower.includes("menu") || lower.includes("toast")) return "component primitive";
  if (lower.includes("settings")) return "settings page";
  if (lower.includes("plugins")) return "plugins UI";
  if (lower.includes("worker")) return "worker/runtime";
  if (/^[a-z]{2}(-[a-z]{2})?-/i.test(name)) return "locale bundle";
  return "";
}

const scriptRefs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
const preloadRefs = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const cssRefs = [...html.matchAll(/<link[^>]+stylesheet[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const inlineCss = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
const cssText = cssFiles.map((file) => readText(file, 1_200_000)).join("\n") + "\n" + inlineCss;
const cssVars = unique([...cssText.matchAll(/(--[_a-zA-Z0-9-]+)\s*:\s*([^;}{]+)/g)].map((m) => `${m[1]}: ${m[2].trim()}`));
const colors = unique([...cssText.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|color-mix\([^)]+\)/g)].map((m) => m[0])).slice(0, 200);
const fonts = unique([...cssText.matchAll(/font-family:\s*([^;}{]+)/g)].map((m) => m[1].trim())).slice(0, 100);
const componentSelectors = unique([...cssText.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((m) => m[1]))
  .filter((name) => /button|btn|input|menu|modal|dialog|toast|tab|toggle|card|panel|sidebar|composer|thread|message|avatar|toolbar|popover|tooltip|select|list|item|settings|terminal/i.test(name))
  .slice(0, 250);

writeFileSync(path.join(dirs.indexes, "file-extension-summary.md"), mdTable(extRows, ["Extension", "Count", "Size"]) + "\n");
writeFileSync(path.join(dirs.indexes, "css-inventory.md"), mdTable(cssInventory, ["Path", "Size", "Classes", "Vars", "Media"]) + "\n");
writeFileSync(path.join(dirs.indexes, "js-inventory.md"), mdTable(jsInventory, ["Path", "Size", "Role", "Imports", "SourceMap"]) + "\n");
writeFileSync(path.join(dirs.indexes, "asset-inventory.md"), mdTable(assetInventory, ["Path", "Type", "Size", "Dimensions"]) + "\n");
writeFileSync(path.join(dirs.indexes, "entrypoints.md"), [
  "# Entrypoints",
  "",
  `- Package main: \`${packageJson.main}\``,
  `- Webview HTML: \`webview/index.html\``,
  `- Script refs: ${scriptRefs.map((x) => `\`${x}\``).join(", ") || "none"}`,
  `- Module preload refs: ${preloadRefs.map((x) => `\`${x}\``).join(", ") || "none"}`,
  `- Stylesheet refs: ${cssRefs.map((x) => `\`${x}\``).join(", ") || "none"}`,
  "",
].join("\n"));

write("00-overview.md", `
# 00 Overview

## App Metadata
- Product: ${packageJson.productName ?? info.CFBundleDisplayName ?? "Codex"}
- Bundle id: ${info.CFBundleIdentifier ?? "unknown"}
- Version: ${packageJson.version ?? info.CFBundleShortVersionString ?? "unknown"}
- Build number: ${packageJson.codexBuildNumber ?? info.CFBundleVersion ?? "unknown"}
- Electron: ${packageJson.devDependencies?.electron ?? "unknown"}
- Build tool clues: Electron Forge, Vite, production flavor \`${packageJson.codexBuildFlavor ?? "unknown"}\`

## Bundle Shape
- Extracted ASAR: \`${rel(rawAsar)}\`
- Renderer webview: \`raw/asar/webview/index.html\`
- Package main: \`${packageJson.main}\`
- CSS files: ${cssFiles.length}
- Renderer JS files: ${rendererJsFiles.length}
- Asset files: ${assetFiles.length}
- Source maps: ${mapFiles.length}

## Largest UI/Runtime Files
${mdTable(topBySize(rendererJsFiles, 20), ["Path", "Size"])}
`);

write("01-css-theme-tokens.md", `
# 01 CSS Theme Tokens

## CSS Files
${mdTable(cssInventory, ["Path", "Size", "Vars", "Media"])}

## CSS Variables
${cssVars.slice(0, 250).map((x) => `- \`${x}\``).join("\n") || "- None detected"}

## Color Values
${colors.map((x) => `- \`${x}\``).join("\n") || "- None detected"}

## Font Families
${fonts.map((x) => `- \`${x}\``).join("\n") || "- None detected"}
`);

write("02-layout-and-shell.md", `
# 02 Layout And Shell

## Likely Layout Chunks
${mdTable(jsInventory.filter((row) => /layout|sidebar|thread|conversation|app-main|hotkey|local-conversation|worktree/i.test(row.Path + row.Role)).slice(0, 80), ["Path", "Size", "Role"])}

## Layout Selectors And Classes
${componentSelectors.filter((x) => /layout|shell|sidebar|panel|thread|conversation|composer|message|toolbar|scroll|window|page|avatar/i.test(x)).slice(0, 160).map((x) => `- \`.${x}\``).join("\n") || "- No obvious layout selectors detected"}

## Static HTML Shell
- Root mount: \`#root\`
- Startup loader classes: \`.startup-loader\`, \`.startup-loader__logo\`, \`.startup-loader__base\`, \`.startup-loader__overlay\`
- Startup loader uses a transparent background, draggable app region, 56px logo, and shimmer animation.
`);

write("03-components.md", `
# 03 Components

## Likely Component Chunks
${mdTable(jsInventory.filter((row) => /button|toggle|menu|modal|dialog|toast|select|input|composer|attachment|avatar|tab|comments|diff|toolbar|list/i.test(row.Path + row.Role)).slice(0, 100), ["Path", "Size", "Role"])}

## Component Selectors And Classes
${componentSelectors.map((x) => `- \`.${x}\``).join("\n") || "- No obvious component selectors detected"}
`);

write("04-icons-and-assets.md", `
# 04 Icons And Assets

## Asset Inventory
${mdTable(assetInventory.slice(0, 300), ["Path", "Type", "Size", "Dimensions"])}

## Notes
- Copied assets live in \`assets/\` with path-safe filenames.
- Font files and SVG/WEBP/PNG media are prioritized for UI reconstruction.
`);

write("05-renderer-entrypoints.md", `
# 05 Renderer Entrypoints

## HTML Entrypoints
- Webview HTML: \`raw/asar/webview/index.html\`
- Root element: \`#root\`
- Script refs: ${scriptRefs.map((x) => `\`${x}\``).join(", ") || "none"}
- Preload refs: ${preloadRefs.map((x) => `\`${x}\``).join(", ") || "none"}

## Main/Preload Candidates
${mdTable(topBySize(mainJsFiles, 40), ["Path", "Size"])}

## Renderer Entry Candidates
${mdTable(jsInventory.filter((row) => /renderer entry|main UI shell|conversation|layout|message composer/i.test(row.Role)).slice(0, 80), ["Path", "Size", "Role", "Imports"])}
`);

write("06-runtime-dom-captures.md", `
# 06 Runtime DOM Captures

Runtime capture artifacts are expected in \`live-captures/\`.

Current static capture facts:
- Startup DOM exists in \`raw/asar/webview/index.html\`.
- Startup CSS is inline in the HTML and mirrored into \`01-css-theme-tokens.md\`.

After running \`node codex-ui-reverse/tools/capture-live.mjs\`, check:
- \`live-captures/codex-window.png\`
- \`live-captures/codex-window-bounds.json\`
- \`live-captures/runtime-notes.md\`
`);

write("07-reconstruction-notes.md", `
# 07 Reconstruction Notes

## Recommended AI Feeding Order
1. \`00-overview.md\`
2. \`01-css-theme-tokens.md\`
3. \`02-layout-and-shell.md\`
4. \`03-components.md\`
5. \`05-renderer-entrypoints.md\`
6. \`04-icons-and-assets.md\`
7. \`06-runtime-dom-captures.md\`

## Reconstruction Priorities
- Recreate the window shell from \`webview/index.html\`, \`app-main-*.css\`, and layout/thread chunks.
- Use CSS variables and global selectors before guessing component styling.
- Treat copied JS files in \`js/\` as focused evidence, while \`raw/asar/\` remains the source of truth.
- Use \`assets/\` for fonts, icons, spritesheets, and product-specific media.

## Useful Source Paths
- \`raw/asar/webview/index.html\`
- \`raw/asar/webview/assets/app-main-DT9r06ux.css\`
- \`raw/asar/webview/assets/app-main-Bucm979x.js\`
- \`raw/asar/webview/assets/index-BCyxq2Zd.js\`
- \`raw/asar/package.json\`
`);

console.log(`Generated Codex UI reverse workspace at ${root}`);
console.log(`CSS: ${cssFiles.length}, renderer JS: ${rendererJsFiles.length}, assets: ${assetFiles.length}, maps: ${mapFiles.length}`);
