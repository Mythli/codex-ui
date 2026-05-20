import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutModeOptionsView } from "./LayoutModeOptionsView";

const meta = { title: "Codex/ChatSwitcher/LayoutModeOptionsView", component: LayoutModeOptionsView } satisfies Meta<typeof LayoutModeOptionsView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const List: Story = { args: { mode: "list" } };
export const Grid: Story = { args: { mode: "grid" } };
