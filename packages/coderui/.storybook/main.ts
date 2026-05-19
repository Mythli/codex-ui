import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const codexSource = (path: string) => fileURLToPath(new URL(`../../codex/src/${path}`, import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: [
          {
            find: /^@taylordb\/codex$/,
            replacement: codexSource("index.ts")
          },
          {
            find: /^@taylordb\/codex\/browser$/,
            replacement: codexSource("browser.ts")
          },
          {
            find: /^@taylordb\/codex\/server$/,
            replacement: codexSource("server.ts")
          }
        ]
      }
    });
  }
};

export default config;
