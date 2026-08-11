import type { CssActivity } from '../../models/Css';

export type FilterOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'isEmpty'
  | 'isNotEmpty';

export interface FilterRule {
  id: string;
  field: keyof CssActivity;
  operator: FilterOperator;
  value: any;
  fieldDisplay?: string;
}

export interface AdvancedFilters {
  rules: FilterRule[];
  logic: 'AND' | 'OR';
}

/**
 * Valuta una singola regola di filtro
 */
export const evaluateRule = (activity: CssActivity, rule: FilterRule): boolean => {
  const fieldValue = getFieldValue(activity, rule.field);

  switch (rule.operator) {
    case '=':
      return normalizeValue(fieldValue) === normalizeValue(rule.value);

    case '!=':
      return normalizeValue(fieldValue) !== normalizeValue(rule.value);

    case '>':
      return Number(fieldValue) > Number(rule.value);

    case '<':
      return Number(fieldValue) < Number(rule.value);

    case '>=':
      return Number(fieldValue) >= Number(rule.value);

    case '<=':
      return Number(fieldValue) <= Number(rule.value);

    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(rule.value).toLowerCase());

    case 'startsWith':
      return String(fieldValue).toLowerCase().startsWith(String(rule.value).toLowerCase());

    case 'endsWith':
      return String(fieldValue).toLowerCase().endsWith(String(rule.value).toLowerCase());

    case 'in':
      return Array.isArray(rule.value)
        ? rule.value.some((v) => normalizeValue(fieldValue) === normalizeValue(v))
        : false;

    case 'isEmpty':
      return !fieldValue || fieldValue === '' || fieldValue === null;

    case 'isNotEmpty':
      return fieldValue && fieldValue !== '' && fieldValue !== null;

    default:
      return true;
  }
};

/**
 * Valuta tutte le regole secondo la logica AND/OR
 */
export const evaluateFilters = (
  activity: CssActivity,
  filters: AdvancedFilters
): boolean => {
  if (!filters.rules || filters.rules.length === 0) return true;

  const results = filters.rules.map((rule) => evaluateRule(activity, rule));

  if (filters.logic === 'AND') {
    return results.every((r) => r === true);
  } else {
    // OR
    return results.some((r) => r === true);
  }
};

/**
 * Filtra un array di attività
 */
export const filterActivities = (
  activities: CssActivity[],
  filters: AdvancedFilters
): CssActivity[] => {
  return activities.filter((activity) => evaluateFilters(activity, filters));
};

/**
 * Ottieni il valore di un campo dall'attività
 */
const getFieldValue = (activity: CssActivity, field: keyof CssActivity | 'custom'): any => {
  if (field === 'custom') return '';
  return activity[field];
};

/**
 * Normalizza i valori per il confronto
 */
const normalizeValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  return String(value).toLowerCase().trim();
};

/**
 * Operatori disponibili per tipo di campo
 */
export const getOperatorsForField = (field: keyof CssActivity): FilterOperator[] => {
  const numericFields = ['rating', 'lastUpdate'];
  const textFields = ['customerName', 'issue', 'details', 'notes', 'cssOwner', 'cssAction'];
  const statusFields = ['issueStatus', 'listStatus'];

  if (numericFields.includes(field)) {
    return ['=', '!=', '>', '<', '>=', '<=', 'isEmpty', 'isNotEmpty'];
  }

  if (statusFields.includes(field)) {
    return ['=', '!=', 'in', 'isEmpty', 'isNotEmpty'];
  }

  if (textFields.includes(field)) {
    return ['=', '!=', 'contains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'];
  }

  return ['=', '!=', 'isEmpty', 'isNotEmpty'];
};

/**
 * Etichette leggibili per operatori
 */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  '=': 'è uguale a',
  '!=': 'è diverso da',
  '>': 'è maggiore di',
  '<': 'è minore di',
  '>=': 'è >= di',
  '<=': 'è <= di',
  contains: 'contiene',
  startsWith: 'inizia con',
  endsWith: 'finisce con',
  in: 'è uno di',
  isEmpty: 'è vuoto',
  isNotEmpty: 'non è vuoto',
};

/**
 * Etichette leggibili per campi
 */
export const FIELD_LABELS: Record<string, string> = {
  customerName: 'Cliente',
  cssOwner: 'CSS Owner',
  issueStatus: 'Issue Status',
  listStatus: 'Status Lista',
  rating: 'Rating',
  issue: 'Issue',
  details: 'Dettagli',
  lastUpdate: 'Last Update',
  notes: 'Note',
  cssAction: 'CSS Action',
  blBu: 'BL/BUs',
  dueDate: 'Due Date',
  customerPriority: 'Customer Priority',
  cssPriority: 'CSS Priority',
  eosOwners: 'EOS Owners',
  customerOwners: 'Customer Owners',
  itemType: 'Item Type',
};
