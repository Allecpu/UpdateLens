/**
 * Hook for managing field-level validation state
 * Tracks errors and touched state for each field
 */

import { useState, useCallback } from 'react';
import type { ValidationRule } from '../utils/validators';
import { validateValue } from '../utils/validators';

export interface FieldValidationState {
  value: any;
  error: string | null;
  isTouched: boolean;
  isDirty: boolean;
}

export interface UseFieldValidatorReturn {
  state: FieldValidationState;
  setValue: (value: any) => void;
  setError: (error: string | null) => void;
  markTouched: () => void;
  reset: () => void;
  validate: () => boolean;
  hasError: boolean;
}

export function useFieldValidator(
  initialValue: any = '',
  rules: ValidationRule[] = []
): UseFieldValidatorReturn {
  const [state, setState] = useState<FieldValidationState>({
    value: initialValue,
    error: null,
    isTouched: false,
    isDirty: false
  });

  const setValue = useCallback((value: any) => {
    setState((prev) => ({
      ...prev,
      value,
      isDirty: value !== initialValue
    }));
  }, [initialValue]);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({
      ...prev,
      error
    }));
  }, []);

  const markTouched = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isTouched: true
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      value: initialValue,
      error: null,
      isTouched: false,
      isDirty: false
    });
  }, [initialValue]);

  const validate = useCallback((): boolean => {
    const error = validateValue(state.value, rules);
    setState((prev) => ({
      ...prev,
      error,
      isTouched: true
    }));
    return !error;
  }, [state.value, rules]);

  return {
    state,
    setValue,
    setError,
    markTouched,
    reset,
    validate,
    hasError: state.error != null
  };
}

/**
 * Hook for managing validation state of multiple fields
 * Used in forms with multiple validated fields
 */
export interface UseFormValidatorReturn {
  values: Record<string, any>;
  errors: Record<string, string | null>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  setFieldValue: (field: string, value: any) => void;
  setFieldError: (field: string, error: string | null) => void;
  markFieldTouched: (field: string) => void;
  resetForm: () => void;
  validateForm: () => boolean;
  validateField: (field: string) => boolean;
  getFieldState: (field: string) => FieldValidationState;
}

export function useFormValidator(
  initialValues: Record<string, any>,
  schema: Record<string, ValidationRule[]>
): UseFormValidatorReturn {
  const [state, setState] = useState<{
    values: Record<string, any>;
    errors: Record<string, string | null>;
    touched: Record<string, boolean>;
    dirty: Record<string, boolean>;
  }>({
    values: initialValues,
    errors: {},
    touched: {},
    dirty: Object.fromEntries(Object.keys(initialValues).map((k) => [k, false]))
  });

  const setFieldValue = useCallback((field: string, value: any) => {
    setState((prev) => ({
      ...prev,
      values: { ...prev.values, [field]: value },
      dirty: { ...prev.dirty, [field]: value !== initialValues[field] }
    }));
  }, [initialValues]);

  const setFieldError = useCallback((field: string, error: string | null) => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [field]: error }
    }));
  }, []);

  const markFieldTouched = useCallback((field: string) => {
    setState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [field]: true }
    }));
  }, []);

  const resetForm = useCallback(() => {
    setState({
      values: initialValues,
      errors: {},
      touched: {},
      dirty: Object.fromEntries(Object.keys(initialValues).map((k) => [k, false]))
    });
  }, [initialValues]);

  const validateField = useCallback(
    (field: string): boolean => {
      const rules = schema[field] || [];
      const error = validateValue(state.values[field], rules);
      setFieldError(field, error);
      return !error;
    },
    [state.values, schema, setFieldError]
  );

  const validateForm = useCallback((): boolean => {
    let isValid = true;
    const newErrors: Record<string, string | null> = {};

    for (const [field, rules] of Object.entries(schema)) {
      const error = validateValue(state.values[field], rules);
      newErrors[field] = error;
      if (error) {
        isValid = false;
      }
    }

    setState((prev) => ({
      ...prev,
      errors: newErrors,
      touched: Object.fromEntries(Object.keys(schema).map((k) => [k, true]))
    }));

    return isValid;
  }, [state.values, schema]);

  const getFieldState = useCallback(
    (field: string): FieldValidationState => ({
      value: state.values[field],
      error: state.errors[field] ?? null,
      isTouched: state.touched[field] ?? false,
      isDirty: state.dirty[field] ?? false
    }),
    [state]
  );

  return {
    values: state.values,
    errors: state.errors,
    touched: state.touched,
    dirty: state.dirty,
    setFieldValue,
    setFieldError,
    markFieldTouched,
    resetForm,
    validateForm,
    validateField,
    getFieldState
  };
}
