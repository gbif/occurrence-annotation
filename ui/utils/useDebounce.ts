import { useEffect, useRef, useCallback } from 'react';

/**
 * React hook for debouncing a callback function
 * Returns a memoized debounced version of the callback that delays execution
 * 
 * @param callback - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns A debounced version of the callback
 * 
 * @example
 * ```typescript
 * const debouncedSearch = useDebouncedCallback(
 *   async (query: string) => {
 *     const results = await fetchResults(query);
 *     setResults(results);
 *   },
 *   300
 * );
 * ```
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}
