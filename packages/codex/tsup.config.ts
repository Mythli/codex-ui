import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/browser.ts", "src/server.ts", "src/protocol.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  target: "es2022",
  external: ["socket.io", "socket.io-client", "zod"]
});
