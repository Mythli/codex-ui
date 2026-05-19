import type { StoryFn } from "@storybook/react";
import { FiCheck, FiEdit3 } from "react-icons/fi";
import { StoryFrame } from "../../system/StoryFrame";
import { Button } from "./Button";

export default {
  title: "Common/Button"
};

export const Variants: StoryFn = () => (
  <StoryFrame>
  <div style={{ display: "flex", gap: 12 }}>
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button iconOnly title="Edit">
      <FiEdit3 />
    </Button>
    <Button disabled variant="primary">
      <FiCheck /> Disabled
    </Button>
  </div>
  </StoryFrame>
);
