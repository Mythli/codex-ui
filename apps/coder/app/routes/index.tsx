import { createFileRoute, redirect } from "@tanstack/react-router";
import { CoderWorkspace } from "../CoderWorkspace";
import { loadCoderInitialDataFn } from "@app/ssr/loadCoderInitialDataFn";
import type { CoderInitialData } from "@coder/types";

export const Route = createFileRoute("/")({
  loader: async ({ location }) => {
    if (typeof window !== "undefined") {
      return undefined;
    }

    const initialData = await loadCoderInitialDataFn({ data: {} }) as CoderInitialData;
    const chatId = initialData.selection?.chatId;
    if (chatId) {
      throw redirect({
        to: "/chats/$chatId",
        params: { chatId },
        search: location.search,
        replace: true
      });
    }

    return initialData;
  },
  component: IndexRoute
});

function IndexRoute() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();

  return (
    <CoderWorkspace
      onSelectChatRoute={(chatId) => {
        void navigate({ to: "/chats/$chatId", params: { chatId }, search });
      }}
    />
  );
}
