import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { appSocketPlugin } from "./api/app-socket";

const codexRoot = path.resolve(__dirname, "../../packages/codex/src");

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@taylordb\/codex\/browser$/,
        replacement: path.resolve(codexRoot, "browser.ts")
      },
      {
        find: /^@taylordb\/codex\/server$/,
        replacement: path.resolve(codexRoot, "server.ts")
      },
      {
        find: /^@taylordb\/codex\/protocol$/,
        replacement: path.resolve(codexRoot, "protocol.ts")
      },
      {
        find: /^@taylordb\/codex$/,
        replacement: path.resolve(codexRoot, "index.ts")
      },
      {
        find: "@taylordb/coderui/style.css",
        replacement: path.resolve(__dirname, "../../packages/coderui/src/theme.css")
      },
      {
        find: "@taylordb/coderui",
        replacement: path.resolve(__dirname, "../../packages/coderui/src/index.ts")
      }
    ]
  },
  plugins: [
    appSocketPlugin(),
    tanstackStart({
      srcDirectory: "app",
      router: {
        entry: "core/router.tsx"
      }
    }),
    react()
  ]
});
