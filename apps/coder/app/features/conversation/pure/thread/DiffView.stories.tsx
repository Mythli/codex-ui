import type { Meta, StoryObj } from "@storybook/react-vite";
import { DiffView } from "./DiffView";

const meta = {
  title: "Codex/Transcript/DiffView",
  component: DiffView
} satisfies Meta<typeof DiffView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unified: Story = {
  args: {
    files: [
      {
        additions: 3,
        deletions: 2,
        path: "apps/coder/app/common/pure/Menu/Menu.tsx",
        diff: [
          "@@ -21,8 +21,9 @@ export function MenuItem({",
          "   children,",
          "-  selected",
          "+  selected,",
          "+  trailing",
          " }: MenuItemProps) {",
          "   return (",
          "-    <button className={styles.item}>",
          "+    <button className={styles.item} aria-current={selected ? \"page\" : undefined}>",
          "       {children}",
          "     </button>"
        ].join("\n")
      }
    ]
  }
};
