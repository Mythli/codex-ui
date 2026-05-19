import type {
  CodexProtocolMetadata,
  CodexProtocolResponse,
  CodexProtocolTraffic,
  CodexRequestMethod,
  CodexRequestParams
} from "../../protocol/stream/index.js";

export type CodexTransportRequestOptions = {
  metadata?: CodexProtocolMetadata;
};

export interface CodexTransport {
  request<M extends CodexRequestMethod>(
    method: M,
    params: CodexRequestParams<M>,
    options?: CodexTransportRequestOptions
  ): Promise<CodexProtocolResponse<M>>;
  notify<M extends CodexRequestMethod>(method: M, params?: CodexRequestParams<M>): void | Promise<void>;
  onTraffic(listener: (traffic: CodexProtocolTraffic) => void): () => void;
  onDiagnostic(listener: (text: string) => void): () => void;
  close(): void;
}
