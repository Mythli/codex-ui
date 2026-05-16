import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import {
  listCodexChats,
  listCodexModels,
  listCodexProjects,
  messageRequestSchema,
  readCodexChat,
  runCodex,
  streamCodex
} from "./codex.js";

const app = new Hono();

app.get("/api", (c) =>
  c.json({
    name: "codex-api",
    routes: [
      "GET /health",
      "GET /api",
      "GET /models",
      "GET /projects",
      "GET /chats",
      "GET /chats/:threadId",
      "POST /chats",
      "POST /chats/stream",
      "POST /chats/:threadId/messages",
      "POST /chats/:threadId/messages/stream"
    ]
  })
);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/models", async (c) => {
  const limit = Number(c.req.query("limit") ?? 100);
  const models = await listCodexModels(Number.isFinite(limit) ? limit : 100);
  return c.json({ models });
});

app.get("/projects", async (c) => {
  const limit = Number(c.req.query("limit") ?? 500);
  const projects = await listCodexProjects(Number.isFinite(limit) ? limit : 500);
  return c.json({ projects });
});

app.get("/chats", async (c) => {
  const limit = Number(c.req.query("limit") ?? 100);
  const chats = await listCodexChats(Number.isFinite(limit) ? limit : 100, c.req.query("cwd"));
  return c.json({ chats });
});

app.get("/chats/:threadId", async (c) => {
  const chat = await readCodexChat(c.req.param("threadId"));
  return c.json(chat);
});

app.post("/chats", async (c) => {
  const request = await parseMessageRequest(c.req.json());
  const result = await runCodex({ kind: "new", request });
  return c.json(result, result.exitCode === 0 ? 201 : 502);
});

app.post("/chats/stream", async (c) => {
  const request = await parseMessageRequest(c.req.json());

  return stream(c, async (out) => {
    const abortController = new AbortController();
    let writes = Promise.resolve();
    out.onAbort(() => abortController.abort());

    await streamCodex(
      { kind: "new", request },
      (event) => {
        writes = writes.then(() => out.write(`${JSON.stringify(event)}\n`).then(() => undefined));
      },
      abortController.signal
    );
    await writes;
  });
});

app.post("/chats/:threadId/messages", async (c) => {
  const threadId = c.req.param("threadId");
  const request = await parseMessageRequest(c.req.json());
  const result = await runCodex({ kind: "resume", threadId, request });
  return c.json(result, result.exitCode === 0 ? 200 : 502);
});

app.post("/chats/:threadId/messages/stream", async (c) => {
  const threadId = c.req.param("threadId");
  const request = await parseMessageRequest(c.req.json());

  return stream(c, async (out) => {
    const abortController = new AbortController();
    let writes = Promise.resolve();
    out.onAbort(() => abortController.abort());

    await streamCodex(
      { kind: "resume", threadId, request },
      (event) => {
        writes = writes.then(() => out.write(`${JSON.stringify(event)}\n`).then(() => undefined));
      },
      abortController.signal
    );
    await writes;
  });
});

app.use("/assets/*", serveStatic({ root: "./dist/client" }));
app.get("/favicon.ico", serveStatic({ root: "./dist/client" }));
app.get("*", serveStatic({ root: "./dist/client", path: "index.html" }));

app.onError((error, c) => {
  if (error instanceof z.ZodError) {
    return c.json({ error: "Invalid request body", issues: error.issues }, 400);
  }

  return c.json({ error: error.message }, 500);
});

async function parseMessageRequest(bodyPromise: Promise<unknown>) {
  return messageRequestSchema.parse(await bodyPromise);
}

const port = Number(process.env.PORT ?? 3000);

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(`codex-api listening on http://localhost:${info.port}`);
  }
);
