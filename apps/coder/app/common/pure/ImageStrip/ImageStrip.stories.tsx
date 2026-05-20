import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImageStrip } from "./ImageStrip";

const meta: Meta<typeof ImageStrip> = {
  title: "Common/ImageStrip",
  component: ImageStrip
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Images: Story = {
  args: {
    images: [
      { id: "one", alt: "Preview", src: "https://placehold.co/320x180/png" },
      { id: "two", alt: "Mobile preview", src: "https://placehold.co/160x220/png" }
    ]
  }
};
