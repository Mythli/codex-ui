import React, { ReactNode } from 'react';
import { MdStyle } from 'react-icons/md';
import { Button } from "../../../../common/Button/Button";
import { Stack } from "../../../../common/Stack/Stack";
import { useLocale } from "../../../../system/LocaleContext";
import styles from "./PureVocabularySection.module.css";

export interface PureVocabularySectionProps {
  /** The title of the section. Defaults to "Key Vocabulary" */
  title?: string;
  /** Optional description text to display below the title */
  description?: ReactNode;
  /** Callback fired when the "Add All" button is clicked */
  onAddAll: () => void;
  /** Whether all items have been added (changes button to success state) */
  isAllAdded: boolean;
  /** Whether the items are currently being saved to the backend */
  isAddingAll?: boolean;
  /** The Flashcard components to display */
  children: ReactNode;
}

export function PureVocabularySection({
  title,
  description,
  onAddAll,
  isAllAdded,
  isAddingAll = false,
  children,
}: PureVocabularySectionProps) {
  const { dict } = useLocale();
  const resolvedTitle = title || dict.vocab.keyVocabulary;

  return (
    <section className={`lui-theme-dark ${styles.section}`}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.icon}><MdStyle /></span>
          <h3 className={styles.title}>{resolvedTitle}</h3>
        </div>
        <Button 
          variant={isAllAdded ? 'success' : 'primary'} 
          size="sm" 
          onClick={onAddAll}
          disabled={isAllAdded || isAddingAll}
          isLoading={isAddingAll}
        >
          {isAllAdded ? dict.vocab.allAddedToDeck : dict.vocab.addAllToDeck}
        </Button>
      </div>
      
      {description && (
        <div className={styles.description}>
          {description}
        </div>
      )}

      <div className={styles.carouselWrapper}>
        <Stack direction="row" gap={4} className={styles.carouselInner}>
          {React.Children.map(children, child => (
            <div className={styles.cardWrapper}>
              {child}
            </div>
          ))}
        </Stack>
      </div>
    </section>
  );
}
