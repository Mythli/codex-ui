import styles from "./StatDelta.module.css";

export function StatDelta({
  additions,
  deletions
}: {
  additions?: number;
  deletions?: number;
}) {
  const additionCount = additions ?? 0;
  const deletionCount = deletions ?? 0;
  return (
    <span className={styles.delta} aria-label={`Changed lines: +${additionCount} -${deletionCount}`}>
      <span className={styles.add}>+{additionCount}</span>
      <span className={styles.remove}>-{deletionCount}</span>
    </span>
  );
}
