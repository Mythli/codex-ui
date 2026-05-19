import React, { useEffect, useState } from 'react';
import type { MDEditorProps } from '@uiw/react-md-editor';
import { LearningMarkdown, MarkdownRenderConfig, useMarkdownConfig } from '../Markdown';
import styles from './MarkdownEditor.module.css';

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  preview?: MDEditorProps['preview'];
  markdownConfig?: MarkdownRenderConfig;
}

type MDEditorComponent = React.ComponentType<MDEditorProps>;

/**
 * A themed wrapper around @uiw/react-md-editor.
 * Provides a split-pane markdown editor with a formatting toolbar.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  height = 200,
  preview = 'live',
  markdownConfig
}: MarkdownEditorProps) {
  const previewOptions = useMarkdownConfig(markdownConfig);
  const [Editor, setEditor] = useState<MDEditorComponent | null>(null);

  useEffect(() => {
    let isMounted = true;

    import('@uiw/react-md-editor')
      .then((mod) => {
        if (isMounted) setEditor(() => mod.default);
      })
      .catch(() => {
        if (isMounted) setEditor(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className={styles.wrapper} data-color-mode="light">
      {Editor ? (
        <Editor
          value={value}
          onChange={(val) => onChange(val || '')}
          height={height}
          preview={preview}
          previewOptions={previewOptions}
          components={{
            preview: (source) => (
              <div className={styles.editorPreview}>
                <LearningMarkdown config={previewOptions}>{source}</LearningMarkdown>
              </div>
            ),
          }}
          textareaProps={{ placeholder }}
        />
      ) : (
        <textarea
          className={styles.textareaFallback}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          style={{ minHeight: height }}
        />
      )}
    </div>
  );
}
