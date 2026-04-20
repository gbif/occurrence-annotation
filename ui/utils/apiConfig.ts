// API Configuration Module
// This module handles switching between local development and production APIs

export type ApiMode = 'local' | 'production';

export interface ApiConfig {
  mode: ApiMode;
  annotationApiBaseUrl: string;
  gbifApiBaseUrl: string;
}

// Get configuration from environment variables
const getApiConfig = (): ApiConfig => {
  const mode = (import.meta.env.VITE_API_MODE as ApiMode) || 'production';
  const localApiBaseUrl = import.meta.env.VITE_LOCAL_API_BASE_URL || 'http://localhost:8080';
  const gbifApiBaseUrl = import.meta.env.VITE_GBIF_API_BASE_URL || 'https://api.gbif.org/v1';

  return {
    mode,
    annotationApiBaseUrl: mode === 'local' ? localApiBaseUrl : gbifApiBaseUrl,
    gbifApiBaseUrl: gbifApiBaseUrl, // Always use GBIF for species lookup
  };
};

export const apiConfig = getApiConfig();

// Helper functions for building API URLs
export const getAnnotationApiUrl = (endpoint: string): string => {
  const baseUrl = apiConfig.annotationApiBaseUrl;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  if (apiConfig.mode === 'local') {
    // For local development, use the occurrence/experimental/annotation prefix
    return `${baseUrl}/occurrence/experimental/annotation${path}`;
  } else {
    // For production, use the full GBIF API path
    return `${baseUrl}/occurrence/experimental/annotation${path}`;
  }
};

export const getGbifApiUrl = (endpoint: string): string => {
  const baseUrl = apiConfig.gbifApiBaseUrl;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${path}`;
};

// OpenAI API Configuration (for AI-powered location quality checks)
const OPENAI_KEY_STORAGE_KEY = 'gbif_openai_api_key';

/**
 * Get OpenAI API key - checks localStorage first, then falls back to env variable
 */
export const getOpenAIApiKey = (): string | undefined => {
  // First check if user has provided their own key
  try {
    const userKey = localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
    if (userKey && userKey.trim()) {
      return userKey.trim();
    }
  } catch (error) {
    // localStorage may throw in private browsing mode or when disabled
    console.warn('Failed to access localStorage for OpenAI key:', error);
  }
  
  // Fall back to environment variable (admin/shared key)
  return import.meta.env.VITE_OPENAI_API_KEY;
};

/**
 * Save user's OpenAI API key to localStorage
 */
export const setUserOpenAIApiKey = (key: string): void => {
  try {
    if (key && key.trim()) {
      localStorage.setItem(OPENAI_KEY_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to save OpenAI key to localStorage:', error);
    throw new Error('Unable to save API key. localStorage may be disabled.');
  }
};

/**
 * Get user's OpenAI API key from localStorage (not the fallback)
 */
export const getUserOpenAIApiKey = (): string | null => {
  try {
    return localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to access localStorage for OpenAI key:', error);
    return null;
  }
};

/**
 * Remove user's OpenAI API key from localStorage
 */
export const clearUserOpenAIApiKey = (): void => {
  try {
    localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to remove OpenAI key from localStorage:', error);
  }
};

/**
 * Check if user is using their own API key
 */
export const isUsingUserProvidedKey = (): boolean => {
  try {
    const userKey = localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
    return !!(userKey && userKey.trim());
  } catch (error) {
    return false;
  }
};

/**
 * Check if admin/shared key is available
 */
export const hasSharedOpenAIKey = (): boolean => {
  return !!(import.meta.env.VITE_OPENAI_API_KEY);
};

// Debug logging
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', {
    mode: apiConfig.mode,
    annotationApiBaseUrl: apiConfig.annotationApiBaseUrl,
    gbifApiBaseUrl: apiConfig.gbifApiBaseUrl,
    hasOpenAIKey: !!getOpenAIApiKey(),
  });
}