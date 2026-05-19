import styles from "../codex.module.css";

export function SidebarHeaderView({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <header className={styles.splitRow}>
      <div>
        <div className={styles.sectionTitle}>{title}</div>
        {subtitle ? <div className={styles.muted}>{subtitle}</div> : null}
      </div>
    </header>
  );
}
