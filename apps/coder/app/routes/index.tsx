import { createFileRoute } from "@tanstack/react-router";
import { CoderWorkspace } from "../coderui/features/Coder";

export const Route = createFileRoute("/")({
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
