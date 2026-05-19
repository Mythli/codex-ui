import React, { ButtonHTMLAttributes, ReactNode, useState } from 'react';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import { Spinner } from '../Spinner/Spinner';
import { useLocale } from '../../system/LocaleContext';
import styles from './Header.module.css';

export interface HeaderProps {
  children: ReactNode;
}

const HeaderLeft = ({ children }: { children: ReactNode }) => (
  <div className={`${styles.slot} ${styles.left}`}>{children}</div>
);

const HeaderCenter = ({ children }: { children: ReactNode }) => (
  <div className={`${styles.slot} ${styles.center}`}>{children}</div>
);

const HeaderRight = ({ children }: { children: ReactNode }) => (
  <div className={`${styles.slot} ${styles.right}`}>{children}</div>
);

function HeaderRoot({ children }: HeaderProps) {
  const left = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === Header.Left
  );
  const center = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === Header.Center
  );
  const right = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && child.type === Header.Right
  );

  return (
    <header className={styles.header}>
      <div className={styles.content}>
        {left || <div className={`${styles.slot} ${styles.left}`} />}
        {center || <div className={`${styles.slot} ${styles.center}`} />}
        {right || <div className={`${styles.slot} ${styles.right}`} />}
      </div>
    </header>
  );
}

export interface HeaderTitleProps {
  title: ReactNode;
  actions?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}

function HeaderTitle({ title, actions, subtitle, children }: HeaderTitleProps) {
  return (
    <div className={`${styles.titleStack} ${children ? styles.titleStackWithContent : ''}`}>
      <div className={styles.title}>
        <span className={styles.titleText}>{title}</span>
        {actions && <span className={styles.titleActions}>{actions}</span>}
      </div>
      {subtitle && <div className={styles.subline}>{subtitle}</div>}
      {children}
    </div>
  );
}

function PureBurgerButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button className={styles.burger} onClick={onClick} disabled={disabled} aria-label="Toggle menu" type="button">
      <span className={styles.burgerLine} />
      <span className={styles.burgerLine} />
      <span className={styles.burgerLine} />
    </button>
  );
}

export interface NavButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  direction: 'prev' | 'next';
  label?: string;
}

export function NavButton({ direction, label, className = '', ...props }: NavButtonProps) {
  const { dict } = useLocale();
  const isPrev = direction === 'prev';

  return (
    <button
      className={`${styles.navButton} ${isPrev ? styles.navPrev : styles.navNext} ${className}`}
      type="button"
      {...props}
    >
      {isPrev && <span className={styles.navArrow}>←</span>}
      <span className={styles.buttonText}>
        <span className={styles.buttonLabel}>{isPrev ? dict.shared.previous : dict.shared.next}</span>
        <span className={styles.buttonTitle}>{label || '\u00A0'}</span>
      </span>
      {!isPrev && <span className={styles.navArrow}>→</span>}
    </button>
  );
}

export interface HeaderActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  label?: ReactNode;
  title: ReactNode;
  indicator?: ReactNode;
  isLoading?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function HeaderActionButton({
  label,
  title,
  indicator = '→',
  isLoading,
  disabled,
  variant = 'default',
  className = '',
  ...props
}: HeaderActionButtonProps) {
  const variantClass = variant === 'success'
    ? styles.actionSuccess
    : variant === 'warning'
      ? styles.actionWarning
      : variant === 'danger'
        ? styles.actionDanger
        : '';

  return (
    <button
      type="button"
      className={`${styles.actionButton} ${variantClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      <span className={styles.buttonText}>
        {label && <span className={styles.buttonLabel}>{label}</span>}
        <span className={styles.buttonTitle}>{title}</span>
      </span>
      <span className={styles.actionIndicator}>
        {isLoading ? <Spinner size="sm" /> : indicator}
      </span>
    </button>
  );
}

export interface HeaderIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  isLoading?: boolean;
}

export function HeaderIconButton({
  icon,
  label,
  isLoading,
  disabled,
  className = '',
  ...props
}: HeaderIconButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.iconButton} ${className}`}
      aria-label={label}
      title={label}
      disabled={disabled || isLoading}
      {...props}
    >
      <span className={styles.icon}>{isLoading ? <Spinner size="sm" /> : icon}</span>
    </button>
  );
}

export interface HeaderResetButtonProps extends Omit<HeaderIconButtonProps, 'icon' | 'label' | 'onClick'> {
  onReset: () => void;
  label?: string;
  confirmTitle?: string;
  confirmMessage?: ReactNode;
}

export function HeaderResetButton({
  onReset,
  label,
  confirmTitle,
  confirmMessage,
  isLoading,
  disabled,
  className = '',
  ...props
}: HeaderResetButtonProps) {
  const { dict } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const resolvedLabel = label || dict.shared.reset;

  return (
    <>
      <button
        {...props}
        type="button"
        className={`${styles.resetButton} ${className}`}
        aria-label={resolvedLabel}
        title={resolvedLabel}
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(true)}
      >
        {isLoading ? <Spinner size="sm" /> : '↺'}
      </button>
      <ConfirmModal
        isOpen={isOpen}
        title={confirmTitle || dict.shared.resetProgress}
        message={confirmMessage || dict.shared.resetWarning}
        confirmText={dict.shared.reset}
        cancelText={dict.shared.cancel}
        onConfirm={() => {
          setIsOpen(false);
          onReset();
        }}
        onCancel={() => setIsOpen(false)}
        variant="danger"
      />
    </>
  );
}

export interface HeaderProgressProps {
  value: number;
  max: number;
  label?: string;
  secondary?: ReactNode;
}

export function HeaderProgress({ value, max, label, secondary }: HeaderProgressProps) {
  const percentage = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return (
    <div className={styles.progress}>
      <div className={styles.progressMeta}>
        <span><strong>{value}</strong>/{max}{label && <span className={styles.progressLabel}> {label}</span>}</span>
        {secondary && (
          <>
            <span className={styles.progressDivider}>•</span>
            <span className={styles.progressSecondary}>{secondary}</span>
          </>
        )}
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

export interface HeaderMetricProps {
  children: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export function HeaderMetric({ children, tone = 'default' }: HeaderMetricProps) {
  const toneClass = tone === 'success'
    ? styles.metricSuccess
    : tone === 'warning'
      ? styles.metricWarning
      : tone === 'danger'
        ? styles.metricDanger
        : '';

  return <span className={`${styles.metric} ${toneClass}`}>{children}</span>;
}

export const Header = Object.assign(HeaderRoot, {
  Left: HeaderLeft,
  Center: HeaderCenter,
  Right: HeaderRight,
  Title: HeaderTitle,
  BurgerButton: PureBurgerButton,
  NavButton,
  ActionButton: HeaderActionButton,
  IconButton: HeaderIconButton,
  ResetButton: HeaderResetButton,
  Progress: HeaderProgress,
  Metric: HeaderMetric,
});
