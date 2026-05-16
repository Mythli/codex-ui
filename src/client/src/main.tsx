import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Composer } from "./components/Composer";
import { Sidebar } from "./components/Sidebar";
import { Transcript } from "./components/Transcript";
import {
  appendAssistantToWork,
  appendWorkActivity,
  createLiveTurn,
  eventToActivity,
  finishActiveWork,
  messagesToTranscript,
  setWorkOpen,
  tickActiveWork
} from "./transcript";
import type { ChatDetail, ChatSummary, CodexTranscript, JsonEvent, ModelSummary, ProjectSummary } from "./types";
import "./styles.css";

const defaultPrompt = "Reply with exactly: pong";

function App() {
  const [threadId, setThreadId] = useState("");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [cwd, setCwd] = useState("");
  const [sandbox, setSandbox] = useState("read-only");
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [transcript, setTranscript] = useState<CodexTranscript>([]);
  const [events, setEvents] = useState<JsonEvent[]>([]);
  const [rawVisible, setRawVisible] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [selectedChatLoading, setSelectedChatLoading] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const activeWorkIdRef = useRef<string>("");
  const rawRef = useRef<HTMLPreElement | null>(null);

  const rawJson = useMemo(() => events.map((event) => JSON.stringify(event, null, 2)).join("\n\n"), [events]);
  const activeProject = useMemo(
    () => projects.find((project) => project.cwd === selectedProject),
    [projects, selectedProject]
  );
  const isStreaming = status === "streaming";

  useEffect(() => {
    if (!isStreaming || !activeWorkIdRef.current) {
      return;
    }

    const interval = window.setInterval(() => {
      const workId = activeWorkIdRef.current;
      if (workId) {
        setTranscript((current) => tickActiveWork(current, workId));
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isStreaming]);

  useEffect(() => {
    rawRef.current?.scrollTo({ top: rawRef.current.scrollHeight });
  }, [rawJson]);

  useEffect(() => {
    void loadModels();
    void loadProjects();
  }, []);

  async function loadModels() {
    try {
      const response = await fetch("/models?limit=100");
      if (!response.ok) {
        throw new Error(`Could not load models: ${response.status}`);
      }
      const body = (await response.json()) as { models?: ModelSummary[] };
      const nextModels = body.models ?? [];
      setModels(nextModels);
      const defaultModel = nextModels.find((model) => model.isDefault) ?? nextModels[0];
      if (defaultModel) {
        setSelectedModel(defaultModel.model);
        setReasoningEffort(defaultModel.defaultReasoningEffort || "medium");
      }
    } catch {
      setSelectedModel("gpt-5.5");
    }
  }

  async function loadProjects() {
    setProjectsLoading(true);
    setError("");
    try {
      const response = await fetch("/projects?limit=500");
      if (!response.ok) {
        throw new Error(`Could not load projects: ${response.status}`);
      }
      const body = (await response.json()) as { projects?: ProjectSummary[] };
      const nextProjects = body.projects ?? [];
      setProjects(nextProjects);
      const nextProject = selectedProject || nextProjects[0]?.cwd || "";
      setSelectedProject(nextProject);
      setCwd((current) => current || nextProject);
      await loadChats(nextProject);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load projects");
      await loadChats("");
    } finally {
      setProjectsLoading(false);
    }
  }

  async function loadChats(projectCwd = selectedProject) {
    setChatsLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "80" });
      if (projectCwd) {
        query.set("cwd", projectCwd);
      }
      const response = await fetch(`/chats?${query.toString()}`);
      if (!response.ok) {
        throw new Error(`Could not load chats: ${response.status}`);
      }
      const body = (await response.json()) as { chats?: ChatSummary[] };
      setChats(body.chats ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load chats");
    } finally {
      setChatsLoading(false);
    }
  }

  async function submit(mode: "new" | "resume") {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isStreaming) {
      return;
    }

    const isResume = mode === "resume" && threadId.trim();
    const projectCwd = (isResume ? cwd : selectedProject || cwd).trim();
    if (!isResume && !projectCwd) {
      setError("Select a project before creating a new chat.");
      return;
    }

    const endpoint = isResume ? `/chats/${encodeURIComponent(threadId.trim())}/messages/stream` : "/chats/stream";
    const controller = new AbortController();
    const liveTurn = createLiveTurn(trimmedPrompt);
    abortRef.current = controller;
    activeWorkIdRef.current = liveTurn.workBlock?.id ?? "";
    setStatus("streaming");
    setError("");
    setTranscript((current) => [...current, liveTurn]);

    if (!isResume) {
      setThreadId("");
      setEvents([]);
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: trimmedPrompt,
          cwd: projectCwd || undefined,
          model: selectedModel || undefined,
          reasoningEffort,
          sandbox
        }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed with ${response.status}`);
      }

      await readJsonLines(response.body, (event) => {
        setEvents((current) => [...current, event]);

        if (event.type === "thread.started" && typeof event.thread_id === "string") {
          setThreadId(event.thread_id);
        }

        if (event.method === "thread/started" && event.params?.thread?.id) {
          setThreadId(event.params.thread.id);
        }

        const agentMessage = extractAgentMessage(event);
        if (agentMessage) {
          appendAssistantMessage(agentMessage);
        }

        const activity = eventToActivity(event);
        if (activity) {
          appendActivity(activity);
        }

        if (event.method === "turn/completed" || event.type === "process.completed") {
          finishWork();
          if (event.type === "process.completed") {
            setStatus(event.exitCode === 0 ? "done" : "error");
            void loadProjects();
          }
        }
      });
    } catch (caught) {
      if (!controller.signal.aborted) {
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "Unknown request failure");
      }
    } finally {
      finishWork();
      abortRef.current = null;
      activeWorkIdRef.current = "";
    }
  }

  function appendAssistantMessage(text: string) {
    const workId = activeWorkIdRef.current;
    if (!workId) {
      return;
    }
    setTranscript((current) => appendAssistantToWork(current, workId, text));
  }

  function appendActivity(activity: ReturnType<typeof eventToActivity>) {
    const workId = activeWorkIdRef.current;
    if (!workId || !activity) {
      return;
    }
    setTranscript((current) => appendWorkActivity(current, workId, activity));
  }

  function finishWork() {
    const workId = activeWorkIdRef.current;
    if (!workId) {
      return;
    }
    setTranscript((current) => finishActiveWork(current, workId));
  }

  function stopStreaming() {
    abortRef.current?.abort();
    finishWork();
    setStatus("done");
  }

  async function beginProjectChat(projectCwd = selectedProject) {
    abortRef.current?.abort();
    activeWorkIdRef.current = "";
    setSelectedProject(projectCwd);
    setCwd(projectCwd);
    setThreadId("");
    setEvents([]);
    setTranscript([]);
    setStatus("idle");
    setError("");
    await loadChats(projectCwd);
  }

  async function selectProject(projectCwd: string) {
    abortRef.current?.abort();
    activeWorkIdRef.current = "";
    setSelectedProject(projectCwd);
    setCwd(projectCwd);
    setThreadId("");
    setTranscript([]);
    setEvents([]);
    setStatus("idle");
    setError("");
    await loadChats(projectCwd);
  }

  async function selectChat(chat: ChatSummary) {
    abortRef.current?.abort();
    activeWorkIdRef.current = "";
    setThreadId(chat.threadId);
    setCwd(chat.cwd ?? "");
    setEvents([]);
    setTranscript([]);
    setStatus("idle");
    setError("");
    setSelectedChatLoading(chat.threadId);

    try {
      const response = await fetch(`/chats/${encodeURIComponent(chat.threadId)}`);
      if (!response.ok) {
        throw new Error(`Could not load chat: ${response.status}`);
      }
      const detail = (await response.json()) as ChatDetail;
      setThreadId(detail.chat.threadId);
      setCwd(detail.chat.cwd ?? chat.cwd ?? "");
      if (detail.chat.cwd) {
        setSelectedProject(detail.chat.cwd);
      }
      setTranscript(messagesToTranscript(detail.messages));
      setEvents([{ type: "thread.read", ...detail.raw }]);
      setChats((current) =>
        current.map((entry) =>
          entry.threadId === detail.chat.threadId
            ? { ...entry, ...detail.chat, messageCount: detail.messages.length }
            : entry
        )
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load chat");
      setTranscript([
        {
          id: crypto.randomUUID(),
          type: "message",
          message: {
            id: crypto.randomUUID(),
            role: "system",
            text: `Selected ${chat.threadId}, but the transcript could not be loaded.`
          }
        }
      ]);
    } finally {
      setSelectedChatLoading("");
    }
  }

  return (
    <main className="shell">
      <Sidebar
        status={status}
        projects={projects}
        selectedProject={selectedProject}
        projectsLoading={projectsLoading}
        chats={chats}
        threadId={threadId}
        selectedChatLoading={selectedChatLoading}
        isStreaming={isStreaming}
        onRefreshProjects={() => void loadProjects()}
        onSelectProject={(projectCwd) => void selectProject(projectCwd)}
        onNewProjectChat={(projectCwd) => void beginProjectChat(projectCwd)}
        onSelectChat={(chat) => void selectChat(chat)}
      />

      <section className={`workspace ${rawVisible ? "withRaw" : ""}`}>
        <section className="transcript">
          <div className="panelHeader">
            <div>
              <h2>{threadId ? "Chat" : "New chat"}</h2>
              <span>{cwd || activeProject?.cwd || "Select a project to start"}</span>
            </div>
            <div className="headerActions">
              <span>{transcript.length} turns</span>
              <button className="smallButton" onClick={() => setRawVisible((visible) => !visible)}>
                {rawVisible ? "Hide JSON" : "Show JSON"}
              </button>
            </div>
          </div>

          <Transcript
            transcript={transcript}
            onToggleWork={(workId, open) => setTranscript((current) => setWorkOpen(current, workId, open))}
          />

          <Composer
            prompt={prompt}
            sandbox={sandbox}
            models={models}
            selectedModel={selectedModel}
            reasoningEffort={reasoningEffort}
            disabled={!threadId && !selectedProject}
            streaming={isStreaming}
            onPromptChange={setPrompt}
            onSandboxChange={setSandbox}
            onModelChange={setSelectedModel}
            onReasoningEffortChange={setReasoningEffort}
            onStop={stopStreaming}
            onSubmit={() => void submit(threadId ? "resume" : "new")}
          />
        </section>

        {rawVisible && (
          <section className="panel raw">
            <div className="panelHeader">
              <h2>Raw JSON</h2>
              <span>{events.length} events</span>
            </div>
            <pre ref={rawRef}>{rawJson || "JSONL events will stream here."}</pre>
          </section>
        )}
      </section>
    </main>
  );
}

function extractAgentMessage(event: JsonEvent): string | undefined {
  if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
    return event.item.text;
  }

  if (event.method === "item/completed" && event.params?.item?.type === "agentMessage" && event.params.item.text) {
    return event.params.item.text;
  }

  return undefined;
}

async function readJsonLines(body: ReadableStream<Uint8Array>, onEvent: (event: JsonEvent) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        onEvent(JSON.parse(trimmed) as JsonEvent);
      }
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    onEvent(JSON.parse(trailing) as JsonEvent);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
