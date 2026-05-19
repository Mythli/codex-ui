import { ReactNode } from 'react';
import { ErrorBoundary } from "../../../common/ErrorBoundary/ErrorBoundary";
import styles from "./PageShell.module.css";

/**
 * The main content container that sits inside the AppLayout.
 * Provides a sticky header and a document-scrolling content area constrained to a max-width.
 */
export interface PageShellProps {
  /** The header component, usually a composed `<Header />` */
  header: ReactNode;
  /** The main content of the page (usually a `<Stack />` of sections) */
  children: ReactNode;
  /** Optional footer component (e.g., `<PageFooterNav />`) */
  footer?: ReactNode;
  /** Optional extra class name for the shell container */
  className?: string;
}

export function PageShell({ header, children, footer, className = '' }: PageShellProps) {
  return (
    <div className={`${styles.shell} ${className}`}>
      <div className={styles.headerWrapper}>
        {header}
      </div>
      <div className={styles.content}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        {footer}
      </div>
    </div>
  );
}
