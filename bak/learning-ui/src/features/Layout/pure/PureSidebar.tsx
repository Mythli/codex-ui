import { ReactNode } from 'react';
import styles from "./PureSidebar.module.css";

export interface PureSidebarProps {
  /** Controls whether the sidebar is visually open or hidden */
  isOpen: boolean;
  /** Callback fired when the close button (×) is clicked */
  onClose: () => void;
  /** The main title at the top of the sidebar. Defaults to 'Menu' */
  title?: string;
  /** The categories and items (e.g., <PureSidebar.Category>) */
  children: ReactNode;
}

export function PureSidebar({ isOpen, onClose, title = 'Menu', children }: PureSidebarProps) {
  return (
    <nav className={`${styles.sidebar} ${isOpen ? styles.open : ''}`} aria-hidden={!isOpen}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <button className={styles.close} onClick={onClose} aria-label="Close menu">
          ×
        </button>
      </div>
      <div className={styles.content}>
        {children}
      </div>
    </nav>
  );
}

export interface PureSidebarCategoryProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

PureSidebar.Category = function PureSidebarCategory({ title, icon, children }: PureSidebarCategoryProps) {
  return (
    <div className={styles.category}>
      <div className={styles.categoryHeader}>
        <span className={styles.categoryIcon}>{icon}</span>
        <span className={styles.categoryTitle}>{title}</span>
      </div>
      <ul className={styles.menu}>
        {children}
      </ul>
    </div>
  );
};

export interface PureSidebarItemProps {
  isActive?: boolean;
  children: ReactNode;
}

PureSidebar.Item = function PureSidebarItem({ isActive, children }: PureSidebarItemProps) {
  return (
    <li className={`${styles.item} ${isActive ? styles.itemActive : ''}`}>
      {children}
    </li>
  );
};
