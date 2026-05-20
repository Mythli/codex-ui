import styles from "./Spinner.module.css";

export function Spinner() {
  return <output aria-label="Loading" className={styles.spinner} />;
}
