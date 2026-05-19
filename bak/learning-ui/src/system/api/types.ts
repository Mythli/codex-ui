export interface AdapterConfig {
  /** The base URL for the API endpoints (e.g., '/api/vocab') */
  baseUrl: string;
  /** Optional custom headers or a function that returns headers (useful for injecting auth tokens) */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  /** Optional custom fetch wrapper. Defaults to the UI library's internal apiClient with toast errors. */
  fetcher?: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}
