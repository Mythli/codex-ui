import { useState, ReactNode, useLayoutEffect } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useInteractions,
  FloatingFocusManager,
  FloatingPortal,
  Placement
} from '@floating-ui/react';
import { ControlIconButton } from "./ControlIconButton";
import styles from "./ControlPopover.module.css";

export interface ControlPopoverProps {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  placement?: Placement;
}

export function ControlPopover({ icon, label, children, placement = 'bottom-end' }: ControlPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const { refs, floatingStyles, context, x, y } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(12), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    placement,
    strategy: 'absolute',
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  useLayoutEffect(() => {
    if (isOpen && x != null && y != null) {
      requestAnimationFrame(() => setIsVisible(true));
    } else if (!isOpen) {
      setIsVisible(false);
    }
  }, [isOpen, x, y]);

  return (
    <>
      <ControlIconButton
        ref={refs.setReference}
        icon={icon}
        label={label}
        active={isOpen}
        {...getReferenceProps()}
      />
      {isOpen && (
        <FloatingPortal root={document.getElementById('experiment-portal-root') || document.body}>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={{
                ...floatingStyles,
                zIndex: 1000,
                outline: 'none',
              }}
              {...getFloatingProps()}
            >
              <div className={`${styles.popover} ${isVisible ? styles.visible : ''}`}>
                {children}
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
