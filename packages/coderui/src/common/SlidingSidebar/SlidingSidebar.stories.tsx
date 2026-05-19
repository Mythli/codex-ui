import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { SlidingSidebar } from "./SlidingSidebar";

const meta = {
  title: "Common/SlidingSidebar",
  component: SlidingSidebar
} satisfies Meta<typeof SlidingSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {
  args: {
    "aria-label": "Review changes",
    children: (
      <div style={{ display: "grid", gap: 12, padding: 16 }}>
        <strong>Review changes</strong>
        <p style={{ color: "var(--coder-muted)", margin: 0 }}>A slide-out panel can host larger review surfaces.</p>
        <Button type="button">Action</Button>
      </div>
    ),
    open: true,
    side: "right"
  }
};

export const Left: Story = {
  args: {
    ...Right.args,
    "aria-label": "Chats",
    side: "left"
  }
};
