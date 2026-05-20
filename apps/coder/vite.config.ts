import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { appSocketPlugin } from "./appSocket";

const appRoot = path.resolve(__dirname, "app");
const coderRoot = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@app\/(.+)$/,
        replacement: path.resolve(appRoot, "$1")
      },
      {
        find: "@coder/client",
        replacement: path.resolve(coderRoot, "client/index.ts")
      },
      {
        find: "@coder/defaults",
        replacement: path.resolve(coderRoot, "defaults.ts")
      },
      {
        find: "@coder/protocol",
        replacement: path.resolve(coderRoot, "protocol/index.ts")
      },
      {
        find: "@coder/types",
        replacement: path.resolve(coderRoot, "types/index.ts")
      }
    ]
  },
  plugins: [
    appSocketPlugin(),
    tanstackStart({
      srcDirectory: "app",
      router: {
        entry: "router.tsx"
      }
    }),
    react()
  ]
});
