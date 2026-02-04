export const LEARN_TYPES = [
  'learningPath',
  'module',
  'course',
  'certification',
  'documentation'
] as const;

export type LearnType = (typeof LEARN_TYPES)[number];
export type LearnLevel = 'beginner' | 'intermediate' | 'advanced' | 'unknown';

export type LearnMeta = {
  title: string;
  type: LearnType;
  level?: LearnLevel;
  uid?: string;
  productKey?: string;
  score?: number;
};

type LearnProductRule = {
  key: string;
  regex: RegExp;
};

const LEARN_PRODUCT_RULES: LearnProductRule[] = [
  { key: 'data-factory', regex: /\bdata\s*factory\b/i },
  { key: 'fabric', regex: /\bmicrosoft\s*fabric\b|\bfabric\b/i },
  { key: 'business-central', regex: /\bbusiness\s*central\b/i },
  { key: 'microsoft-365', regex: /\bmicrosoft\s*365\b|\bm365\b|\boffice\s*365\b/i },
  { key: 'power-bi', regex: /\bpower\s*bi\b/i },
  { key: 'power-platform', regex: /\bpower\s*platform\b/i },
  { key: 'dynamics-365', regex: /\bdynamics\s*365\b/i },
  { key: 'teams', regex: /\bmicrosoft\s*teams\b|\bteams\b/i },
  { key: 'sharepoint', regex: /\bsharepoint\b/i },
  { key: 'exchange', regex: /\bexchange\b/i },
  { key: 'copilot', regex: /\bcopilot\b/i },
  { key: 'azure', regex: /\bazure\b/i }
];

export const normalizeLearnType = (value?: string | null): LearnType => {
  if (!value) {
    return 'documentation';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'learningpath' || normalized === 'learning-path') {
    return 'learningPath';
  }
  if (normalized === 'module') {
    return 'module';
  }
  if (normalized === 'course') {
    return 'course';
  }
  if (normalized === 'certification' || normalized === 'exam') {
    return 'certification';
  }
  return 'documentation';
};

export const normalizeLearnLevel = (value?: string | null): LearnLevel => {
  if (!value) {
    return 'unknown';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'beginner') {
    return 'beginner';
  }
  if (normalized === 'intermediate') {
    return 'intermediate';
  }
  if (normalized === 'advanced') {
    return 'advanced';
  }
  return 'unknown';
};

export const getLearnTypeRank = (type: LearnType): number => {
  if (type === 'learningPath') {
    return 0;
  }
  if (type === 'module') {
    return 1;
  }
  if (type === 'course') {
    return 2;
  }
  if (type === 'certification') {
    return 3;
  }
  return 4;
};

export const getLearnLevelRank = (level?: LearnLevel): number => {
  if (level === 'intermediate') {
    return 0;
  }
  if (level === 'beginner') {
    return 1;
  }
  if (level === 'advanced') {
    return 2;
  }
  return 3;
};

export const resolveLearnProductKey = (rawProduct?: string | null): string | null => {
  if (!rawProduct) {
    return null;
  }
  const product = rawProduct.trim();
  if (!product) {
    return null;
  }
  for (const rule of LEARN_PRODUCT_RULES) {
    if (rule.regex.test(product)) {
      return rule.key;
    }
  }
  return null;
};

export const getLearnTypeLabel = (type: LearnType): string => {
  if (type === 'learningPath') {
    return 'Learning Path';
  }
  if (type === 'module') {
    return 'Module';
  }
  if (type === 'course') {
    return 'Course';
  }
  if (type === 'certification') {
    return 'Certification';
  }
  return 'Documentation';
};

export const getLearnLevelLabel = (level?: LearnLevel): string => {
  if (level === 'beginner') {
    return 'Beginner';
  }
  if (level === 'intermediate') {
    return 'Intermediate';
  }
  if (level === 'advanced') {
    return 'Advanced';
  }
  return 'N/D';
};
