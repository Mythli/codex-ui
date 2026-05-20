import type { StoryFn } from "@storybook/react";
import { StoryFrame } from "../system/StoryFrame";
import { Badge } from "./Badge";

export default {
  title: "Common/Badge"
};

export const Tones: StoryFn = () => (
  <StoryFrame>
  <div style={{ display: "flex", gap: 12 }}>
    <Badge>Draft</Badge>
    <Badge tone="success">Published</Badge>
  </div>
  </StoryFrame>
);
