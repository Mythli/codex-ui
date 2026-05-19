import React, { createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import { MarkdownProvider, type MarkdownRenderConfig } from '../common/Markdown';
import type { ExperimentBackendAdapter, ExperimentStorageAdapter } from '../features/Experiment/types/adapters';
import type { VocabBackendAdapter, CardTypeDefinition } from '../features/Flashcard/types';
import type { LayoutStorageAdapter } from '../features/Layout/types/adapters';
import type { QuizAdapter, QuizExamAdapter } from '../features/Quiz/core/types/adapters';
import type { QuestionTypePlugin } from '../features/Quiz/core/types/plugin';

export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

export interface LearningUIDictionary {
  shared: {
    confirm: string;
    cancel: string;
    previous: string;
    next: string;
    done: string;
    pts: string;
    resetProgress: string;
    resetWarning: string;
    reset: string;
    question: string;
  };
  quiz: {
    questionNumber: string;
    pointSingular: string;
    pointPlural: string;
    bossDefeated: string;
    correct: string;
    pointsEarned: string;
    connectionIssueTitle: string;
    connectionIssueBody: string;
    feedbackTitle: string;
    partialTitle: string;
    answerTitle: string;
    scoreTitle: string;
    finalScore: string;
    noPointsAwarded: string;
    checkingAnswer: string;
    markCorrect: string;
    checkAgain: string;
    giveUp: string;
    improveAnswer: string;
    checkAnswer: string;
    partialPointsBadge: string;
    placeholderFreeText: string;
    placeholderFormula: string;
    scratchpadLabel: string;
    scratchpadPlaceholder: string;
    pen: string;
    eraser: string;
    undo: string;
    redo: string;
    clear: string;
  };
  experiment: {
    challengeProgress: string;
    back: string;
    next: string;
    progressLabel: string;
    progressCount: string;
    timeRemaining: string;
    analyzing: string;
    nextStep: string;
    discovered: string;
    discoveredExclaim: string;
    revealed: string;
    discoverToUnlock: string;
    completeToUnlock: string;
    revealAnyway: string;
    peekAnyway: string;
    whatDidYouDiscover: string;
    allPatternsFound: string;
    hintsToDiscoverMore: string;
    patternsDiscovered: string;
    observationPlaceholder: string;
    checking: string;
    checkDiscoveries: string;
  };
  vocab: {
    clickToFlip: string;
    back: string;
    added: string;
    addToDeck: string;
    showAnswer: string;
    space: string;
    again: string;
    hard: string;
    good: string;
    easy: string;
    dailyReviewComplete: string;
    sessionComplete: string;
    conqueredReview: string;
    cardsMastered: string;
    accuracy: string;
    timeSpent: string;
    returnToDashboard: string;
    activeCard: string;
    keyVocabulary: string;
    allAddedToDeck: string;
    addAllToDeck: string;
  };
}

export const defaultDictionary: LearningUIDictionary = {
  shared: {
    confirm: "Confirm",
    cancel: "Cancel",
    previous: "Previous",
    next: "Next",
    done: "Done",
    pts: "Pts",
    resetProgress: "Reset Progress?",
    resetWarning: "This will clear all your progress. This cannot be undone.",
    reset: "Reset",
    question: "Question"
  },
  quiz: {
    questionNumber: "Question {number}",
    pointSingular: "{points} point",
    pointPlural: "{points} points",
    bossDefeated: "BOSS DEFEATED!",
    correct: "Correct!",
    pointsEarned: "+{points} points",
    connectionIssueTitle: "Connection Issue",
    connectionIssueBody: "Couldn't reach grading server. Please check manually or try again.",
    feedbackTitle: "Feedback",
    partialTitle: "Partial credit",
    answerTitle: "Answer",
    scoreTitle: "Score",
    finalScore: "Final score: {points} points",
    noPointsAwarded: "No points awarded",
    checkingAnswer: "Checking answer...",
    markCorrect: "✓ I got it right",
    checkAgain: "Check Again",
    giveUp: "Give Up",
    improveAnswer: "Improve Answer",
    checkAnswer: "Check Answer",
    partialPointsBadge: "⭐ {earned} / {max} points earned",
    placeholderFreeText: "Type your answer...",
    placeholderFormula: "Enter formula...",
    scratchpadLabel: "Scratchpad (optional workings):",
    scratchpadPlaceholder: "Optional workings...",
    pen: "✏️ Pen",
    eraser: "🧽 Eraser",
    undo: "↩️ Undo",
    redo: "↪️ Redo",
    clear: "🗑️ Clear"
  },
  experiment: {
    challengeProgress: "CHALLENGE {current} OF {total}",
    back: "← Back",
    next: "Next →",
    progressLabel: "Progress",
    progressCount: "{current} / {target} ({percent}%)",
    timeRemaining: "⏱️ {time}s remaining",
    analyzing: "Analyzing...",
    nextStep: "NEXT ➔",
    discovered: "✓ Discovered",
    discoveredExclaim: "✓ Discovered!",
    revealed: "Revealed",
    discoverToUnlock: "Discover these patterns to unlock:",
    completeToUnlock: "Complete the experiment and record your observations to unlock",
    revealAnyway: "Reveal Anyway",
    peekAnyway: "Peek Anyway",
    whatDidYouDiscover: "What Did You Discover?",
    allPatternsFound: "🎉 All patterns found!",
    hintsToDiscoverMore: "💡 Hints to discover more:",
    patternsDiscovered: "{confirmed} of {total} patterns discovered",
    observationPlaceholder: "What patterns did you notice? Describe what you discovered...",
    checking: "Checking...",
    checkDiscoveries: "Check My Discoveries"
  },
  vocab: {
    clickToFlip: "↺ Click to flip",
    back: "↺ Back",
    added: "✓ Added",
    addToDeck: "+ Add to Deck",
    showAnswer: "Show Answer",
    space: "Space",
    again: "Again",
    hard: "Hard",
    good: "Good",
    easy: "Easy",
    dailyReviewComplete: "Daily Review Complete!",
    sessionComplete: "🎉 Session Complete",
    conqueredReview: "You've conquered your daily review.",
    cardsMastered: "Cards Mastered",
    accuracy: "Accuracy",
    timeSpent: "Time Spent",
    returnToDashboard: "Return to Dashboard",
    activeCard: "Active Card",
    keyVocabulary: "Key Vocabulary",
    allAddedToDeck: "✓ All Added to Deck",
    addAllToDeck: "+ Add All to Deck"
  }
};

const LocaleContext = createContext<LearningUIDictionary>(defaultDictionary);

function isObject(item: unknown): item is Record<string, unknown> {
  return Boolean(item && typeof item === 'object' && !Array.isArray(item));
}

function mergeDeep<T extends Record<string, unknown>, U extends Record<string, unknown>>(target: T, source: U): T & U {
  const output = Object.assign({}, target) as Record<string, unknown>;
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target))
          Object.assign(output, { [key]: source[key] });
        else
          output[key] = mergeDeep(
            target[key] as Record<string, unknown>, 
            source[key] as Record<string, unknown>
          );
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output as T & U;
}

