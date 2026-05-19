import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { PageIntro, QuizPage, type QuizSession } from '@taylordb/learning-ui';
import { useModuleNavigation } from '../../core/navigation';
import { fetchQuizFn } from '../../features/quiz/server-fns';

const QUIZ_ID = 'demo-quiz-2';

export const Route = createFileRoute('/bonds/quiz')({
  staticData: {
    moduleId: 'bonds',
    moduleName: 'Chemical Bonds',
    moduleOrder: 2,
    title: 'Quiz',
    order: 2,
    icon: '⚛️',
  },
  component: BondsQuiz,
  loader: async () => fetchQuizFn({ data: QUIZ_ID }),
});

function BondsQuiz() {
  const navProps = useModuleNavigation();
  const initialQuiz = Route.useLoaderData() as QuizSession;

  return (
    <QuizPage
      quizId={QUIZ_ID}
      initialQuiz={initialQuiz}
      {...navProps}
    >
      <PageIntro>
        <PageIntro.Title>{initialQuiz.quiz.title}</PageIntro.Title>
        <PageIntro.Description>
          <p>
            This quiz is loaded from the backend. The browser renders the public question
            definition and submits only your answers; grading data stays server-side.
          </p>
        </PageIntro.Description>
      </PageIntro>
    </QuizPage>
  );
}
