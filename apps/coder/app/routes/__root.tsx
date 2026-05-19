import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useState } from "react";
import { createQueryClient } from "../core/queryClient";
import { CoderStoreBinder, CoderUIProvider } from "@taylordb/coderui";
import { createCodexAdapter, createGitClient } from "../features/Coder/adapters/codexAdapter";
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
  const [coderAdapter] = useState(() => createCodexAdapter());
  const [gitClient] = useState(() => createGitClient());
  const content = (
    <CoderUIProvider
      adapters={{ coder: coderAdapter, git: gitClient }}
      queryClient={queryClient}
    >
      <CoderStoreBinder />
      <FixturePlaybackConnector />
      <Outlet />
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
