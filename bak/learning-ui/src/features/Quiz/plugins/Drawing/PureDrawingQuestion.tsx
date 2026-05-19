import React, { ReactNode, forwardRef } from 'react';
import { PureQuestion } from "../../core/components/PureQuestionShell";
import { AnswerStatus } from "../../core/types/models";
import { PureDrawingInput, DrawingTool } from "./PureDrawingInput";
import { PureDrawingInputRef } from "./index";
import { LocaleProvider, DeepPartial, LearningUIDictionary } from '../../../../system/LocaleContext';

export interface PureDrawingQuestionProps {
  difficulty?: 'easy' | 'medium' | 'hard' | 'boss';
  status?: AnswerStatus;
  feedbackStatus?: AnswerStatus;
  
  isReadOnly?: boolean;
  onChange?: () => void;
  tools?: DrawingTool[];
  snapshot?: Record<string, unknown> | null;
  
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

export const PureDrawingQuestion = forwardRef<PureDrawingInputRef, PureDrawingQuestionProps>(({
  difficulty = 'medium',
  status = 'building',
  feedbackStatus,
  isReadOnly = false,
  onChange,
  tools,
  snapshot,
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
}, ref) => {
  const controlsDisabled = isReadOnly || isChecking || status === 'success' || isRevealed;

  return (
    <LocaleProvider localeText={localeText}>
      <PureQuestion status={status} difficulty={difficulty}>
        {children}
        
        <PureDrawingInput
          ref={ref}
          onChange={onChange}
          isReadOnly={controlsDisabled}
          tools={tools}
          snapshot={snapshot}
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
            checkDisabled={isChecking}
            onCheck={onCheck}
            onGiveUp={onGiveUp}
            onMarkCorrect={onMarkCorrect}
            disabled={controlsDisabled}
          />
        )}
      </PureQuestion>
    </LocaleProvider>
  );
});

PureDrawingQuestion.displayName = 'PureDrawingQuestion';
