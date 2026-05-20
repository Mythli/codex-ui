import { createFileRoute } from "@tanstack/react-router";
import { CoderWorkspace } from "../CoderWorkspace";
import { loadCoderInitialDataFn } from "../features/connection/api/server-fns";

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

  return (
    <CoderWorkspace
      initialChatId={chatId}
      onSelectChatRoute={(nextChatId) => {
        void navigate({ to: "/chats/$chatId", params: { chatId: nextChatId }, search });
      }}
      onNewChatRoute={() => {
        void navigate({ to: "/", search });
      }}
    />
  );
}
