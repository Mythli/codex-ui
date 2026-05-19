import React, { ReactNode } from 'react';
import { PureQuestion } from "../../core/components/PureQuestionShell";
import { AnswerStatus } from "../../core/types/models";
import { PureFormulaInput } from "./PureFormulaInput";
import { PureFormulaInputStatus } from "./index";
import { LocaleProvider, DeepPartial, LearningUIDictionary } from '../../../../system/LocaleContext';

export interface PureFormulaQuestionProps {
  difficulty?: 'easy' | 'medium' | 'hard' | 'boss';
  status?: AnswerStatus;
  feedbackStatus?: AnswerStatus;
  
  formulaValue: string;
  onFormulaChange: (value: string) => void;
  previewNode?: ReactNode;
  scratchpadValue?: string;
  onScratchpadChange?: (value: string) => void;
  inputStatus?: PureFormulaInputStatus;
  disabled?: boolean;
  isInvalid?: boolean;
  
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

export function PureFormulaQuestion({
  difficulty = 'medium',
  status = 'building',
  feedbackStatus,
  formulaValue,
  onFormulaChange,
  previewNode,
  scratchpadValue,
  onScratchpadChange,
  inputStatus = 'default',
  disabled = false,
  isInvalid = false,
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
}: PureFormulaQuestionProps) {
  return (
    <LocaleProvider localeText={localeText}>
      <PureQuestion status={status} difficulty={difficulty}>
        {children}
        
        <PureFormulaInput
          formulaValue={formulaValue}
          onFormulaChange={onFormulaChange}
          previewNode={previewNode}
          scratchpadValue={scratchpadValue}
          onScratchpadChange={onScratchpadChange}
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
            checkDisabled={!formulaValue || isInvalid || isChecking}
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
