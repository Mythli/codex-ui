import type { ReactNode } from "react";
import { useEffect } from "react";
import styles from "./SlidingSidebar.module.css";

export type SlidingSidebarSide = "left" | "right";

export type SlidingSidebarProps = {
  "aria-label": string;
  children: ReactNode;
  className?: string;
  open: boolean;
  onClose?: () => void;
  side?: SlidingSidebarSide;
};

export function SlidingSidebar({
  "aria-label": ariaLabel,
  children,
  className,
  onClose,
  open,
  side = "right"
}: SlidingSidebarProps) {
  useEffect(() => {
    if (!open || !onClose) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.root} data-side={side}>
      <button aria-label="Close panel" className={styles.scrim} onClick={onClose} type="button" />
      <dialog
        open
        aria-label={ariaLabel}
        className={[styles.panel, className ?? ""].filter(Boolean).join(" ")}
        data-side={side}
      >
        {children}
      </dialog>
    </div>
  );
}
