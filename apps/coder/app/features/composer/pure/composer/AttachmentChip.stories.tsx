import type { Meta, StoryObj } from "@storybook/react-vite";
import { AttachmentChip } from "./AttachmentChip";

const meta = {
  title: "Codex/Composer/AttachmentChip",
  component: AttachmentChip
} satisfies Meta<typeof AttachmentChip>;

export default meta;
type Story = StoryObj<typeof meta>;

const screenshotPreview = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96">
  <rect width="160" height="96" fill="#111827"/>
  <rect x="12" y="12" width="136" height="72" rx="8" fill="#f8fafc"/>
  <rect x="24" y="24" width="46" height="48" rx="5" fill="#38bdf8"/>
  <rect x="82" y="24" width="54" height="10" rx="3" fill="#0f172a"/>
  <rect x="82" y="44" width="24" height="28" rx="3" fill="#fb7185"/>
  <rect x="112" y="44" width="24" height="28" rx="3" fill="#22c55e"/>
</svg>
`)}`;

export const File: Story = {
  args: {
    attachment: { id: "a1", kind: "file", mimeType: "text/csv", name: "report.csv", path: "/tmp/report.csv", size: 24_000 }
  }
};

export const Json: Story = {
  args: {
    attachment: { id: "a3", kind: "file", mimeType: "application/json", name: "fixture.json", path: "/tmp/fixture.json", size: 3_000 }
  }
};

export const RemovableImage: Story = {
  args: {
    attachment: { id: "a2", kind: "image", mimeType: "image/png", name: "screenshot.png", path: "/tmp/screenshot.png", size: 1_200_000, dataUrl: screenshotPreview },
    onRemove: () => undefined
  }
};
