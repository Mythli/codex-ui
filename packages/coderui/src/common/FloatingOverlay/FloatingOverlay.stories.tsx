import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { FloatingOverlay } from "./FloatingOverlay";

const meta: Meta<typeof FloatingOverlay> = {
  title: "Common/FloatingOverlay",
  component: FloatingOverlay
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    children: ({ close }) => (
      <div style={{ background: "var(--coder-surface)", border: "1px solid var(--coder-border)", borderRadius: 8, padding: 12 }}>
        <p style={{ marginTop: 0 }}>Floating content can close itself.</p>
        <Button onClick={close} type="button">Close</Button>
      </div>
    ),
    renderTrigger: ({ ref, props }) => (
      <Button {...props} ref={ref} type="button">
        Open overlay
      </Button>
    )
  }
};
