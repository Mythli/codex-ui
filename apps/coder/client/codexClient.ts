import type {
  CodexProtocolMetadata,
  CodexProtocolResponse,
  CodexRequestMethod,
  CodexRequestParams
} from "@coder/types";
import {
  parseCodexProtocolErrorResponseTraffic,
  parseCodexProtocolRequestTraffic,
  parseCodexProtocolResponseTraffic
} from "@coder/protocol";
import { codexTrafficReceived } from "@app/features/connection/state/codexTrafficActions";
import { getCodexTransport } from "./codexTransport";

let clientRequestSequence = 0;

type CodexTrafficDispatch = (action: ReturnType<typeof codexTrafficReceived>) => unknown;

export type CodexClientRequestOptions = {
  alreadyDispatched?: boolean;
  metadata?: CodexProtocolMetadata;
  prefix?: string;
  targetThreadId?: string;
};

export async function requestCodex<M extends CodexRequestMethod>(
  dispatch: CodexTrafficDispatch,
  method: M,
  params: CodexRequestParams<M>,
  options: CodexClientRequestOptions = {}
): Promise<CodexProtocolResponse<M>> {
  const clientRequestId = options.metadata?.clientRequestId ?? nextClientRequestId(options.prefix);
  const metadata: CodexProtocolMetadata = {
    ...options.metadata,
    clientRequestId,
    ...(options.targetThreadId ? { targetThreadId: options.targetThreadId } : undefined)
  };
  if (!options.alreadyDispatched) {
    dispatch(codexTrafficReceived(parseCodexProtocolRequestTraffic(method, params, {
      id: clientRequestId,
      metadata,
      timestampMs: Date.now()
    })));
  }

  try {
    const response = await getCodexTransport().request(method, params, { metadata });
    dispatch(codexTrafficReceived(parseCodexProtocolResponseTraffic(method, response, {
      id: clientRequestId,
      metadata,
      timestampMs: Date.now()
    })));
    return response;
  } catch (error) {
    dispatch(codexTrafficReceived(parseCodexProtocolErrorResponseTraffic(method, serializeRequestError(error), {
      id: clientRequestId,
      metadata,
      timestampMs: Date.now()
    })));
    throw error;
  }
}

export async function notifyCodex<M extends CodexRequestMethod>(
  method: M,
  params?: CodexRequestParams<M>
): Promise<void> {
  await getCodexTransport().notify(method, params);
}

export function closeCodexSession(): void {
  getCodexTransport().close();
}

function nextClientRequestId(prefix = "request"): string {
  clientRequestSequence += 1;
  return `client:${prefix}:${clientRequestSequence}`;
}

function serializeRequestError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}
