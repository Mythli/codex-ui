import type { StoryFn } from "@storybook/react";
import { FiExternalLink, FiMonitor, FiRefreshCw } from "react-icons/fi";
import { IconButton } from "../IconButton";
import { StoryFrame } from "../../system/StoryFrame";
import { UrlBar } from "./UrlBar";

export default {
  title: "Common/UrlBar"
};

export const Preview: StoryFn = () => (
  <StoryFrame>
    <div style={{ border: "1px solid var(--coder-border)", height: 44, maxWidth: 720 }}>
      <UrlBar
        actions={
          <>
            <IconButton label="Reload preview">
              <FiRefreshCw />
            </IconButton>
            <IconButton label="Open preview">
              <FiExternalLink />
            </IconButton>
          </>
        }
        leading={
          <IconButton label="Change viewport">
            <FiMonitor />
          </IconButton>
        }
        title="Preview URL"
        value="http://localhost:4321/projects/codex-api"
      />
    </div>
  </StoryFrame>
);
