import React from 'react';
import { LearningMarkdown } from '../../../../common/Markdown';
import { PureFlashcard } from "./PureFlashcard";
import styles from "./PureMarkdownFlashcard.module.css";

export interface PureMarkdownFlashcardProps {
  /** Whether the card is currently showing its back face */
  isFlipped: boolean;
  /** Markdown string for the front of the card */
  frontMarkdown: string;
  /** Markdown string for the back of the card */
  backMarkdown: string;
  className?: string;
}

/**
 * A ready-to-use Flashcard that accepts Markdown strings.
 * Automatically parses and styles the content using react-markdown.
 */
export function PureMarkdownFlashcard({ 
  isFlipped, 
  frontMarkdown, 
  backMarkdown, 
  className = '' 
}: PureMarkdownFlashcardProps) {
  return (
    <PureFlashcard isFlipped={isFlipped} className={className}>
      <PureFlashcard.Front>
        <div className={styles.markdownBody}>
          <LearningMarkdown>{frontMarkdown}</LearningMarkdown>
        </div>
      </PureFlashcard.Front>
      <PureFlashcard.Back>
        <div className={styles.markdownBody}>
          <LearningMarkdown>{backMarkdown}</LearningMarkdown>
        </div>
      </PureFlashcard.Back>
    </PureFlashcard>
  );
}
