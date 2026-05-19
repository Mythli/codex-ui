import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import type { MarkdownComponents } from "../common";

export type CoderUIConfig = {
  markdownComponents?: MarkdownComponents;
};

const CoderUIConfigContext = createContext<CoderUIConfig>({});

export function useCoderUIConfig() {
  return useContext(CoderUIConfigContext);
}

export function requireCoderUIDependency<T>(value: T | undefined, label: string): T {
  if (!value) {
    throw new Error(`${label} is required. Wrap your app in CoderUIProvider and provide it.`);
  }
  return value;
}

export function CoderUIProvider({
  children,
  markdownComponents,
  queryClient
}: {
  children: ReactNode;
  markdownComponents?: MarkdownComponents;
  queryClient?: QueryClient;
}) {
  const parentConfig = useCoderUIConfig();
  const [ownedQueryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 15_000
          }
        }
      })
  );

  const value = useMemo<CoderUIConfig>(
    () => ({
      markdownComponents: markdownComponents ?? parentConfig.markdownComponents
    }),
    [
      markdownComponents,
      parentConfig.markdownComponents
    ]
  );

  return (
    <CoderUIConfigContext.Provider value={value}>
      <QueryClientProvider client={queryClient ?? ownedQueryClient}>{children}</QueryClientProvider>
    </CoderUIConfigContext.Provider>
  );
}
