import { FiChevronRight } from "react-icons/fi";
import styles from "../codex.module.css";

export function WorkDividerView({
  expanded,
  label,
  onToggle,
  timeLabel
}: {
  expanded: boolean;
  label: string;
  onToggle?: () => void;
  timeLabel?: string;
}) {
  return (
    <button aria-expanded={expanded} className={styles.workDivider} onClick={onToggle} type="button">
      <FiChevronRight aria-hidden="true" />
      <span>{label}{timeLabel ? ` for ${timeLabel}` : ""}</span>
    </button>
  );
}
