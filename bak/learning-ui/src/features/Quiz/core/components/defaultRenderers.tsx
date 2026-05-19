import React, { useEffect, useRef } from 'react';
import { evaluate, format } from 'mathjs';
import { LearningMarkdown } from '../../../../common/Markdown';
import { PureQuestion } from './PureQuestionShell';
import { QuizQuestionRendererProps } from '../types/plugin';
import { ChoiceItem } from '../../plugins/MultipleChoice';
import { PureMultipleChoiceQuestion } from '../../plugins/MultipleChoice/PureMultipleChoiceQuestion';
import { PureFreeTextQuestion } from '../../plugins/FreeText/PureFreeTextQuestion';
import { PureFillInTheBlanksQuestion } from '../../plugins/FillInTheBlanks/PureFillInTheBlanksQuestion';
import { PureFillInTheBlanksPart, PureFillInTheBlanksStatus } from '../../plugins/FillInTheBlanks';
import { PureFormulaQuestion } from '../../plugins/Formula/PureFormulaQuestion';
import { PureDrawingQuestion } from '../../plugins/Drawing/PureDrawingQuestion';
import { PureDrawingInputRef } from '../../plugins/Drawing';

type BasePublicQuestion = {
  title?: string;
  questionText?: string;
};

const QuestionContent = ({ question, state, showScoreBadge, displayLabel, title, text }: {
  question: QuizQuestionRendererProps['question'];
  state?: QuizQuestionRendererProps['state'];
  showScoreBadge?: boolean;
  displayLabel?: string;
  title?: string;
  text?: string;
}) => {
  const displayTitle = question.metadata?.title || title;

  return (
    <>
      <PureQuestion.Header
        questionNumber={1}
        displayLabel={displayLabel}
        difficulty={question.difficulty || 'medium'}
        maxPoints={question.maxPoints}
        earnedPoints={state?.earnedPoints}
        showScore={showScoreBadge}
        isGenerated={question.metadata?.source === 'generated'}
      />
      {displayTitle && <PureQuestion.Title>{displayTitle}</PureQuestion.Title>}
      {question.metadata?.practiceFocus && (
        <PureQuestion.Focus>
          {question.metadata.practiceFocus}
        </PureQuestion.Focus>
      )}
      {text && (
        <PureQuestion.Body>
          <LearningMarkdown>{text}</LearningMarkdown>
        </PureQuestion.Body>
      )}
    </>
  );
};

const revealText = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return null;
  const answer = (payload as { answer?: unknown }).answer;
  return typeof answer === 'string' || typeof answer === 'number' ? String(answer) : null;
};

export function MultipleChoiceRenderer({
  question,
  state,
  answer,
  isChecking,
  chrome,
  setAnswer,
  submit,
  giveUp,
  markCorrect,
}: QuizQuestionRendererProps<string[]>) {
  const config = question.public as BasePublicQuestion & {
    choices: ChoiceItem[];
    multiSelect?: boolean;
  };
  const selectedIds = Array.isArray(answer) ? answer : [];
  const revealPayload = state?.revealPayload as { correctIds?: string[] } | undefined;
  const statusMap: Record<string, 'correct' | 'incorrect' | 'default'> = {};

  if (state?.revealed && revealPayload?.correctIds) {
    revealPayload.correctIds.forEach((id) => { statusMap[id] = 'correct'; });
    selectedIds.forEach((id) => {
      if (!revealPayload.correctIds?.includes(id)) statusMap[id] = 'incorrect';
    });
  }

  return (
    <PureMultipleChoiceQuestion
      difficulty={question.difficulty || 'medium'}
      status={chrome.status}
      feedbackStatus={chrome.feedbackStatus}
      choices={config.choices || []}
      selectedIds={selectedIds}
      onChange={setAnswer}
      multiSelect={config.multiSelect}
      disabled={chrome.interactionDisabled}
      statusMap={statusMap}
      isChecking={isChecking}
      isRevealed={chrome.isRevealed}
      apiError={chrome.apiError}
      feedback={state?.feedback}
      discovery={state?.discovery}
      earnedPoints={chrome.earnedPoints}
      maxPoints={question.maxPoints}
      revealedAnswer={<p>The correct answers are highlighted above.</p>}
      showFeedback={chrome.showFeedback}
      showActions={chrome.showActions}
      onCheck={() => submit(undefined, selectedIds)}
      onGiveUp={giveUp}
      onMarkCorrect={markCorrect}
    >
      <QuestionContent question={question} state={state} showScoreBadge={chrome.showScoreBadge} displayLabel={chrome.displayLabel} title={config.title} text={config.questionText} />
    </PureMultipleChoiceQuestion>
  );
}

