import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import ReactMarkdown, { type Options as ReactMarkdownOptions } from 'react-markdown';
import styles from './Markdown.module.css';

export type MarkdownRenderConfig = Omit<ReactMarkdownOptions, 'children' | 'className'>;

export interface MarkdownProviderProps {
  config?: MarkdownRenderConfig;
  children: ReactNode;
}

const MarkdownContext = createContext<MarkdownRenderConfig>({});

export function mergeMarkdownConfig(
  base: MarkdownRenderConfig = {},
  override: MarkdownRenderConfig = {}
): MarkdownRenderConfig {
  return {
    ...base,
    ...override,
    components: {
      ...(base.components || {}),
      ...(override.components || {}),
    },
  };
}

export function MarkdownProvider({ config, children }: MarkdownProviderProps) {
  const parentConfig = useContext(MarkdownContext);
  const value = useMemo(
    () => mergeMarkdownConfig(parentConfig, config),
    [parentConfig, config]
  );

  return (
    <MarkdownContext.Provider value={value}>
      {children}
    </MarkdownContext.Provider>
  );
}

export function useMarkdownConfig(config?: MarkdownRenderConfig) {
  const contextConfig = useContext(MarkdownContext);
  return useMemo(
    () => mergeMarkdownConfig(contextConfig, config),
    [contextConfig, config]
  );
}

export interface LearningMarkdownProps {
  children: string;
  className?: string;
  config?: MarkdownRenderConfig;
}

export function LearningMarkdown({ children, className, config }: LearningMarkdownProps) {
  const markdownConfig = useMarkdownConfig(config);
  const resolvedClassName = [styles.markdown, className].filter(Boolean).join(' ');

  return (
    <ReactMarkdown className={resolvedClassName} {...markdownConfig}>
      {children}
    </ReactMarkdown>
  );
}
