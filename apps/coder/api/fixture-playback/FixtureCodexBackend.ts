import {
  type CodexParsedTurn,
  type CodexProtocolResponse,
  type CodexProtocolTraffic,
  type CodexRequestMethod,
  type CodexRequestParams,
  type CodexRolloutEntry,
  type CodexScenarioAction,
  type CodexScenarioFixture,
  type CodexTransport,
  type CodexTransportRequestOptions
} from "@taylordb/codex/server";
import { parseRolloutJsonlThreadTurns } from "../../../../packages/codex/src/core";
import type {
  FixturePlaybackDefinition,
  FixturePlaybackMode,
  FixturePlaybackStatus
} from "./types.js";

type PlayFrame = {
  actionIndex: number;
  actionEndStep: number;
  traffic: CodexProtocolTraffic;
};

type StatusListener = (status: FixturePlaybackStatus) => void;

export class FixtureCodexBackend implements CodexTransport {
  private readonly trafficListeners = new Set<(traffic: CodexProtocolTraffic) => void>();
  private readonly diagnosticListeners = new Set<(text: string) => void>();
  private readonly liveFrames: PlayFrame[];
  private readonly timestampOffsetMs: number;
  private closed = false;
  private currentStep = 0;
  private delayMs = 80;
  private isRunning = false;
  private mode: FixturePlaybackMode;
  private readonly pendingSyntheticResponseIdsByMethod = new Map<string, string[]>();
  private revealedActionIndex = -1;
  private requestId = 0;

  constructor(
    private readonly definition: FixturePlaybackDefinition,
    private readonly options: { onStatus?: StatusListener } = {}
  ) {
    this.mode = definition.defaultMode;
    this.liveFrames = liveFrames(definition.fixture);
    this.timestampOffsetMs = Date.now() - scenarioStartMs(definition.fixture);
  }

