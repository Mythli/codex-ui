import type {
  CodexProtocolResponse,
  CodexProtocolTraffic,
  CodexRequestMethod,
  CodexRequestParams
} from "../../protocol/stream/index.js";

export interface CodexTransport {
  request<M extends CodexRequestMethod>(method: M, params: CodexRequestParams<M>): Promise<CodexProtocolResponse<M>>;
  notify<M extends CodexRequestMethod>(method: M, params?: CodexRequestParams<M>): void | Promise<void>;
  onTraffic(listener: (traffic: CodexProtocolTraffic) => void): () => void;
  onDiagnostic(listener: (text: string) => void): () => void;
  close(): void;
}
