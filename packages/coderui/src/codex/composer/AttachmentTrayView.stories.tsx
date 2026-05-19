import type { Meta, StoryObj } from "@storybook/react-vite";
import { AttachmentTrayView } from "./AttachmentTrayView";

const meta = { title: "Codex/Composer/AttachmentTrayView", component: AttachmentTrayView } satisfies Meta<typeof AttachmentTrayView>;
export default meta;
type Story = StoryObj<typeof meta>;

const dashboardPreview = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#10151f"/>
  <rect x="18" y="18" width="84" height="144" rx="10" fill="#1f2937"/>
  <rect x="120" y="24" width="178" height="38" rx="8" fill="#f3f4f6"/>
  <rect x="120" y="78" width="80" height="72" rx="8" fill="#38bdf8"/>
  <rect x="216" y="78" width="82" height="72" rx="8" fill="#f97316"/>
  <path d="M136 128l18-22 18 12 18-30" fill="none" stroke="#082f49" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`);

const platePreview = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#f8fafc"/>
  <path d="M52 46h210l30 32-48 56H78L30 78z" fill="#cbd5e1" stroke="#334155" stroke-width="8" stroke-linejoin="round"/>
  <circle cx="92" cy="76" r="11" fill="#f8fafc" stroke="#334155" stroke-width="6"/>
  <circle cx="228" cy="76" r="11" fill="#f8fafc" stroke="#334155" stroke-width="6"/>
  <path d="M88 124h152" stroke="#334155" stroke-width="7" stroke-linecap="round"/>
</svg>
`);

export const WithAttachments: Story = {
  args: {
    attachments: [
      { id: "1", kind: "image", mimeType: "image/png", name: "dashboard-screenshot.png", previewUrl: dashboardPreview, sizeLabel: "140 KB" },
      { id: "2", kind: "image", mimeType: "image/jpeg", name: "plate-reference.jpeg", previewUrl: platePreview, sizeLabel: "820 KB" },
      { id: "3", kind: "file", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "Finanzplan_Sparkasse_v8_growth.xlsx", sizeLabel: "48 KB" },
      { id: "4", kind: "file", mimeType: "application/x-dxf", name: "sheet_4mm_321_stainless_steel_plate_1.dxf", sizeLabel: "62 KB" },
      { id: "5", kind: "file", mimeType: "application/pdf", name: "vendor-quote.pdf", sizeLabel: "96 KB" },
      { id: "6", kind: "file", mimeType: "application/json", name: "settings.json", sizeLabel: "3 KB" }
    ]
  }
};

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
