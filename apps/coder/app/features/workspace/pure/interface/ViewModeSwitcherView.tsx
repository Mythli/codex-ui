import type { CoderShellViewMode } from "@coder/types";
import styles from "@app/common/pure/codex.module.css";

export function ViewModeSwitcherView({
  mode,
  onChange
}: {
  mode: CoderShellViewMode;
  onChange?: (mode: CoderShellViewMode) => void;
}) {
  return (
    <div aria-label="View mode" className={styles.layoutOptions}>
      {(["chat", "both", "preview"] as const).map((option) => (
        <button
          aria-pressed={mode === option}
          className={[styles.iconButton, mode === option ? styles.rowActive : ""].filter(Boolean).join(" ")}
          key={option}
          onClick={() => onChange?.(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
