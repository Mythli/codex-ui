import { createFileRoute } from "@tanstack/react-router";
import { CoderWorkspace } from "../coderui/features/Coder";
import { loadCoderInitialDataFn } from "../features/Coder/server-fns";
import type { CoderInitialData } from "../features/Coder/store/reducers/initialData";

export const Route = createFileRoute("/chats/$chatId")({
  loader: async ({ params }) => typeof window === "undefined"
    ? loadCoderInitialDataFn({ data: { chatId: params.chatId } })
    : undefined,
  component: ChatRoute
});

function ChatRoute() {
  const { chatId } = Route.useParams();
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const initialData = Route.useLoaderData() as CoderInitialData;

  return (
    <CoderWorkspace
      initialChatId={chatId}
      initialData={initialData}
      onSelectChatRoute={(nextChatId) => {
        void navigate({ to: "/chats/$chatId", params: { chatId: nextChatId }, search });
      }}
      onNewChatRoute={() => {
        void navigate({ to: "/", search });
      }}
    />
  );
}
