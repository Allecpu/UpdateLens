export type FilterState = {
  targetCustomerIds: string[];
  targetGroupIds: string[];
  targetCssOwners: string[];
  products: string[];
  sources: string[];
  statuses: string[];
  categories: string[];
  tags: string[];
  waves: string[];
  months: string[];
  availabilityTypes: string[];
  enabledFor: string[];
  geography: string[];
  language: string[];
  bcVersions: string[];
  periodNewDays: number;
  periodChangedDays: number;
  releaseInDays: number;
  minBcVersionMin: number | null;
  releaseDateFrom: string;
  releaseDateTo: string;
  sortOrder: 'newest' | 'oldest';
  query: string;
  horizonMonths: number;
  historyMonths: number;
};

export type FilterPreset = {
  id: string;
  name: string;
  description?: string;
  filters: FilterState;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
