import styles from "../codex.module.css";

export function LayoutModeOptionsView({
  mode,
  onChange
}: {
  mode: "list" | "grid";
  onChange?: (mode: "list" | "grid") => void;
}) {
  return (
    <div aria-label="Layout mode" className={styles.layoutOptions}>
      {(["list", "grid"] as const).map((option) => (
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
