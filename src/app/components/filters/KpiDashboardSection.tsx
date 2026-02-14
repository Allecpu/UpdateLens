import {
  DASHBOARD_KPI_DEFINITIONS,
  type DashboardKpiKey
} from '../../../services/KpiService';

const KPI_VALUE_CLASSES: Record<DashboardKpiKey, string> = {
  total: '',
  Microsoft: 'text-blue-600',
  EOS: 'text-amber-600',
  Fabric: 'text-teal-600',
  'MICROSOFT 365': 'text-purple-600'
};

type Props = {
  open: boolean;
  onToggle: (isOpen: boolean) => void;
  dashboardKpis: Record<DashboardKpiKey, number>;
};

const KpiDashboardSection = ({ open, onToggle, dashboardKpis }: Props) => (
  <details
    className="ul-surface"
    open={open}
    onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
  >
    <summary className="flex cursor-pointer items-center gap-3 p-5 select-none">
      <svg
        className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      <h2 className="text-lg font-semibold">KPI Dashboard</h2>
      {!open && (
        <span className="text-xs text-muted-foreground">
          Totale: {dashboardKpis.total}
        </span>
      )}
    </summary>
    <div className="grid gap-4 px-5 pb-5 md:grid-cols-4">
      {DASHBOARD_KPI_DEFINITIONS.map((definition) => (
        <div key={definition.key} className="ul-surface p-5">
          <div className="text-xs uppercase text-muted-foreground">
            {definition.label}
          </div>
          <div
            className={`mt-3 text-3xl font-semibold ${KPI_VALUE_CLASSES[definition.key]}`}
          >
            {dashboardKpis[definition.key]}
          </div>
        </div>
      ))}
    </div>
  </details>
);

export default KpiDashboardSection;
