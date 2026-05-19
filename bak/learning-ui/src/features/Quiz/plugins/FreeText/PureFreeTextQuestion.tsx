import React, { ReactNode } from 'react';
import { PureQuestion } from "../../core/components/PureQuestionShell";
import { AnswerStatus } from "../../core/types/models";
import { PureFreeTextInput } from "./PureFreeTextInput";
import { PureFreeTextInputStatus } from "./index";
import { LocaleProvider, DeepPartial, LearningUIDictionary } from '../../../../system/LocaleContext';

export interface PureFreeTextQuestionProps {
  difficulty?: 'easy' | 'medium' | 'hard' | 'boss';
  status?: AnswerStatus;
  feedbackStatus?: AnswerStatus;
  
  value: string;
  onChange: (value: string) => void;
  inputType?: 'short' | 'long';
  placeholder?: string;
  inputStatus?: PureFreeTextInputStatus;
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
  
  localeText?: DeepPartial<LearningUIDictionary>;
  children: ReactNode;
}

export function PureFreeTextQuestion({
  difficulty = 'medium',
  status = 'building',
  feedbackStatus,
  value,
  onChange,
  inputType = 'short',
  placeholder,
  inputStatus = 'default',
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
  localeText,
  children
}: PureFreeTextQuestionProps) {
  return (
    <LocaleProvider localeText={localeText}>
      <PureQuestion status={status} difficulty={difficulty}>
        {children}
        
        <PureFreeTextInput
          value={value}
          onChange={onChange}
          inputType={inputType}
          placeholder={placeholder}
          status={inputStatus}
          disabled={disabled}
          onEnterPress={showActions ? onCheck : undefined}
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
            checkDisabled={!value || isChecking}
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