export function FreeTextRenderer({
  question,
  state,
  answer,
  isChecking,
  chrome,
  setAnswer,
  submit,
  giveUp,
  markCorrect,
}: QuizQuestionRendererProps<string>) {
  const config = question.public as BasePublicQuestion & {
    inputType?: 'short' | 'long';
    placeholder?: string;
  };
  const value = typeof answer === 'string' ? answer : '';
  const revealed = revealText(state?.revealPayload);

  return (
    <PureFreeTextQuestion
      difficulty={question.difficulty || 'medium'}
      status={chrome.status}
      feedbackStatus={chrome.feedbackStatus}
      value={value}
      onChange={setAnswer}
      inputType={config.inputType}
      placeholder={config.placeholder}
      inputStatus={chrome.isRevealed ? 'revealed' : state?.status === 'success' ? 'correct' : 'default'}
      disabled={chrome.interactionDisabled}
      isChecking={isChecking}
      isRevealed={chrome.isRevealed}
      apiError={chrome.apiError}
      feedback={state?.feedback}
      discovery={state?.discovery}
      earnedPoints={chrome.earnedPoints}
      maxPoints={question.maxPoints}
      revealedAnswer={revealed ? <p>{revealed}</p> : undefined}
      showFeedback={chrome.showFeedback}
      showActions={chrome.showActions}
      onCheck={() => submit(undefined, value)}
      onGiveUp={giveUp}
      onMarkCorrect={markCorrect}
    >
      <QuestionContent question={question} state={state} showScoreBadge={chrome.showScoreBadge} displayLabel={chrome.displayLabel} title={config.title} text={config.questionText} />
    </PureFreeTextQuestion>
  );
}

export function FillInTheBlanksRenderer({
  question,
  state,
  answer,
  isChecking,
  chrome,
  setAnswer,
  submit,
  giveUp,
  markCorrect,
}: QuizQuestionRendererProps<Record<string, string>>) {
  const config = question.public as BasePublicQuestion & {
    parts: PureFillInTheBlanksPart[];
  };
  const values = answer && typeof answer === 'object' ? answer : {};
  const hasAnyValue = Object.values(values).some((value) => value.trim() !== '');
  const statusMap: Record<string, PureFillInTheBlanksStatus> = {};
  const displayValues: Record<string, string> = {};
  const helperMap: Record<string, React.ReactNode> = {};
  const revealPayload = state?.revealPayload as { answers?: Record<string, string> } | undefined;

  if (state?.revealed && revealPayload?.answers) {
    Object.entries(revealPayload.answers).forEach(([id, expected]) => {
      const submitted = values[id] || '';
      const isCorrect = submitted.trim().toLowerCase() === expected.trim().toLowerCase();
      statusMap[id] = isCorrect ? 'correct' : 'error';
      displayValues[id] = expected;
      if (!isCorrect) {
        helperMap[id] = submitted.trim() ? `Your answer: ${submitted}` : 'Blank';
      }
    });
  } else if (state?.status === 'success') {
    Object.keys(values).forEach((id) => { statusMap[id] = 'correct'; });
  }

  return (
    <PureFillInTheBlanksQuestion
      difficulty={question.difficulty || 'medium'}
      status={chrome.status}
      feedbackStatus={chrome.feedbackStatus}
      parts={config.parts || []}
      values={values}
      onChange={(gapId, val) => setAnswer({ ...values, [gapId]: val })}
      statusMap={statusMap}
      displayValues={displayValues}
      helperMap={helperMap}
      disabled={chrome.interactionDisabled}
      isChecking={isChecking}
      isRevealed={chrome.isRevealed}
      apiError={chrome.apiError}
      feedback={state?.feedback}
      discovery={state?.discovery}
      earnedPoints={chrome.earnedPoints}
      maxPoints={question.maxPoints}
      revealedAnswer={undefined}
      checkDisabled={!hasAnyValue}
      showFeedback={chrome.showFeedback}
      showActions={chrome.showActions}
      onCheck={() => submit(undefined, values)}
      onGiveUp={giveUp}
      onMarkCorrect={markCorrect}
    >
      <QuestionContent question={question} state={state} showScoreBadge={chrome.showScoreBadge} displayLabel={chrome.displayLabel} title={config.title} text={config.questionText} />
    </PureFillInTheBlanksQuestion>
  );
}

