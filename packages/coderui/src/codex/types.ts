import type { ReactNode } from "react";

export type CodexViewMode = "chat" | "both" | "preview";
export type CodexPreviewViewport = "desktop" | "tablet" | "phone";

export type CodexChatRow = {
  id: string;
  title: string;
  updatedLabel?: string;
  activity?: "none" | "running";
  unread?: boolean;
  additions?: number;
  deletions?: number;
};

export type CodexProjectGroup = {
  id: string;
  name: string;
  chats: CodexChatRow[];
};

export type CodexAttachment = {
  id: string;
  kind: "image" | "file";
  name: string;
  sizeLabel: string;
};

export type CodexVersionRow = {
  id: string;
  label: string;
  message: string;
  meta: string;
};

export type CodexMessage = {
  id: string;
  role: "user" | "assistant";
  body: ReactNode;
};

export type CodexMenuOption = {
  id: string;
  label: string;
  description?: string;
  selected?: boolean;
  disabled?: boolean;
};

export type CodexFileChange = {
  path: string;
  additions?: number;
  deletions?: number;
  diff?: string;
};
