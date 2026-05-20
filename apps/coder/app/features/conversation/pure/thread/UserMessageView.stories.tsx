import type { Meta, StoryObj } from "@storybook/react-vite";
import { UserMessageView } from "./UserMessageView";

const meta = {
  title: "Codex/Thread/UserMessageView",
  component: UserMessageView
} satisfies Meta<typeof UserMessageView>;

export default meta;
type Story = StoryObj<typeof meta>;

const dashboardPreview = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#111827"/>
  <rect x="18" y="18" width="284" height="144" rx="14" fill="#f9fafb"/>
  <rect x="38" y="38" width="104" height="104" rx="10" fill="#38bdf8"/>
  <rect x="160" y="38" width="122" height="26" rx="6" fill="#0f172a"/>
  <rect x="160" y="80" width="54" height="62" rx="6" fill="#fb7185"/>
  <rect x="228" y="80" width="54" height="62" rx="6" fill="#22c55e"/>
</svg>
`);

const referencePhoto = svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" fill="#e2e8f0"/>
  <rect x="28" y="28" width="264" height="124" rx="12" fill="#94a3b8"/>
  <circle cx="88" cy="68" r="18" fill="#facc15"/>
  <path d="M38 140l74-58 46 34 34-26 90 50z" fill="#334155"/>
  <path d="M122 140l36-48 40 48z" fill="#f8fafc" opacity=".8"/>
</svg>
`);

export const Text: Story = {
  args: {
    children: "Can you compare the latest mockup with the budget and call out anything that looks risky before I send it?"
  }
};

export const WithAttachments: Story = {
  args: {
    images: [
      { id: "mockup", alt: "Dashboard mockup", kind: "dataUrl", dataUrl: dashboardPreview },
      { id: "reference", alt: "Reference photo", kind: "dataUrl", dataUrl: referencePhoto }
    ],
    attachments: [
      { id: "1", kind: "file", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "Finanzplan_Sparkasse_v8_growth.xlsx", sizeLabel: "48 KB" },
      { id: "2", kind: "file", mimeType: "application/x-dxf", name: "sheet_4mm_321_stainless_steel_plate_1.dxf", sizeLabel: "62 KB" },
      { id: "3", kind: "file", mimeType: "application/pdf", name: "vendor-quote.pdf", sizeLabel: "96 KB" },
      { id: "4", kind: "file", mimeType: "application/json", name: "settings.json", sizeLabel: "3 KB" }
    ],
    children: "Please check the spreadsheet assumptions against the quote, then use the reference image and DXF to flag any mismatch in the stainless plate geometry."
  }
};

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
