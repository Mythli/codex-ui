import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import styles from "./Input.module.css";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[styles.input, props.className ?? ""].filter(Boolean).join(" ")} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={[styles.textarea, props.className ?? ""].filter(Boolean).join(" ")} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={[styles.select, props.className ?? ""].filter(Boolean).join(" ")} />;
}
