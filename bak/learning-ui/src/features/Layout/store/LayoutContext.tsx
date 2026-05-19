import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { LayoutState, LayoutStorageAdapter } from "../types/adapters";

export interface LayoutContextValue {
  isSidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}

export interface LayoutProviderProps {
  children: ReactNode;
  initialState?: LayoutState | null;
  storage?: LayoutStorageAdapter;
}

export function LayoutProvider({ children, initialState, storage }: LayoutProviderProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(initialState?.isSidebarOpen ?? false);
  const [isLoaded, setIsLoaded] = useState(Boolean(initialState) || !storage);
  const skipInitialSaveRef = useRef(true);

  useEffect(() => {
    if (initialState) return;
    if (!storage) {
      setIsLoaded(true);
      return;
    }
    
    let mounted = true;

    setIsLoaded(false);

    storage.load().then((state) => {
      if (mounted) {
        if (state) {
          setIsSidebarOpen(state.isSidebarOpen);
        }
        setIsLoaded(true);
      }
    });
    
    return () => {
      mounted = false;
    };
  }, [initialState, storage]);

  useEffect(() => {
    if (!isLoaded || !storage) return;
    if (skipInitialSaveRef.current) {
      skipInitialSaveRef.current = false;
      return;
    }

    storage.save({ isSidebarOpen });
  }, [isSidebarOpen, isLoaded, storage]);

  const openSidebar = useCallback(() => setIsSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

  return (
    <LayoutContext.Provider value={{ isSidebarOpen, openSidebar, closeSidebar, toggleSidebar }}>
      {children}
    </LayoutContext.Provider>
  );
}
