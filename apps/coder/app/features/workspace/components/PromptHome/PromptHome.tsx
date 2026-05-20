import { Button } from "@app/common/pure";
import styles from "./PromptHome.module.css";

type PromptStarter = {
  label: string;
  prompt: string;
};

const defaultStarters: PromptStarter[] = [
  { label: "Explain this codebase", prompt: "Explain this codebase" },
  { label: "Debug an issue", prompt: "Debug an issue" },
  { label: "Add a new feature", prompt: "Add a new feature" },
  { label: "Refactor code", prompt: "Refactor code" }
];

export function PromptHome({
  onSelectStarter,
  starters = defaultStarters
}: {
  onSelectStarter: (prompt: string) => void;
  starters?: PromptStarter[];
}) {
  return (
    <div className={styles.promptHome}>
      <div className={styles.sparkles}>* * *</div>
      <h1>What can I help you build?</h1>
      <p>Your AI coding assistant. Ask me anything about your project.</p>
      <div className={styles.promptSuggestions}>
        {starters.map((starter) => (
          <Button key={starter.label} onClick={() => onSelectStarter(starter.prompt)} variant="ghost">
            {starter.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
