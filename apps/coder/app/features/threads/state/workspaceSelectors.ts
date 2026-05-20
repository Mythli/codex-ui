import { createSelector } from "@reduxjs/toolkit";
import type { CodexProjectIndexItem } from "@coder/types";
import type { CodexThreadIndexItem } from "@coder/types";
import { DEFAULT_CODEX_CWD } from "@coder/client";
import { selectSelection } from "./threadSelectionSlice";
import type { RootState } from "../../../store/configureStore";

export const selectActiveChat = createSelector(
  [(state: RootState) => state.threadIndex.threadsById, selectSelection],
  (threadsById, selection): CodexThreadIndexItem | undefined =>
    selection.kind === "thread" ? threadsById[selection.threadId] : undefined
);

export const selectCurrentProject = createSelector(
  [(state: RootState) => state.threadIndex, selectActiveChat, selectSelection],
  (threadIndex, activeChat, selection): CodexProjectIndexItem => {
    const selectedProjectId = selection.kind === "none" ? undefined : selection.projectId;
    const selectedProject = selectedProjectId ? threadIndex.projectsByCwd[selectedProjectId] : undefined;
    if (selectedProject) {
      return selectedProject;
    }

    const activeProject = activeChat?.cwd ? threadIndex.projectsByCwd[activeChat.cwd] : undefined;
    return activeProject ?? fallbackProject(selectedProjectId ?? activeChat?.cwd ?? DEFAULT_CODEX_CWD);
  }
);

function fallbackProject(cwd: string): CodexProjectIndexItem {
  return {
    cwd,
    name: cwd.split("/").filter(Boolean).at(-1) ?? cwd,
    threadIds: []
  };
}
