import type { CoderComposerAttachment } from "../../CoderCore/types";

const maxAttachmentBytes = 20 * 1024 * 1024;

export function readAttachments(files: File[]): Promise<CoderComposerAttachment[]> {
  return Promise.all(files.map(readAttachment));
}

export function hasTransferFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes("Files");
}

export function filesFromDataTransfer(dataTransfer: DataTransfer): File[] {
  const files = [...dataTransfer.files];
  if (files.length > 0) {
    return files;
  }
  return [...dataTransfer.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  for (const unit of units) {
    if (value < 1024 || unit === units.at(-1)) {
      return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
    }
    value /= 1024;
  }
  return `${bytes} B`;
}

async function readAttachment(file: File): Promise<CoderComposerAttachment> {
  if (file.size > maxAttachmentBytes) {
    throw new Error(`${file.name} is larger than 20 MB`);
  }
  const uploaded = await uploadAttachment(file);
  const isImage = isImageMime(file.type);
  const dataUrl = isImage ? await readFileAsDataUrl(file) : undefined;
  const asset = uploaded.asset?.url && uploaded.asset.kind
    ? {
      url: uploaded.asset.url,
      kind: uploaded.asset.kind,
      mimeType: uploaded.asset.mimeType,
      originalPath: uploaded.asset.originalPath,
      sizeBytes: uploaded.asset.sizeBytes
    }
    : undefined;
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind: isImage ? "image" : "file",
    name: file.name || "attachment",
    mimeType: file.type || uploaded.asset?.mimeType || "application/octet-stream",
    size: file.size,
    path: uploaded.path,
    assetUrl: uploaded.asset?.url,
    dataUrl,
    input: uploaded.input && asset
      ? { ...uploaded.input, asset }
      : uploaded.input
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Could not read ${file.name}`));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function uploadAttachment(file: File): Promise<{
  input?: CoderComposerAttachment["input"];
  path: string;
  asset?: {
    url?: string;
    kind?: "file" | "bytes";
    mimeType?: string;
    originalPath?: string;
    sizeBytes?: number;
  };
}> {
  const response = await fetch("/codex-assets/upload", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": file.name || "attachment"
    },
    body: file
  });
  if (!response.ok) {
    throw new Error(`File upload failed with ${response.status}`);
  }
  const payload = await response.json() as {
    input?: CoderComposerAttachment["input"];
    path?: string;
    asset?: {
      url?: string;
      kind?: "file" | "bytes";
      mimeType?: string;
      originalPath?: string;
      sizeBytes?: number;
    };
  };
  if (!payload.path) {
    throw new Error("File upload did not return a staged path");
  }
  return {
    input: payload.input,
    path: payload.path,
    asset: payload.asset
  };
}

function isImageMime(value: string): boolean {
  return value.startsWith("image/");
}
