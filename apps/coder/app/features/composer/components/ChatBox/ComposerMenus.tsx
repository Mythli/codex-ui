import type {
  CSSProperties } from "react";
import { FiChevronDown,
  FiShield,
  FiZap } from "react-icons/fi";
import { MenuItem,
  MenuList,
  Popover } from "@app/common/pure";
import type { CodexThreadTokenUsage } from "@coder/types";
import type { CodexAppServerModel } from "@coder/types";
import type {
  CoderPermissionMode,
  CoderReasoningEffort
} from "@coder/types";
import styles from "./CodexChatBox.module.css";

export function permissionModeLabel(mode: CoderPermissionMode) {
  if (mode === "auto-review") {
    return "Auto-review";
  }
  if (mode === "full-access") {
    return "Full access";
  }
  return "Default permissions";
}

export function getDisplayModelLabel(label: string) {
  return label
    .replace(/^OpenAI:\s*/i, "")
    .replace(/^GPT-/i, "")
    .replace(/^gpt-/i, "");
}

export function getDisplayReasoningLabel(value: CoderReasoningEffort) {
  return value === "xhigh"
    ? "XHigh"
    : value.charAt(0).toUpperCase() + value.slice(1);
}

export function PermissionPopover({
  onSelectPermissionMode,
  selectedPermissionMode
}: {
  onSelectPermissionMode?: (value: CoderPermissionMode) => void;
  selectedPermissionMode: CoderPermissionMode;
}) {
  const label = permissionModeLabel(selectedPermissionMode);
  const options: CoderPermissionMode[] = ["default", "auto-review", "full-access"];
  return (
    <Popover
      placement="top"
      renderTrigger={({ ref, props }) => (
        <button {...props} ref={ref} aria-label={`Access mode: ${label}`} className={styles.accessButton} data-testid="access-mode-button" type="button">
          <FiShield aria-hidden="true" />
          <span>{label}</span>
          <FiChevronDown aria-hidden="true" className={styles.chevron} />
        </button>
      )}
    >
      {({ close }) => (
        <MenuList data-testid="permission-popover" label="Permissions">
          {options.map((option) => (
            <MenuItem
              data-testid={`permission-option-${option}`}
              key={option}
              label={permissionModeLabel(option)}
              leadingIcon={<FiShield aria-hidden="true" />}
              onSelect={() => {
                onSelectPermissionMode?.(option);
                close();
              }}
              selected={option === selectedPermissionMode}
            />
          ))}
        </MenuList>
      )}
    </Popover>
  );
}

export function ModelPopover({
  modelLabel,
  models,
  onSelectModel,
  selectedModel
}: {
  modelLabel: string;
  models: CodexAppServerModel[];
  onSelectModel: (id: string) => void;
  selectedModel: string;
}) {
  return (
    <Popover
      placement="top"
      renderTrigger={({ ref, props }) => (
        <button {...props} ref={ref} aria-label={`Model: ${modelLabel}`} className={styles.modelControl} data-testid="model-control" type="button">
          <FiZap aria-hidden="true" />
          <span>{modelLabel}</span>
          <FiChevronDown aria-hidden="true" className={styles.chevron} />
        </button>
      )}
    >
      {({ close }) => (
        <MenuList data-testid="model-popover" label="Model">
          {models.map((model) => (
            <MenuItem
              data-testid={`model-option-${model.id}`}
              key={model.id}
              label={getDisplayModelLabel(model.displayName)}
              onSelect={() => {
                onSelectModel(model.id);
                close();
              }}
              selected={model.id === selectedModel}
            />
          ))}
        </MenuList>
      )}
    </Popover>
  );
}

