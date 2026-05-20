import { createRootRoute, HeadContent, Outlet, Scripts, useMatches } from "@tanstack/react-router";
import { useState } from "react";
import { createQueryClient } from "../queryClient";
import { CoderUIProvider } from "../common/providers/CoderUIProvider";
import { CoderReduxProvider } from "../store/provider";
import type { CoderInitialData } from "@coder/types";
import "../theme.css";

export const Route = createRootRoute({
  validateSearch: (search): RootSearch => ({
    ...search
  }),
  component: RootComponent
});

type RootSearch = Record<string, unknown>;

function RootComponent() {
  const [queryClient] = useState(() => createQueryClient());
  const initialData = useCoderInitialDataFromMatches();
  const content = (
    <CoderUIProvider
      queryClient={queryClient}
    >
      <CoderReduxProvider initialData={initialData}>
        <Outlet />
      </CoderReduxProvider>
    </CoderUIProvider>
  );

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <title>TaylorDB Coder</title>
      </head>
      <body>
        {content}
        <Scripts />
      </body>
    </html>
  );
}

function useCoderInitialDataFromMatches(): CoderInitialData | undefined {
  const matches = useMatches();
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const loaderData = matches[index]?.loaderData;
    if (isCoderInitialData(loaderData)) {
      return loaderData;
    }
  }
  return undefined;
}

function isCoderInitialData(value: unknown): value is CoderInitialData {
  return Boolean(value && typeof value === "object" && "threadIndex" in value);
}
