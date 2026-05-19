import type { ReactElement, ReactNode } from "react";
import { LuFolder } from "react-icons/lu";
import { Popover, type PopoverRenderTriggerProps } from "../../../../common";
import type { CoderProjectItem } from "../../../CoderCore/types";
import styles from "./ProjectPicker.module.css";

export function ProjectPicker({
  children,
  onSelectProject,
  placement = "bottom-end",
  projects,
  renderTrigger
}: {
  children?: ReactNode;
  onSelectProject: (projectId: string) => void;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  projects: CoderProjectItem[];
  renderTrigger: (input: PopoverRenderTriggerProps) => ReactElement;
}) {
  return (
    <Popover
      contentClassName={styles.surface}
      offsetPx={6}
      placement={placement}
      renderTrigger={renderTrigger}
    >
      {({ close }) => (
        <div className={styles.menu} role="menu">
          {children ? <div className={styles.title}>{children}</div> : null}
          {projects.map((project) => (
            <button
              className={styles.item}
              key={project.id}
              onClick={() => {
                onSelectProject(project.id);
                close();
              }}
              role="menuitem"
              type="button"
            >
              <LuFolder aria-hidden="true" />
              <span>{project.name}</span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
