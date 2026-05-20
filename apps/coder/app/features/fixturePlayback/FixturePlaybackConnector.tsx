import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getAppSocketAuth } from "../../core/appSession";

type FixturePlaybackMode = "live" | "loaded";

type FixturePlaybackOption = {
  id: string;
  label: string;
  defaultMode: FixturePlaybackMode;
};

type FixturePlaybackStatus = {
  fixtureId?: string;
  label?: string;
  mode?: FixturePlaybackMode;
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
  delayMs: number;
  error?: string;
};

type FixtureControlResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error: FixtureControlError };

type FixtureControlError = { message?: string } | string;

const delayOptions = [
  { label: "Instant", value: 0 },
  { label: "Fast", value: 40 },
  { label: "Normal", value: 80 },
  { label: "Slow", value: 180 },
  { label: "Very slow", value: 400 }
];

export function FixturePlaybackConnector() {
  const [fixtureId, setFixtureId] = useState<string | undefined>();
  const socketRef = useRef<Socket | undefined>(undefined);
  const [options, setOptions] = useState<FixturePlaybackOption[]>([]);
  const [status, setStatus] = useState<FixturePlaybackStatus>(() => emptyStatus(fixtureId));

  useEffect(() => {
    const requested = requestedFixtureId();
    setFixtureId(requested);
    setStatus(emptyStatus(requested));
  }, []);

  useEffect(() => {
    if (!fixtureId) {
      return;
    }

    const socket = io("/fixture-control", {
      path: "/app-socket",
      auth: getAppSocketAuth()
    });
    socketRef.current = socket;
    socket.on("status", (nextStatus: FixturePlaybackStatus) => {
      setStatus(nextStatus);
    });

    void request<FixturePlaybackOption[]>(socket, "list").then(setOptions).catch(reportControlError);
    socket.on("connect", () => {
      void request<FixturePlaybackStatus>(socket, "select", { fixtureId })
        .then(setStatus)
        .catch(reportControlError);
    });

    return () => {
      socket.disconnect();
      socketRef.current = undefined;
    };
  }, [fixtureId]);

  if (!fixtureId) {
    return null;
  }

  const selectedFixtureId = status.fixtureId ?? fixtureId;
  const selectedOption = options.find((option) => option.id === selectedFixtureId);
  const progressMax = Math.max(1, status.totalSteps);
  const progressValue = Math.min(progressMax, Math.max(0, status.currentStep));

  const send = <T,>(method: string, params?: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket) {
      return Promise.reject(new Error("Fixture control socket is not connected"));
    }
    return request<T>(socket, method, params);
  };

  return (
    <div aria-label="Fixture playback controls" data-testid="fixture-playback-controls" style={controlStyle}>
      <label style={inlineControlStyle}>
        Fixture
        <select
          data-testid="fixture-playback-select"
          disabled={status.isRunning}
          onChange={(event) => {
            const nextFixtureId = event.currentTarget.value;
            replaceFixtureSearch(nextFixtureId);
            void send<FixturePlaybackStatus>("select", { fixtureId: nextFixtureId }).then(setStatus).catch(reportControlError);
          }}
          value={selectedFixtureId}
        >
          {(options.length > 0 ? options : [{ id: selectedFixtureId, label: selectedOption?.label ?? selectedFixtureId, defaultMode: "live" as const }]).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        data-testid="fixture-playback-play"
        disabled={status.isRunning}
        onClick={() => {
          void send<FixturePlaybackStatus>("play").then(setStatus).catch(reportControlError);
        }}
        type="button"
      >
        Play
      </button>
      <button
        data-testid="fixture-playback-load-thread"
        disabled={status.isRunning}
        onClick={() => {
          void send<FixturePlaybackStatus>("play", { mode: "loaded" }).then(setStatus).catch(reportControlError);
        }}
        type="button"
      >
        Load thread
      </button>
      <button
        data-testid="fixture-playback-reset"
        disabled={status.isRunning}
        onClick={() => {
          void send<FixturePlaybackStatus>("reset").then(setStatus).catch(reportControlError);
        }}
        type="button"
      >
        Reset
      </button>
      <label style={inlineControlStyle}>
        Step delay
        <select
          data-testid="fixture-playback-delay"
          onChange={(event) => {
            void send<FixturePlaybackStatus>("setDelay", { delayMs: Number(event.currentTarget.value) }).then(setStatus).catch(reportControlError);
          }}
          value={status.delayMs}
        >
          {delayOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ ...inlineControlStyle, minWidth: 260 }}>
        Progress
        <input
          aria-label="Fixture playback progress"
          data-testid="fixture-playback-progress"
          disabled={status.isRunning}
          max={progressMax}
          min={0}
          onChange={(event) => {
            void send<FixturePlaybackStatus>("seek", { step: Number(event.currentTarget.value) }).then(setStatus).catch(reportControlError);
          }}
          step={1}
          style={{ flex: 1 }}
          type="range"
          value={progressValue}
        />
        <span style={{ minWidth: 70 }}>
          {progressValue}/{progressMax}
        </span>
      </label>
      <span data-testid="fixture-playback-status" style={{ marginLeft: "auto" }}>
        {status.error ?? (status.isRunning ? "Playing" : status.label ?? selectedFixtureId)}
      </span>
    </div>
  );
}

function requestedFixtureId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const value = new URL(window.location.href).searchParams.get("fixture");
  if (!value || value === "true" || value === "1") {
    return value === null ? undefined : "standard-live";
  }
  return value;
}

function emptyStatus(fixtureId: string | undefined): FixturePlaybackStatus {
  return {
    fixtureId,
    isRunning: false,
    currentStep: 0,
    totalSteps: 1,
    delayMs: 80
  };
}

function request<T>(socket: Socket, method: string, params?: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    socket.emit("request", { method, params }, (response: FixtureControlResponse<T>) => {
      if (response.ok) {
        resolve(response.result);
        return;
      }
      reject(new Error(errorMessage(response.error)));
    });
  });
}

function errorMessage(error: FixtureControlError): string {
  if (typeof error === "string") {
    return error;
  }
  return error?.message ?? "Fixture control request failed";
}

function reportControlError(error: unknown): void {
  console.error(error);
}

function replaceFixtureSearch(fixtureId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("fixture", fixtureId);
  window.history.replaceState(window.history.state, "", url);
}

const controlStyle = {
  alignItems: "center",
  background: "color-mix(in srgb, var(--coder-bg) 92%, transparent)",
  border: "1px solid var(--coder-border)",
  borderRadius: 8,
  boxShadow: "0 8px 30px rgb(0 0 0 / 18%)",
  color: "var(--coder-text)",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  left: "auto",
  maxWidth: "min(520px, calc(100vw - 32px))",
  padding: "8px 10px",
  position: "fixed",
  right: 16,
  top: 72,
  zIndex: 50
} as const;

const inlineControlStyle = {
  alignItems: "center",
  display: "flex",
  gap: 6
} as const;
