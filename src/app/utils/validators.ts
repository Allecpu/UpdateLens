/**
 * Validation rules engine
 * Supports: required, min/max length, regex, numeric range, email, custom validators
 */

export type ValidatorType = 
  | 'required' 
  | 'minLength' 
  | 'maxLength' 
  | 'min' 
  | 'max' 
  | 'regex' 
  | 'email' 
  | 'url' 
  | 'custom';

export interface ValidationRule {
  type: ValidatorType;
  value?: string | number | RegExp;
  message?: string;
  custom?: (val: any) => boolean | string;
}

export interface ValidationError {
  field: string;
  message: string;
  rule: ValidatorType;
}

export interface FieldValidator {
  field: string;
  type: 'text' | 'number' | 'date' | 'choice' | 'lookup';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp | string;
  email?: boolean;
  url?: boolean;
  customValidators?: Array<(val: any) => boolean | string>;
}

/**
 * Validates a single rule against a value
 */
export function validateRule(value: any, rule: ValidationRule): string | null {
  const defaultMsg = (type: string) => `Validation error: ${type}`;

  switch (rule.type) {
    case 'required':
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
        return rule.message || 'Campo obbligatorio';
      }
      return null;

    case 'minLength':
      if (value != null && String(value).length < (rule.value as number)) {
        return rule.message || `Minimo ${rule.value} caratteri`;
      }
      return null;

    case 'maxLength':
      if (value != null && String(value).length > (rule.value as number)) {
        return rule.message || `Massimo ${rule.value} caratteri`;
      }
      return null;

    case 'min':
      if (value != null) {
        const num = Number(value);
        if (isNaN(num) || num < (rule.value as number)) {
          return rule.message || `Valore minimo: ${rule.value}`;
        }
      }
      return null;

    case 'max':
      if (value != null) {
        const num = Number(value);
        if (isNaN(num) || num > (rule.value as number)) {
          return rule.message || `Valore massimo: ${rule.value}`;
        }
      }
      return null;

    case 'regex': {
      if (value != null) {
        const pattern = rule.value instanceof RegExp 
          ? rule.value 
          : new RegExp(rule.value as string);
        if (!pattern.test(String(value))) {
          return rule.message || 'Formato non valido';
        }
      }
      return null;
    }

    case 'email':
      if (value != null && String(value).trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          return rule.message || 'Email non valida';
        }
      }
      return null;

    case 'url':
      if (value != null && String(value).trim()) {
        try {
          new URL(String(value));
        } catch {
          return rule.message || 'URL non valido';
        }
      }
      return null;

    case 'custom':
      if (rule.custom) {
        const result = rule.custom(value);
        if (result !== true) {
          return typeof result === 'string' ? result : (rule.message || defaultMsg('custom'));
        }
      }
      return null;

    default:
      return null;
  }
}

/**
 * Validates a value against multiple rules
 * Returns first error found, or null if all pass
 */
export function validateValue(value: any, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    const error = validateRule(value, rule);
    if (error) {
      return error;
    }
  }
  return null;
}

/**
 * Validates an object against a schema of validators
 * Returns all validation errors found
 */
export function validateObject(
  obj: Record<string, any>,
  schema: Record<string, ValidationRule[]>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const error = validateValue(obj[field], rules);
    if (error) {
      errors.push({
        field,
        message: error,
        rule: rules[0].type
      });
    }
  }

  return errors;
}

/**
 * Build rules from FieldValidator config
 * Used to generate validation rules from field metadata
 */
export function buildRules(validator: FieldValidator): ValidationRule[] {
  const rules: ValidationRule[] = [];

  if (validator.required) {
    rules.push({ type: 'required' });
  }

  if (validator.minLength != null) {
    rules.push({
      type: 'minLength',
      value: validator.minLength,
      message: `Minimo ${validator.minLength} caratteri`
    });
  }

  if (validator.maxLength != null) {
    rules.push({
      type: 'maxLength',
      value: validator.maxLength,
      message: `Massimo ${validator.maxLength} caratteri`
    });
  }

  if (validator.type === 'number') {
    if (validator.min != null) {
      rules.push({
        type: 'min',
        value: validator.min,
        message: `Valore minimo: ${validator.min}`
      });
    }
    if (validator.max != null) {
      rules.push({
        type: 'max',
        value: validator.max,
        message: `Valore massimo: ${validator.max}`
      });
    }
  }

  if (validator.pattern) {
    rules.push({
      type: 'regex',
      value: validator.pattern,
      message: `Formato non valido`
    });
  }

  if (validator.email) {
    rules.push({ type: 'email' });
  }

  if (validator.url) {
    rules.push({ type: 'url' });
  }

  if (validator.customValidators) {
    for (const customValidator of validator.customValidators) {
      rules.push({
        type: 'custom',
        custom: customValidator
      });
    }
  }

  return rules;
}

/**
 * Predefined validators for common use cases
 */
export const COMMON_VALIDATORS = {
  required: (message?: string): ValidationRule => ({
    type: 'required',
    message: message || 'Campo obbligatorio'
  }),

  email: (): ValidationRule => ({
    type: 'email',
    message: 'Email non valida'
  }),

  url: (): ValidationRule => ({
    type: 'url',
    message: 'URL non valido'
  }),

  minLength: (length: number, message?: string): ValidationRule => ({
    type: 'minLength',
    value: length,
    message: message || `Minimo ${length} caratteri`
  }),

  maxLength: (length: number, message?: string): ValidationRule => ({
    type: 'maxLength',
    value: length,
    message: message || `Massimo ${length} caratteri`
  }),

  pattern: (regex: RegExp | string, message?: string): ValidationRule => ({
    type: 'regex',
    value: regex,
    message: message || 'Formato non valido'
  }),

  numericRange: (min: number, max: number): ValidationRule[] => [
    { type: 'min', value: min, message: `Valore minimo: ${min}` },
    { type: 'max', value: max, message: `Valore massimo: ${max}` }
  ],

  phone: (message?: string): ValidationRule => ({
    type: 'regex',
    value: /^[\d\s\-\+\(\)]{7,}$/,
    message: message || 'Numero di telefono non valido'
  })
};
