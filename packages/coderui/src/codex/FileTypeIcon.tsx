import type { IconType } from "react-icons";
import {
  LuFile,
  LuFileArchive,
  LuFileAudio,
  LuFileAxis3D,
  LuFileBox,
  LuFileChartColumn,
  LuFileCode,
  LuFileImage,
  LuFileJson,
  LuFileSpreadsheet,
  LuFileText,
  LuFileVideo
} from "react-icons/lu";

export type FileTypeIconFile = {
  extension?: string;
  kind?: "image" | "file";
  mimeType?: string;
  name?: string;
};

export function FileTypeIcon({
  className,
  file
}: {
  className?: string;
  file: FileTypeIconFile;
}) {
  const Icon = resolveFileTypeIcon(file);
  return <Icon aria-hidden="true" className={className} />;
}

export function resolveFileTypeIcon(file: FileTypeIconFile): IconType {
  const mimeType = normalizeMimeType(file.mimeType);
  const extension = normalizeExtension(file.extension) ?? extensionFromName(file.name);

  if (file.kind === "image" || mimeType.startsWith("image/") || hasExtension(imageExtensions, extension)) {
    return LuFileImage;
  }
  if (mimeType.startsWith("audio/") || hasExtension(audioExtensions, extension)) {
    return LuFileAudio;
  }
  if (mimeType.startsWith("video/") || hasExtension(videoExtensions, extension)) {
    return LuFileVideo;
  }
  if (isCadMimeType(mimeType) || hasExtension(cadExtensions, extension)) {
    return LuFileAxis3D;
  }
  if (isArchiveMimeType(mimeType) || hasExtension(archiveExtensions, extension)) {
    return LuFileArchive;
  }
  if (isSpreadsheetMimeType(mimeType) || hasExtension(spreadsheetExtensions, extension)) {
    return LuFileSpreadsheet;
  }
  if (isJsonMimeType(mimeType) || hasExtension(jsonExtensions, extension)) {
    return LuFileJson;
  }
  if (isCodeMimeType(mimeType) || hasExtension(codeExtensions, extension)) {
    return LuFileCode;
  }
  if (isPresentationMimeType(mimeType) || hasExtension(presentationExtensions, extension)) {
    return LuFileChartColumn;
  }
  if (isDocumentMimeType(mimeType) || hasExtension(documentExtensions, extension)) {
    return LuFileText;
  }
  if (isBinaryMimeType(mimeType) || hasExtension(binaryExtensions, extension)) {
    return LuFileBox;
  }
  return LuFile;
}

function normalizeMimeType(value: string | undefined) {
  return value?.split(";")[0]?.trim().toLowerCase() ?? "";
}

function normalizeExtension(value: string | undefined) {
  const extension = value?.trim().toLowerCase().replace(/^\.+/, "");
  return extension || undefined;
}

function extensionFromName(value: string | undefined) {
  const name = value?.trim().toLowerCase();
  if (!name) {
    return undefined;
  }
  const lastSegment = name.split(/[\\/]/).at(-1) ?? name;
  const dotIndex = lastSegment.lastIndexOf(".");
  return dotIndex > 0 ? normalizeExtension(lastSegment.slice(dotIndex + 1)) : undefined;
}

function hasExtension(extensions: ReadonlySet<string>, extension: string | undefined) {
  return extension ? extensions.has(extension) : false;
}

function isJsonMimeType(value: string) {
  return value === "application/json" || value.endsWith("+json");
}

function isArchiveMimeType(value: string) {
  return [
    "application/gzip",
    "application/java-archive",
    "application/vnd.rar",
    "application/x-7z-compressed",
    "application/x-bzip",
    "application/x-bzip2",
    "application/x-rar-compressed",
    "application/x-tar",
    "application/zip"
  ].includes(value);
}

function isCadMimeType(value: string) {
  return [
    "application/acad",
    "application/dxf",
    "application/x-acad",
    "application/x-autocad",
    "application/x-dxf",
    "drawing/x-dxf",
    "image/vnd.dxf"
  ].includes(value);
}

function isSpreadsheetMimeType(value: string) {
  return [
    "application/vnd.ms-excel",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/tab-separated-values"
  ].includes(value);
}

function isPresentationMimeType(value: string) {
  return [
    "application/vnd.ms-powerpoint",
    "application/vnd.oasis.opendocument.presentation",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ].includes(value);
}

function isDocumentMimeType(value: string) {
  return value.startsWith("text/") || [
    "application/msword",
    "application/pdf",
    "application/rtf",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ].includes(value);
}

function isCodeMimeType(value: string) {
  return [
    "application/javascript",
    "application/typescript",
    "application/x-httpd-php",
    "application/x-sh",
    "application/xml",
    "text/css",
    "text/html",
    "text/javascript",
    "text/jsx",
    "text/tsx",
    "text/typescript",
    "text/xml"
  ].includes(value);
}

function isBinaryMimeType(value: string) {
  return value === "application/octet-stream" || value === "application/x-msdownload";
}

const imageExtensions = new Set([
  "avif",
  "bmp",
  "gif",
  "heic",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "tif",
  "tiff",
  "webp"
]);

const audioExtensions = new Set(["aac", "aiff", "flac", "m4a", "mp3", "ogg", "wav", "weba"]);
const videoExtensions = new Set(["avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm"]);
const cadExtensions = new Set(["dwg", "dxf", "iges", "igs", "step", "stl", "stp"]);
const archiveExtensions = new Set(["7z", "bz2", "gz", "jar", "rar", "tar", "tgz", "war", "xz", "zip"]);
const spreadsheetExtensions = new Set(["csv", "numbers", "ods", "tsv", "xls", "xlsx"]);
const jsonExtensions = new Set(["geojson", "ipynb", "json", "json5", "jsonc", "jsonl"]);
const presentationExtensions = new Set(["key", "odp", "ppt", "pptx"]);
const documentExtensions = new Set(["doc", "docx", "log", "md", "mdx", "odt", "pdf", "rtf", "txt"]);
const binaryExtensions = new Set(["bin", "dmg", "exe", "iso", "pkg"]);

const codeExtensions = new Set([
  "astro",
  "c",
  "cc",
  "cjs",
  "clj",
  "cpp",
  "cs",
  "css",
  "cts",
  "go",
  "h",
  "hpp",
  "html",
  "java",
  "js",
  "jsx",
  "kt",
  "lua",
  "mjs",
  "mts",
  "php",
  "pl",
  "py",
  "rb",
  "rs",
  "sass",
  "scss",
  "sh",
  "svelte",
  "swift",
  "toml",
  "ts",
  "tsx",
  "vue",
  "xml",
  "yaml",
  "yml",
  "zig"
]);
