import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const codexSource = (path: string) => fileURLToPath(new URL(`../../../packages/codex/src/${path}`, import.meta.url));

const config: StorybookConfig = {
  stories: ["../app/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  async viteFinal(baseConfig) {
    return mergeConfig(baseConfig, {
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
