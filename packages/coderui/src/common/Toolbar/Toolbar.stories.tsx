import type { StoryFn } from "@storybook/react";
import { FiEdit3, FiSidebar } from "react-icons/fi";
import { StoryFrame } from "../../system/StoryFrame";
import { IconButton } from "../IconButton";
import { Toolbar } from "./Toolbar";

export default {
  title: "Common/Toolbar"
};

export const Basic: StoryFn = () => (
  <StoryFrame>
  <Toolbar>
    <Toolbar.Left>
      <IconButton label="Switch chats">
        <FiSidebar />
      </IconButton>
    </Toolbar.Left>
    <Toolbar.Center>
      <Toolbar.Title title="Website Template (Astro)" />
    </Toolbar.Center>
    <Toolbar.Right>
      <IconButton label="New chat">
        <FiEdit3 />
      </IconButton>
    </Toolbar.Right>
  </Toolbar>
  </StoryFrame>
);
