import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pagination } from "./Pagination";

const meta: Meta<typeof Pagination> = {
  title: "Common/Pagination",
  component: Pagination
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Middle: Story = {
  args: {
    currentPage: 6,
    onPageChange: () => undefined,
    totalPages: 12
  }
};

export const FirstPage: Story = {
  args: {
    currentPage: 1,
    onPageChange: () => undefined,
    totalPages: 5
  }
};
