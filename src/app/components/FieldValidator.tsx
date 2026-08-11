/**
 * Reusable validated input components
 * Displays error messages and visual feedback inline
 */

import React, { ReactNode } from 'react';
import type { ValidationRule } from '../utils/validators';

interface FieldErrorProps {
  error: string | null;
  isTouched: boolean;
}

export function FieldError({ error, isTouched }: FieldErrorProps) {
  if (!error || !isTouched) {
    return null;
  }

  return (
    <div className="mt-1 text-xs text-red-600 dark:text-red-400">
      ⚠️ {error}
    </div>
  );
}

interface ValidatedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  description?: string;
  rules?: ValidationRule[];
  error?: string | null;
  isTouched?: boolean;
  isDirty?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  showError?: boolean;
  errorPosition?: 'bottom' | 'inline';
  hint?: string;
}

export const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  (
    {
      label,
      description,
      rules = [],
      error,
      isTouched = false,
      isDirty = false,
      onChange,
      onBlur,
      showError = true,
      errorPosition = 'bottom',
      hint,
      className,
      ...props
    },
    ref
  ) => {
    const hasError = error != null && isTouched && showError;

    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-foreground">
            {label}
            {rules.some((r) => r.type === 'required') && (
              <span className="ml-1 text-red-600">*</span>
            )}
          </label>
        )}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <input
          ref={ref}
          className={`ul-input ${hasError ? 'border-red-500 ring-red-500' : ''} ${className ?? ''}`}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          {...props}
        />
        {errorPosition === 'bottom' && (
          <FieldError error={error ?? null} isTouched={isTouched} />
        )}
        {errorPosition === 'inline' && hasError && (
          <span className="ml-2 inline text-xs text-red-600 dark:text-red-400">
            • {error}
          </span>
        )}
        {hint && !hasError && (
          <p className="text-xs text-muted-foreground">💡 {hint}</p>
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';

interface ValidatedSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  description?: string;
  options: Array<{ value: string; label: string }>;
  rules?: ValidationRule[];
  error?: string | null;
  isTouched?: boolean;
  isDirty?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  showError?: boolean;
}

export const ValidatedSelect = React.forwardRef<HTMLSelectElement, ValidatedSelectProps>(
  (
    {
      label,
      description,
      options,
      rules = [],
      error,
      isTouched = false,
      isDirty = false,
      onChange,
      onBlur,
      showError = true,
      className,
      ...props
    },
    ref
  ) => {
    const hasError = error != null && isTouched && showError;

    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-foreground">
            {label}
            {rules.some((r) => r.type === 'required') && (
              <span className="ml-1 text-red-600">*</span>
            )}
          </label>
        )}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <select
          ref={ref}
          className={`ul-input ${hasError ? 'border-red-500 ring-red-500' : ''} ${className ?? ''}`}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <FieldError error={error ?? null} isTouched={isTouched} />
      </div>
    );
  }
);

ValidatedSelect.displayName = 'ValidatedSelect';

interface ValidatedTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  description?: string;
  rules?: ValidationRule[];
  error?: string | null;
  isTouched?: boolean;
  isDirty?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  showError?: boolean;
}

export const ValidatedTextarea = React.forwardRef<HTMLTextAreaElement, ValidatedTextareaProps>(
  (
    {
      label,
      description,
      rules = [],
      error,
      isTouched = false,
      isDirty = false,
      onChange,
      onBlur,
      showError = true,
      className,
      ...props
    },
    ref
  ) => {
    const hasError = error != null && isTouched && showError;

    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-foreground">
            {label}
            {rules.some((r) => r.type === 'required') && (
              <span className="ml-1 text-red-600">*</span>
            )}
          </label>
        )}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <textarea
          ref={ref}
          className={`ul-textarea ${hasError ? 'border-red-500 ring-red-500' : ''} ${className ?? ''}`}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          {...props}
        />
        <FieldError error={error ?? null} isTouched={isTouched} />
      </div>
    );
  }
);

ValidatedTextarea.displayName = 'ValidatedTextarea';

/**
 * Form wrapper with built-in error display
 */
interface ValidatedFormProps {
  onSubmit: (e: React.FormEvent) => void;
  children: ReactNode;
  className?: string;
  globalError?: string | null;
}

export function ValidatedForm({
  onSubmit,
  children,
  className,
  globalError
}: ValidatedFormProps) {
  return (
    <form onSubmit={onSubmit} className={className}>
      {globalError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          ⚠️ {globalError}
        </div>
      )}
      {children}
    </form>
  );
}

/**
 * Visual indicator for validation summary
 */
interface ValidationSummaryProps {
  errors: Record<string, string | null>;
  touched: Record<string, boolean>;
}

export function ValidationSummary({ errors, touched }: ValidationSummaryProps) {
  const visibleErrors = Object.entries(errors)
    .filter(([field, error]) => error && touched[field])
    .map(([field, error]) => ({ field, error }));

  if (visibleErrors.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
      <h4 className="mb-2 font-medium text-amber-900 dark:text-amber-200">
        ⚠️ Errori di validazione ({visibleErrors.length})
      </h4>
      <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
        {visibleErrors.map(({ field, error }) => (
          <li key={field}>
            <strong>{field}:</strong> {error}
          </li>
        ))}
      </ul>
    </div>
  );
}
