import { QuizBackendAdapter, GradingRequest, GradingResponse } from "../types/adapters";

/**
 * Creates a backend adapter that communicates with a real API endpoint.
 * 
 * @param endpointUrl The full URL to the grading API endpoint
 */
export const createApiBackendAdapter = (endpointUrl: string): QuizBackendAdapter => ({
  gradeAnswer: async (req: GradingRequest): Promise<GradingResponse> => {
    try {
      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      return rawData as GradingResponse;
    } catch (error) {
      console.error('Failed to grade answer:', error);
      throw error;
    }
  }
});
