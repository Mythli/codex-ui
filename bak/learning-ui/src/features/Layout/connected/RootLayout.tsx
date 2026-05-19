import React, { ReactNode } from 'react';
import { LayoutProvider, useLayout } from "../store/LayoutContext";
import { AppLayout } from "../pure/AppLayout";
import { Toaster } from "../../../common/Toast/Toaster";
import { useLearningUIConfig } from "../../../system/LocaleContext";
import { LayoutState, LayoutStorageAdapter } from "../types/adapters";

export interface RootLayoutProps {
  /** The sidebar component (e.g., <Sidebar>) */
  sidebar: ReactNode;
  /** The main application content/router */
  children: ReactNode;
  /** Initial layout state from SSR route data */
  initialLayoutState?: LayoutState | null;
  /** Optional persistence adapter for layout state */
  layoutStorage?: LayoutStorageAdapter;
}

function RootLayoutContent({ sidebar, children }: RootLayoutProps) {
  const { isSidebarOpen, closeSidebar } = useLayout();
  return (
    <AppLayout isSidebarOpen={isSidebarOpen} onOverlayClick={closeSidebar}>
      <AppLayout.Sidebar>
        {sidebar}
      </AppLayout.Sidebar>
      <AppLayout.Main>
        {children}
      </AppLayout.Main>
    </AppLayout>
  );
}

/**
 * The global application shell.
 * Wraps the app in a LayoutProvider to manage sidebar state globally.
 * Automatically includes the global Toaster for notifications.
 */
export function RootLayout({ sidebar, children, initialLayoutState, layoutStorage }: RootLayoutProps) {
  const learningUI = useLearningUIConfig();
  const resolvedStorage = layoutStorage || learningUI.adapters?.layoutStorage;

  return (
    <LayoutProvider initialState={initialLayoutState} storage={resolvedStorage}>
      <RootLayoutContent sidebar={sidebar}>
        {children}
      </RootLayoutContent>
      <Toaster />
    </LayoutProvider>
  );
}
