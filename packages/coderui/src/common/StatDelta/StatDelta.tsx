import styles from "./StatDelta.module.css";

export function StatDelta({
  additions,
  deletions
}: {
  additions?: number;
  deletions?: number;
}) {
  return (
    <span className={styles.delta} aria-label="Changed lines">
      <span className={styles.add}>+{additions ?? 0}</span>
      <span className={styles.remove}>-{deletions ?? 0}</span>
    </span>
  );
}
