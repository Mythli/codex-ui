import type { StoryFn } from "@storybook/react";
import { StoryFrame } from "../system/StoryFrame";
import { Input, Select, Textarea } from "./Input";

export default {
  title: "Common/Input"
};

export const Fields: StoryFn = () => (
  <StoryFrame maxWidth={420}>
  <div style={{ display: "grid", gap: 12 }}>
    <Input placeholder="Project name" />
    <Select defaultValue="gpt-5.5">
      <option value="gpt-5.5">OpenAI: GPT-5.5</option>
      <option value="gpt-5.4">OpenAI: GPT-5.4</option>
    </Select>
    <Textarea placeholder="Plan and build anything" />
  </div>
  </StoryFrame>
);