export function ReasoningPopover({
  onOpen,
  onSelectReasoningEffort,
  reasoningEfforts,
  reasoningLabel,
  selectedReasoningEffort
}: {
  onOpen?: () => void;
  onSelectReasoningEffort: (value: CoderReasoningEffort) => void;
  reasoningEfforts: CoderReasoningEffort[];
  reasoningLabel: string;
  selectedReasoningEffort: CoderReasoningEffort;
}) {
  return (
    <Popover
      placement="top"
      renderTrigger={({ ref, props }) => (
        <button
          {...props}
          ref={ref}
          aria-label={`Reasoning effort: ${reasoningLabel}`}
          className={styles.reasoningButton}
          data-testid="reasoning-control"
          onClick={(event) => {
            onOpen?.();
            const onClick = props.onClick;
            if (typeof onClick === "function") {
              onClick(event);
            }
          }}
          type="button"
        >
          <span>{reasoningLabel}</span>
          <FiChevronDown aria-hidden="true" className={styles.chevron} />
        </button>
      )}
    >
      {({ close }) => (
        <MenuList data-testid="reasoning-popover" label="Reasoning">
          {reasoningEfforts.map((effort) => (
            <MenuItem
              data-testid={`reasoning-option-${effort}`}
              key={effort}
              label={getDisplayReasoningLabel(effort)}
              onSelect={() => {
                onSelectReasoningEffort(effort);
                close();
              }}
              selected={effort === selectedReasoningEffort}
            />
          ))}
        </MenuList>
      )}
    </Popover>
  );
}

export function ContextUsagePopover({ tokenUsage }: { tokenUsage?: CodexThreadTokenUsage }) {
  const contextUsage = formatTokenUsageMetrics(tokenUsage);
  const ringStyle = {
    "--context-used-degrees": `${contextUsage?.ringDegrees ?? 0}deg`
  } as CSSProperties;
  return (
    <Popover
      placement="top"
      renderTrigger={({ ref, props }) => (
        <button {...props} ref={ref} aria-label="Context window usage" className={styles.contextButton} data-testid="context-usage-button" type="button">
          <span className={styles.contextRing} aria-hidden="true" style={ringStyle} />
        </button>
      )}
    >
      <div className={styles.contextPanel} data-testid="context-usage-popover">
        <p className={styles.contextEyebrow}>Context window:</p>
        <p className={styles.contextPrimary}>
          {contextUsage ? `${contextUsage.usedPercent}% used (${contextUsage.remainingPercent}% left)` : "-"}
        </p>
        <p className={styles.contextPrimary}>
          {contextUsage ? `${contextUsage.activeTokensLabel} / ${contextUsage.contextWindowLabel} active context tokens` : "-"}
        </p>
        {contextUsage ? <p className={styles.contextNote}>{contextUsage.cumulativeTokensLabel} cumulative thread tokens</p> : null}
        <p className={styles.contextNote}>Codex automatically compacts its context</p>
      </div>
    </Popover>
  );
}

function formatTokenUsageMetrics(input: CodexThreadTokenUsage | undefined) {
  const cumulativeTokens = input?.total?.totalTokens;
  const lastTokens = input?.last?.totalTokens;
  const activeInputTokens = input?.last?.inputTokens;
  const contextWindow = input?.modelContextWindow;
  if (
    typeof cumulativeTokens !== "number" ||
    typeof lastTokens !== "number" ||
    typeof activeInputTokens !== "number" ||
    typeof contextWindow !== "number" ||
    contextWindow <= 0
  ) {
    return undefined;
  }
  const activeTokens = Math.min(activeInputTokens, contextWindow);
  const usedPercent = Math.min(100, Math.max(0, Math.round((activeTokens / contextWindow) * 100)));
  return {
    activeTokens,
    cumulativeTokens,
    contextWindow,
    usedPercent,
    remainingPercent: Math.max(0, 100 - usedPercent),
    activeTokensLabel: formatCompactNumber(activeTokens),
    cumulativeTokensLabel: formatCompactNumber(cumulativeTokens),
    contextWindowLabel: formatCompactNumber(contextWindow),
    ringDegrees: usedPercent * 3.6
  };
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}m`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return String(value);
}
