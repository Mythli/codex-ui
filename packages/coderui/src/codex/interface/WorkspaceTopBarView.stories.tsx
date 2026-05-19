import type { Meta, StoryObj } from "@storybook/react-vite";
import { ViewModeSwitcherView } from "./ViewModeSwitcherView";
import { WorkspaceTopBarView } from "./WorkspaceTopBarView";

const meta = { title: "Codex/Interface/WorkspaceTopBarView", component: WorkspaceTopBarView } satisfies Meta<typeof WorkspaceTopBarView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = { args: { right: <ViewModeSwitcherView mode="both" />, title: "codex-api" } };
