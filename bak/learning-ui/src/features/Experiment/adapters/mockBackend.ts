import { ExperimentBackendAdapter, ParseObservationsRequest, ParseObservationsResponse } from '../types/adapters';
import { ObservationDefinition } from '../types/state';

export function createMockExperimentBackendAdapter(
  possibleObservations: ObservationDefinition[] = []
): ExperimentBackendAdapter {
  return {
    parseObservations: async (req: ParseObservationsRequest): Promise<ParseObservationsResponse> => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));

      const text = req.userText.toLowerCase();
      const confirmed: string[] = [];
      const hints: { observationId: string; hint: string }[] = [];

      possibleObservations.forEach(obs => {
        // Simple mock logic: if the user types the ID or the name, consider it found.
        // In a real app, an LLM would evaluate the criteria.
        if (text.includes(obs.id.toLowerCase()) || text.includes(obs.name.toLowerCase())) {
          confirmed.push(obs.id);
        } else if (obs.hint) {
          hints.push({ observationId: obs.id, hint: obs.hint });
        }
      });

      let feedback = "I've analyzed your observations.";
      if (confirmed.length === 0) {
        feedback = "I don't see any of the expected patterns yet. Keep experimenting!";
      } else if (confirmed.length === possibleObservations.length) {
        feedback = "Excellent! You've discovered all the key patterns.";
      } else {
        feedback = `Good job! You found ${confirmed.length} pattern(s). Keep looking for more.`;
      }

      return {
        confirmed,
        feedback,
        hints
      };
    }
  };
}

/**
 * A mock backend adapter useful for testing and Storybook.
 * Simulates network latency and provides basic string matching for observations.
 */
export const experimentMockBackendAdapter = createMockExperimentBackendAdapter();