  async request<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options: CodexTransportRequestOptions = {}
  ): Promise<CodexProtocolResponse<M>> {
    if (this.closed) {
      throw new Error(`Fixture playback backend is closed; cannot request ${method}`);
    }

    if (method === "thread/list") {
      return this.emitSyntheticResponse(method, params, {
        data: this.hasVisibleThread() ? [this.syntheticThread()] : [],
        nextCursor: null,
        backwardsCursor: null
      } as CodexProtocolResponse<M>, options);
    }
    if (method === "thread/read") {
      return this.emitSyntheticResponse(method, params, {
        thread: this.syntheticThread()
      } as CodexProtocolResponse<M>, options);
    }
    if (method === "fs/readFile") {
      return this.emitSyntheticResponse(method, params, {
        dataText: jsonlFromRecords(this.visibleSessionRecords())
      } as CodexProtocolResponse<M>, options);
    }
    if (method === "model/list") {
      return this.emitSyntheticResponse(method, params, {
        data: [
          { id: "gpt-5.5", model: "gpt-5.5", displayName: "OpenAI: GPT-5.5", isDefault: true },
          { id: "gpt-5.4", model: "gpt-5.4", displayName: "OpenAI: GPT-5.4" }
        ],
        nextCursor: null
      } as CodexProtocolResponse<M>, options);
    }
    if (
      method === "thread/archive" ||
      method === "thread/compact/start" ||
      method === "turn/interrupt" ||
      method === "initialized"
    ) {
      return this.emitSyntheticResponse(method, params, {} as CodexProtocolResponse<M>, options);
    }

    throw new Error(`Fixture ${this.definition.id} does not handle ${method}; use fixture controls to drive playback`);
  }

  notify<M extends CodexRequestMethod>(method: M, params?: CodexRequestParams<M>): void {
    if (method === "initialized") {
      void this.request(method, (params ?? {}) as CodexRequestParams<M>);
      return;
    }
    this.emit({
      kind: "request",
      id: this.nextRequestId(),
      method,
      params: (params ?? {}) as CodexRequestParams<M>,
      timestampMs: Date.now()
    } as Extract<CodexProtocolTraffic, { kind: "request" }>);
  }

  onTraffic(listener: (traffic: CodexProtocolTraffic) => void): () => void {
    this.trafficListeners.add(listener);
    return () => this.trafficListeners.delete(listener);
  }

  onDiagnostic(listener: (text: string) => void): () => void {
    this.diagnosticListeners.add(listener);
    return () => this.diagnosticListeners.delete(listener);
  }

  close(): void {
    this.closed = true;
    this.trafficListeners.clear();
    this.diagnosticListeners.clear();
  }

  status(): FixturePlaybackStatus {
    return {
      fixtureId: this.definition.id,
      label: this.definition.label,
      mode: this.mode,
      isRunning: this.isRunning,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps(),
      delayMs: this.delayMs
    };
  }

  setDelayMs(delayMs: number): FixturePlaybackStatus {
    this.delayMs = normalizeDelayMs(delayMs);
    return this.emitStatus();
  }

  async play(mode = this.definition.defaultMode): Promise<FixturePlaybackStatus> {
    this.mode = mode;
    if (this.isRunning) {
      return this.status();
    }

    this.isRunning = true;
    this.emitStatus();
    let errorMessage: string | undefined;
    try {
      if (this.mode === "loaded" || this.liveFrames.length === 0) {
        await this.playLoaded();
      } else {
        await this.playLive();
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      this.isRunning = false;
    }
    return this.emitStatus(errorMessage);
  }

  reset(): FixturePlaybackStatus {
    this.isRunning = false;
    this.mode = this.definition.defaultMode;
    this.currentStep = 0;
    this.revealedActionIndex = -1;
    this.emitThreadArchived();
    this.emitEmptyThreadList();
    return this.emitStatus();
  }

  seek(step: number): FixturePlaybackStatus {
    const targetStep = Math.min(Math.max(0, Math.round(step)), this.totalSteps());
    this.reset();
    if (targetStep === 0) {
      return this.status();
    }

    if (this.mode === "loaded" || this.liveFrames.length === 0) {
      this.revealAll();
      this.emitLoadedTraffic();
      this.currentStep = this.totalSteps();
      return this.emitStatus();
    }

    for (const frame of this.liveFrames.slice(0, targetStep)) {
      this.emit(shiftTrafficTime(frame.traffic, this.timestampOffsetMs));
      this.currentStep += 1;
      if (frame.actionEndStep <= this.currentStep) {
        this.revealedActionIndex = Math.max(this.revealedActionIndex, frame.actionIndex);
      }
    }
    return this.emitStatus();
  }

  private async playLive(): Promise<void> {
    const frames = this.liveFrames;
    for (let index = this.currentStep; index < frames.length; index += 1) {
      if (!this.isRunning) {
        return;
      }
      if (index > this.currentStep || this.currentStep > 0) {
        await delay(this.delayMs);
      }
      const frame = frames[index]!;
      this.emit(shiftTrafficTime(frame.traffic, this.timestampOffsetMs));
      this.currentStep = index + 1;
      if (frame.actionEndStep <= this.currentStep) {
        this.revealedActionIndex = Math.max(this.revealedActionIndex, frame.actionIndex);
      }
      this.emitStatus();
    }
  }

  private async playLoaded(): Promise<void> {
    this.revealAll();
    this.currentStep = 0;
    for (const emitStep of this.loadedSteps()) {
      if (!this.isRunning) {
        return;
      }
      await delay(this.currentStep === 0 ? 0 : this.delayMs);
      emitStep();
      this.currentStep += 1;
      this.emitStatus();
    }
  }

  private loadedSteps(): Array<() => void> {
    return [
      () => this.emitSyntheticRequest("thread/list", { limit: 100, cwd: null }),
      () => this.emitSyntheticResponseOnly("thread/list", { data: [this.syntheticThread()], nextCursor: null, backwardsCursor: null }),
      () => this.emitSyntheticRequest("thread/read", { threadId: activeThreadId(this.definition.fixture), includeTurns: true }),
      () => this.emitSyntheticResponseOnly("thread/read", { thread: this.syntheticThread() }),
      () => this.emitSyntheticRequest("fs/readFile", { path: this.syntheticThread().path }),
      () => this.emitSyntheticResponseOnly("fs/readFile", { dataText: jsonlFromRecords(this.visibleSessionRecords()) })
    ];
  }

  private emitLoadedTraffic(): void {
    for (const emitStep of this.loadedSteps()) {
      emitStep();
    }
  }

  private totalSteps(): number {
    return this.mode === "loaded" || this.liveFrames.length === 0
      ? this.loadedSteps().length
      : Math.max(1, this.liveFrames.length);
  }

  private revealAll(): void {
    this.revealedActionIndex = this.definition.fixture.actions.length - 1;
  }

  private hasVisibleThread(): boolean {
    return this.revealedActionIndex >= 0 || this.currentStep > 0;
  }

  private visibleSessionRecords(): CodexRolloutEntry[] {
    if (this.mode === "live" && this.isRunning) {
      return [];
    }
    if (this.revealedActionIndex < 0) {
      return [];
    }
    return this.definition.fixture.actions
      .slice(0, this.revealedActionIndex + 1)
      .flatMap((action) => action.sessionRecords);
  }

  private syntheticThread(options: { includeTurns?: boolean } = {}) {
    const records = this.visibleSessionRecords();
    const turns = [...parseRolloutJsonlThreadTurns(jsonlFromRecords(records)).values()];
    const fixture = this.definition.fixture;
    const startedAtMs = fixture.actions.find((action) => typeof action.startedAtMs === "number")?.startedAtMs ?? fixture.metadata.capturedAtMs;
    const completedAtMs = [...fixture.actions].reverse().find((action) => typeof action.completedAtMs === "number")?.completedAtMs ?? fixture.metadata.capturedAtMs;
    const preview = firstUserMessagePreview(turns) ?? this.definition.label;
    return {
      id: activeThreadId(fixture),
      sessionId: activeThreadId(fixture),
      forkedFromId: null,
      name: this.definition.label,
      preview,
      ephemeral: false,
      modelProvider: "openai",
      cwd: defaultCwd(fixture),
      path: `fixture://${this.definition.id}/${activeThreadId(fixture)}.jsonl`,
      createdAt: Math.round(startedAtMs / 1000),
      updatedAt: Math.round(completedAtMs / 1000),
      status: { type: "idle" as const },
      cliVersion: fixture.metadata.codexVersion,
      source: "appServer" as const,
      threadSource: "user" as const,
      agentNickname: null,
      agentRole: null,
      gitInfo: null,
      turns: options.includeTurns ? turns : []
    };
  }

  private emitThreadArchived(): void {
    this.emit({
      kind: "event",
      event: {
        method: "thread/archived",
        params: { threadId: activeThreadId(this.definition.fixture) }
      },
      timestampMs: Date.now()
    });
  }

  private emitEmptyThreadList(): void {
    const id = this.nextRequestId();
    this.emit({
      kind: "request",
      id,
      method: "thread/list",
      params: { limit: 100, cwd: null },
      timestampMs: Date.now()
    } as Extract<CodexProtocolTraffic, { kind: "request" }>);
    this.emit({
      kind: "response",
      id,
      method: "thread/list",
      response: { data: [] },
      timestampMs: Date.now()
    } as Extract<CodexProtocolTraffic, { kind: "response" }>);
  }

  private emitSyntheticRequest<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options: CodexTransportRequestOptions = {}
  ): string {
    const id = this.nextRequestId();
    const ids = this.pendingSyntheticResponseIdsByMethod.get(method) ?? [];
    ids.push(id);
    this.pendingSyntheticResponseIdsByMethod.set(method, ids);
    this.emit({
      kind: "request",
      id,
      method,
      metadata: options.metadata,
      params,
      timestampMs: Date.now()
    } as Extract<CodexProtocolTraffic, { kind: "request" }>);
    return id;
  }

  private emitSyntheticResponseOnly<M extends CodexRequestMethod>(method: M, response: CodexProtocolResponse<M>): void {
    const ids = this.pendingSyntheticResponseIdsByMethod.get(method) ?? [];
    const id = ids.shift() ?? this.nextRequestId();
    this.pendingSyntheticResponseIdsByMethod.set(method, ids);
    this.emit({
      kind: "response",
      id,
      method,
      response,
      timestampMs: Date.now()
    } as Extract<CodexProtocolTraffic, { kind: "response" }>);
  }

  private async emitSyntheticResponse<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    response: CodexProtocolResponse<M>,
    options: CodexTransportRequestOptions = {}
  ): Promise<CodexProtocolResponse<M>> {
    const id = this.emitSyntheticRequest(method, params, options);
    this.forgetPendingSyntheticResponseId(method, id);
    this.emit({
      kind: "response",
      id,
      method,
      metadata: options.metadata,
      response,
      timestampMs: Date.now()
    } as Extract<CodexProtocolTraffic, { kind: "response" }>);
    return response;
  }

  private forgetPendingSyntheticResponseId(method: string, id: string): void {
    const ids = this.pendingSyntheticResponseIdsByMethod.get(method) ?? [];
    this.pendingSyntheticResponseIdsByMethod.set(method, ids.filter((candidate) => candidate !== id));
  }

  private emit(traffic: CodexProtocolTraffic): void {
    for (const listener of this.trafficListeners) {
      listener(traffic);
    }
    if (traffic.kind === "diagnostic") {
      for (const listener of this.diagnosticListeners) {
        listener(traffic.text);
      }
    }
  }

  private emitStatus(error?: string): FixturePlaybackStatus {
    const status = { ...this.status(), error };
    this.options.onStatus?.(status);
    return status;
  }

  private nextRequestId(): string {
    this.requestId += 1;
    return `fixture:${this.definition.id}:${this.requestId}`;
  }
}

