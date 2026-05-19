import { useQuery } from "@tanstack/react-query";
import { requireCoderUIDependency, useCoderUIConfig } from "../../../system";
import type { CoderRuntimeConfig } from "../types";

export function useCoderDashboard() {
  const { adapters } = useCoderUIConfig();
  const coder = requireCoderUIDependency(adapters?.coder, "Coder runtime adapter");

  const modelsQuery = useQuery({
    queryKey: ["coder", "models"],
    queryFn: () => coder.listModels({ limit: 100 }),
    refetchInterval: (query) => query.state.data ? false : 1_000,
    retry: true
  });
  const configQuery = useQuery({
    queryKey: ["coder", "config", coder.defaultCwd],
    queryFn: async (): Promise<CoderRuntimeConfig> =>
      coder.readConfig?.({ cwd: coder.defaultCwd ?? null, includeLayers: false }) ?? {},
    refetchInterval: (query) => query.state.data ? false : 1_000,
    retry: true
  });

  return {
    configQuery,
    modelsQuery
  };
}
