import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/browser.ts", "src/server.ts", "src/protocol.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  target: "es2022",
  outExtensions: ({ format }) =>
    format === "cjs" ? { js: ".cjs", dts: ".d.cts" } : { js: ".js", dts: ".d.ts" },
  deps: {
    neverBundle: ["socket.io", "socket.io-client", "zod"]
  }
});
