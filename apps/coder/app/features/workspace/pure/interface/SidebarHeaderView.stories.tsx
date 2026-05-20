import type { Meta, StoryObj } from "@storybook/react-vite";
import { SidebarHeaderView } from "./SidebarHeaderView";

const meta = { title: "Codex/Interface/SidebarHeaderView", component: SidebarHeaderView } satisfies Meta<typeof SidebarHeaderView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { subtitle: "3 chats", title: "codex-api" } };