export function FormulaRenderer({
  question,
  state,
  answer,
  isChecking,
  chrome,
  setAnswer,
  submit,
  giveUp,
  markCorrect,
}: QuizQuestionRendererProps<{ formula: string; scratchpad?: string }>) {
  const config = question.public as BasePublicQuestion & { enableScratchpad?: boolean };
  const value = answer || { formula: '', scratchpad: '' };
  let previewNode = null;
  let computeError: string | null = null;

  if (value.formula?.trim()) {
    try {
      const computed = evaluate(value.formula);
      previewNode = <span>= {format(computed, { precision: 7 })}</span>;
    } catch (err) {
      computeError = err instanceof Error ? `Invalid Formula: ${err.message}` : 'Invalid Formula';
      previewNode = <span style={{ color: 'var(--lui-color-danger)' }}>{computeError}</span>;
    }
  }

  const revealed = revealText(state?.revealPayload);

  return (
    <PureFormulaQuestion
      difficulty={question.difficulty || 'medium'}
      status={chrome.status}
      feedbackStatus={chrome.feedbackStatus}
      formulaValue={value.formula || ''}
      onFormulaChange={(formula) => setAnswer({ ...value, formula })}
      previewNode={previewNode}
      scratchpadValue={config.enableScratchpad ? value.scratchpad : undefined}
      onScratchpadChange={config.enableScratchpad ? (scratchpad) => setAnswer({ ...value, scratchpad }) : undefined}
      inputStatus={chrome.isRevealed ? 'revealed' : state?.status === 'success' ? 'correct' : 'default'}
      disabled={chrome.interactionDisabled}
      isInvalid={computeError !== null}
      isChecking={isChecking}
      isRevealed={chrome.isRevealed}
      apiError={chrome.apiError}
      feedback={state?.feedback}
      discovery={state?.discovery}
      earnedPoints={chrome.earnedPoints}
      maxPoints={question.maxPoints}
      revealedAnswer={revealed ? <p>{revealed}</p> : undefined}
      showFeedback={chrome.showFeedback}
      showActions={chrome.showActions}
      onCheck={() => submit(undefined, value)}
      onGiveUp={giveUp}
      onMarkCorrect={markCorrect}
    >
      <QuestionContent question={question} state={state} showScoreBadge={chrome.showScoreBadge} displayLabel={chrome.displayLabel} title={config.title} text={config.questionText} />
    </PureFormulaQuestion>
  );
}

export function DrawingRenderer({
  question,
  state,
  answer,
  isChecking,
  chrome,
  setAnswer,
  submit,
  giveUp,
  markCorrect,
  registerQuestionCollector,
}: QuizQuestionRendererProps<Record<string, unknown>>) {
  const config = question.public as BasePublicQuestion;
  const drawingRef = useRef<PureDrawingInputRef>(null);
  const revealed = revealText(state?.revealPayload);
  const snapshot = answer && typeof answer === 'object' ? answer : null;

  useEffect(() => {
    if (!registerQuestionCollector) return undefined;

    registerQuestionCollector(question.id, async () => {
      const snapshot = await drawingRef.current?.exportSnapshot();
      const image = await drawingRef.current?.exportImage('jpeg');

      return {
        answer: snapshot || null,
        submission: image ? { image } : undefined,
      };
    });

    return () => registerQuestionCollector(question.id, null);
  }, [question.id, registerQuestionCollector]);

  const handleSubmit = async () => {
    const snapshot = await drawingRef.current?.exportSnapshot();
    const image = await drawingRef.current?.exportImage('jpeg');
    if (snapshot) setAnswer(snapshot);
    await submit(image ? { image } : undefined, snapshot || null);
  };

  return (
    <PureDrawingQuestion
      ref={drawingRef}
      difficulty={question.difficulty || 'medium'}
      status={chrome.status}
      feedbackStatus={chrome.feedbackStatus}
      isChecking={isChecking}
      isRevealed={chrome.isRevealed}
      apiError={chrome.apiError}
      feedback={state?.feedback}
      discovery={state?.discovery}
      earnedPoints={chrome.earnedPoints}
      maxPoints={question.maxPoints}
      revealedAnswer={revealed ? <p>{revealed}</p> : undefined}
      snapshot={snapshot}
      isReadOnly={chrome.interactionDisabled}
      showFeedback={chrome.showFeedback}
      showActions={chrome.showActions}
      onChange={async () => {
        const snapshot = await drawingRef.current?.exportSnapshot();
        if (snapshot) setAnswer(snapshot);
      }}
      onCheck={handleSubmit}
      onGiveUp={giveUp}
      onMarkCorrect={markCorrect}
    >
      <QuestionContent question={question} state={state} showScoreBadge={chrome.showScoreBadge} displayLabel={chrome.displayLabel} title={config.title} text={config.questionText} />
    </PureDrawingQuestion>
  );
}
