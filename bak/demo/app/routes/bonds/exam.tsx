import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ExamQuizPage, PageIntro, type QuizExamSession } from '@taylordb/learning-ui';
import { useModuleNavigation } from '../../core/navigation';
import { fetchQuizExamFn } from '../../features/quiz/server-fns';

const QUIZ_ID = 'demo-quiz-2';

export const Route = createFileRoute('/bonds/exam')({
  staticData: {
    moduleId: 'bonds',
    moduleName: 'Chemical Bonds',
    moduleOrder: 2,
    title: 'Exam',
    order: 3,
    icon: '📝',
  },
  component: BondsExam,
  loader: async () => fetchQuizExamFn({ data: QUIZ_ID }),
});

function BondsExam() {
  const navProps = useModuleNavigation();
  const initialExam = Route.useLoaderData() as QuizExamSession;

  return (
    <ExamQuizPage
      quizId={QUIZ_ID}
      initialExam={initialExam}
      allowReset
      {...navProps}
    >
      <PageIntro>
        <PageIntro.Title>{initialExam.quiz.title} Exam</PageIntro.Title>
        <PageIntro.Description>
          <p>
            This exam uses the same backend-owned quiz definition as practice mode,
            but timing, draft persistence, final grading, and full reveal are owned by the server.
          </p>
        </PageIntro.Description>
      </PageIntro>
    </ExamQuizPage>
  );
}
