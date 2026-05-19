import type { CSSProperties } from "react";
import { FiChevronDown, FiShield, FiZap } from "react-icons/fi";
import { MenuItem, MenuList, Popover } from "../../../common";
import type {
  CoderContextUsage,
  CoderModelItem,
  CoderPermissionMode,
  CoderReasoningEffort
} from "../../CoderCore/types";
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
  models: CoderModelItem[];
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
              label={getDisplayModelLabel(model.label)}
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

export function ContextUsagePopover({ contextUsage }: { contextUsage?: CoderContextUsage }) {
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
