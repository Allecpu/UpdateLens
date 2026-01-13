import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import ClientsPage from './app/pages/ClientsPage';
import DashboardPage from './app/pages/DashboardPage';
import GlobalFiltersPage from './app/pages/GlobalFiltersPage';
import VersionPage from './app/pages/VersionPage';
import { useCustomerGroupStore } from './app/store/useCustomerGroupStore';
import { useCustomerStore } from './app/store/useCustomerStore';
import { useFilterStore } from './app/store/useFilterStore';

const isEntryActive = (entry: { isActive?: boolean }): boolean => entry.isActive !== false;

const App = () => {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('updatelens.theme');
    if (stored === 'dark') {
      return true;
    }
    if (stored === 'light') {
      return false;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const { index, activeCustomerId, setActiveCustomer } = useCustomerStore();
  const activeIndex = useMemo(() => index.filter((entry) => isEntryActive(entry)), [index]);
  const { cssFilters } = useFilterStore();
  const { groups } = useCustomerGroupStore();
  const prevHasCustomerFilters = useRef(false);

  const targetCustomerIds = useMemo(() => {
    const selected = new Set<string>(cssFilters?.targetCustomerIds ?? []);
    const groupMap = new Map(groups.map((group) => [group.id, group.customerIds]));
    (cssFilters?.targetGroupIds ?? []).forEach((groupId) => {
      (groupMap.get(groupId) ?? []).forEach((id) => selected.add(id));
    });
    return selected;
  }, [cssFilters?.targetCustomerIds, cssFilters?.targetGroupIds, groups]);

  const ownerCustomerIds = useMemo(() => {
    if (!cssFilters || cssFilters.targetCssOwners.length === 0) {
      return new Set<string>();
    }
    const owners = new Set(cssFilters.targetCssOwners);
    const selected = new Set<string>();
    activeIndex.forEach((entry) => {
      if (entry.ownerCss && owners.has(entry.ownerCss)) {
        selected.add(entry.id);
      }
    });
    return selected;
  }, [activeIndex, cssFilters]);

  const activeCustomerIds = useMemo(
    () => new Set(activeIndex.map((entry) => entry.id)),
    [activeIndex]
  );
  const includedCustomerIds = useMemo(() => {
    const hasOwnerFilter = (cssFilters?.targetCssOwners ?? []).length > 0;
    const hasTargetFilter = targetCustomerIds.size > 0;
    if (hasOwnerFilter && hasTargetFilter) {
      return new Set(
        Array.from(ownerCustomerIds).filter((id) => targetCustomerIds.has(id))
      );
    }
    if (hasOwnerFilter) {
      return ownerCustomerIds;
    }
    if (hasTargetFilter) {
      return targetCustomerIds;
    }
    return new Set(activeIndex.map((entry) => entry.id));
  }, [
    cssFilters?.targetCssOwners,
    activeIndex,
    ownerCustomerIds,
    targetCustomerIds
  ]);
  const activeIncludedCustomerIds = useMemo(
    () =>
      new Set(
        Array.from(includedCustomerIds).filter((id) => activeCustomerIds.has(id))
      ),
    [activeCustomerIds, includedCustomerIds]
  );

  const hasCustomerFilters =
    (cssFilters?.targetCssOwners ?? []).length > 0 || targetCustomerIds.size > 0;

  const customerOptions = useMemo(
    () =>
      activeIndex
        .filter((entry) => activeIncludedCustomerIds.has(entry.id))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [activeIndex, activeIncludedCustomerIds]
  );

  const customerPlaceholder = hasCustomerFilters
    ? `Clienti filtrati (${customerOptions.length})`
    : 'Tutti i clienti';

  useEffect(() => {
    if (activeCustomerId && !activeIncludedCustomerIds.has(activeCustomerId)) {
      setActiveCustomer(null);
    }
  }, [activeCustomerId, activeIncludedCustomerIds, setActiveCustomer]);

  useEffect(() => {
    if (prevHasCustomerFilters.current && !hasCustomerFilters) {
      setActiveCustomer(null);
    }
    prevHasCustomerFilters.current = hasCustomerFilters;
  }, [hasCustomerFilters, setActiveCustomer]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('updatelens.theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold">UpdateLens</div>
            <nav className="flex items-center gap-3 text-sm text-muted-foreground">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `rounded-full px-3 py-1 ${
                    isActive ? 'bg-accent text-accent-foreground' : ''
                  }`
                }
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/clienti"
                className={({ isActive }) =>
                  `rounded-full px-3 py-1 ${
                    isActive ? 'bg-accent text-accent-foreground' : ''
                  }`
                }
              >
                Clienti
              </NavLink>
              <NavLink
                to="/filtri-globali"
                className={({ isActive }) =>
                  `rounded-full px-3 py-1 ${
                    isActive ? 'bg-accent text-accent-foreground' : ''
                  }`
                }
              >
                Filtri globali
              </NavLink>
              <NavLink
                to="/versione"
                className={({ isActive }) =>
                  `rounded-full px-3 py-1 ${
                    isActive ? 'bg-accent text-accent-foreground' : ''
                  }`
                }
              >
                Versione
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="ul-input max-w-[220px]"
              value={activeCustomerId ?? ''}
              onChange={(event) =>
                setActiveCustomer(event.target.value || null)
              }
            >
              <option value="">{customerPlaceholder}</option>
              {customerOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <button
              className="ul-button ul-button-ghost"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label={isDark ? 'Attiva tema chiaro' : 'Attiva tema scuro'}
              title={isDark ? 'Attiva tema chiaro' : 'Attiva tema scuro'}
            >
              {isDark ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clienti" element={<ClientsPage />} />
          <Route path="/filtri-globali" element={<GlobalFiltersPage />} />
          <Route path="/versione" element={<VersionPage />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
