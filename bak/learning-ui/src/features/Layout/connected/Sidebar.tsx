import React, { ReactNode } from 'react';
import { PureSidebar } from "../pure/PureSidebar";
import { useLayout } from "../store/LayoutContext";

export interface SidebarProps {
  title?: string;
  children: ReactNode;
}

export function Sidebar({ title, children }: SidebarProps) {
  const { isSidebarOpen, closeSidebar } = useLayout();
  return (
    <PureSidebar isOpen={isSidebarOpen} onClose={closeSidebar} title={title}>
      {children}
    </PureSidebar>
  );
}

// Attach the pure compound components for convenience
Sidebar.Category = PureSidebar.Category;
Sidebar.Item = PureSidebar.Item;
