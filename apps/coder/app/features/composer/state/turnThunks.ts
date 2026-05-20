import { parseCodexProtocolRequestTraffic } from "@coder/protocol";
import type {
  CodexProtocolMetadata,
  CodexAppServerUserInput,
  CodexRequestParams
} from "@coder/types";
import { parseCodexMessageInput } from "@app/features/composer/state/messageInput";
import { requestCodex } from "@coder/client";
import { DEFAULT_CODEX_CWD } from "@coder/client";
import {
  permissionModeToRequestOverrides
} from "./composerState";
import type { CoderComposerAttachment } from "@coder/types";
import type { AppThunk } from "../../../store/configureStore";
import { attachmentsCleared, composerPromptCleared } from "./composerSlice";
import { codexTrafficReceived } from "../../connection/state/codexTrafficActions";
import { threadUnreadCleared } from "@app/features/threads/state/threadListMetaSlice";
import { createProvisionalThread, promoteProvisionalThread } from "@app/features/thread/state/loadedThreadsSlice";
import type { CoderSubmitPromptResult } from "@coder/types";

type MessageInput = string | CodexAppServerUserInput[];
let provisionalThreadSequence = 0;
let optimisticTurnSequence = 0;

export function submitPrompt(): AppThunk<Promise<CoderSubmitPromptResult>> {
  return async (dispatch, getState) => {
    const state = getState();
    const composer = state.composer;
    const selection = state.selection.current;
    const message = composer.prompt.trim();
    const attachments = composer.attachments;
    if (!message && attachments.length === 0) {
      return undefined;
    }

    if (selection.kind === "thread" && state.threads.byId[selection.threadId]?.status === "running") {
      return undefined;
    }

    dispatch(composerPromptCleared());
    const input = promptInput(message, attachments);
    const permissionOverrides = permissionModeToRequestOverrides(composer.selectedPermissionMode);
    const sandbox = permissionOverrides.sandbox ?? "read-only";
    const approvalPolicy = permissionOverrides.approvalPolicy ?? "never";

    if (selection.kind === "draft") {
      const cwd = selection.projectId;
      const provisionalThreadId = `local-thread:${++provisionalThreadSequence}`;
      const provisionalRequestId = `client:turn:provisional:${provisionalThreadSequence}`;
      dispatch(createProvisionalThread({ threadId: provisionalThreadId, cwd }));
      const provisionalTurnParams = turnStartParams({
        approvalPolicy,
        cwd,
        input,
        model: composer.selectedModel,
        reasoningEffort: composer.selectedReasoningEffort,
        sandbox,
        threadId: provisionalThreadId
      });
      dispatchOptimisticTurnStart(dispatch, provisionalTurnParams, {
        clientRequestId: provisionalRequestId,
        provisionalThreadId
      });
      dispatch(attachmentsCleared());
      const startResponse = await requestCodex(dispatch, "thread/start", {
        cwd,
        model: composer.selectedModel,
        modelProvider: null,
        approvalPolicy,
        sandbox,
        ephemeral: false,
        persistExtendedHistory: true
      }, { prefix: "thread-start" });
      const threadId = startResponse.thread.id;
      dispatch(promoteProvisionalThread({ provisionalThreadId, threadId }));
      const turnRequest = requestCodex(dispatch, "turn/start", turnStartParams({
        approvalPolicy,
        cwd,
        input,
        model: composer.selectedModel,
        reasoningEffort: composer.selectedReasoningEffort,
        sandbox,
        threadId
      }), {
        metadata: {
          clientRequestId: provisionalRequestId,
          provisionalThreadId
        },
        alreadyDispatched: true,
        targetThreadId: threadId,
        prefix: "turn"
      });
      void turnRequest.catch(() => undefined);
      return { createdThreadId: threadId };
    }

    if (selection.kind !== "thread") {
      return undefined;
    }

    const thread = state.threads.byId[selection.threadId];
    const cwd = thread?.cwd ?? selection.projectId ?? DEFAULT_CODEX_CWD;
    const existingTurnParams = turnStartParams({
      approvalPolicy,
      cwd,
      input,
      model: composer.selectedModel,
      reasoningEffort: composer.selectedReasoningEffort,
      sandbox,
      threadId: selection.threadId
    });
    const optimisticRequestId = `client:turn:optimistic:${++optimisticTurnSequence}`;
    dispatch(threadUnreadCleared(selection.threadId));
    dispatchOptimisticTurnStart(dispatch, existingTurnParams, {
      clientRequestId: optimisticRequestId,
      targetThreadId: selection.threadId
    });
    dispatch(attachmentsCleared());
    void (async () => {
      await requestCodex(dispatch, "thread/resume", {
      threadId: selection.threadId,
      cwd,
      model: composer.selectedModel,
      modelProvider: null,
      approvalPolicy,
      sandbox,
      persistExtendedHistory: true
      }, { targetThreadId: selection.threadId, prefix: "thread-resume" }).catch(() => undefined);
      await requestCodex(dispatch, "turn/start", existingTurnParams, {
        alreadyDispatched: true,
      metadata: { clientRequestId: optimisticRequestId },
      targetThreadId: selection.threadId,
      prefix: "turn"
      });
    })().catch(() => undefined);
    return undefined;
  };
}

