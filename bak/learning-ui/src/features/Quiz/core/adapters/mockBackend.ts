import { QuizBackendAdapter, GradingRequest, GradingResponse } from "../types/adapters";
import { QuestionTypePlugin } from "../types/plugin";

export function createMockBackendAdapter(_plugins: QuestionTypePlugin<unknown>[]): QuizBackendAdapter {
  return {
    gradeAnswer: async (req: GradingRequest): Promise<GradingResponse> => {
      await new Promise(resolve => setTimeout(resolve, 800));

      // Since local grading is removed, we just return a generic mock success
      return { status: 'success', points: req.maxPoints, reason: 'Mock graded successfully!' };
    }
  };
}
