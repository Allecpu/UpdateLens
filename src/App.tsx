import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import ClientsPage from './app/pages/ClientsPage';
import DashboardPage from './app/pages/DashboardPage';
import GlobalFiltersPage from './app/pages/GlobalFiltersPage';
import LearnPage from './app/pages/LearnPage';
import VersionPage from './app/pages/VersionPage';
import IssuesPage from './app/pages/IssuesPage';
import SharesPage from './app/components/shares/SharesPage';
import ChatPanel from './app/components/chat/ChatPanel';
import UserMenu from './app/components/UserMenu';
import AccessDenied from './app/components/AccessDenied';
import { useCustomerGroupStore } from './app/store/useCustomerGroupStore';
import { useCustomerStore } from './app/store/useCustomerStore';
import { useFilterStore } from './app/store/useFilterStore';
import { useAuthStore } from './app/store/useAuthStore';
import { useBootstrapFilters } from './hooks/useBootstrapFilters';
import { useBootstrapPresets } from './hooks/useBootstrapPresets';

const isEntryActive = (entry: { isActive?: boolean }): boolean => entry.isActive !== false;
type NavItem = {
  to: string;
  label: string;
  end?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/clienti', label: 'Clienti' },
  { to: '/filtri-globali', label: 'Filtri globali' },
  { to: '/learn', label: 'Learn' },
  { to: '/versione', label: 'Versione' },
  { to: '/issues', label: 'Segnalazioni' },
  { to: '/condivisioni', label: 'Condivisioni' }
];

const getNavLinkClassName = (isActive: boolean): string =>
  `inline-flex h-11 items-center border-b-2 px-1 text-[1rem] font-medium transition-[color,border-color,transform] duration-180 ease-out will-change-transform motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
    isActive
      ? 'border-primary text-foreground'
      : 'border-transparent text-muted-foreground hover:-translate-y-0.5 hover:border-border/80 hover:text-foreground'
  }`;

const CustomerPicker = () => {
  const { index, activeCustomerId, setActiveCustomer } = useCustomerStore();
  const activeIndex = useMemo(() => index.filter((entry) => isEntryActive(entry)), [index]);
  const { cssFilters } = useFilterStore();
  const { groups } = useCustomerGroupStore();
  const prevHasCustomerFilters = useRef(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [debouncedCustomerQuery, setDebouncedCustomerQuery] = useState('');
  const deferredCustomerQuery = useDeferredValue(debouncedCustomerQuery);

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
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => ({
          ...entry,
          lowerName: entry.name.toLowerCase()
        })),
    [activeIndex, activeIncludedCustomerIds]
  );

  const filteredCustomerOptions = useMemo(() => {
    const normalized = deferredCustomerQuery.trim().toLowerCase();
    if (!normalized) {
      return customerOptions;
    }
    return customerOptions.filter((entry) =>
      entry.lowerName.includes(normalized)
    );
  }, [customerOptions, deferredCustomerQuery]);

  const customerOptionsForSelect = useMemo(() => {
    if (!activeCustomerId) {
      return filteredCustomerOptions;
    }
    if (filteredCustomerOptions.some((entry) => entry.id === activeCustomerId)) {
      return filteredCustomerOptions;
    }
    const activeEntry = customerOptions.find((entry) => entry.id === activeCustomerId);
    return activeEntry ? [activeEntry, ...filteredCustomerOptions] : filteredCustomerOptions;
  }, [activeCustomerId, customerOptions, filteredCustomerOptions]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedCustomerQuery(customerQuery);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [customerQuery]);

  useEffect(() => {
    const normalized = deferredCustomerQuery.trim();
    if (!normalized) {
      return;
    }
    if (filteredCustomerOptions.length === 1) {
      setActiveCustomer(filteredCustomerOptions[0].id);
    }
  }, [deferredCustomerQuery, filteredCustomerOptions, setActiveCustomer]);

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

  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row">
      <input
        className="ul-input h-10 w-full sm:w-[210px]"
        value={customerQuery}
        onChange={(event) => setCustomerQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && filteredCustomerOptions.length > 0) {
            setActiveCustomer(filteredCustomerOptions[0].id);
          }
        }}
        placeholder="Cerca cliente..."
        aria-label="Cerca cliente"
      />
      <select
        className="ul-input h-10 w-full sm:w-[210px]"
        value={activeCustomerId ?? ''}
        onChange={(event) =>
          setActiveCustomer(event.target.value || null)
        }
      >
        <option value="">{customerPlaceholder}</option>
        {customerOptionsForSelect.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
        {customerOptionsForSelect.length === 0 && (
          <option value="" disabled>
            Nessun risultato
          </option>
        )}
      </select>
    </div>
  );
};

const App = () => {
  // Bootstrap global filters if needed
  useBootstrapFilters();
  useBootstrapPresets();

  // Auth state
  const { fetchCurrentUser, accessDenied, accessDeniedReason, userEmail, isLoading, hasFetched } = useAuthStore();

  // Fetch current user on mount
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    // Set color-scheme for native form controls (select, input, etc.)
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    localStorage.setItem('updatelens.theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Show loading state while checking auth
  if (isLoading || !hasFetched) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  // Show access denied page if user is not whitelisted or disabled
  if (accessDenied && accessDeniedReason) {
    return <AccessDenied reason={accessDeniedReason} email={userEmail || undefined} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-[1.95rem] font-semibold leading-none tracking-tight">
                <span className="text-orange-500">EOS</span>{' '}UpdateLens
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:justify-end">
                <div className="order-1 flex h-9 w-fit items-center gap-1 self-end rounded-full border border-border bg-background px-1 sm:order-2 sm:self-auto">
                  <UserMenu />
                  <div className="h-4 w-px bg-border/80" aria-hidden="true" />
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    onClick={() => setIsDark((prev) => !prev)}
                    aria-label={isDark ? 'Attiva tema chiaro' : 'Attiva tema scuro'}
                    title={isDark ? 'Attiva tema chiaro' : 'Attiva tema scuro'}
                  >
                    {isDark ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
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
                        className="h-4 w-4"
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
                <div className="order-2 w-full sm:order-1 sm:w-auto">
                  <CustomerPicker />
                </div>
              </div>
            </div>
            <nav aria-label="Navigazione principale" className="overflow-x-auto">
              <div className="flex min-w-max items-center gap-7 border-b border-border/70 px-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => getNavLinkClassName(isActive)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clienti" element={<ClientsPage />} />
          <Route path="/filtri-globali" element={<GlobalFiltersPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/learn/:productKey" element={<LearnPage />} />
          <Route path="/versione" element={<VersionPage />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/condivisioni" element={<SharesPage />} />
        </Routes>
      </div>
      <ChatPanel />
    </div>
  );
};

export default App;
