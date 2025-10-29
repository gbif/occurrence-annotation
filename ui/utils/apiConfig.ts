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

// Debug logging
if (import.meta.env.DEV) {
  console.log('🔧 API Configuration:', {
    mode: apiConfig.mode,
    annotationApiBaseUrl: apiConfig.annotationApiBaseUrl,
    gbifApiBaseUrl: apiConfig.gbifApiBaseUrl,
  });
}