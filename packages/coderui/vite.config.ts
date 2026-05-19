import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const codexSource = (path: string) => fileURLToPath(new URL(`../codex/src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@taylordb\/codex$/,
        replacement: codexSource("index.ts")
      },
      {
        find: /^@taylordb\/codex\/browser$/,
        replacement: codexSource("browser.ts")
      },
      {
        find: /^@taylordb\/codex\/server$/,
        replacement: codexSource("server.ts")
      }
    ]
  }
});
