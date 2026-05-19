import { useState, useRef, ReactNode, ReactElement, CSSProperties, Dispatch, SetStateAction, MutableRefObject } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  arrow,
  FloatingArrow,
  Placement,
  ReferenceType,
  safePolygon,
  FloatingContext,
} from '@floating-ui/react';
import styles from "./FloatingTooltip.module.css";

export interface FloatingTooltipProps {
  /** The content to display. Strings get default styling; Elements render as-is. */
  content: ReactNode;
  /** The trigger element */
  children: ReactElement;
  placement?: Placement;
  /** Delay in ms. Default: { open: 300, close: 0 } */
  delay?: number | { open?: number; close?: number };
  /** If true, allows hovering over the tooltip content (safe polygon) */
  interactive?: boolean;
  /** Theme context for portal-rendered tooltip content. */
  theme?: 'inherit' | 'dark';
}

export function FloatingTooltip({ 
  content, 
  children, 
  placement = 'top',
  delay,
  interactive = false,
  theme = 'inherit',
}: FloatingTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = useRef<SVGSVGElement | null>(null);

  // Default delay: 300ms open delay, no close delay
  const defaultDelay = typeof delay === 'number' 
    ? { open: delay, close: 0 } 
    : delay ?? { open: 300, close: 0 };

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    middleware: [
      offset(12),
      flip({
        fallbackAxisSideDirection: 'start',
        padding: 10,
      }),
      shift({ padding: 10 }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { 
    delay: defaultDelay,
    move: false,
    // safePolygon creates a safe zone from cursor to tooltip
    handleClose: interactive ? safePolygon({ buffer: 1 }) : null,
  });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  // Helper to wrap simple strings in standard styling
  const renderContent = () => {
    if (typeof content === 'string') {
      return <div className={styles.textContent}>{content}</div>;
    }
    return content;
  };

  return (
    <>
      <span 
        ref={refs.setReference} 
        {...getReferenceProps()}
        className={styles.trigger}
      >
        {children}
      </span>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className={`${theme === 'dark' ? 'lui-theme-dark' : ''} ${styles.tooltip} ${interactive ? styles.interactive : ''}`}
          >
            <div className={styles.content}>
              {renderContent()}
            </div>
            <FloatingArrow 
              ref={arrowRef} 
              context={context}
              className={styles.arrow}
            />
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

// Hook for SVG elements that need virtual positioning
export interface VirtualElement {
  getBoundingClientRect: () => DOMRect;
}

export interface UseFloatingTooltipOptions {
  placement?: Placement;
  interactive?: boolean;
}

export interface UseFloatingTooltipReturn {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  show: (element: SVGElement | HTMLElement) => void;
  hide: () => void;
  refs: ReturnType<typeof useFloating>['refs'];
  floatingStyles: CSSProperties;
  context: FloatingContext<ReferenceType>;
  arrowRef: MutableRefObject<SVGSVGElement | null>;
  interactive: boolean;
  getFloatingProps: () => Record<string, unknown>;
}

export function useFloatingTooltip(options: UseFloatingTooltipOptions = {}): UseFloatingTooltipReturn {
  const { placement = 'top', interactive = true } = options;
  const [isOpen, setIsOpen] = useState(false);
  const arrowRef = useRef<SVGSVGElement | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    middleware: [
      offset(12),
      flip({
        fallbackAxisSideDirection: 'start',
        padding: 10,
      }),
      shift({ padding: 10 }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Update reference when virtual element changes
  const setReference = (element: SVGElement | HTMLElement | null) => {
    if (element) {
      const virtual: VirtualElement = {
        getBoundingClientRect: () => element.getBoundingClientRect(),
      };
      refs.setReference(virtual as unknown as ReferenceType);
    }
  };

  const show = (element: SVGElement | HTMLElement) => {
    setReference(element);
    setIsOpen(true);
  };

  const hide = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    setIsOpen,
    show,
    hide,
    refs,
    floatingStyles,
    context,
    arrowRef,
    interactive,
    getFloatingProps: () => ({}),
  };
}
