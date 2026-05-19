import { toast } from '../../common/Toast/Toaster';

/**
 * A centralized fetch wrapper that automatically intercepts HTTP errors,
 * parses the backend's JSON error response, and triggers a global toast notification.
 */
export async function apiClient<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(url, options);
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      let message = `HTTP Error ${res.status}`;
      
      if (errorData) {
        if (typeof errorData.details === 'string') {
          message = errorData.details;
        } else if (errorData.error) {
          message = errorData.error;
        }
      }
      
      throw new Error(message);
    }
    
    // Handle 204 No Content
    if (res.status === 204) {
      return {} as T;
    }
    
    return res.json();
  } catch (error: unknown) {
    // Automatically show the error to the user
    const errorMessage = error instanceof Error ? error.message : 'An unexpected network error occurred';
    toast.error(errorMessage);
    // Re-throw so the calling component can stop its loading state
    throw error;
  }
}
