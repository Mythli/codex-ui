import { z } from 'zod';

export interface ObservationDefinition {
  id: string;
  name: string;
  criteria?: string;
  hint?: string;
}

export interface PublicExperimentDefinition {
  id: string;
  title: string;
  observations: ObservationDefinition[];
}

export interface ExperimentSession {
  experiment: PublicExperimentDefinition;
}

export const observationHintSchema = z.object({
  observationId: z.string(),
  hint: z.string()
});

export type ObservationHint = z.infer<typeof observationHintSchema>;

export const experimentStateSchema = z.object({
  observationsText: z.string().catch(''),
  confirmedObservations: z.array(z.string()).catch([]),
  manuallyRevealedSections: z.array(z.string()).catch([]),
  completedChallenges: z.array(z.string()).catch([]),
  activeChallengeId: z.string().nullable().catch(null),
  slices: z.record(z.string(), z.unknown()).catch({}),
  history: z.record(z.string(), z.unknown()).catch({}),
  isParsingObservations: z.boolean().catch(false),
  observationFeedback: z.string().nullable().catch(null),
  observationHints: z.array(observationHintSchema).catch([]),
  checkpointResetKey: z.number().catch(0)
});

export type ExperimentState = z.infer<typeof experimentStateSchema>;
