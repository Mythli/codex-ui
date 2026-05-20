const appSessionStorageKey = "taylordb:coder:app-session-id";

let memorySessionId: string | undefined;

export function getAppSessionId(): string {
  if (memorySessionId) {
    return memorySessionId;
  }

  if (typeof window === "undefined") {
    memorySessionId = createSessionId();
    return memorySessionId;
  }

  const stored = window.sessionStorage.getItem(appSessionStorageKey);
  if (stored) {
    memorySessionId = stored;
    return stored;
  }

  memorySessionId = createSessionId();
  window.sessionStorage.setItem(appSessionStorageKey, memorySessionId);
  return memorySessionId;
}

export function getAppSocketAuth(): Record<string, string> {
  return {
    appSessionId: getAppSessionId()
  };
}

function createSessionId(): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) {
    return random;
  }
  return `app-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
