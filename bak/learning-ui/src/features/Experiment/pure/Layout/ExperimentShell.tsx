import React, { ReactNode } from 'react';
import { MdFullscreen, MdFullscreenExit } from 'react-icons/md';
import { ExperimentCanvas } from "./ExperimentCanvas";
import { StatsSidebar } from "./StatsSidebar";
import styles from "./ExperimentShell.module.css";

/**
 * The main container for interactive WebGL experiments.
 * Automatically applies the dark theme context (`.lui-theme-dark`) to all children.
 */
export interface ExperimentProps {
  /** If true, applies a glowing active state to the shell border */
  isActive?: boolean;
  /** If true, expands the shell to fill the entire viewport */
  isFullscreen?: boolean;
  /** Optional extra class name */
  className?: string;
  /** The compound children (<Experiment.Header>, <Experiment.Canvas>, <Experiment.Sidebar>) */
  children: ReactNode;
}

export function Experiment({
  isActive = false,
  isFullscreen = false,
  className = '',
  children,
}: ExperimentProps) {
  const header = React.Children.toArray(children).find(child => React.isValidElement(child) && child.type === Experiment.Header);
  const canvas = React.Children.toArray(children).find(child => React.isValidElement(child) && child.type === Experiment.Canvas);
  const sidebar = React.Children.toArray(children).find(child => React.isValidElement(child) && child.type === Experiment.Sidebar);

  const shellClasses = [
    styles.shell,
    'lui-theme-dark', // Apply the dark theme context wrapper
    isActive ? styles.active : '',
    isFullscreen ? styles.fullscreen : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={shellClasses}>
      {header}
      <div className={styles.body}>
        <div className={styles.mainContent}>
          {canvas}
        </div>
        {sidebar}
      </div>
      <div id="experiment-portal-root" className={styles.portalRoot} />
    </div>
  );
}

export interface ExperimentHeaderProps {
  /** The title of the experiment */
  title: string;
  /** Optional step number to display next to the title */
  stepNumber?: number | string;
  /** If true, the fullscreen exit icon is shown instead of enter */
  isFullscreen?: boolean;
  /** Callback fired when the fullscreen toggle button is clicked */
  onToggleFullscreen?: () => void;
  /** Controls to render in the top right header (e.g., Play/Pause buttons) */
  children?: ReactNode;
}

Experiment.Header = function ExperimentHeader({
  title,
  stepNumber,
  isFullscreen,
  onToggleFullscreen,
  children
}: ExperimentHeaderProps) {
  const displayTitle = title.startsWith('Experiment:') ? title : `Experiment: ${title}`;

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        {stepNumber && <div className={styles.stepNumber}>{stepNumber}</div>}
        <h3 className={styles.title}>{displayTitle}</h3>
      </div>
      <div className={styles.actions}>
        {children}
        {onToggleFullscreen && (
          <>
            <div className={styles.divider} />
            <button
              className={styles.iconBtn}
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              type="button"
            >
              {isFullscreen ? <MdFullscreenExit /> : <MdFullscreen />}
            </button>
          </>
        )}
      </div>
    </header>
  );
};

// Attach the existing pure components as compound slots
Experiment.Canvas = ExperimentCanvas;
Experiment.Sidebar = StatsSidebar;
