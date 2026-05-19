import { createFileRoute } from "@tanstack/react-router";
import { CoderWorkspace } from "../coderui/features/Coder";

export const Route = createFileRoute("/chats/$chatId")({
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
