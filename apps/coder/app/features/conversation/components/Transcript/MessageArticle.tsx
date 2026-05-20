import { useEffect, useMemo, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import type { CodexTranscriptAttachment, CodexTranscriptImage } from "@taylordb/codex";
import { Markdown, type MarkdownComponents, type MarkdownUrlTransform } from "@app/common/pure";
import { UserMessageAttachmentsView } from "../../pure/thread/UserMessageView";
import { CopyMessageButton } from "./CopyMessageButton";
import { TranscriptImageStrip } from "./TranscriptImages";
import styles from "./Transcript.module.css";

const registeredMarkdownAssetUrlByPath = new Map<string, string>();

export function UserMessageBubble({
  blockId,
  cwd,
  attachments,
  images,
  markdownComponents,
  text
}: {
  attachments?: readonly CodexTranscriptAttachment[];
  blockId?: string;
  cwd?: string;
  images?: readonly CodexTranscriptImage[];
  markdownComponents?: MarkdownComponents;
  text: string;
}) {
  return (
    <MessageArticle
      cwd={cwd}
      blockId={blockId}
      markdownComponents={markdownComponents}
      message={{ role: "user", text, attachments: attachments ?? [], images: images ?? [] }}
    />
  );
}

export function AssistantMessage({
  blockId,
  cwd,
  final = true,
  markdownComponents,
  text
}: {
  blockId?: string;
  cwd?: string;
  final?: boolean;
  markdownComponents?: MarkdownComponents;
  text: string;
}) {
  return (
    <MessageArticle
      cwd={cwd}
      blockId={blockId}
      final={final}
      markdownComponents={markdownComponents}
      message={{ role: "assistant", text, attachments: [], images: [] }}
      overlay={final ? <CopyMessageButton text={text} /> : null}
    />
  );
}

export function MessageArticle({
  blockId,
  cwd,
  final = false,
  markdownComponents,
  message,
  overlay,
  trailing
}: {
  blockId?: string;
  cwd?: string;
  final?: boolean;
  markdownComponents?: MarkdownComponents;
  message: {
    role: "user" | "assistant" | "system";
    text: string;
    attachments?: readonly CodexTranscriptAttachment[];
    images?: readonly CodexTranscriptImage[];
  };
  overlay?: ReactNode;
  trailing?: ReactNode;
}) {
  const resolvedMarkdownComponents = useResolvedMarkdownComponents(markdownComponents, cwd);
  const hasOverlay = Boolean(overlay);

  return (
    <article
      aria-label={`${message.role} message`}
      className={[styles.message, styles[`message_${message.role}`], final ? styles.message_final : "", hasOverlay ? styles.message_withOverlay : ""]
        .filter(Boolean)
        .join(" ")}
      data-row-final={final ? "true" : undefined}
      data-block-id={blockId}
      data-row-role={message.role}
      data-row-type="message"
      data-testid={`transcript-${message.role}-message`}
    >
      {overlay}
      {message.images?.length ? <TranscriptImageStrip blockId={blockId} compact images={message.images} /> : null}
      {message.attachments?.length ? <MessageAttachments attachments={message.attachments} /> : null}
      {message.text
        ? <Markdown components={resolvedMarkdownComponents.components} text={message.text} urlTransform={resolvedMarkdownComponents.urlTransform} />
        : null}
      {trailing}
    </article>
  );
}

function MessageAttachments({ attachments }: { attachments: readonly CodexTranscriptAttachment[] }) {
  return (
    <UserMessageAttachmentsView
      attachments={[...attachments]}
    />
  );
}

function useResolvedMarkdownComponents(
  components: MarkdownComponents | undefined,
  cwd: string | undefined
): { components: MarkdownComponents | undefined; urlTransform?: MarkdownUrlTransform } {
  const urlTransform = useMemo<MarkdownUrlTransform>(
    () => (value, key) => key === "href" && localMarkdownPathFromTarget(value, cwd)
      ? value
      : undefined,
    [cwd]
  );
  return useMemo(() => {
    if (components?.a) {
      return {
        components
      };
    }

    return {
      components: {
        ...components,
        a: (props) => <MarkdownAssetLink {...props} cwd={cwd} />
      },
      urlTransform
    };
  }, [components, cwd, urlTransform]);
}

function MarkdownAssetLink({
  children,
  cwd,
  href,
  rel,
  target,
  ...props
}: ComponentProps<"a"> & { cwd?: string }) {
  const path = useMemo(() => localMarkdownPathFromTarget(href, cwd), [cwd, href]);
  const [assetHref, setAssetHref] = useState(() => path ? registeredMarkdownAssetUrlByPath.get(path) : undefined);

  useEffect(() => {
    if (!path) {
      setAssetHref(undefined);
      return;
    }

    const cached = registeredMarkdownAssetUrlByPath.get(path);
    if (cached) {
      setAssetHref(cached);
      return;
    }

    let cancelled = false;
    void registerLocalMarkdownPath(path).then((url) => {
      if (!url || cancelled) {
        return;
      }
      registeredMarkdownAssetUrlByPath.set(path, url);
      setAssetHref(url);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return (
    <a
      {...props}
      data-local-markdown-link-state={path ? assetHref ? "ready" : "registering" : undefined}
      href={path ? assetHref : href}
      rel={rel ?? "noopener noreferrer"}
      target={target ?? "_blank"}
    >
      {children}
    </a>
  );
}

async function registerLocalMarkdownPath(path: string): Promise<string | undefined> {
  try {
    const response = await fetch("/codex-assets/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path })
    });
    if (!response.ok) {
      return undefined;
    }
    const payload = await response.json() as { asset?: { url?: string } };
    return payload.asset?.url;
  } catch {
    return undefined;
  }
}

function localMarkdownPathFromTarget(target: string | null | undefined, cwd: string | undefined): string | undefined {
  if (!target) {
    return undefined;
  }

  const value = target.trim();
  if (!isLocalMarkdownTarget(value, cwd)) {
    return undefined;
  }

  const path = stripLineSuffix(stripQueryAndFragment(value.startsWith("file:")
    ? localPathFromFileUrl(value)
    : value));
  if (isAbsoluteLocalPath(path)) {
    return path;
  }
  return cwd ? resolvePath(cwd, path) : path;
}

function isLocalMarkdownTarget(value: string, cwd: string | undefined): boolean {
  if (value.startsWith("/codex-assets/")) {
    return false;
  }
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return false;
  }
  if (value.startsWith("mailto:") || value.startsWith("#")) {
    return false;
  }
  return value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("file:") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    Boolean(cwd && /(^|\/)[^/\s]+\.[A-Za-z0-9]{1,8}(:\d+)?([?#].*)?$/.test(value));
}

function localPathFromFileUrl(value: string): string {
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname);
  } catch {
    return value.replace(/^file:\/+/, value.startsWith("file:///") ? "/" : "");
  }
}

function stripQueryAndFragment(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? value;
}

function stripLineSuffix(value: string): string {
  return value.replace(/:\d+(?::\d+)?$/, "");
}

function isAbsoluteLocalPath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function resolvePath(cwd: string, path: string): string {
  const prefix = cwd.startsWith("/") ? "/" : "";
  const parts = `${cwd.replace(/[\\/]+$/, "")}/${path}`.split(/[\\/]+/);
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  return `${prefix}${resolved.join("/")}`;
}
