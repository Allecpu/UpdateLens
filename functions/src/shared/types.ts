// Shared types for Azure Functions

export type LatestManifest = {
  microsoft?: string;
  eos?: string;
  fabric?: string;
  m365roadmap?: string;
};

export type MicrosoftReleaseItem = {
  id: string;
  source: 'Microsoft';
  productId?: string;
  releasePlanId?: string | null;
  product: string;
  category?: string;
  wave?: string;
  availabilityTypes?: string[];
  enabledFor?: string;
  geography?: string;
  geographyCountries?: string[];
  title: string;
  summary: string;
  status: 'Planned' | 'Rolling out' | 'Try now' | 'Launched' | 'Unknown';
  availabilityDate: string;
  availabilityDateFull?: string;
  firstAvailableDate?: string;
  lastUpdatedDate?: string;
  sourcePlanId?: string | null;
  sourceAppName?: string | null;
  sourceUrl?: string | null;
  learnUrl?: string | null;
  url: string;
};

export type EosReleaseItem = {
  id: string;
  source: 'EOS';
  product: string;
  title: string;
  summary: string;
  status: 'Planned' | 'Rolling out' | 'Launched' | 'Unknown';
  availabilityDate: string;
  availabilityDateFull?: string;
  firstAvailableDate?: string;
  lastUpdatedDate?: string;
  minBcVersion?: number | null;
  sourceUrl?: string | null;
  url: string;
};

export type FabricReleaseItem = {
  id: string;
  source: 'Fabric';
  productId: string;
  product: string;
  productName: string;
  category: string;
  title: string;
  summary: string;
  description: string;
  status: 'Planned' | 'Try now' | 'Launched' | 'Unknown';
  availabilityDate: string;
  availabilityDateFull?: string;
  releaseDate: string;
  tryNow: boolean;
  minBcVersion: null;
  availabilityTypes?: string[];
  firstAvailableDate?: string;
  lastUpdatedDate?: string;
  sourceUrl: string;
  learnUrl?: string | null;
  url: string;
};

export type M365RoadmapReleaseItem = {
  id: string;
  source: 'MICROSOFT 365';
  productId: string;
  product: string;
  productName: string;
  category: string;
  title: string;
  summary: string;
  description: string;
  status: 'Planned' | 'Rolling out' | 'Launched' | 'Unknown';
  availabilityDate: string;
  availabilityDateFull?: string;
  releaseDate: string;
  tryNow: boolean;
  minBcVersion: null;
  availabilityTypes?: string[];
  tags?: string[];
  firstAvailableDate?: string;
  lastUpdatedDate?: string;
  sourceUrl: string;
  learnUrl?: string;
  url: string;
};

export type ReleaseItem =
  | MicrosoftReleaseItem
  | EosReleaseItem
  | FabricReleaseItem
  | M365RoadmapReleaseItem;

export type Snapshot<T> = {
  version: number;
  items: T[];
};

export type RefreshResult = {
  source: 'microsoft' | 'eos' | 'fabric' | 'm365roadmap';
  status: 'ok' | 'failed';
  itemCount: number | null;
  duration: number;
  error?: string;
  timestamp: string;
  filename?: string;
};
