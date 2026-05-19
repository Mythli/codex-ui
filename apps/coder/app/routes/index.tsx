import { createFileRoute, redirect } from "@tanstack/react-router";
import { CoderWorkspace } from "../coderui/features/Coder";
import { loadCoderInitialDataFn } from "../features/Coder/server-fns";
import type { CoderInitialData } from "../features/Coder/store/reducers/initialData";

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
  const initialData = Route.useLoaderData() as CoderInitialData;

  return (
    <CoderWorkspace
      initialData={initialData}
      onSelectChatRoute={(chatId) => {
        void navigate({ to: "/chats/$chatId", params: { chatId }, search });
      }}
    />
  );
}
