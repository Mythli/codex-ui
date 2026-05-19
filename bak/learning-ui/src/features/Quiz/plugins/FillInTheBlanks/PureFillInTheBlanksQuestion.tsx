import React, { ReactNode } from 'react';
import { PureQuestion } from "../../core/components/PureQuestionShell";
import { AnswerStatus } from "../../core/types/models";
import { PureFillInTheBlanksInput } from "./PureFillInTheBlanksInput";
import { PureFillInTheBlanksPart, PureFillInTheBlanksStatus } from "./index";
import { LocaleProvider, DeepPartial, LearningUIDictionary } from '../../../../system/LocaleContext';

export interface PureFillInTheBlanksQuestionProps {
  difficulty?: 'easy' | 'medium' | 'hard' | 'boss';
  status?: AnswerStatus;
  feedbackStatus?: AnswerStatus;
  
  parts: PureFillInTheBlanksPart[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  statusMap?: Record<string, PureFillInTheBlanksStatus>;
  displayValues?: Record<string, string>;
  helperMap?: Record<string, ReactNode>;
  disabled?: boolean;
  
  isChecking?: boolean;
  isRevealed?: boolean;
  apiError?: boolean;
  feedback?: string | null;
  discovery?: string | null;
  earnedPoints?: number;
  maxPoints: number;
  revealedAnswer?: ReactNode;
  showFeedback?: boolean;
  showActions?: boolean;
  
  onCheck: () => void;
  onGiveUp: () => void;
  onMarkCorrect?: () => void;
  checkDisabled?: boolean;
  
  localeText?: DeepPartial<LearningUIDictionary>;
  children: ReactNode;
}

export function PureFillInTheBlanksQuestion({
  difficulty = 'medium',
  status = 'building',
  feedbackStatus,
  parts,
  values,
  onChange,
  statusMap,
  displayValues,
  helperMap,
  disabled = false,
  isChecking = false,
  isRevealed = false,
  apiError = false,
  feedback = null,
  discovery = null,
  earnedPoints = 0,
  maxPoints,
  revealedAnswer,
  showFeedback = true,
  showActions = true,
  onCheck,
  onGiveUp,
  onMarkCorrect,
  checkDisabled = false,
  localeText,
  children
}: PureFillInTheBlanksQuestionProps) {
  return (
    <LocaleProvider localeText={localeText}>
      <PureQuestion status={status} difficulty={difficulty}>
        {children}
        
        <PureFillInTheBlanksInput
          parts={parts}
          values={values}
          onChange={onChange}
          statusMap={statusMap}
          displayValues={displayValues}
          helperMap={helperMap}
          disabled={disabled}
        />

        {showFeedback && (
          <PureQuestion.Feedback
            status={feedbackStatus || status}
            isRevealed={isRevealed}
            apiError={apiError}
            feedback={feedback}
            discovery={discovery}
            earnedPoints={earnedPoints}
            maxPoints={maxPoints}
            revealedAnswer={revealedAnswer}
            isBoss={difficulty === 'boss'}
          />
        )}

        {showActions && (
          <PureQuestion.Actions
            isChecking={isChecking}
            isSuccess={status === 'success'}
            isRevealed={isRevealed}
            apiError={apiError}
            earnedPoints={earnedPoints}
            maxPoints={maxPoints}
            checkDisabled={isChecking || checkDisabled}
            onCheck={onCheck}
            onGiveUp={onGiveUp}
            onMarkCorrect={onMarkCorrect}
            disabled={disabled}
          />
        )}
      </PureQuestion>
    </LocaleProvider>
  );
}