export interface LocaleProviderProps {
  localeText?: DeepPartial<LearningUIDictionary>;
  children: ReactNode;
}

export function LocaleProvider({ localeText, children }: LocaleProviderProps) {
  const parentLocale = useContext(LocaleContext);
  
  const merged = useMemo(() => {
    if (!localeText) return parentLocale;
    return mergeDeep(
      parentLocale as unknown as Record<string, unknown>, 
      localeText as Record<string, unknown>
    ) as unknown as LearningUIDictionary;
  }, [parentLocale, localeText]);

  return <LocaleContext.Provider value={merged}>{children}</LocaleContext.Provider>;
}

/**
 * The global provider that library users will wrap their app in.
 */
export interface LearningUIProviderProps extends LocaleProviderProps {
  markdownConfig?: MarkdownRenderConfig;
  adapters?: {
    quiz?: QuizAdapter;
    quizExam?: QuizExamAdapter;
    vocab?: VocabBackendAdapter;
    experiment?: ExperimentBackendAdapter;
    experimentStorage?: ExperimentStorageAdapter;
    layoutStorage?: LayoutStorageAdapter;
  };
  plugins?: {
    quiz?: QuestionTypePlugin<unknown>[];
    vocabCards?: CardTypeDefinition[];
  };
}

export type LearningUIConfig = Pick<LearningUIProviderProps, 'adapters' | 'plugins'>;

const LearningUIConfigContext = createContext<LearningUIConfig>({});

export function LearningUIProvider({
  localeText,
  markdownConfig,
  adapters,
  plugins,
  children
}: LearningUIProviderProps) {
  const parentConfig = useContext(LearningUIConfigContext);
  const value = useMemo<LearningUIConfig>(() => ({
    adapters: {
      ...(parentConfig.adapters || {}),
      ...(adapters || {}),
    },
    plugins: {
      ...(parentConfig.plugins || {}),
      ...(plugins || {}),
    },
  }), [parentConfig, adapters, plugins]);

  return (
    <LearningUIConfigContext.Provider value={value}>
      <LocaleProvider localeText={localeText}>
        <MarkdownProvider config={markdownConfig}>
          {children}
        </MarkdownProvider>
      </LocaleProvider>
    </LearningUIConfigContext.Provider>
  );
}

export function useLearningUIConfig() {
  return useContext(LearningUIConfigContext);
}

export function requireLearningUIDependency<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null) {
    throw new Error(`${name} was not provided. Pass it as a prop or configure it on LearningUIProvider.`);
  }
  return value;
}

export function useLocale() {
  const dict = useContext(LocaleContext);
  
  const t = useCallback((text: string, variables?: Record<string, string | number>) => {
    if (!variables) return text;
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }, []);

  return { dict, t };
}
