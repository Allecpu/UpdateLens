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
  }
};

export const getProductColor = (product: string): ProductColorConfig =>
  PRODUCT_COLOR_MAP[product] ?? DEFAULT_PRODUCT_COLOR;
