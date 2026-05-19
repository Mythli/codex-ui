import type { ReactElement, ReactNode } from "react";
import { LuFolder } from "react-icons/lu";
import { MenuItem, MenuList, Popover, type PopoverRenderTriggerProps } from "../../../../common";
import type { CoderProjectItem } from "../../../CoderCore/types";

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
      offsetPx={6}
      placement={placement}
      renderTrigger={renderTrigger}
    >
      {({ close }) => (
        <MenuList label={children}>
          {projects.map((project) => (
            <MenuItem
              key={project.id}
              label={project.name}
              leadingIcon={<LuFolder aria-hidden="true" />}
              onSelect={() => {
                onSelectProject(project.id);
                close();
              }}
            />
          ))}
        </MenuList>
      )}
    </Popover>
  );
}
