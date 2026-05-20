export type CodexAssetKind = "file" | "bytes";

export type CodexAssetRef = {
  url: string;
  kind: CodexAssetKind;
  mimeType?: string;
  originalPath?: string;
  sizeBytes?: number;
};

export type CodexAssetMetadata = CodexAssetRef & {
  token: string;
};

export type CodexAssetBearing = {
  asset?: CodexAssetRef;
};
