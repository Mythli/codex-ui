import { ReactNode } from 'react';
import styles from "./PageIntro.module.css";

export interface PageIntroProps {
  children: ReactNode;
  className?: string;
}

export function PageIntro({ children, className = '' }: PageIntroProps) {
  return (
    <header className={`${styles.intro} ${className}`}>
      {children}
    </header>
  );
}

PageIntro.Title = function PageIntroTitle({ children }: { children: ReactNode }) {
  return <h1 className={styles.title}>{children}</h1>;
};

PageIntro.Description = function PageIntroDescription({ children }: { children: ReactNode }) {
  return <div className={styles.description}>{children}</div>;
};
