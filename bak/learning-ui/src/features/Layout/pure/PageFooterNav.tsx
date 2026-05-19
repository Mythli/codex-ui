import { ReactNode } from 'react';
import { Spinner } from '../../../common/Spinner/Spinner';
import styles from "./PageFooterNav.module.css";

export interface PageFooterNavProps {
  children: ReactNode;
}

export function PageFooterNav({ children }: PageFooterNavProps) {
  return (
    <div className={styles.footer}>
      {children}
    </div>
  );
}

export interface PageFooterCardProps {
  title: string;
  label?: string;
}

PageFooterNav.Card = function PageFooterCard({ title, label = 'Up Next' }: PageFooterCardProps) {
  return (
    <div className={styles.button}>
      <div className={styles.content}>
        <span className={styles.label}>{label}</span>
        <span className={styles.title}>{title}</span>
      </div>
      <span className={styles.arrow}>→</span>
    </div>
  );
};

export interface PageFooterActionProps {
  title: string;
  label?: string;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  indicator?: ReactNode;
}

export function PageActionCard({
  title,
  label = 'Continue',
  onClick,
  isLoading,
  disabled,
  indicator = '→',
}: PageFooterActionProps) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      <div className={styles.content}>
        <span className={styles.label}>{label}</span>
        <span className={styles.title}>{title}</span>
      </div>
      <span className={styles.arrow}>
        {isLoading ? <Spinner size="sm" /> : indicator}
      </span>
    </button>
  );
}

PageFooterNav.Action = function PageFooterAction(props: PageFooterActionProps) {
  return <PageActionCard {...props} />;
};
