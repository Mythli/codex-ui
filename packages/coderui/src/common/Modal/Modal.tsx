import { type ReactNode, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { Button } from "../Button/Button";
import styles from "./Modal.module.css";

export type ModalProps = {
  "aria-label"?: string;
  children: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  size?: "compact" | "default" | "wide";
  title?: string;
};

export function Modal({
  "aria-label": ariaLabel,
  children,
  isOpen,
  onClose,
  size = "default",
  title
}: ModalProps) {
  const [themeClassName, setThemeClassName] = useState("");

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    const themeRoot = document.querySelector(".coder-theme-light, .coder-theme-dark");
    setThemeClassName(
      themeRoot?.classList.contains("coder-theme-light")
        ? "coder-theme-light"
        : themeRoot?.classList.contains("coder-theme-dark")
          ? "coder-theme-dark"
          : ""
    );
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className={[themeClassName, styles.overlay].filter(Boolean).join(" ")} onMouseDown={onClose}>
      <section
        aria-label={ariaLabel ?? title}
        aria-modal="true"
        className={[styles.modal, styles[size]].join(" ")}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        {title ? (
          <header className={styles.header}>
            <h2>{title}</h2>
            <Button aria-label="Close dialog" iconOnly onClick={onClose} title="Close dialog" variant="ghost">
              <FiX aria-hidden="true" />
            </Button>
          </header>
        ) : null}
        {children}
      </section>
    </div>,
    document.body
  );
}
