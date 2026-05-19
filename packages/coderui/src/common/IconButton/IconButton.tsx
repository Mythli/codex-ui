import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

export function IconButton({
  children,
  label,
  variant = "ghost",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      {...props}
      aria-label={label}
      className={[styles.button, styles[variant], props.className ?? ""].filter(Boolean).join(" ")}
      title={props.title ?? label}
      type={props.type ?? "button"}
    >
      {children}
    </button>
  );
}
