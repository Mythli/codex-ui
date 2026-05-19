import type { CodexViewMode } from "../types";
import styles from "../codex.module.css";

export function ViewModeSwitcherView({
  mode,
  onChange
}: {
  mode: CodexViewMode;
  onChange?: (mode: CodexViewMode) => void;
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
