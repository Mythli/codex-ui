import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../../common/Button/Button';
import { Callout } from '../../../../common/Callout/Callout';
import { ConfirmModal } from '../../../../common/ConfirmModal/ConfirmModal';
import { Header } from '../../../../common/Header';
import { LearningMarkdown } from '../../../../common/Markdown';
import { PureBadge, type BadgeColor } from '../../../../common/Badge/PureBadge';
import { Stack } from '../../../../common/Stack/Stack';
import {
  requireLearningUIDependency,
  useLearningUIConfig
} from '../../../../system/LocaleContext';
import { BurgerButton } from '../../../Layout/connected/BurgerButton';
import { PageActionCard, PageFooterNav } from '../../../Layout/pure/PageFooterNav';
import { PageShell } from '../../../Layout/pure/PageShell';
import { QuizExamAdapter, QuizExamFinalQuestionPayload } from '../types/adapters';
import { PublicQuizQuestion, QuizExamAttempt, QuizExamSession, QuizPluginRegistry } from '../types/models';
import { QuestionTypePlugin, QuizQuestionCollector } from '../types/plugin';
import { QuestionState } from '../types/state';
import { QuizQuestionRenderer } from './QuizQuestionRenderer';

export interface ExamQuizPageProps {
  quizId: string;
  initialExam?: QuizExamSession;
  title?: string;
  prevLabel?: string;
  onPrev?: () => void;
  nextLabel?: string;
  onNext?: () => void;
  allowReset?: boolean;
  children?: ReactNode;
}

const formatDuration = (totalSeconds: number) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

const getRemainingSeconds = (attempt?: QuizExamAttempt) => {
  if (!attempt?.endsAt || attempt.status !== 'in-progress') return 0;
  return Math.max(0, Math.ceil((Date.parse(attempt.endsAt) - Date.now()) / 1000));
};

export const createExamQuestionState = (
  question: PublicQuizQuestion,
  attempt: QuizExamAttempt,
  answer: unknown
): QuestionState => {
  const reviewResults = attempt.status === 'submitted'
    ? attempt.computedQuestionResults || attempt.questionResults
    : attempt.questionResults;
  const result = reviewResults?.[question.id];

  if (result) {
    return { ...result, isChecking: false } as QuestionState;
  }

  return {
    questionId: question.id,
    questionType: question.questionType,
    answer: (answer ?? null) as never,
    lastSubmittedAnswer: null,
    status: 'building',
    isChecking: false,
    feedback: null,
    earnedPoints: 0,
    revealed: false,
    pluginState: attempt.pluginState[question.id],
  } as QuestionState;
};

export const getExamStats = ({
  attempt,
  questions,
  answers,
  plugins,
}: {
  attempt?: QuizExamAttempt;
  questions: PublicQuizQuestion[];
  answers: Record<string, unknown>;
  plugins: QuestionTypePlugin<unknown>[];
}) => {
  if (!attempt) return { done: 0, earned: 0, answered: 0 };

  const completedResults = attempt.status === 'submitted'
    ? attempt.computedQuestionResults || attempt.questionResults
    : attempt.questionResults;

  if (completedResults) {
    return Object.values(completedResults).reduce(
      (next, result) => ({
        done: next.done + 1,
        earned: next.earned + (result.earnedPoints || 0),
        answered: next.answered + 1,
      }),
      { done: 0, earned: 0, answered: 0 }
    );
  }

  return questions.reduce((next, question) => {
    const plugin = plugins.find((item) => item.type === question.questionType);
    const answer = answers[question.id];
    const hasAnswer = plugin ? !plugin.isEmpty(answer as never) : answer !== undefined && answer !== null;

    return {
      done: next.done,
      earned: next.earned,
      answered: next.answered + (hasAnswer ? 1 : 0),
    };
  }, { done: 0, earned: 0, answered: 0 });
};

