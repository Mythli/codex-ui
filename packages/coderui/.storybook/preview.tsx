import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/theme.css";

const withCoderTheme: Decorator = (Story, context) => {
  const themeClass =
    context.globals.theme === "light"
      ? "coder-theme-light"
      : context.globals.theme === "dark"
        ? "coder-theme-dark"
        : "";

  return (
    <div className={["coder-story-root", themeClass].filter(Boolean).join(" ")}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withCoderTheme],
  globalTypes: {
    theme: {
      description: "CoderUI theme",
      defaultValue: "auto",
      toolbar: {
        icon: "circlehollow",
        items: [
          { title: "Auto", value: "auto" },
          { title: "Light", value: "light" },
          { title: "Dark", value: "dark" }
        ],
        title: "Theme"
      }
    }
  },
  parameters: {
    controls: {
      expanded: true
    },
    options: {
      storySort: {
        order: ["Common"]
      }
    }
  }
};

export default preview;
