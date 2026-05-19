import type { Meta, StoryObj } from "@storybook/react-vite";
import { SidebarHeaderView } from "./SidebarHeaderView";
import { SidebarView } from "./SidebarView";

const meta = { title: "Codex/Interface/SidebarView", component: SidebarView } satisfies Meta<typeof SidebarView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Expanded: Story = { args: { children: <SidebarHeaderView title="codex-api" subtitle="Workspace" /> } };
export const Collapsed: Story = { args: { children: <span>C</span>, collapsed: true } };