export function ExamHeader({
  title,
  prevLabel,
  onPrev,
  answeredCount,
  totalQuestions,
  remainingSeconds,
  onSubmit,
  onReset,
  isSubmitting,
  isResetting,
}: {
  title: string;
  prevLabel?: string;
  onPrev?: () => void;
  answeredCount: number;
  totalQuestions: number;
  remainingSeconds: number;
  onSubmit: () => void;
  onReset?: () => void;
  isSubmitting?: boolean;
  isResetting?: boolean;
}) {
  const isLow = remainingSeconds <= 60;

  return (
    <Header>
      <Header.Left>
        <BurgerButton />
        {onPrev && <Header.NavButton direction="prev" label={prevLabel} onClick={onPrev} disabled={isSubmitting} />}
      </Header.Left>
      <Header.Center>
        <Header.Title
          title={title}
          actions={(
            onReset ? (
              <Header.ResetButton
                onReset={onReset}
                isLoading={isResetting}
                disabled={isSubmitting}
              />
            ) : undefined
          )}
        >
          <Header.Progress value={answeredCount} max={totalQuestions} label="answered" />
        </Header.Title>
      </Header.Center>
      <Header.Right>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
        }}>
          <span style={{
            color: isLow ? 'var(--lui-color-danger)' : 'var(--lui-color-text-main)',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>
            {formatDuration(remainingSeconds)}
          </span>
          <Header.ActionButton
            label={`${answeredCount}/${totalQuestions} answered`}
            title="Submit exam"
            indicator="✓"
            onClick={onSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          />
        </div>
      </Header.Right>
    </Header>
  );
}

function ExamQuizPageContent({
  quizId,
  adapter,
  plugins,
  initialExam,
  title,
  prevLabel,
  onPrev,
  nextLabel,
  onNext,
  allowReset = false,
  children,
}: Omit<ExamQuizPageProps, 'adapter' | 'plugins'> & {
  adapter: QuizExamAdapter;
  plugins: QuestionTypePlugin<unknown>[];
}) {
  const [session, setSession] = useState<QuizExamSession | null>(initialExam || null);
  const [isLoaded, setIsLoaded] = useState(Boolean(initialExam));
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialExam?.attempt.answers || {});
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(initialExam?.attempt));
  const [isStarting, setIsStarting] = useState(false);
  const [isStartConfirmOpen, setIsStartConfirmOpen] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const collectorsRef = useRef<Record<string, QuizQuestionCollector>>({});
  const answersRef = useRef(answers);
  const draftSequenceRef = useRef<Record<string, number>>({});
  const autoSubmittedRef = useRef(false);

  const quiz = session?.quiz;
  const attempt = session?.attempt;
  const questions = quiz?.questions || [];
  const totalQuestions = questions.length;
  const resolvedTitle = title || quiz?.title || 'Exam';
  const isTaking = attempt?.status === 'in-progress';
  const isReviewed = attempt?.status === 'submitted' || (attempt as { status?: string } | undefined)?.status === 'expired';

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (isLoaded) return;

    let mounted = true;
    adapter.loadExam(quizId).then((next) => {
      if (!mounted) return;
      setSession(next);
      setAnswers(next.attempt.answers || {});
      setRemainingSeconds(getRemainingSeconds(next.attempt));
      setIsLoaded(true);
    }).catch((error) => {
      if (!mounted) return;
      setSubmitError(error instanceof Error ? error.message : 'Could not load exam.');
      setIsLoaded(true);
    });

    return () => { mounted = false; };
  }, [adapter, isLoaded, quizId]);

  useEffect(() => {
    if (!attempt) return;
    setRemainingSeconds(getRemainingSeconds(attempt));

    if (attempt.status !== 'in-progress' || isSubmitting) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds(getRemainingSeconds(attempt));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [attempt, isSubmitting]);

  const registerQuestionCollector = useCallback((
    questionId: string,
    collector: QuizQuestionCollector | null
  ) => {
    if (collector) {
      collectorsRef.current[questionId] = collector;
    } else {
      delete collectorsRef.current[questionId];
    }
  }, []);

  const startExam = useCallback(async () => {
    setIsStarting(true);
    setSubmitError(null);
    try {
      const next = await adapter.startExam(quizId);
      setIsStartConfirmOpen(false);
      autoSubmittedRef.current = false;
      setSession(next);
      setAnswers(next.attempt.answers || {});
      setRemainingSeconds(getRemainingSeconds(next.attempt));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not start exam.');
    } finally {
      setIsStarting(false);
    }
  }, [adapter, quizId]);

  const saveAnswer = useCallback((
    questionId: string,
    answer: QuizPluginRegistry[keyof QuizPluginRegistry] | null,
    _questionType: keyof QuizPluginRegistry,
    pluginState?: unknown
  ) => {
    if (isSubmitting) return;

    setAnswers((prev) => ({ ...prev, [questionId]: answer }));

    if (!isTaking) return;

    const sequence = (draftSequenceRef.current[questionId] || 0) + 1;
    draftSequenceRef.current[questionId] = sequence;

    adapter.saveDraft(quizId, questionId, answer, { pluginState }).then((nextAttempt) => {
      if (draftSequenceRef.current[questionId] !== sequence) return;
      setSession((prev) => prev ? { ...prev, attempt: nextAttempt } : prev);
    }).catch((error) => {
      console.error('Failed to save exam draft', error);
    });
  }, [adapter, isSubmitting, isTaking, quizId]);

  const collectFinalPayloads = useCallback(async () => {
    const payloads: Record<string, QuizExamFinalQuestionPayload> = {};

    for (const question of questions) {
      payloads[question.id] = {
        answer: answersRef.current[question.id] ?? null,
        pluginState: attempt?.pluginState[question.id],
      };
    }

    for (const [questionId, collector] of Object.entries(collectorsRef.current)) {
      const collected = await collector();
      payloads[questionId] = {
        ...payloads[questionId],
        ...('answer' in collected ? { answer: collected.answer ?? null } : {}),
        ...('pluginState' in collected ? { pluginState: collected.pluginState } : {}),
        ...('submission' in collected ? { submission: collected.submission } : {}),
      };
    }

    return payloads;
  }, [attempt?.pluginState, questions]);

  const submitExam = useCallback(async () => {
    if (isSubmitting || !attempt || attempt.status !== 'in-progress') return;

    setIsSubmitting(true);
    setSubmitError(null);
    setRemainingSeconds(getRemainingSeconds(attempt));

    try {
      const payloads = await collectFinalPayloads();
      const nextAttempt = await adapter.submitExam(quizId, payloads);
      setSession((prev) => prev ? { ...prev, attempt: nextAttempt } : prev);
      setAnswers(nextAttempt.answers || {});
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not submit exam.');
    } finally {
      setIsSubmitting(false);
    }
  }, [adapter, attempt, collectFinalPayloads, isSubmitting, quizId]);

  const resetExam = useCallback(async () => {
    if (!allowReset || isResetting) return;

    setIsResetting(true);
    setSubmitError(null);

    try {
      const next = await adapter.resetExam(quizId);
      autoSubmittedRef.current = false;
      collectorsRef.current = {};
      draftSequenceRef.current = {};
      setSession(next);
      setAnswers(next.attempt.answers || {});
      setRemainingSeconds(getRemainingSeconds(next.attempt));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not reset exam.');
    } finally {
      setIsResetting(false);
    }
  }, [adapter, allowReset, isResetting, quizId]);

  useEffect(() => {
    if (!isTaking || isSubmitting || !attempt || autoSubmittedRef.current) return;
    if (getRemainingSeconds(attempt) > 0) return;
    autoSubmittedRef.current = true;
    setIsSubmitConfirmOpen(false);
    void submitExam();
  }, [attempt, isSubmitting, isTaking, remainingSeconds, submitExam]);

  const questionStates = useMemo(() => {
    if (!attempt) return {};

    return Object.fromEntries(
      questions.map((question) => [
        question.id,
        createExamQuestionState(question, attempt, answers[question.id]),
      ])
    ) as Record<string, QuestionState>;
  }, [answers, attempt, questions]);

  const stats = useMemo(() => {
    return getExamStats({ attempt, questions, answers, plugins });
  }, [answers, attempt, plugins, questions]);

  const requestSubmitExam = useCallback(() => {
    if (!attempt || attempt.status !== 'in-progress' || isSubmitting) return;

    if (stats.answered < totalQuestions) {
      setIsSubmitConfirmOpen(true);
      return;
    }

    void submitExam();
  }, [attempt, isSubmitting, stats.answered, submitExam, totalQuestions]);

  const primaryAction = useMemo(() => {
    if (!isLoaded || !session || !attempt) return null;

    if (attempt.status === 'not-started') {
      return {
        label: `${formatDuration(session.exam.timeLimitSeconds)} limit`,
        title: 'Start exam',
        onClick: () => setIsStartConfirmOpen(true),
        isLoading: isStarting,
        indicator: '→',
      };
    }

    if (isTaking) {
      return {
        label: `${stats.answered}/${totalQuestions} answered`,
        title: 'Submit exam',
        onClick: requestSubmitExam,
        isLoading: isSubmitting,
        indicator: '✓',
      };
    }

    return null;
  }, [attempt, isLoaded, isStarting, isSubmitting, isTaking, requestSubmitExam, session, stats.answered, totalQuestions]);

  const startConfirmMessage = session ? (
    <div>
      <p style={{ margin: '0 0 0.75rem' }}>
        Starting will begin the exam timer immediately. You will have{' '}
        <strong>{formatDuration(session.exam.timeLimitSeconds)}</strong> to complete and submit your answers.
      </p>
      <p style={{ margin: 0 }}>
        Drafts will save while you work, and the exam will submit automatically when time runs out.
      </p>
    </div>
  ) : null;

  const footer = isLoaded && session && isTaking ? (
    <PageFooterNav>
      <PageFooterNav.Action
        label={primaryAction?.label || `${stats.answered}/${totalQuestions} answered`}
        title={primaryAction?.title || 'Submit exam'}
        onClick={primaryAction?.onClick || requestSubmitExam}
        isLoading={primaryAction?.isLoading}
        indicator={primaryAction?.indicator || '✓'}
      />
    </PageFooterNav>
  ) : isLoaded && session && isReviewed && onNext && nextLabel ? (
    <PageFooterNav>
      <a
        href="#"
        onClick={(event) => {
          event.preventDefault();
          onNext();
        }}
        style={{ textDecoration: 'none', display: 'contents' }}
      >
        <PageFooterNav.Card title={nextLabel} />
      </a>
    </PageFooterNav>
  ) : undefined;

  const header = isTaking ? (
    <ExamHeader
      title={resolvedTitle}
      prevLabel={prevLabel}
      onPrev={onPrev}
      answeredCount={stats.answered}
      totalQuestions={totalQuestions}
      remainingSeconds={remainingSeconds}
      onSubmit={requestSubmitExam}
      onReset={allowReset ? resetExam : undefined}
      isSubmitting={isSubmitting}
      isResetting={isResetting}
    />
  ) : (
    <Header>
      <Header.Left>
        <BurgerButton />
        {onPrev && <Header.NavButton direction="prev" label={prevLabel} onClick={onPrev} disabled={isSubmitting} />}
      </Header.Left>
      <Header.Center>
        <Header.Title
          title={resolvedTitle}
          actions={(
            allowReset && isReviewed ? (
              <Header.ResetButton
                onReset={resetExam}
                isLoading={isResetting}
                disabled={isSubmitting}
              />
            ) : undefined
          )}
        />
      </Header.Center>
      <Header.Right>
        {attempt?.status === 'not-started' && primaryAction && (
          <Header.ActionButton
            label={primaryAction.label}
            title={primaryAction.title}
            indicator={primaryAction.indicator}
            onClick={primaryAction.onClick}
            isLoading={primaryAction.isLoading}
            disabled={primaryAction.isLoading}
            variant="success"
          />
        )}
        {isReviewed && onNext && (
          <Header.NavButton direction="next" label={nextLabel} onClick={onNext} disabled={isSubmitting} />
        )}
      </Header.Right>
    </Header>
  );

  return (
    <>
      <PageShell
        header={header}
        footer={footer}
      >
        <Stack gap={6}>
          {children}

          {!isLoaded && <ExamNotice title="Loading exam" body="Preparing your exam session." />}

          {isLoaded && submitError && <ExamNotice title="Exam error" body={submitError} tone="warning" />}

          {isLoaded && session && attempt?.status === 'not-started' && (
            <ExamStartScreen
              questions={questions}
              plugins={plugins}
              questionStates={questionStates}
              action={primaryAction}
              timeLimitSeconds={session.exam.timeLimitSeconds}
            />
          )}

          {isLoaded && session && isTaking && (
            <>
              <Stack gap={4}>
                {questions.map((question, index) => (
                  <QuizQuestionRenderer
                    key={question.id}
                    question={question}
                    displayLabel={`Question ${index + 1}`}
                    state={questionStates[question.id]}
                    plugins={plugins}
                    mode="exam"
                    disabled={isSubmitting}
                    setAnswer={saveAnswer}
                    submit={() => undefined}
                    giveUp={() => undefined}
                    markCorrect={() => undefined}
                    registerQuestionCollector={registerQuestionCollector}
                  />
                ))}
              </Stack>
            </>
          )}

          {isLoaded && session && attempt && isReviewed && (() => {
            const reviewedAttempt = attempt;
            return (
              <>
                <ExamResultPanel attempt={reviewedAttempt} />
                <Stack gap={4}>
                  {questions.map((question, index) => (
                    <QuizQuestionRenderer
                      key={question.id}
                      question={question}
                      displayLabel={`Question ${index + 1}`}
                      state={questionStates[question.id]}
                      plugins={plugins}
                      mode="review"
                      disabled
                      setAnswer={() => undefined}
                      submit={() => undefined}
                      giveUp={() => undefined}
                      markCorrect={() => undefined}
                    />
                  ))}
                </Stack>
              </>
            );
          })()}
        </Stack>
      </PageShell>
      <ConfirmModal
        isOpen={isStartConfirmOpen}
        title="Start timed exam?"
        message={startConfirmMessage}
        confirmText="Start exam"
        cancelText="Cancel"
        onConfirm={startExam}
        onCancel={() => setIsStartConfirmOpen(false)}
        variant="warning"
        isLoading={isStarting}
      />
      <ConfirmModal
        isOpen={isSubmitConfirmOpen}
        title="Submit exam?"
        message={(
          <div>
            <p style={{ margin: '0 0 0.75rem' }}>
              You still have <strong>{Math.max(0, totalQuestions - stats.answered)}</strong>{' '}
              unanswered {Math.max(0, totalQuestions - stats.answered) === 1 ? 'question' : 'questions'}.
            </p>
            <p style={{ margin: 0 }}>
              Time remaining: <strong>{formatDuration(remainingSeconds)}</strong>. Submitted answers are final.
            </p>
          </div>
        )}
        confirmText="Submit exam"
        cancelText="Keep working"
        onConfirm={() => {
          setIsSubmitConfirmOpen(false);
          void submitExam();
        }}
        onCancel={() => setIsSubmitConfirmOpen(false)}
        variant="warning"
        isLoading={isSubmitting}
      />
    </>
  );
}

