import React, { ReactNode } from 'react';
import { PureQuestion } from "../../core/components/PureQuestionShell";
import { AnswerStatus } from "../../core/types/models";
import { PureMultipleChoiceInput } from "./PureMultipleChoiceInput";
import { ChoiceItem } from "./index";
import { LocaleProvider, DeepPartial, LearningUIDictionary } from '../../../../system/LocaleContext';

export interface PureMultipleChoiceQuestionProps {
  difficulty?: 'easy' | 'medium' | 'hard' | 'boss';
  status?: AnswerStatus;
  feedbackStatus?: AnswerStatus;
  
  choices: ChoiceItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multiSelect?: boolean;
  disabled?: boolean;
  statusMap?: Record<string, 'correct' | 'incorrect' | 'default'>;
  
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
  
  localeText?: DeepPartial<LearningUIDictionary>;
  children: ReactNode;
}

export function PureMultipleChoiceQuestion({
  difficulty = 'medium',
  status = 'building',
  feedbackStatus,
  choices,
  selectedIds,
  onChange,
  multiSelect = false,
  disabled = false,
  statusMap = {},
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
  localeText,
  children
}: PureMultipleChoiceQuestionProps) {
  return (
    <LocaleProvider localeText={localeText}>
      <PureQuestion status={status} difficulty={difficulty}>
        {children}
        
        <PureMultipleChoiceInput
          choices={choices}
          selectedIds={selectedIds}
          onChange={onChange}
          multiSelect={multiSelect}
          disabled={disabled}
          statusMap={statusMap}
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
            checkDisabled={selectedIds.length === 0 || isChecking}
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
