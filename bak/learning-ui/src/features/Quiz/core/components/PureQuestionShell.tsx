import React, { ReactNode } from 'react';
import { Button } from '../../../../common/Button/Button';
import { LearningMarkdown } from '../../../../common/Markdown';
import { MessageGroup, type MessageGroupItem } from '../../../../common/MessageGroup/MessageGroup';
import { PureBadge, BadgeColor } from '../../../../common/Badge/PureBadge';
import { useLocale } from '../../../../system/LocaleContext';
import { AnswerStatus } from '../types/models';
import styles from "./PureQuestionShell.module.css";

export interface PureQuestionProps {
  status?: AnswerStatus;
  difficulty?: 'easy' | 'medium' | 'hard' | 'boss';
  children: ReactNode;
  className?: string;
}

const getDifficultyColor = (difficulty: string): BadgeColor => {
  switch (difficulty) {
    case 'easy': return 'success';
    case 'medium': return 'warning';
    case 'hard': return 'danger';
    case 'boss': return 'accent';
    default: return 'default';
  }
};

export function PureQuestion({ status = 'building', difficulty = 'medium', children, className = '' }: PureQuestionProps) {
  const isBoss = difficulty === 'boss';
  const isSuccess = status === 'success';
  const isPartial = status === 'partial';

  return (
    <div className={`${styles.question} ${isSuccess ? styles.correct : ''} ${isPartial ? styles.partial : ''} ${isBoss ? `lui-theme-dark ${styles.boss}` : ''} ${className}`}>
      {children}
    </div>
  );
}

export interface PureQuestionHeaderProps {
  questionNumber: number | string;
  displayLabel?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'boss';
  maxPoints: number;
  earnedPoints?: number;
  showScore?: boolean;
  isGenerated?: boolean;
}

PureQuestion.Header = function PureQuestionHeader({
  questionNumber,
  displayLabel,
  difficulty,
  maxPoints,
  earnedPoints,
  showScore = false,
  isGenerated = false,
}: PureQuestionHeaderProps) {
  const { dict, t } = useLocale();
  const isBoss = difficulty === 'boss';
  const scoreColor: BadgeColor = earnedPoints === maxPoints
    ? 'success'
    : earnedPoints && earnedPoints > 0
      ? 'warning'
      : 'danger';
  
  return (
    <div className={styles.header}>
      <span className={styles.questionNumber}>
        {displayLabel || t(dict.quiz.questionNumber, { number: questionNumber })}
      </span>
      {isGenerated && (
        <PureBadge variant="tinted" color="info">AI practice</PureBadge>
      )}
      <PureBadge 
        variant="solid" 
        color={getDifficultyColor(difficulty)}
        className={isBoss ? styles.difficultyBoss : ''}
      >
        {difficulty}
      </PureBadge>
      <PureBadge variant="tinted" color={showScore ? scoreColor : 'accent'} className={styles.pointsBadge}>
        {showScore && earnedPoints !== undefined
          ? `${earnedPoints}/${maxPoints} ${dict.shared.pts}`
          : maxPoints === 1 ? t(dict.quiz.pointSingular, { points: maxPoints }) : t(dict.quiz.pointPlural, { points: maxPoints })}
      </PureBadge>
    </div>
  );
};

PureQuestion.Title = function PureQuestionTitle({ children }: { children: ReactNode }) {
  return <h4 className={styles.titleText}>{children}</h4>;
};

PureQuestion.Body = function PureQuestionBody({ children }: { children: ReactNode }) {
  return <div className={styles.description}>{children}</div>;
};

PureQuestion.Focus = function PureQuestionFocus({ children }: { children: ReactNode }) {
  return <p className={styles.practiceFocus}>{children}</p>;
};

PureQuestion.ContextArea = function PureQuestionContextArea({ children }: { children: ReactNode }) {
  return <div className={styles.contextArea}>{children}</div>;
};

export interface PureQuestionFeedbackProps {
  status: AnswerStatus;
  isRevealed: boolean;
  apiError: boolean;
  feedback: string | null;
  discovery?: string | null;
  earnedPoints: number;
  maxPoints: number;
  revealedAnswer?: ReactNode;
  isBoss?: boolean;
}

