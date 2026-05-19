import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useState } from "react";
import { createQueryClient } from "../core/queryClient";
import { CoderUIProvider } from "../coderui/system";
import { CoderReduxProvider } from "../features/Coder/store/provider";
import { FixturePlaybackConnector } from "../features/fixture-playback";
import "@taylordb/coderui/style.css";

export const Route = createRootRoute({
  validateSearch: (search): RootSearch => ({
    ...search
  }),
  component: RootComponent
});

type RootSearch = Record<string, unknown>;

function RootComponent() {
  const [queryClient] = useState(() => createQueryClient());
  const content = (
    <CoderUIProvider
      queryClient={queryClient}
    >
      <CoderReduxProvider>
        <FixturePlaybackConnector />
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
