import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/browser.ts", "src/server.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  target: "es2022",
  outExtensions: ({ format }) =>
    format === "cjs" ? { js: ".cjs", dts: ".d.cts" } : { js: ".js", dts: ".d.ts" },
  deps: {
    neverBundle: ["@parcel/watcher", "simple-git", "socket.io", "socket.io-client"]
  }
});