function dispatchOptimisticTurnStart(
  dispatch: (action: ReturnType<typeof codexTrafficReceived>) => unknown,
  params: CodexRequestParams<"turn/start">,
  metadata: CodexProtocolMetadata
): void {
  dispatch(codexTrafficReceived(parseCodexProtocolRequestTraffic("turn/start", params, {
    id: metadata.clientRequestId ?? `client:turn:optimistic:${++optimisticTurnSequence}`,
    metadata,
    timestampMs: Date.now()
  })));
}

function promptInput(message: string, attachments: readonly CoderComposerAttachment[]): MessageInput {
  if (attachments.length === 0) {
    return message;
  }
  const attachmentText = attachmentReferenceText(attachments);
  return [
    ...(message ? [{ type: "text" as const, text: message, text_elements: [] }] : []),
    ...(attachmentText ? [{ type: "text" as const, text: attachmentText, text_elements: [] }] : []),
    ...attachments.flatMap((attachment) => attachment.input ? [attachment.input] : [])
  ];
}

function turnStartParams(input: {
  approvalPolicy: "untrusted" | "on-request" | "never";
  cwd: string;
  input: MessageInput;
  model: string;
  reasoningEffort: CodexRequestParams<"turn/start">["effort"];
  sandbox: "read-only" | "workspace-write" | "danger-full-access";
  threadId: string;
}): CodexRequestParams<"turn/start"> {
  return {
    threadId: input.threadId,
    input: parseCodexMessageInput(input.input),
    cwd: input.cwd,
    approvalPolicy: input.approvalPolicy,
    sandboxPolicy: toSandboxPolicy(input.sandbox, input.cwd),
    model: input.model,
    effort: input.reasoningEffort
  };
}

function toSandboxPolicy(
  sandbox: "read-only" | "workspace-write" | "danger-full-access",
  cwd: string
): CodexRequestParams<"turn/start">["sandboxPolicy"] {
  if (sandbox === "danger-full-access") {
    return { type: "dangerFullAccess" };
  }
  if (sandbox === "workspace-write") {
    return {
      type: "workspaceWrite",
      writableRoots: [cwd],
      networkAccess: false,
      excludeTmpdirEnvVar: false,
      excludeSlashTmp: false
    };
  }
  return { type: "readOnly", networkAccess: false };
}

function attachmentReferenceText(attachments: readonly CoderComposerAttachment[]): string {
  const fileAttachments = attachments.filter((attachment) => attachment.kind === "file");
  if (fileAttachments.length === 0) {
    return "";
  }
  return fileAttachments.map((attachment) => {
    const mimeType = attachment.mimeType || "application/octet-stream";
    return `Attached file: ${attachment.name} (${mimeType}, ${formatAttachmentSize(attachment.size)}) at ${attachment.path}. Inspect it if relevant.`;
  }).join("\n");
}

function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown size";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  for (const unit of units) {
    if (value < 1024 || unit === units.at(-1)) {
      return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${bytes} B`;
}
