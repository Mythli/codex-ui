import { QuizAdapter, QuizExamAdapter } from '../types/adapters';
import { AdapterConfig } from '../../../../system/api/types';
import { apiClient } from '../../../../system/api/apiClient';

export type QuizAdapterConfig = AdapterConfig;

/**
 * Factory function to create a server-owned Quiz adapter.
 * Server GETs are trusted; client POSTs only send user-produced answer data.
 */
export function createQuizAdapter(config: QuizAdapterConfig): QuizAdapter {
  const { baseUrl, headers, fetcher = apiClient } = config;

  const getHeaders = async () => {
    const resolvedHeaders = typeof headers === 'function' ? await headers() : headers;
    return { 'Content-Type': 'application/json', ...resolvedHeaders };
  };

  return {
    loadQuiz: async (quizId) => fetcher(`${baseUrl}/${quizId}`, {
      headers: await getHeaders(),
    }),

    saveDraft: async (quizId, questionId, answer, pluginState) => fetcher(`${baseUrl}/${quizId}/questions/${questionId}/draft`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ answer, pluginState }),
    }),

    submitAnswer: async (quizId, questionId, answer, options) => fetcher(`${baseUrl}/${quizId}/questions/${questionId}/submit`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        answer,
        pluginState: options?.pluginState,
        submission: options?.submission,
      }),
    }),

    giveUp: async (quizId, questionId) => fetcher(`${baseUrl}/${quizId}/questions/${questionId}/give-up`, {
      method: 'POST',
      headers: await getHeaders(),
    }),

    markCorrect: async (quizId, questionId) => fetcher(`${baseUrl}/${quizId}/questions/${questionId}/mark-correct`, {
      method: 'POST',
      headers: await getHeaders(),
    }),

    generateMoreQuestions: async (quizId, count) => fetcher(`${baseUrl}/${quizId}/questions/generate`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ count }),
    }),

    reset: async (quizId) => fetcher(`${baseUrl}/${quizId}/reset`, {
        method: 'POST',
        headers: await getHeaders(),
    }),
  };
}

export function createQuizExamAdapter(config: QuizAdapterConfig): QuizExamAdapter {
  const { baseUrl, headers, fetcher = apiClient } = config;

  const getHeaders = async () => {
    const resolvedHeaders = typeof headers === 'function' ? await headers() : headers;
    return { 'Content-Type': 'application/json', ...resolvedHeaders };
  };

  return {
    loadExam: async (quizId) => fetcher(`${baseUrl}/${quizId}/exam`, {
      headers: await getHeaders(),
    }),

    startExam: async (quizId) => fetcher(`${baseUrl}/${quizId}/exam/start`, {
      method: 'POST',
      headers: await getHeaders(),
    }),

    saveDraft: async (quizId, questionId, answer, options) => fetcher(`${baseUrl}/${quizId}/exam/questions/${questionId}/draft`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ answer, pluginState: options?.pluginState }),
    }),

    submitExam: async (quizId, questions) => fetcher(`${baseUrl}/${quizId}/exam/submit`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ questions }),
    }),

    resetExam: async (quizId) => fetcher(`${baseUrl}/${quizId}/exam/reset`, {
      method: 'POST',
      headers: await getHeaders(),
    }),
  };
}
