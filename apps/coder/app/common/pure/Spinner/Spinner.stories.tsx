import type { StoryFn } from "@storybook/react";
import { StoryFrame } from "../system/StoryFrame";
import { Spinner } from "./Spinner";

export default {
  title: "Common/Spinner"
};

export const Loading: StoryFn = () => (
  <StoryFrame>
    <div
      style={{
        alignItems: "center",
        background: "var(--coder-surface)",
        border: "1px solid var(--coder-border)",
        borderRadius: "var(--coder-radius-md)",
        display: "flex",
        gap: "var(--coder-space-3)",
        padding: "var(--coder-space-4)",
        width: 220
      }}
    >
      <Spinner />
      <span style={{ color: "var(--coder-muted)" }}>Loading workspace</span>
    </div>
  </StoryFrame>
);
