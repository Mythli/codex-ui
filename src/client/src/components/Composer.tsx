import { FiPlus, FiSend, FiSquare } from "react-icons/fi";
import type { ModelSummary } from "../types";

export function Composer({
  prompt,
  sandbox,
  models,
  selectedModel,
  reasoningEffort,
  disabled,
  streaming,
  onPromptChange,
  onSandboxChange,
  onModelChange,
  onReasoningEffortChange,
  onStop,
  onSubmit
}: {
  prompt: string;
  sandbox: string;
  models: ModelSummary[];
  selectedModel: string;
  reasoningEffort: string;
  disabled: boolean;
  streaming: boolean;
  onPromptChange: (prompt: string) => void;
  onSandboxChange: (sandbox: string) => void;
  onModelChange: (model: string) => void;
  onReasoningEffortChange: (effort: string) => void;
  onStop: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={disabled ? "Select a project to start a chat" : "Message Codex"}
        rows={3}
        disabled={disabled}
      />
      <div className="composerBar">
        <button className="plusButton" type="button" title="Add context">
          <FiPlus />
        </button>
        <select value={sandbox} onChange={(event) => onSandboxChange(event.target.value)}>
          <option value="read-only">Read only</option>
          <option value="workspace-write">Workspace write</option>
          <option value="danger-full-access">Full access</option>
        </select>
        <span className="spacer" />
        <select value={selectedModel} onChange={(event) => onModelChange(event.target.value)}>
          {models.length === 0 ? (
            <option value={selectedModel}>{selectedModel || "gpt-5.5"}</option>
          ) : (
            models.map((model) => (
              <option key={model.id} value={model.model}>
                {model.displayName}
              </option>
            ))
          )}
        </select>
        <select value={reasoningEffort} onChange={(event) => onReasoningEffortChange(event.target.value)}>
          {["low", "medium", "high", "xhigh"].map((effort) => (
            <option key={effort} value={effort}>
              {capitalize(effort)}
            </option>
          ))}
        </select>
        <button className="stopButton" type="button" onClick={onStop} disabled={!streaming} title="Stop">
          <FiSquare />
        </button>
        <button className="sendButton" type="submit" disabled={streaming || !prompt.trim() || disabled}>
          <FiSend />
        </button>
      </div>
    </form>
  );
}

function capitalize(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
