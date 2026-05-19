import { VocabBackendAdapter, ReviewRating } from '../../..';
import { AdapterConfig } from '../../../system/api/types';
import { apiClient } from '../../../system/api/apiClient';

/**
 * Factory function to create a standard VocabBackendAdapter.
 * Returns an object with all methods implemented, which can be easily extended or overridden.
 */
export function createVocabAdapter(config: AdapterConfig): VocabBackendAdapter {
  const { baseUrl, headers, fetcher = apiClient } = config;

  const getHeaders = async () => {
    const resolvedHeaders = typeof headers === 'function' ? await headers() : headers;
    return { 'Content-Type': 'application/json', ...resolvedHeaders };
  };

  return {
    fetchReviewBatch: async (options) => fetcher(`${baseUrl}/review/batch`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(options || {}),
    }),

    submitReview: async (cardId: string, rating: ReviewRating) => {
      await fetcher(`${baseUrl}/review/submit`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ cardId, rating }),
      });
    },

    fetchAllCards: async () => fetcher(`${baseUrl}/cards`, {
      headers: await getHeaders(),
    }),

    fetchCardsBySourceIds: async (sourceIds) => fetcher(`${baseUrl}/cards/query`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({ sourceIds }),
    }),

    createCard: async (card) => fetcher(`${baseUrl}/cards`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(card),
    }),

    updateCard: async (id: string, cardUpdate) => fetcher(`${baseUrl}/cards/${id}`, {
      method: 'PUT',
      headers: await getHeaders(),
      body: JSON.stringify(cardUpdate),
    }),

    deleteCards: async (ids: string[]) => {
      await fetcher(`${baseUrl}/cards`, {
        method: 'DELETE',
        headers: await getHeaders(),
        body: JSON.stringify({ ids }),
      });
    },

    fetchAvailableTags: async () => fetcher(`${baseUrl}/tags`, {
      headers: await getHeaders(),
    })
  };
}