function liveFrames(fixture: CodexScenarioFixture): PlayFrame[] {
  const frames: PlayFrame[] = [];
  for (const [actionIndex, action] of fixture.actions.entries()) {
    if (action.intent !== "sendMessage" && action.intent !== "listThreads") {
      continue;
    }
    const actionEndStep = frames.length + action.traffic.length;
    for (const traffic of action.traffic) {
      frames.push({ actionIndex, actionEndStep, traffic });
    }
  }
  return frames;
}

function activeThreadId(fixture: CodexScenarioFixture): string {
  return fixture.metadata.activeThreadId ?? `fixture-${fixture.metadata.id}`;
}

function defaultCwd(fixture: CodexScenarioFixture): string {
  for (const call of fixture.actions.flatMap((action: CodexScenarioAction) => action.calls)) {
    const response = call.response;
    if (response && typeof response === "object" && "thread" in response) {
      const thread = response.thread;
      if (thread && typeof thread === "object" && "cwd" in thread && typeof thread.cwd === "string") {
        return thread.cwd;
      }
    }
  }
  return "/tmp/codex-playback";
}

function firstUserMessagePreview(turns: CodexParsedTurn[]): string | undefined {
  for (const turn of turns) {
    const user = turn.items.find((item) => item.type === "userMessage");
    if (user && "content" in user) {
      const text = user.content.flatMap((entry) => entry.type === "text" ? [entry.text] : []).join(" ").trim();
      if (text) {
        return text;
      }
    }
  }
  return undefined;
}

