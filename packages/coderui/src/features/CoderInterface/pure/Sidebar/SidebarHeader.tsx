import { FiEdit3, FiMenu } from "react-icons/fi";
import { Button } from "../../../../common";
import type { CoderProjectItem } from "../../../CoderCore/types";
import { ProjectPicker } from "../../ProjectPicker";
import styles from "./SidebarHeader.module.css";

export function SidebarHeader({
  chatTitle,
  onNewChat,
  onToggleSwitcher,
  project,
  projects,
}: {
  chatTitle: string;
  onNewChat?: (projectId?: string) => void;
  onToggleSwitcher: () => void;
  project: CoderProjectItem;
  projects: CoderProjectItem[];
}) {
  return (
    <header className={styles.sidebarHeader} data-testid="coder-sidebar-header">
      <Button
        aria-label="Open sidebar"
        data-testid="switch-chats-button"
        iconOnly
        onClick={onToggleSwitcher}
        title="Open sidebar"
        type="button"
        variant="ghost"
      >
        <FiMenu aria-hidden="true" />
      </Button>
      <div
        aria-label="Current chat"
        className={styles.projectButton}
        data-chat-title={chatTitle}
        data-project-name={project.name}
        data-testid="current-chat-heading"
      >
        <div className={styles.projectName}>{project.name}</div>
        <div className={styles.chatTitle}>{chatTitle}</div>
      </div>
      <ProjectPicker
        onSelectProject={(projectId) => onNewChat?.(projectId)}
        projects={projects}
        renderTrigger={({ ref, props }) => (
          <Button
            {...props}
            aria-label="New chat"
            data-testid="new-chat-button"
            iconOnly
            ref={ref}
            title="New chat"
            variant="ghost"
          >
            <FiEdit3 />
          </Button>
        )}
      >
        New chat in
      </ProjectPicker>
    </header>
  );
}
