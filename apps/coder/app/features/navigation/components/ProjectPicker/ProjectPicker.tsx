import type { ReactElement, ReactNode } from "react";
import { LuFolder } from "react-icons/lu";
import type { CodexProjectIndexItem } from "@taylordb/codex";
import { MenuItem, MenuList, Popover, type PopoverRenderTriggerProps } from "@app/common/pure";

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
  projects: CodexProjectIndexItem[];
  renderTrigger: (input: PopoverRenderTriggerProps) => ReactElement;
}) {
  return (
    <Popover
      offsetPx={6}
      placement={placement}
      renderTrigger={renderTrigger}
    >
      {({ close }) => (
        <MenuList label={children}>
          {projects.map((project) => (
            <MenuItem
              key={project.cwd}
              label={project.name}
              leadingIcon={<LuFolder aria-hidden="true" />}
              onSelect={() => {
                onSelectProject(project.cwd);
                close();
              }}
            />
          ))}
        </MenuList>
      )}
    </Popover>
  );
}
