import { ObservationHint } from './state';

export interface ParseObservationsRequest {
  experimentId: string;
  userText: string;
}

export interface ParseObservationsResponse {
  confirmed: string[];
  feedback: string;
  hints: ObservationHint[];
}

export interface ExperimentBackendAdapter {
  /** Evaluates the user's text against the possible observations */
  parseObservations: (request: ParseObservationsRequest) => Promise<ParseObservationsResponse>;
}

export interface ExperimentStorageAdapter {
  /** Loads the saved state for a given experiment */
  load: (experimentId: string) => Promise<Record<string, unknown> | null>;
  /** Persists the current state of the experiment */
  save: (experimentId: string, state: Record<string, unknown>) => Promise<void>;
}
