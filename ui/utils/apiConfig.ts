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
 * Migrate legacy localStorage OpenAI key to sessionStorage
 * @private
 */
const migrateLegacyOpenAIKey = (): void => {
  try {
    const legacyKey = localStorage.getItem(OPENAI_KEY_STORAGE_KEY);
    if (legacyKey) {
      console.info('Migrating OpenAI API key from localStorage to sessionStorage');
      sessionStorage.setItem(OPENAI_KEY_STORAGE_KEY, legacyKey);
      localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Failed to migrate legacy OpenAI key:', error);
  }
};

/**
 * Get OpenAI API key from user-provided sessionStorage only
 * 
 * SECURITY: No fallback to environment variables to prevent key exposure in client bundle.
 * Users must provide their own OpenAI API keys via the UI settings.
 * Key is stored in sessionStorage (not localStorage) to limit exposure to XSS attacks.
 */
export const getOpenAIApiKey = (): string | undefined => {
  migrateLegacyOpenAIKey();
  
  try {
    const userKey = sessionStorage.getItem(OPENAI_KEY_STORAGE_KEY);
    if (userKey && userKey.trim()) {
      return userKey.trim();
    }
  } catch (error) {
    // sessionStorage may throw in private browsing mode or when disabled
    console.warn('Failed to access sessionStorage for OpenAI key:', error);
  }
  
  // No fallback - users must provide their own keys for security
  return undefined;
};

/**
 * Save user's OpenAI API key to sessionStorage
 */
export const setUserOpenAIApiKey = (key: string): void => {
  migrateLegacyOpenAIKey();
  
  try {
    if (key && key.trim()) {
      sessionStorage.setItem(OPENAI_KEY_STORAGE_KEY, key.trim());
    } else {
      sessionStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to save OpenAI key to sessionStorage:', error);
    throw new Error('Unable to save API key. sessionStorage may be disabled.');
  }
};

/**
 * Get user's OpenAI API key from sessionStorage
 */
export const getUserOpenAIApiKey = (): string | null => {
  migrateLegacyOpenAIKey();
  
  try {
    return sessionStorage.getItem(OPENAI_KEY_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to access sessionStorage for OpenAI key:', error);
    return null;
  }
};

/**
 * Remove user's OpenAI API key from sessionStorage
 */
export const clearUserOpenAIApiKey = (): void => {
  try {
    sessionStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
    // Also remove legacy localStorage key if it exists
    localStorage.removeItem(OPENAI_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to remove OpenAI key from sessionStorage:', error);
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