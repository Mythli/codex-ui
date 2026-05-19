import styles from "./Spinner.module.css";

export function Spinner() {
  return <span aria-label="Loading" className={styles.spinner} role="status" />;
}
