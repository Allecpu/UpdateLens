export type ProductColorConfig = {
  barClass: string;
  badgeClass: string;
};

const DEFAULT_PRODUCT_COLOR: ProductColorConfig = {
  barClass: 'bg-slate-400/70 dark:bg-slate-500/60',
  badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200'
};

export const PRODUCT_COLOR_MAP: Record<string, ProductColorConfig> = {
  'Microsoft Sustainability Manager': {
    barClass: 'bg-emerald-500/90 dark:bg-emerald-400',
    badgeClass: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
  },
  'Dynamics 365 Business Central': {
    barClass: 'bg-sky-500/90 dark:bg-sky-400',
    badgeClass: 'bg-sky-50 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200'
  },
  'Dynamics 365 Contact Center': {
    barClass: 'bg-violet-500/90 dark:bg-violet-400',
    badgeClass: 'bg-violet-50 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200'
  },
  Dataverse: {
    barClass: 'bg-orange-500/90 dark:bg-orange-400',
    badgeClass: 'bg-orange-50 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200'
  },
  'AI Builder': {
    barClass: 'bg-fuchsia-500/90 dark:bg-fuchsia-400',
    badgeClass: 'bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200'
  },
  'Data Factory': {
    barClass: 'bg-teal-500/90 dark:bg-teal-400',
    badgeClass: 'bg-teal-50 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200'
  },
  'Data Science': {
    barClass: 'bg-cyan-500/90 dark:bg-cyan-400',
    badgeClass: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200'
  },
  'Data Warehouse': {
    barClass: 'bg-teal-600/90 dark:bg-teal-500',
    badgeClass: 'bg-teal-50 text-teal-900 dark:bg-teal-600/20 dark:text-teal-100'
  },
  OneLake: {
    barClass: 'bg-cyan-600/90 dark:bg-cyan-500',
    badgeClass: 'bg-cyan-50 text-cyan-900 dark:bg-cyan-600/20 dark:text-cyan-100'
  },
  'Data Engineering': {
    barClass: 'bg-teal-700/90 dark:bg-teal-600',
    badgeClass: 'bg-teal-50 text-teal-900 dark:bg-teal-700/20 dark:text-teal-100'
  },
  'Power BI': {
    barClass: 'bg-yellow-500/90 dark:bg-yellow-400',
    badgeClass: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200'
  },
  'Real-Time Intelligence': {
    barClass: 'bg-cyan-700/90 dark:bg-cyan-600',
    badgeClass: 'bg-cyan-50 text-cyan-900 dark:bg-cyan-700/20 dark:text-cyan-100'
  },
  'Administration, Governance and Security': {
    barClass: 'bg-teal-800/90 dark:bg-teal-700',
    badgeClass: 'bg-teal-50 text-teal-900 dark:bg-teal-800/20 dark:text-teal-100'
  },
  'Cosmos DB (NoSQL)': {
    barClass: 'bg-cyan-800/90 dark:bg-cyan-700',
    badgeClass: 'bg-cyan-50 text-cyan-900 dark:bg-cyan-800/20 dark:text-cyan-100'
  },
  'SQL database': {
    barClass: 'bg-teal-900/90 dark:bg-teal-800',
    badgeClass: 'bg-teal-50 text-teal-900 dark:bg-teal-900/20 dark:text-teal-100'
  },
  'Fabric Developer Experiences': {
    barClass: 'bg-cyan-900/90 dark:bg-cyan-800',
    badgeClass: 'bg-cyan-50 text-cyan-900 dark:bg-cyan-900/20 dark:text-cyan-100'
  },
  'Fabric Ecosystem': {
    barClass: 'bg-teal-500/80 dark:bg-teal-400/90',
    badgeClass: 'bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200'
  },
  IQ: {
    barClass: 'bg-cyan-500/80 dark:bg-cyan-400/90',
    badgeClass: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200'
  }
};

export const getProductColor = (product: string): ProductColorConfig =>
  PRODUCT_COLOR_MAP[product] ?? DEFAULT_PRODUCT_COLOR;
