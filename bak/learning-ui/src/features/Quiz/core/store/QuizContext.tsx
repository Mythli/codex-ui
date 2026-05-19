import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { GradingRequest, QuizAdapter } from "../types/adapters";
import { QuestionState } from "../types/state";
import { QuestionTypePlugin } from "../types/plugin";
import { PublicQuizDefinition, QuizPluginRegistry, QuizSession } from '../types/models';

interface QuizContextValue {
  quiz: PublicQuizDefinition | null;
  state: Record<string, QuestionState>;
  plugins: QuestionTypePlugin<unknown>[];
  setAnswer: <K extends keyof QuizPluginRegistry>(id: string, answer: QuizPluginRegistry[K] | null, questionType: K) => void;
  submitAnswer: (request: GradingRequest) => Promise<void>;
  submitQuestion: (questionId: string, submission?: Record<string, unknown>, answerOverride?: unknown) => Promise<void>;
  giveUp: <K extends keyof QuizPluginRegistry>(id: string, questionType: K) => void;
  markCorrect: (id: string, questionType: string, maxPoints: number) => void;
  generateMoreQuestions: (count: number) => Promise<void>;
  resetQuiz: () => void;
  isLoaded: boolean;
  checkingIds: Record<string, boolean>;
  isGeneratingQuestions: boolean;
  generationError: string | null;
  resetKey: number;
}

const QuizContext = createContext<QuizContextValue | null>(null);

export function useQuiz() {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
}

interface QuizProviderProps {
  quizId: string;
  adapter: QuizAdapter;
  plugins: QuestionTypePlugin<unknown>[];
  initialQuiz?: QuizSession;
  children: React.ReactNode;
}

const createDefaultState = <K extends keyof QuizPluginRegistry>(questionType: K): QuestionState<K> => ({
  questionType,
  answer: null,
  lastSubmittedAnswer: null,
  status: 'building',
  isChecking: false,
  feedback: null,
  earnedPoints: 0,
  revealed: false,
} as QuestionState<K>);

export function QuizProvider({ quizId, adapter, plugins, initialQuiz, children }: QuizProviderProps) {
  const [quiz, setQuiz] = useState<PublicQuizDefinition | null>(initialQuiz?.quiz || null);
  const [state, setState] = useState<Record<string, QuestionState>>(initialQuiz?.state || {});
  const [isLoaded, setIsLoaded] = useState(!!initialQuiz);
  const [checkingIds, setCheckingIds] = useState<Record<string, boolean>>({});
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (isLoaded) return;

    let mounted = true;
    adapter.loadQuiz(quizId).then((session) => {
      if (mounted) {
        setQuiz(session.quiz);
        setState(session.state);
        setIsLoaded(true);
      }
    });
    return () => { mounted = false; };
  }, [quizId, adapter, isLoaded]);

  const setAnswer = useCallback(<K extends keyof QuizPluginRegistry>(id: string, answer: QuizPluginRegistry[K] | null, questionType: K) => {
    setState((prev) => {
      const current = prev[id] || createDefaultState(questionType);
      if (current.status === 'success' || current.revealed) return prev;
      
      return {
        ...prev,
        [id]: {
          ...current,
          questionType,
          answer,
          // Notice we DO NOT touch status, feedback, or lastSubmittedAnswer here!
          // The backend owns the grade, the frontend owns the draft answer.
        } as QuestionState
      };
    });
    adapter.saveDraft(quizId, id, answer).catch((error) => {
      console.error('Failed to save quiz draft', error);
    });
  }, [adapter, quizId]);

  const submitQuestion = useCallback(async (id: string, submission?: Record<string, unknown>, answerOverride?: unknown) => {
    const current = state[id];
    const question = quiz?.questions.find((item) => item.id === id);
    if (!question || current?.status === 'success' || current?.revealed || checkingIds[id]) return;
    const answer = answerOverride !== undefined ? answerOverride : current?.answer ?? null;

    setCheckingIds((prev) => ({ ...prev, [id]: true }));
    setState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || createDefaultState(question.questionType as keyof QuizPluginRegistry)), isChecking: true, feedback: null } as QuestionState
    }));

    try {
      const next = await adapter.submitAnswer(quizId, id, answer, {
        pluginState: current?.pluginState,
        submission,
      });
      setState((prev) => ({
        ...prev,
        [id]: { ...next, isChecking: false } as QuestionState,
      }));
    } catch {
      setState((prev) => {
        const prevQ = prev[id] || createDefaultState(question.questionType as keyof QuizPluginRegistry);
        return {
          ...prev,
          [id]: { ...prevQ, isChecking: false, status: 'error', feedback: 'Connection failed.' } as QuestionState
        };
      });
    } finally {
      setCheckingIds((prev) => ({ ...prev, [id]: false }));
    }
  }, [adapter, checkingIds, quiz, quizId, state]);

  const submitAnswer = useCallback(async (req: GradingRequest) => {
    const id = req.questionId;
    const userAnswer = 'userAnswer' in req ? req.userAnswer : state[id]?.answer;
    setState((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || createDefaultState(req.questionType as keyof QuizPluginRegistry)),
        answer: userAnswer as never,
      } as QuestionState
    }));
    await submitQuestion(id, typeof req.image === 'string' ? { image: req.image } : undefined, userAnswer);
  }, [state, submitQuestion]);

  const giveUp = useCallback(async <K extends keyof QuizPluginRegistry>(id: string, questionType: K) => {
    try {
      const next = await adapter.giveUp(quizId, id);
      setState((prev) => ({ ...prev, [id]: next as QuestionState }));
    } catch {
      setState((prev) => {
        const current = prev[id] || createDefaultState(questionType);
        return {
          ...prev,
          [id]: { ...current, questionType, revealed: true, feedback: null, status: current.status === 'success' ? 'success' : 'failed' } as QuestionState
        };
      });
    }
  }, [adapter, quizId]);

  const markCorrect = useCallback(async (id: string, questionType: string, maxPoints: number) => {
    try {
      const next = await adapter.markCorrect(quizId, id);
      setState((prev) => ({ ...prev, [id]: next as QuestionState }));
    } catch {
      setState((prev) => {
        const current = prev[id] || createDefaultState(questionType as keyof QuizPluginRegistry);
        return {
          ...prev,
          [id]: { ...current, status: 'success', earnedPoints: maxPoints, feedback: 'Marked as correct.', isChecking: false, lastSubmittedAnswer: current.answer } as QuestionState
        };
      });
    }
  }, [adapter, quizId]);

  const resetQuiz = useCallback(async () => {
    const session = await adapter.reset(quizId);
    setQuiz(session.quiz);
    setState(session.state);
    setResetKey(k => k + 1);
  }, [adapter, quizId]);

  const generateMoreQuestions = useCallback(async (count: number) => {
    if (isGeneratingQuestions) return;
    setIsGeneratingQuestions(true);
    setGenerationError(null);

    try {
      const session = await adapter.generateMoreQuestions(quizId, count);
      setQuiz(session.quiz);
      setState(session.state);
    } catch {
      setGenerationError('Could not generate more questions.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  }, [adapter, isGeneratingQuestions, quizId]);

  return (
    <QuizContext.Provider value={{ quiz, state, plugins, setAnswer, submitAnswer, submitQuestion, giveUp, markCorrect, generateMoreQuestions, resetQuiz, isLoaded, checkingIds, isGeneratingQuestions, generationError, resetKey }}>
      {children}
    </QuizContext.Provider>
  );
}
