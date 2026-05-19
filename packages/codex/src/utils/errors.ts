export class CodexNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexNotFoundError";
  }
}

export class CodexInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexInvariantError";
  }
}

export class CodexTransportError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "CodexTransportError";
  }
}
