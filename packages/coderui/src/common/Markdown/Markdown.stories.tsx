import type { StoryFn } from "@storybook/react";
import { StoryFrame } from "../../system/StoryFrame";
import { Markdown } from "./Markdown";

export default {
  title: "Common/Markdown"
};

export const RichText: StoryFn = () => (
  <StoryFrame maxWidth={620}>
    <Markdown
      text={[
        "Updated the sidebar and extracted a reusable `ChatSwitcher` component.",
        "",
        "- Supports **custom markdown handlers**.",
        "- Keeps code blocks readable.",
        "",
        "```ts",
        "const status = 'Published';",
        "```"
      ].join("\n")}
    />
  </StoryFrame>
);
