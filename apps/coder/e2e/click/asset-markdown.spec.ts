import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createAssetHelper,
  createAssetHttpHandler
} from "../../assets/index.js";
import {
  createMarkdownAssetProcessor,
  defaultMarkdownRewriteHandlers,
  rewriteTrafficMarkdown
} from "../../middlewares/markdown-rewrite/index.js";

test.describe("stateless assets and markdown rewriting", () => {
  test("writes byte assets once by hash and serves cache and file urls", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "coder-assets-"));
    const cacheDir = join(workspace, "cache");
    const helper = createAssetHelper({ cacheDir });
    const bytes = Buffer.from("hello cached asset\n", "utf8");

    const first = helper.urlForBytes(bytes, { mimeType: "text/plain", originalName: "note.txt" });
    const firstStat = await stat(first.path);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = helper.urlForBytes(bytes, { mimeType: "text/plain", originalName: "note.txt" });
    const secondStat = await stat(second.path);

    expect(second.path).toBe(first.path);
    expect(second.asset.url).toBe(first.asset.url);
    expect(secondStat.mtimeMs).toBe(firstStat.mtimeMs);
    expect(first.asset.url).toMatch(/^\/codex-assets\/cache\/sha256-[a-f0-9]{64}\.txt$/);

    const localFile = join(workspace, "local-file.txt");
    await writeFile(localFile, "hello local file\n");
    const localAsset = helper.urlForFileTarget(localFile);
    expect(localAsset?.url).toMatch(/^\/codex-assets\/file\/[A-Za-z0-9_-]+$/);
    expect(localAsset?.url).not.toContain(localFile);

    const server = await serveAssets(helper);
    try {
      const cacheResponse = await fetchAsset(server, first.asset.url);
      expect(cacheResponse.status).toBe(200);
      expect(await cacheResponse.text()).toBe("hello cached asset\n");

      const fileResponse = await fetchAsset(server, localAsset?.url ?? "");
      expect(fileResponse.status).toBe(200);
      expect(await fileResponse.text()).toBe("hello local file\n");

      const missing = helper.urlForPath(join(workspace, "missing.txt"));
      const missingResponse = await fetchAsset(server, missing.url);
      expect(missingResponse.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });

  test("resolves local targets and rewrites only markdown asset urls", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "coder-markdown-"));
    const cacheDir = join(workspace, "cache");
    const cwd = join(workspace, "project");
    const helper = createAssetHelper({ cacheDir });
    const processor = createMarkdownAssetProcessor({ assets: helper });
    const localText = join(cwd, "notes", "local.txt");
    const localImage = join(cwd, "images", "image.png");
    await mkdir(join(cwd, "notes"), { recursive: true });
    await mkdir(join(cwd, "images"), { recursive: true });
    await writeFile(localText, "local notes\n");
    await writeFile(localImage, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const relativeAsset = helper.urlForFileTarget("./notes/local.txt", { cwd });
    const absoluteAsset = helper.urlForFileTarget(localText, { cwd });
    const fileUrlAsset = helper.urlForFileTarget(pathToFileURL(localText).href, { cwd });
    expect(relativeAsset?.url).toBe(absoluteAsset?.url);
    expect(fileUrlAsset?.url).toBe(absoluteAsset?.url);

    const dataUrl = `data:image/png;base64,${Buffer.from([1, 2, 3, 4]).toString("base64")}`;
    const rewritten = processor.rewrite([
      "[local](./notes/local.txt)",
      `![absolute image](${localImage})`,
      `![data image](${dataUrl})`,
      "[asset](/codex-assets/file/already-safe)",
      "[web](https://example.com/a.png)",
      "[mail](mailto:test@example.com)",
      "[anchor](#section)"
    ].join("\n"), { cwd });

    expect(rewritten).toContain("](/codex-assets/file/");
    expect(rewritten).toContain("![absolute image](/codex-assets/file/");
    expect(rewritten).toContain("![data image](/codex-assets/cache/sha256-");
    expect(rewritten).toContain("[asset](/codex-assets/file/already-safe)");
    expect(rewritten).toContain("[web](https://example.com/a.png)");
    expect(rewritten).toContain("[mail](mailto:test@example.com)");
    expect(rewritten).toContain("[anchor](#section)");

    const cachedFile = join(cacheDir, (rewritten.match(/sha256-[a-f0-9]{64}\.png/) ?? [])[0] ?? "");
    expect(await readFile(cachedFile)).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  test("rewrites streamed assistant markdown deltas", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "coder-markdown-delta-"));
    const cacheDir = join(workspace, "cache");
    const cwd = join(workspace, "project");
    const helper = createAssetHelper({ cacheDir });
    const localText = join(cwd, "notes", "local.txt");
    await mkdir(join(cwd, "notes"), { recursive: true });
    await writeFile(localText, "local notes\n");

    const rewritten = rewriteTrafficMarkdown({
      kind: "event",
      event: {
        method: "item/agentMessage/delta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          delta: `[local](${pathToFileURL(localText).href})`
        }
      }
    }, {
      assets: helper,
      cwd,
      handlers: defaultMarkdownRewriteHandlers,
      readFile: async () => undefined
    });

    if (rewritten.kind !== "event" || rewritten.event.method !== "item/agentMessage/delta") {
      throw new Error("Expected markdown traffic rewrite to preserve the assistant delta event.");
    }
    expect(rewritten.event.params.delta).toContain("[local](/codex-assets/file/");
    expect(rewritten.event.params.delta).not.toContain("file://");
    expect(rewritten.event.params.delta).not.toContain(localText);
  });
});

async function serveAssets(helper: ReturnType<typeof createAssetHelper>): Promise<Server> {
  const handler = createAssetHttpHandler(helper);
  const server = createServer((request, response) => {
    request.url = request.url?.replace(/^\/codex-assets(?=\/|$)/, "") || request.url;
    handler(request, response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  return server;
}

async function fetchAsset(server: Server, assetUrl: string): Promise<Response> {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Asset test server did not expose a TCP address.");
  }
  return fetch(`http://127.0.0.1:${address.port}${assetUrl}`);
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
