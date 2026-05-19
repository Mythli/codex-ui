import {
  QuizPlugin,
  backendZ as z,
  baseGradingRequestSchema,
  quizGradingConfigSchema,
} from '@taylordb/learning-backend';

const publicSchema = z.object({
  title: z.string().optional(),
  questionText: z.string(),
  min: z.number().optional(),
  max: z.number().optional(),
  defaultValue: z.number().optional(),
});

const gradingSchema = quizGradingConfigSchema.extend({
  expectedAnswer: z.number(),
});

const revealPayloadSchema = z.object({
  answer: z.number(),
});

const schema = baseGradingRequestSchema.extend({
  questionType: z.literal('custom-slider'),
  expectedAnswer: z.number(),
  userAnswer: z.number(),
});

const answerSchema = z.number();

const gradeSliderDeterministic = (payload: z.infer<typeof schema>) => {
  const { expectedAnswer, userAnswer, maxPoints } = payload;
  
  if (userAnswer === expectedAnswer) {
    return { status: 'success', points: maxPoints, reason: 'Spot on!' } as const;
  }
  
  const diff = Math.abs(userAnswer - expectedAnswer);
  if (diff <= 10) {
    return { status: 'partial', points: Math.floor(maxPoints / 2), reason: 'Very close! (Within 10)' } as const;
  }
  
  return { status: 'failed', points: 0, reason: 'Too far off.' } as const;
};

export const sliderPlugin = {
  questionType: 'custom-slider',
  publicSchema,
  gradingSchema,
  revealPayloadSchema,
  answerSchema,
  schema,
  isEmptyAnswer: (answer) => answer === null || answer === undefined,
  respectComputedSuccess: true,
  buildLockedPublic: (publicData) => ({
    title: publicData.title ? 'Locked question' : undefined,
    questionText: 'This question unlocks when you start the timed exam.',
    min: publicData.min,
    max: publicData.max,
    defaultValue: publicData.defaultValue,
  }),
  gradeDeterministic: gradeSliderDeterministic,
  grade: async (payload, context) => {
    const deterministicResult = gradeSliderDeterministic(payload);
    
    if (payload.aiMode === 'never') {
      return deterministicResult;
    }

    if (deterministicResult.status === 'success' && payload.aiMode !== 'always') {
      return deterministicResult;
    }
    
    // If they want AI feedback on a slider...
    const result = await context.evaluate({
      question: payload.question || 'Slider question',
      successCriteria: `The exact answer is ${payload.expectedAnswer}.`,
      userAnswer: `The user selected ${payload.userAnswer}.`,
      maxPoints: payload.maxPoints,
      modelPreference: 'fast',
    });

    if (deterministicResult.status === 'success') {
       return { ...result, status: 'success', points: payload.maxPoints };
    }
    
    return { ...result, status: deterministicResult.status, points: deterministicResult.points };
  }
} satisfies QuizPlugin<
  z.infer<typeof schema>,
  'custom-slider',
  typeof publicSchema,
  typeof gradingSchema,
  typeof revealPayloadSchema,
  typeof answerSchema
>;