export function ExamQuizPage(props: ExamQuizPageProps) {
  const learningUI = useLearningUIConfig();
  const resolvedAdapter = requireLearningUIDependency(
    learningUI.adapters?.quizExam,
    'ExamQuizPage adapter'
  );
  const resolvedPlugins = requireLearningUIDependency(
    learningUI.plugins?.quiz,
    'ExamQuizPage plugins'
  );

  return (
    <ExamQuizPageContent {...props} adapter={resolvedAdapter} plugins={resolvedPlugins} />
  );
}

export function ExamStartScreen({
  questions,
  plugins,
  questionStates,
  action,
  timeLimitSeconds,
}: {
  questions: PublicQuizQuestion[];
  plugins: QuestionTypePlugin<unknown>[];
  questionStates: Record<string, QuestionState>;
  action: {
    label: string;
    title: string;
    onClick: () => void;
    isLoading?: boolean;
    indicator?: ReactNode;
  } | null;
  timeLimitSeconds: number;
}) {
  const startAction = action || {
    label: `${formatDuration(timeLimitSeconds)} limit`,
    title: 'Start exam',
    onClick: () => undefined,
    indicator: '→',
  };

  return (
    <Stack gap={5}>
      <LockedExamPreview
        questions={questions}
        plugins={plugins}
        questionStates={questionStates}
        action={startAction}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PageActionCard
          label={startAction.label}
          title={startAction.title}
          onClick={startAction.onClick}
          isLoading={startAction.isLoading}
          indicator={startAction.indicator}
        />
      </div>
    </Stack>
  );
}

