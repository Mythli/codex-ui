import { ReactNode, useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import styles from "./StatsSidebar.module.css";

export interface StatsSidebarProps {
  children: ReactNode;
  className?: string;
  resizable?: boolean;
  defaultWidth?: number;
}

export function StatsSidebar({ 
  children, 
  className = '', 
  resizable = true,
  defaultWidth = 320 
}: StatsSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 900;

  useLayoutEffect(() => {
    if (sidebarRef.current && !isMobile) {
      const currentWidth = sidebarRef.current.offsetWidth;
      if (currentWidth > 0) {
        setWidth(currentWidth);
      }
    }
  }, [isMobile]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(240, Math.min(newWidth, window.innerWidth * 0.8)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  if (isMobile) {
    return (
      <div className={`${styles.sidebar} ${styles.mobile} ${className}`}>
        <div className={styles.content}>{children}</div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.spacer} style={{ width: resizable ? width : defaultWidth }} />
      <div 
        ref={sidebarRef}
        className={`${styles.sidebar} ${className}`}
        style={{ width: resizable ? width : defaultWidth }}
      >
        {resizable && (
          <div 
            className={`${styles.resizeHandle} ${isDragging ? styles.resizeHandleActive : ''}`}
            onMouseDown={handleMouseDown}
          >
            <div className={styles.resizeGrip} />
          </div>
        )}
        <div className={styles.content}>{children}</div>
      </div>
    </>
  );
}
