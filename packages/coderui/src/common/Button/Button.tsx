import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  iconOnly?: boolean;
  variant?: ButtonVariant;
}>(function Button({
  children,
  iconOnly = false,
  variant = "secondary",
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      className={[styles.button, styles[variant], iconOnly ? styles.icon : "", props.className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
});