function LockedExamPreview({
  questions,
  plugins,
  questionStates,
  action,
}: {
  questions: PublicQuizQuestion[];
  plugins: QuestionTypePlugin<unknown>[];
  questionStates: Record<string, QuestionState>;
  action: {
    label: string;
    title: string;
    onClick: () => void;
    isLoading?: boolean;
    indicator?: ReactNode;
  };
}) {
  return (
    <section style={{
      position: 'relative',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <div
        aria-hidden="true"
        style={{
          filter: 'blur(7px)',
          opacity: 0.5,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <Stack gap={4}>
          {questions.map((question, index) => (
            <QuizQuestionRenderer
              key={question.id}
              question={question}
              displayLabel={`Question ${index + 1}`}
              state={questionStates[question.id]}
              plugins={plugins}
              mode="locked"
              disabled
              setAnswer={() => undefined}
              submit={() => undefined}
              giveUp={() => undefined}
              markCorrect={() => undefined}
            />
          ))}
        </Stack>
      </div>
      <div style={{
        position: 'absolute',
        inset: 0,
        padding: 24,
        background: 'color-mix(in srgb, var(--lui-color-bg-main) 35%, transparent)',
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}>
        <div style={{
          position: 'fixed',
          top: '50%',
          left: 'calc(var(--lui-layout-sidebar-offset, 0px) + ((100vw - var(--lui-layout-sidebar-offset, 0px)) / 2))',
          transform: 'translate(-50%, -50%)',
          zIndex: 'calc(var(--lui-z-sticky) + 1)',
          width: 'min(360px, calc(100vw - var(--lui-layout-sidebar-offset, 0px) - 32px))',
          maxWidth: 360,
          padding: '24px 28px',
          borderRadius: 8,
          background: 'var(--lui-color-bg-main)',
          border: '1px solid var(--lui-color-border)',
          boxShadow: 'var(--lui-shadow-lg)',
          textAlign: 'center',
          pointerEvents: 'auto',
        }}>
          <strong style={{ display: 'block', marginBottom: 8 }}>Questions locked</strong>
          <span style={{ display: 'block', color: 'var(--lui-color-text-muted)', marginBottom: 18 }}>
            Start the timed exam to unlock the real questions.
          </span>
          <Button
            type="button"
            variant="success"
            size="lg"
            onClick={action.onClick}
            isLoading={action.isLoading}
            rightIcon={action.indicator}
          >
            {action.title}
          </Button>
          <span style={{
            display: 'block',
            marginTop: 10,
            color: 'var(--lui-color-text-light)',
            fontSize: 'var(--lui-font-size-sm)',
          }}>
            {action.label}
          </span>
        </div>
      </div>
    </section>
  );
}

export function ExamTimer({ remainingSeconds, endsAt }: { remainingSeconds: number; endsAt?: string }) {
  const isLow = remainingSeconds <= 60;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      border: '1px solid var(--lui-color-border)',
      borderRadius: 8,
      padding: '14px 18px',
      background: isLow ? 'var(--lui-color-warning-bg, #fff8e1)' : 'var(--lui-color-bg-alt)',
    }}>
      <strong>Time remaining</strong>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: '1.25rem', fontWeight: 700 }}>
        {formatDuration(remainingSeconds)}
      </span>
      {endsAt && (
        <span style={{ color: 'var(--lui-color-text-muted)', fontSize: '0.875rem' }}>
          Ends {new Date(endsAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

export function ExamResultPanel({ attempt }: { attempt: QuizExamAttempt }) {
  const evaluation = attempt.finalEvaluation;

  if (!evaluation) {
    return <ExamNotice title="Exam submitted" body="Your exam was submitted, but no final report is available." />;
  }

  const scoreTone: BadgeColor = evaluation.percentage >= 80
    ? 'success'
    : evaluation.percentage >= 50
      ? 'warning'
      : 'danger';
  return (
    <Callout
      variant={scoreTone === 'success' ? 'success' : scoreTone === 'warning' ? 'warning' : 'insight'}
      title="Final report"
      icon="✓"
    >
      <Stack gap={4}>
        <Stack direction="row" gap={3} align="center" wrap>
          <PureBadge color={scoreTone} variant="solid" size="md">
            {evaluation.teacherAwardedPoints}/{evaluation.maxPoints} pts
          </PureBadge>
          <PureBadge color={scoreTone} variant="tinted" size="md">
            {evaluation.percentage}%
          </PureBadge>
          {evaluation.gradeLabel && (
            <PureBadge color="primary" variant="tinted" size="md">
              {evaluation.gradeLabel}
            </PureBadge>
          )}
        </Stack>

        <LearningMarkdown>{evaluation.teacherReport}</LearningMarkdown>
      </Stack>
    </Callout>
  );
}

function ExamNotice({
  title,
  body,
  tone = 'default',
}: {
  title: string;
  body: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <section style={{
      border: '1px solid var(--lui-color-border)',
      borderRadius: 8,
      padding: 18,
      background: tone === 'warning' ? 'var(--lui-color-danger-bg, #fff1f2)' : 'var(--lui-color-bg-alt)',
    }}>
      <strong>{title}</strong>
      <p style={{ margin: '8px 0 0' }}>{body}</p>
    </section>
  );
}