function jsonlFromRecords(records: readonly unknown[]): string {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

function scenarioStartMs(fixture: CodexScenarioFixture): number {
  const firstSendMessageTime = fixture.actions.find((action) => action.intent === "sendMessage")?.startedAtMs;
  if (typeof firstSendMessageTime === "number") {
    return firstSendMessageTime;
  }
  const firstTrafficTime = fixture.actions
    .flatMap((action) => action.traffic)
    .find((traffic) => typeof traffic.timestampMs === "number")?.timestampMs;
  return firstTrafficTime ?? fixture.metadata.capturedAtMs ?? Date.now();
}

function shiftTrafficTime<T extends CodexProtocolTraffic>(traffic: T, offsetMs: number): T {
  return shiftTimeValue(traffic, offsetMs) as T;
}

function shiftTimeValue(value: unknown, offsetMs: number, key?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => shiftTimeValue(item, offsetMs));
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "number" && key && millisecondTimeKeys.has(key)) {
      return value + offsetMs;
    }
    if (typeof value === "number" && key && secondTimeKeys.has(key)) {
      return value + offsetMs / 1000;
    }
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
    entryKey,
    shiftTimeValue(entryValue, offsetMs, entryKey)
  ]));
}

function normalizeDelayMs(value: number): number {
  return Number.isFinite(value) ? Math.min(1000, Math.max(0, Math.round(value))) : 80;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const millisecondTimeKeys = new Set(["timestampMs", "startedAtMs", "completedAtMs"]);
const secondTimeKeys = new Set(["startedAt", "completedAt", "createdAt", "updatedAt"]);
