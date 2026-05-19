import React, { useMemo, ReactNode } from 'react';
import { QuizProvider, useQuiz } from '../store/QuizContext';
import { QuizSession } from "../types/models";
import { QuizQuestionRenderer } from './QuizQuestionRenderer';
import { Header } from '../../../../common/Header';
import { BurgerButton } from '../../../Layout/connected/BurgerButton';
import { PageShell } from '../../../Layout/pure/PageShell';
import { PageFooterNav } from '../../../Layout/pure/PageFooterNav';
import { Stack } from '../../../../common/Stack/Stack';
import { Button } from '../../../../common/Button/Button';
import {
  requireLearningUIDependency,
  useLearningUIConfig
} from '../../../../system/LocaleContext';

export interface QuizPageProps {
  /** Unique identifier for the backend-owned quiz definition */
  quizId: string;
  /** Initial backend session for SSR hydration */
  initialQuiz?: QuizSession;
  /** Optional title override */
  title?: string;
  /** The label for the previous page button */
  prevLabel?: string;
  /** Callback fired when the previous button is clicked */
  onPrev?: () => void;
  /** The label for the next page button and the footer card */
  nextLabel?: string;
  /** Callback fired when the next button or footer card is clicked */
  onNext?: () => void;
  /** Number of AI-generated questions to append when the practice control is used. */
  generatedQuestionCount?: number;
  /** The content of the quiz page (e.g., questions and intro) */
  children: ReactNode;
}

/**
 * Internal content wrapper that consumes the QuizContext to drive the Header.
 */
function QuizPageContent({
  title,
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  generatedQuestionCount = 3,
  children
}: Omit<QuizPageProps, 'quizId' | 'initialQuiz'>) {
  const {
    quiz,
    state,
    plugins,
    resetQuiz,
    setAnswer,
    submitQuestion,
    giveUp,
    markCorrect,
    generateMoreQuestions,
    checkingIds,
    isGeneratingQuestions,
    generationError
  } = useQuiz();
  const questions = quiz?.questions || [];
  const baseQuestions = questions.filter((question) => question.metadata?.source !== 'generated');
  const generatedQuestions = questions.filter((question) => question.metadata?.source === 'generated');
  const resolvedTitle = title || quiz?.title || 'Quiz';
  const totalQuestions = questions.length;
  const totalPoints = questions.reduce((sum, question) => sum + question.maxPoints, 0);

  // Calculate global progress and points dynamically using the plugins
  const stats = useMemo(() => {
    let done = 0;
    let earned = 0;
    let hasDraft = false;
    
    Object.values(state).forEach(q => {
      // A question is "done" if it was successfully answered, failed, or revealed (gave up)
      if (q.status === 'success' || q.status === 'failed' || q.revealed) {
        done++;
      }
      earned += (q.earnedPoints || 0);

      // Find the plugin that owns this question type to check if the answer is empty
      const plugin = plugins.find(p => p.type === q.questionType);
      if (plugin && !plugin.isEmpty(q.answer)) {
        hasDraft = true;
      }
    });

    return { done, earned, hasDraft };
  }, [state, plugins]);

  const hasProgress = stats.done > 0 || stats.earned > 0 || stats.hasDraft;

  return (
    <PageShell
      header={
        <Header>
          <Header.Left>
            <BurgerButton />
            {onPrev && (
              <Header.NavButton direction="prev" label={prevLabel} onClick={onPrev} />
            )}
          </Header.Left>
          <Header.Center>
            <Header.Title
              title={resolvedTitle}
              actions={(
                hasProgress ? <Header.ResetButton onReset={resetQuiz} /> : undefined
              )}
            >
              <Header.Progress
                value={stats.done}
                max={totalQuestions}
                label="Questions"
                secondary={<><strong>{stats.earned}</strong>/{totalPoints} Pts</>}
              />
            </Header.Title>
          </Header.Center>
          <Header.Right>
            {onNext && (
              <Header.NavButton direction="next" label={nextLabel} onClick={onNext} />
            )}
          </Header.Right>
        </Header>
      }
      footer={
        onNext && nextLabel ? (
          <PageFooterNav>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNext();
              }}
              style={{ textDecoration: 'none', display: 'contents' }}
            >
              <PageFooterNav.Card title={nextLabel} />
            </a>
          </PageFooterNav>
        ) : undefined
      }
    >
      <Stack gap={6}>
        {children}
        {baseQuestions.map((question, index) => {
          const questionState = state[question.id];

          return (
            <QuizQuestionRenderer
              key={question.id}
              question={question}
              displayLabel={`Question ${index + 1}`}
              state={questionState}
              plugins={plugins}
              isChecking={Boolean(checkingIds[question.id] || questionState?.isChecking)}
              setAnswer={(questionId, answer, questionType) => setAnswer(questionId, answer, questionType)}
              submit={submitQuestion}
              giveUp={giveUp}
              markCorrect={markCorrect}
            />
          );
        })}
        {generatedQuestions.length > 0 && (
          <div style={{ borderTop: '1px solid var(--lui-color-border)', paddingTop: 24, marginTop: 8 }}>
            <h3 style={{ margin: 0, color: 'var(--lui-color-text-main)' }}>Extra Practice</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--lui-color-text-muted)' }}>
              Personalized questions based on your progress
            </p>
          </div>
        )}
        {generatedQuestions.map((question, index) => {
          const questionState = state[question.id];

          return (
            <QuizQuestionRenderer
              key={question.id}
              question={question}
              displayLabel={`Extra Practice ${index + 1}`}
              state={questionState}
              plugins={plugins}
              isChecking={Boolean(checkingIds[question.id] || questionState?.isChecking)}
              setAnswer={(questionId, answer, questionType) => setAnswer(questionId, answer, questionType)}
              submit={submitQuestion}
              giveUp={giveUp}
              markCorrect={markCorrect}
            />
          );
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <Button
            type="button"
            variant="secondary"
            isLoading={isGeneratingQuestions}
            onClick={() => void generateMoreQuestions(generatedQuestionCount)}
          >
            {generatedQuestions.length > 0
              ? `Add ${generatedQuestionCount} more practice questions`
              : `Get ${generatedQuestionCount} extra practice questions`}
          </Button>
          {generationError && (
            <span style={{ color: 'var(--color-danger, #b91c1c)', fontSize: 14 }}>
              {generationError}
            </span>
          )}
        </div>
      </Stack>
    </PageShell>
  );
}

/**
 * The root provider and layout wrapper for a Quiz Page.
 * Automatically wires up the global layout, progress header, and state management.
 */
export function QuizPage({
  quizId,
  initialQuiz,
  title,
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  generatedQuestionCount,
  children
}: QuizPageProps) {
  const learningUI = useLearningUIConfig();
  const resolvedAdapter = requireLearningUIDependency(
    learningUI.adapters?.quiz,
    'QuizPage adapter'
  );
  const resolvedPlugins = requireLearningUIDependency(
    learningUI.plugins?.quiz,
    'QuizPage plugins'
  );

  return (
    <QuizProvider quizId={quizId} adapter={resolvedAdapter} plugins={resolvedPlugins} initialQuiz={initialQuiz}>
      <QuizPageContent
        title={title}
        prevLabel={prevLabel}
        onPrev={onPrev}
        nextLabel={nextLabel}
        onNext={onNext}
        generatedQuestionCount={generatedQuestionCount}
      >
        {children}
      </QuizPageContent>
    </QuizProvider>
  );
}
