import React, { ReactNode } from 'react';
import styles from "./AppLayout.module.css";

export interface AppLayoutProps {
  isSidebarOpen?: boolean;
  onOverlayClick?: () => void;
  isDarkTheme?: boolean;
  children: ReactNode;
}

export function AppLayout({
  isSidebarOpen,
  onOverlayClick,
  isDarkTheme,
  children,
}: AppLayoutProps) {
  const sidebar = React.Children.toArray(children).find(child => React.isValidElement(child) && child.type === AppLayout.Sidebar);
  const main = React.Children.toArray(children).find(child => React.isValidElement(child) && child.type === AppLayout.Main);

  return (
    <div className={`${styles.layout} ${isSidebarOpen ? styles.sidebarOpen : ''} ${isDarkTheme ? styles.layoutDark : ''}`}>
      {isSidebarOpen && (
        <div className={styles.overlay} onClick={onOverlayClick} aria-hidden="true" />
      )}
      
      {sidebar}
      {main}
    </div>
  );
}

AppLayout.Sidebar = function AppLayoutSidebar({ children }: { children: ReactNode }) {
  return <>{children}</>;
};

AppLayout.Main = function AppLayoutMain({ children }: { children: ReactNode }) {
  return <div className={styles.viewport}>{children}</div>;
};
