import type { ReleaseItem, ReleaseSource } from '../models/ReleaseItem';

export type DashboardKpiKey = 'total' | ReleaseSource;

export const DASHBOARD_KPI_DEFINITIONS: { key: DashboardKpiKey; label: string }[] = [
  { key: 'total', label: 'Totale' },
  { key: 'Microsoft', label: 'Microsoft' },
  { key: 'EOS', label: 'EOS' },
  { key: 'Fabric', label: 'Fabric' },
  { key: 'MICROSOFT 365', label: 'MICROSOFT 365' }
];

export const computeDashboardKpis = (
  items: ReleaseItem[]
): Record<DashboardKpiKey, number> => {
  const counts: Record<DashboardKpiKey, number> = {
    total: items.length,
    Microsoft: 0,
    EOS: 0,
    Fabric: 0,
    'MICROSOFT 365': 0
  };

  items.forEach((item) => {
    counts[item.source] += 1;
  });

  return counts;
};
