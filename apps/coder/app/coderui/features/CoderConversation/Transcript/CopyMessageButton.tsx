import { useEffect, useRef, useState } from "react";
import { FiCheck, FiCopy } from "react-icons/fi";
import styles from "./Transcript.module.css";

export function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== undefined) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    const success = await copyTextToClipboard(text);
    if (!success) {
      return;
    }
    if (resetTimerRef.current !== undefined) {
      window.clearTimeout(resetTimerRef.current);
    }
    setCopied(true);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
  }

  const Icon = copied ? FiCheck : FiCopy;

  return (
    <button
      aria-label={copied ? "Copied response" : "Copy response"}
      className={styles.messageCopyButton}
      data-testid="assistant-message-copy"
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy response"}
      type="button"
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand below.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}
