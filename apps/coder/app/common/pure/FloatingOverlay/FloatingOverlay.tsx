import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  type Placement,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions
} from "@floating-ui/react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useLayoutEffect, useMemo, useState } from "react";
import styles from "./FloatingOverlay.module.css";

export type FloatingOverlayRenderTriggerProps = {
  ref: (node: HTMLElement | null) => void;
  isOpen: boolean;
  props: Record<string, unknown>;
};

export type FloatingOverlayProps = {
  children: ReactNode | ((input: { close(): void }) => ReactNode);
  className?: string;
  contentClassName?: string;
  modalFocus?: boolean;
  offsetPx?: number;
  placement?: Placement;
  renderTrigger(input: FloatingOverlayRenderTriggerProps): ReactElement;
};

export function FloatingOverlay({
  children,
  className,
  contentClassName,
  modalFocus = false,
  offsetPx = 8,
  placement = "bottom-end",
  renderTrigger
}: FloatingOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [themeClassName, setThemeClassName] = useState("");
  const { refs, floatingStyles, context, x, y } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    middleware: [offset(offsetPx), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    placement
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  useLayoutEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    const reference = refs.reference.current;
    if (!(reference instanceof Element)) {
      setThemeClassName("");
      return;
    }

    const themeRoot = reference.closest(".coder-theme-light, .coder-theme-dark");
    setThemeClassName(
      themeRoot?.classList.contains("coder-theme-light")
        ? "coder-theme-light"
        : themeRoot?.classList.contains("coder-theme-dark")
          ? "coder-theme-dark"
          : ""
    );
  }, [isOpen, refs.reference]);

  const floatingClassName = useMemo(
    () => [themeClassName, className ?? ""].filter(Boolean).join(" "),
    [className, themeClassName]
  );

  useLayoutEffect(() => {
    if (isOpen && x != null && y != null) {
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    if (!isOpen) {
      setIsVisible(false);
    }
    return undefined;
  }, [isOpen, x, y]);

  const close = () => setIsOpen(false);

  return (
    <>
      {renderTrigger({
        ref: refs.setReference,
        isOpen,
        props: getReferenceProps()
      })}
      {isOpen ? (
        <FloatingPortal root={typeof document === "undefined" ? undefined : document.body}>
          <FloatingFocusManager context={context} modal={modalFocus}>
            <div
              ref={refs.setFloating}
              style={{ ...floatingStyles, zIndex: "var(--coder-z-overlay)" } as CSSProperties}
              {...getFloatingProps({ className: floatingClassName })}
            >
              <div
                className={[styles.content, isVisible ? styles.contentVisible : "", contentClassName ?? ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {typeof children === "function" ? children({ close }) : children}
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      ) : null}
    </>
  );
}
