import 'dotenv/config';
import { z } from 'zod';
import OpenAI from 'openai';
import { createLlm } from 'llm-fns';
import {
  AiConfig,
  ExperimentService,
  InMemorySrsRepository,
  InMemoryQuizRepository,
  InMemoryExperimentRepository,
  QuizService,
  SrsCard,
  SpacedRepetitionService,
  createQuizEngine
} from '@taylordb/learning-backend';
import { demoQuizPlugins } from '../features/quiz/plugins';
import { experimentDefinitions, quizDefinitions } from '../route-definitions';

const parseModelConfig = (str: string) => {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'string' ? { model: parsed } : parsed;
  } catch {
    return { model: str };
  }
};

// 1. Validate Environment (Fails fast on startup if missing)
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required in .env'),
  OPENAI_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENAI_MODEL: z.string().default('~google/gemini-flash-latest').transform(parseModelConfig),
  OPENAI_MODEL_VALUE: z.string().default('{"model":"~google/gemini-flash-latest","reasoning_effort":"high"}').transform(parseModelConfig),
  OPENAI_MODEL_STRONG: z.string().default('{"model":"~google/gemini-pro-latest","reasoning_effort":"high"}').transform(parseModelConfig),
});
const env = envSchema.parse(process.env);

interface DemoDependencies {
  aiConfig: AiConfig;
  quizEngine: ReturnType<typeof createQuizEngine>;
  quizRepository: InMemoryQuizRepository;
  quizService: QuizService;
  experimentRepository: InMemoryExperimentRepository;
  experimentService: ExperimentService;
  srsRepository: InMemorySrsRepository;
  srsService: SpacedRepetitionService<Record<string, never>>;
}

type QueueTask<T> = () => Promise<T>;

const createSeedVocabCards = (): SrsCard[] => {
  const now = new Date();
  return [
    {
      id: 'demo-markdown-smiles-card',
      sourceId: 'demo-markdown-smiles-card',
      due: now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      payload: {
        type: 'markdown',
        sourceId: 'demo-markdown-smiles-card',
        front: 'Custom Markdown renderer demo `molecule:CCO`',
        back: 'This card is standard Markdown data. The demo app injects a renderer for simple tags like `molecule:O`.',
      },
      tags: ['chemistry', 'markdown'],
      suspended: false,
    },
  ];
};

const createLlmQueue = (concurrency: number) => {
  let activeCount = 0;
  const pending: Array<() => void> = [];

  const runNext = () => {
    activeCount -= 1;
    pending.shift()?.();
  };

  return {
    add: <T>(task: QueueTask<T>) => new Promise<T>((resolve, reject) => {
      const run = () => {
        activeCount += 1;
        task()
          .then(resolve, reject)
          .finally(runNext);
      };

      if (activeCount < concurrency) {
        run();
      } else {
        pending.push(run);
      }
    }),
  };
};

const adaptLlmClient = (client: ReturnType<typeof createLlm>): AiConfig['llm'] => ({
  promptZod: client.promptZod as AiConfig['llm']['promptZod'],
  promptText: ((options) => client.promptText(options as any)) as AiConfig['llm']['promptText'],
});

const createDependencies = (): DemoDependencies => {
  const srsRepository = new InMemorySrsRepository({ cards: createSeedVocabCards() });
  const srsService = new SpacedRepetitionService(srsRepository);
  const llmQueue = createLlmQueue(4);

  // 3. Initialize AI Configuration
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });

  const llm = createLlm({ openai: openai as any, defaultModel: env.OPENAI_MODEL, queue: llmQueue as any });
  const llmValue = createLlm({ openai: openai as any, defaultModel: env.OPENAI_MODEL_VALUE, queue: llmQueue as any });
  const llmStrong = createLlm({ openai: openai as any, defaultModel: env.OPENAI_MODEL_STRONG, queue: llmQueue as any });

  const aiConfig: AiConfig = {
    llm: adaptLlmClient(llm),
    llmValue: adaptLlmClient(llmValue),
    llmStrong: adaptLlmClient(llmStrong),
  };

  // 4. Initialize Quiz Engine with built-in and custom plugins
  const quizEngine = createQuizEngine({
    aiConfig,
    plugins: demoQuizPlugins
  });
  const quizRepository = new InMemoryQuizRepository(quizDefinitions, demoQuizPlugins);
  const quizService = new QuizService(
    quizRepository,
    demoQuizPlugins,
    quizEngine,
    aiConfig
  );
  const experimentRepository = new InMemoryExperimentRepository(experimentDefinitions);
  const experimentService = new ExperimentService(experimentRepository, aiConfig);

  return {
    aiConfig,
    quizEngine,
    quizRepository,
    quizService,
    experimentRepository,
    experimentService,
    srsRepository,
    srsService,
  };
};

const globalDependencies = globalThis as typeof globalThis & {
  __learningDemoDependencies?: DemoDependencies;
};

// 5. Export DI Container
export function getDependencies() {
  globalDependencies.__learningDemoDependencies ??= createDependencies();
  return globalDependencies.__learningDemoDependencies;
}
