import { ExperimentBackendAdapter } from '../../..';
import { AdapterConfig } from '../../../system/api/types';
import { apiClient } from '../../../system/api/apiClient';

/**
 * Factory function to create a standard ExperimentBackendAdapter.
 */
export function createExperimentAdapter(config: AdapterConfig): ExperimentBackendAdapter {
  const { baseUrl, headers, fetcher = apiClient } = config;

  const getHeaders = async () => {
    const resolvedHeaders = typeof headers === 'function' ? await headers() : headers;
    return { 'Content-Type': 'application/json', ...resolvedHeaders };
  };

  return {
    parseObservations: async ({ experimentId, userText }) =>
      fetcher(`${baseUrl}/${experimentId}/observations/parse`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ userText }),
      })
  };
}
