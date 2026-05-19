import type { StoryFn } from "@storybook/react";
import { StoryFrame } from "../../system/StoryFrame";
import { Badge } from "../Badge/Badge";
import { Stack } from "./Stack";

export default {
  title: "Common/Stack"
};

export const Spacing: StoryFn = () => (
  <StoryFrame maxWidth={320}>
  <Stack gap={3}>
    <Badge>First</Badge>
    <Badge>Second</Badge>
    <Badge>Third</Badge>
  </Stack>
  </StoryFrame>
);
