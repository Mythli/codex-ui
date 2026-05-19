import type { MarkdownRenderConfig } from '@taylordb/learning-ui';

function DemoMoleculeTag({ notation }: { notation: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        border: '1px solid var(--lui-color-border)',
        borderRadius: 999,
        background: 'var(--lui-color-bg-alt)',
        color: 'var(--lui-color-text-main)',
        fontSize: '0.88em',
        fontWeight: 600,
        verticalAlign: 'baseline',
      }}
      title="Rendered by the demo Markdown config"
    >
      <span aria-hidden>mol</span>
      <code style={{ font: 'inherit' }}>{notation}</code>
    </span>
  );
}

export const demoMarkdownConfig: MarkdownRenderConfig = {
  components: {
    code({ className, children, ...props }) {
      const language = className?.replace('language-', '');
      const value = String(children).trim();
      const moleculeTag = value.match(/^molecule:([\s\S]+)$/);

      if (language === 'smiles' || language === 'mol') {
        return <DemoMoleculeTag notation={value} />;
      }

      if (!className && moleculeTag) {
        return <DemoMoleculeTag notation={moleculeTag[1].trim()} />;
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  },
};
