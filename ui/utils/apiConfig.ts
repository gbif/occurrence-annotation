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
  const userKey = localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
  if (userKey && userKey.trim()) {
    return userKey.trim();
  }
  
  // Fall back to environment variable (admin/shared key)
  return import.meta.env.VITE_OPENAI_API_KEY;
};

/**
 * Save user's OpenAI API key to localStorage
 */
export const setUserOpenAIApiKey = (key: string): void => {
  if (key && key.trim()) {
    localStorage.setItem(OPENAI_KEY_STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
  }
};

/**
 * Get user's OpenAI API key from localStorage (not the fallback)
 */
export const getUserOpenAIApiKey = (): string | null => {
  return localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
};

/**
 * Remove user's OpenAI API key from localStorage
 */
export const clearUserOpenAIApiKey = (): void => {
  localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
};

/**
 * Check if user is using their own API key
 */
export const isUsingUserProvidedKey = (): boolean => {
  const userKey = localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
  return !!(userKey && userKey.trim());
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