import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook that debounces a value change.
 * Returns a tuple of [debouncedValue, setValueImmediately]
 *
 * @param initialValue - Initial value
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 */
export function useDebouncedValue<T>(
  initialValue: T,
  delay = 300
): [T, T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced update
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup on unmount or value change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return [value, debouncedValue, setValue];
}

/**
 * Hook for debounced input fields.
 * Syncs with external value and provides immediate local updates with debounced onChange.
 *
 * @param externalValue - The controlled value from parent
 * @param onChange - Callback to update parent (will be debounced)
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 */
export function useDebouncedInput(
  externalValue: string,
  onChange: (value: string) => void,
  delay = 300
): [string, (value: string) => void] {
  const [localValue, setLocalValue] = useState(externalValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Sync local value when external value changes (e.g., reset filters)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Only sync if the external value differs from local
    // This prevents overwriting user input during typing
    if (externalValue !== localValue && !timeoutRef.current) {
      setLocalValue(externalValue);
    }
  }, [externalValue]);

  const handleChange = (newValue: string) => {
    // Update local state immediately for responsive UI
    setLocalValue(newValue);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the actual onChange callback
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
      timeoutRef.current = null;
    }, delay);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [localValue, handleChange];
}

/**
 * Hook that returns a debounced version of a callback function.
 * Useful for wrapping onChange handlers that trigger expensive operations.
 *
 * @param callback - The callback function to debounce
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay = 300
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Keep callback ref updated
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

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
      timeoutRef.current = null;
    }, delay);
  }, [delay]) as T;

  return debouncedCallback;
}