PureQuestion.Feedback = function PureQuestionFeedback({
  status, isRevealed, apiError, feedback, discovery, earnedPoints, maxPoints, revealedAnswer, isBoss
}: PureQuestionFeedbackProps) {
  const { dict, t } = useLocale();
  const isSuccess = status === 'success';
  const isPartial = status === 'partial';
  const items: MessageGroupItem[] = [];
  const hasUsefulFeedback = Boolean(feedback && feedback.trim() && feedback.trim() !== 'No valid answer submitted.');

  if (isSuccess) {
    items.push({
      type: 'success',
      title: isBoss ? dict.quiz.bossDefeated : dict.quiz.correct,
      content: (
        <>
          <span>{t(dict.quiz.pointsEarned, { points: earnedPoints })}</span>
          {discovery && (
            <div style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
              <LearningMarkdown>{discovery}</LearningMarkdown>
            </div>
          )}
        </>
      ),
    });
  }

  if (isPartial && !apiError) {
    items.push({
      type: 'warning',
      title: dict.quiz.partialTitle,
      content: hasUsefulFeedback ? feedback : `${earnedPoints}/${maxPoints} ${dict.shared.pts}`,
    });
  }

  if (status === 'failed' && !apiError && hasUsefulFeedback) {
    items.push({
      type: 'error',
      title: dict.quiz.feedbackTitle,
      content: feedback,
    });
  }

  if (status === 'building' && feedback && !apiError) {
    items.push({
      type: 'info',
      title: dict.quiz.feedbackTitle,
      content: feedback,
    });
  }

  if (apiError) {
    items.push({
      type: 'error',
      title: dict.quiz.connectionIssueTitle,
      content: dict.quiz.connectionIssueBody,
    });
  }

  if (isRevealed && revealedAnswer) {
    items.push({
      type: 'info',
      title: dict.quiz.answerTitle,
      content: revealedAnswer,
    });
  }

  return (
    items.length > 0 ? (
      <div style={{ marginTop: '20px' }}>
        <MessageGroup items={items} />
      </div>
    ) : null
  );
};

export interface PureQuestionActionsProps {
  isChecking: boolean;
  isSuccess: boolean;
  isRevealed: boolean;
  apiError: boolean;
  earnedPoints: number;
  maxPoints: number;
  checkDisabled: boolean;
  onCheck: () => void;
  onGiveUp: () => void;
  onMarkCorrect?: () => void;
  disabled?: boolean;
}

PureQuestion.Actions = function PureQuestionActions({
  isChecking, isSuccess, isRevealed, apiError, earnedPoints, maxPoints, checkDisabled, onCheck, onGiveUp, onMarkCorrect, disabled = false
}: PureQuestionActionsProps) {
  const { dict, t } = useLocale();

  if (isChecking) {
    return (
      <div className={styles.actions}>
        <div className={styles.checking}>
          <span className={styles.spinner}></span>
          {dict.quiz.checkingAnswer}
        </div>
      </div>
    );
  }
  
  if (isSuccess || isRevealed) {
    return null;
  }
  
  if (apiError && onMarkCorrect) {
    return (
      <div className={styles.actions}>
        <div className={styles.selfCheckBtns}>
          <Button variant="success" onClick={onMarkCorrect} disabled={disabled}>{dict.quiz.markCorrect}</Button>
          <Button variant="primary" onClick={onCheck} disabled={disabled || checkDisabled}>{dict.quiz.checkAgain}</Button>
          <Button variant="secondary" onClick={onGiveUp} disabled={disabled}>{dict.quiz.giveUp}</Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.actions}>
      <Button variant="primary" onClick={onCheck} disabled={disabled || checkDisabled}>
        {earnedPoints > 0 ? dict.quiz.improveAnswer : dict.quiz.checkAnswer}
      </Button>
      <Button variant="secondary" onClick={onGiveUp} disabled={disabled}>{dict.quiz.giveUp}</Button>
      {earnedPoints > 0 && (
        <span className={styles.partialBadge}>
          {t(dict.quiz.partialPointsBadge, { earned: earnedPoints, max: maxPoints })}
        </span>
      )}
    </div>
  );
};
