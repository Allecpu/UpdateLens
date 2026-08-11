import { useEffect, useMemo, useRef, useState } from 'react';
import type { CssActivity, CssProposal } from '../../models/Css';
import { cssService } from '../../services/CssService';
import { useCssControlsStore } from '../store/cssControlsStore';
import { useViewsStore } from '../store/viewsStore';
import { ModernListsLayout } from '../components/ModernListsLayout';
import type { GroupByKey } from '../components/GroupingPanel';
import { useAdvancedFilters } from '../hooks/useAdvancedFilters';
import { evaluateFilters } from '../utils/filterEngine';

const DEFAULT_ACTIVITY = {
  customerName: '',
  cssOwner: '',
  lastUpdate: '',
  blBu: '',
  issue: '',
  listStatus: '',
  issueStatus: 'Action required',
  details: '',
  eosOwners: '',
  customerOwners: '',
  cssAction: '',
  notes: '',
  customerPriority: '',
  cssPriority: '',
  dueDate: '',
  rating: '',
  itemType: ''
};

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('it-IT');
};

const toDateInputValue = (value?: string | null): string => {
  if (!value) return '';
  const direct = value.trim();
  if (!direct) return '';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(direct);
  if (iso) return direct;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(direct);
  if (match) {
    const dd = match[1].padStart(2, '0');
    const mm = match[2].padStart(2, '0');
    return `${match[3]}-${mm}-${dd}`;
  }
  const parsed = new Date(direct);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const normalizeOwnerLabel = (value: string): string => {
  const parts = value
    .split(';#')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !/^\d+$/.test(part));
  if (parts.length > 0) {
    return Array.from(new Set(parts)).join(', ');
  }
  return value.trim();
};

const splitChoiceTokens = (value?: string | null): string[] =>
  (value ?? '')
    .split(';#')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !/^\d+$/.test(part));

const normalizeChoiceValue = (value?: string | null): string =>
  (splitChoiceTokens(value)[0] ?? '').replace(/\s+/g, ' ').trim();

const uniqueCanonical = (values: string[]): string[] => {
  const byLower = new Map<string, string>();
  values.forEach((value) => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!byLower.has(key)) {
      byLower.set(key, normalized);
    }
  });
  return Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
};

const normalizeToken = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase();

const splitOwnerTokens = (value?: string | null): string[] =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const toComparableDate = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

type SortKey = 'customerName' | 'lastUpdate' | 'blBu' | 'issue' | 'issueStatus' | 'cssOwner';
type SortDirection = 'asc' | 'desc';
type ColumnKey =
  | 'customer'
  | 'lastUpdate'
  | 'blBu'
  | 'issue'
  | 'issueStatus'
  | 'listStatus'
  | 'details'
  | 'cssOwner'
  | 'eosOwners'
  | 'customerOwners'
  | 'cssAction'
  | 'notes'
  | 'customerPriority'
  | 'cssPriority'
  | 'dueDate'
  | 'rating'
  | 'itemType';

const COLUMN_DEFINITIONS: Array<{ key: ColumnKey; label: string }> = [
  { key: 'customer', label: 'Customer' },
  { key: 'lastUpdate', label: 'Last Update' },
  { key: 'blBu', label: 'BLs/BUs' },
  { key: 'issue', label: 'Issue' },
  { key: 'issueStatus', label: 'Issue Status' },
  { key: 'listStatus', label: 'Status (Lista)' },
  { key: 'details', label: 'Details' },
  { key: 'cssOwner', label: 'CSS Owner' },
  { key: 'eosOwners', label: 'EOS Owners' },
  { key: 'customerOwners', label: 'Customer Owners' },
  { key: 'cssAction', label: 'CSS Action' },
  { key: 'notes', label: 'Notes' },
  { key: 'customerPriority', label: 'Customer Priority' },
  { key: 'cssPriority', label: 'CSS Priority' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'rating', label: 'Rating (0-5)' },
  { key: 'itemType', label: 'Item Type' }
];

// Larghezze fisse per colonna: evitano che il layout della tabella (table-layout: auto)
// venga ricalcolato quando una riga entra in modalita' di modifica, il che altrimenti
// fa "saltare" lo scroll orizzontale mostrando colonne diverse da quelle su cui si sta lavorando.
const COLUMN_WIDTHS: Record<ColumnKey, number> = {
  customer: 176,
  lastUpdate: 144,
  blBu: 224,
  issue: 208,
  issueStatus: 160,
  listStatus: 160,
  details: 288,
  cssOwner: 176,
  eosOwners: 176,
  customerOwners: 176,
  cssAction: 176,
  notes: 360,
  customerPriority: 144,
  cssPriority: 144,
  dueDate: 144,
  rating: 128,
  itemType: 128
};
const CHECKBOX_COLUMN_WIDTH = 48;
const ACTIONS_COLUMN_WIDTH = 96;

const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  customer: true,
  lastUpdate: true,
  blBu: true,
  issue: true,
  issueStatus: true,
  listStatus: true,
  details: false,      // Microsoft Lists: nascosto di default
  cssOwner: true,
  eosOwners: true,
  customerOwners: true,
  cssAction: false,    // Microsoft Lists: nascosto di default
  notes: false,        // Microsoft Lists: nascosto di default
  customerPriority: true,
  cssPriority: true,
  dueDate: true,
  rating: true,
  itemType: true
};

const GRID_PREFS_STORAGE_KEY = 'css-grid-prefs';
const GRID_PREFS_VERSION = 2;
const ISSUE_STATUS_BASE_OPTIONS = [
  'Action required',
  'In progress',
  'Planned',
  'Requested',
  'Stand By',
  'Monitored',
  'Closed',
  'Aborted',
  'Opportunity'
] as const;
const PRIORITY_BASE_OPTIONS = ['Very High', 'High', 'Medium', 'Low', 'Undefined'] as const;

type EditableChoiceField = 'blBu' | 'issueStatus' | 'listStatus' | 'customerPriority' | 'cssPriority' | 'cssOwner';

const getChoiceChipClassName = (field: EditableChoiceField, value?: string | null): string => {
  const token = normalizeToken(value);
  if (!token) return 'bg-muted text-muted-foreground';

  if (field === 'issueStatus' || field === 'listStatus') {
    if (token === 'action required') return 'bg-blue-100 text-blue-700';
    if (token === 'in progress') return 'bg-emerald-100 text-emerald-700';
    if (token === 'planned') return 'bg-amber-100 text-amber-700';
    if (token === 'requested') return 'bg-pink-100 text-pink-700';
    if (token === 'stand by') return 'bg-slate-200 text-slate-700';
    if (token === 'monitored') return 'bg-rose-200 text-rose-800';
    if (token === 'closed') return 'bg-lime-700 text-lime-50';
    if (token === 'aborted') return 'bg-red-700 text-red-50';
    if (token === 'opportunity') return 'bg-indigo-200 text-indigo-700';
    return 'bg-violet-100 text-violet-700';
  }

  if (field === 'customerPriority' || field === 'cssPriority') {
    if (token === 'very high') return 'bg-red-700 text-red-50';
    if (token === 'high') return 'bg-red-100 text-red-700';
    if (token === 'medium') return 'bg-cyan-100 text-cyan-700';
    if (token === 'low') return 'bg-amber-100 text-amber-700';
    if (token === 'undefined') return 'bg-slate-200 text-slate-700';
    return 'bg-violet-100 text-violet-700';
  }

  if (field === 'blBu') {
    if (token.includes('controlling') || token.includes('analytics')) return 'bg-lime-100 text-lime-800';
    if (token.includes('customer service')) return 'bg-sky-200 text-sky-800';
    if (token.includes('customer experience')) return 'bg-rose-200 text-rose-800';
    if (token.includes('digital factory')) return 'bg-red-600 text-red-50';
    if (token.includes('business central')) return 'bg-amber-100 text-amber-800';
    if (token.includes('modern workplace')) return 'bg-teal-100 text-teal-800';
    if (token.includes('azure')) return 'bg-cyan-100 text-cyan-800';
    if (token.includes('sales')) return 'bg-slate-200 text-slate-700';
    return 'bg-violet-100 text-violet-700';
  }

  return 'bg-muted text-muted-foreground';
};

const getChoiceSelectClassName = (field: EditableChoiceField, value?: string | null): string => {
  const token = normalizeToken(value);
  if (!token) return '!bg-muted !text-muted-foreground';

  if (field === 'issueStatus' || field === 'listStatus') {
    if (token === 'action required') return '!bg-blue-100 !text-blue-700 !border-blue-200';
    if (token === 'in progress') return '!bg-emerald-100 !text-emerald-700 !border-emerald-200';
    if (token === 'planned') return '!bg-amber-100 !text-amber-700 !border-amber-200';
    if (token === 'requested') return '!bg-pink-100 !text-pink-700 !border-pink-200';
    if (token === 'stand by') return '!bg-slate-200 !text-slate-700 !border-slate-300';
    if (token === 'monitored') return '!bg-rose-200 !text-rose-800 !border-rose-300';
    if (token === 'closed') return '!bg-lime-700 !text-lime-50 !border-lime-700';
    if (token === 'aborted') return '!bg-red-700 !text-red-50 !border-red-700';
    if (token === 'opportunity') return '!bg-indigo-200 !text-indigo-700 !border-indigo-300';
    return '!bg-violet-100 !text-violet-700 !border-violet-200';
  }

  if (field === 'customerPriority' || field === 'cssPriority') {
    if (token === 'very high') return '!bg-red-700 !text-red-50 !border-red-700';
    if (token === 'high') return '!bg-red-100 !text-red-700 !border-red-200';
    if (token === 'medium') return '!bg-cyan-100 !text-cyan-700 !border-cyan-200';
    if (token === 'low') return '!bg-amber-100 !text-amber-700 !border-amber-200';
    if (token === 'undefined') return '!bg-slate-200 !text-slate-700 !border-slate-300';
    return '!bg-violet-100 !text-violet-700 !border-violet-200';
  }

  if (field === 'blBu') {
    if (token.includes('controlling') || token.includes('analytics')) return '!bg-lime-100 !text-lime-800 !border-lime-200';
    if (token.includes('customer service')) return '!bg-sky-200 !text-sky-800 !border-sky-300';
    if (token.includes('customer experience')) return '!bg-rose-200 !text-rose-800 !border-rose-300';
    if (token.includes('digital factory')) return '!bg-red-600 !text-red-50 !border-red-600';
    if (token.includes('business central')) return '!bg-amber-100 !text-amber-800 !border-amber-200';
    if (token.includes('modern workplace')) return '!bg-teal-100 !text-teal-800 !border-teal-200';
    if (token.includes('azure')) return '!bg-cyan-100 !text-cyan-800 !border-cyan-200';
    if (token.includes('sales')) return '!bg-slate-200 !text-slate-700 !border-slate-300';
    return '!bg-violet-100 !text-violet-700 !border-violet-200';
  }

  return '!bg-muted !text-muted-foreground';
};

const parseRatingValue = (value?: string | number | null): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(5, parsed));
  return Math.round(clamped * 2) / 2;
};

const renderRatingStars = (rating?: number | null): string => {
  const parsed = parseRatingValue(rating);
  if (parsed == null || parsed <= 0) {
    return '☆☆☆☆☆';
  }
  const fullStars = Math.round(parsed);
  return `${'★'.repeat(fullStars)}${'☆'.repeat(Math.max(0, 5 - fullStars))}`;
};

const CssPage = () => {
  // Microsoft Lists Controls & Views
  const { isColumnHidden } = useCssControlsStore();
  const { views, activeViewId, setUnsavedChanges, saveActiveView } = useViewsStore();
  const activeView = views.find((v) => v.id === activeViewId);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<CssActivity[]>([]);
  
  // Advanced Filters Hook
  const { filters: advancedFilters, setFilters: setAdvancedFilters } = useAdvancedFilters(activities);
  
  const [owners, setOwners] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Action required'); // Auto-filter: Action required
  const [ratingFilter, setRatingFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('lastUpdate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('In progress');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [isWideMode, setIsWideMode] = useState(true);
  const [showColumnPanel, setShowColumnPanel] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS);
  const [groupBy, setGroupBy] = useState<GroupByKey>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState({
    customerName: '',
    cssOwner: '',
    lastUpdate: '',
    blBu: '',
    issue: '',
    listStatus: '',
    issueStatus: '',
    details: '',
    eosOwners: '',
    customerOwners: '',
    cssAction: '',
    notes: '',
    customerPriority: '',
    cssPriority: '',
    dueDate: '',
    rating: '',
    itemType: ''
  });

  const [activityForm, setActivityForm] = useState(DEFAULT_ACTIVITY);
  const [savingActivity, setSavingActivity] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Array<{ documentId: string; filename: string; extractionStatus: string; uploadedAt: string; extractionError: string | null }>>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<CssProposal[]>([]);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState(false);
  const [validationSummary, setValidationSummary] = useState<string | null>(null);
  const [quickUpdatingId, setQuickUpdatingId] = useState<string | null>(null);
  const [choiceEditor, setChoiceEditor] = useState<{ activityId: string; field: EditableChoiceField } | null>(null);
  const [notesEditor, setNotesEditor] = useState<{ activityId: string; value: string } | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollTrackRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);

  const refreshMeta = async () => {
    const meta = await cssService.getMeta();
    setOwners(Array.from(new Set(meta.owners.map((owner) => normalizeOwnerLabel(owner)).filter((owner) => owner.length > 0))).sort((a, b) => a.localeCompare(b)));
    setStatuses(meta.statuses);
    setCustomers(meta.customers);
  };

  const refreshActivities = async () => {
    const result = await cssService.listActivities();
    setActivities(result.items);
  };

  const refreshDocuments = async () => {
    const result = await cssService.listDocuments();
    setDocuments(result.items);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([refreshMeta(), refreshActivities(), refreshDocuments()]);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Errore caricamento sezione CSS');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  // Apply Microsoft Lists Controls (hidden columns & auto-filters)
  useEffect(() => {
    setVisibleColumns((prev) => ({
      ...prev,
      details: !isColumnHidden('details'),
      cssAction: !isColumnHidden('cssAction'),
      notes: !isColumnHidden('notes'),
    }));
  }, [isColumnHidden]);

  // Apply active view configuration (columns, filters, sort)
  useEffect(() => {
    if (!activeView) return;

    // Apply visible columns from view
    setVisibleColumns(activeView.visibleColumns);

    // Apply filters from view
    if (activeView.filters.customer) setCustomerFilter(activeView.filters.customer);
    if (activeView.filters.owner) setOwnerFilter(activeView.filters.owner);
    if (activeView.filters.status) setStatusFilter(activeView.filters.status);
    if (activeView.filters.rating) setRatingFilter(activeView.filters.rating);
    if (activeView.filters.query) setQuery(activeView.filters.query);

    // Apply sort from view
    if (activeView.sortBy) setSortBy(activeView.sortBy as any);
    if (activeView.sortDirection) setSortDirection(activeView.sortDirection as any);
  }, [activeViewId, activeView]);

  // Auto-save view changes (columns, filters, sort)
  useEffect(() => {
    if (!activeView || activeView.isSystem) return;

    const timer = setTimeout(() => {
      saveActiveView({
        visibleColumns,
        filters: {
          customer: customerFilter || undefined,
          owner: ownerFilter || undefined,
          status: statusFilter || undefined,
          rating: ratingFilter || undefined,
          query: query || undefined,
        },
        sortBy,
        sortDirection,
      });
    }, 1000); // Salva dopo 1 secondo di inattività

    setUnsavedChanges(true);

    return () => clearTimeout(timer);
  }, [visibleColumns, customerFilter, ownerFilter, statusFilter, ratingFilter, query, sortBy, sortDirection, activeView, activeViewId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GRID_PREFS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        version?: number;
        isWideMode?: boolean;
        showColumnPanel?: boolean;
        visibleColumns?: Partial<Record<ColumnKey, boolean>>;
      };
      if (parsed.version !== GRID_PREFS_VERSION) {
        return;
      }
      if (typeof parsed.isWideMode === 'boolean') setIsWideMode(parsed.isWideMode);
      if (typeof parsed.showColumnPanel === 'boolean') setShowColumnPanel(parsed.showColumnPanel);
      if (parsed.visibleColumns && typeof parsed.visibleColumns === 'object') {
        setVisibleColumns((prev) => ({ ...prev, ...parsed.visibleColumns }));
      }
    } catch (err) {
      console.warn('Impossibile caricare preferenze griglia CSS', err);
    }
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({
      version: GRID_PREFS_VERSION,
      isWideMode,
      showColumnPanel,
      visibleColumns
    });
    localStorage.setItem(GRID_PREFS_STORAGE_KEY, payload);
  }, [isWideMode, showColumnPanel, visibleColumns]);

  const onEdit = (activity: CssActivity) => {
    setEditingId(activity.activityId);
    setActivityForm({
      customerName: activity.customerName,
      cssOwner: activity.cssOwner ?? '',
      lastUpdate: toDateInputValue(activity.lastUpdate),
      blBu: activity.blBu ?? '',
      issue: activity.issue,
      listStatus: activity.listStatus ?? '',
      issueStatus: activity.issueStatus,
      details: activity.details ?? '',
      eosOwners: activity.eosOwners ?? '',
      customerOwners: activity.customerOwners ?? '',
      cssAction: activity.cssAction ?? '',
      notes: activity.notes ?? '',
      customerPriority: activity.customerPriority ?? '',
      cssPriority: activity.cssPriority ?? '',
      dueDate: toDateInputValue(activity.dueDate),
      rating: activity.rating != null ? String(activity.rating) : '',
      itemType: activity.itemType ?? ''
    });
    setIsFormModalOpen(true);
  };

  const onCreateActivity = () => {
    setEditingId(null);
    setActivityForm(DEFAULT_ACTIVITY);
    setIsFormModalOpen(true);
  };

  const startInlineEdit = (activity: CssActivity) => {
    setInlineEditId(activity.activityId);
    setInlineEdit({
      customerName: activity.customerName,
      cssOwner: activity.cssOwner ?? '',
      lastUpdate: toDateInputValue(activity.lastUpdate),
      blBu: activity.blBu ?? '',
      issue: activity.issue,
      listStatus: activity.listStatus ?? '',
      issueStatus: activity.issueStatus,
      details: activity.details ?? '',
      eosOwners: activity.eosOwners ?? '',
      customerOwners: activity.customerOwners ?? '',
      cssAction: activity.cssAction ?? '',
      notes: activity.notes ?? '',
      customerPriority: activity.customerPriority ?? '',
      cssPriority: activity.cssPriority ?? '',
      dueDate: toDateInputValue(activity.dueDate),
      rating: activity.rating != null ? String(activity.rating) : '',
      itemType: activity.itemType ?? ''
    });
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineEdit({
      customerName: '',
      cssOwner: '',
      lastUpdate: '',
      blBu: '',
      issue: '',
      listStatus: '',
      issueStatus: '',
      details: '',
      eosOwners: '',
      customerOwners: '',
      cssAction: '',
      notes: '',
      customerPriority: '',
      cssPriority: '',
      dueDate: '',
      rating: '',
      itemType: ''
    });
  };

  const saveInlineEdit = async () => {
    if (!inlineEditId) {
      return;
    }
    setError(null);
    try {
      await cssService.updateActivity(inlineEditId, {
        customerName: inlineEdit.customerName,
        cssOwner: inlineEdit.cssOwner || null,
        lastUpdate: inlineEdit.lastUpdate || null,
        blBu: inlineEdit.blBu || null,
        issue: inlineEdit.issue,
        listStatus: inlineEdit.listStatus || null,
        issueStatus: inlineEdit.issueStatus,
        details: inlineEdit.details || null,
        eosOwners: inlineEdit.eosOwners || null,
        customerOwners: inlineEdit.customerOwners || null,
        cssAction: inlineEdit.cssAction || null,
        notes: inlineEdit.notes || null,
        customerPriority: inlineEdit.customerPriority || null,
        cssPriority: inlineEdit.cssPriority || null,
        dueDate: inlineEdit.dueDate || null,
        rating: inlineEdit.rating ? Number(inlineEdit.rating) : null,
        itemType: inlineEdit.itemType || null
      });
      cancelInlineEdit();
      await Promise.all([refreshActivities(), refreshMeta()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio inline');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setActivityForm(DEFAULT_ACTIVITY);
    setIsFormModalOpen(false);
  };

  const onSaveActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingActivity(true);
    setError(null);
    try {
      if (editingId) {
        await cssService.updateActivity(editingId, {
          ...activityForm,
          cssOwner: activityForm.cssOwner || null,
          blBu: activityForm.blBu || null,
          lastUpdate: activityForm.lastUpdate || null,
          details: activityForm.details || null,
          listStatus: activityForm.listStatus || null,
          eosOwners: activityForm.eosOwners || null,
          customerOwners: activityForm.customerOwners || null,
          cssAction: activityForm.cssAction || null,
          notes: activityForm.notes || null,
          customerPriority: activityForm.customerPriority || null,
          cssPriority: activityForm.cssPriority || null,
          dueDate: activityForm.dueDate || null,
          rating: activityForm.rating ? Number(activityForm.rating) : null,
          itemType: activityForm.itemType || null
        });
      } else {
        await cssService.createActivity({
          ...activityForm,
          cssOwner: activityForm.cssOwner || null,
          blBu: activityForm.blBu || null,
          lastUpdate: activityForm.lastUpdate || null,
          details: activityForm.details || null,
          listStatus: activityForm.listStatus || null,
          eosOwners: activityForm.eosOwners || null,
          customerOwners: activityForm.customerOwners || null,
          cssAction: activityForm.cssAction || null,
          notes: activityForm.notes || null,
          customerPriority: activityForm.customerPriority || null,
          cssPriority: activityForm.cssPriority || null,
          dueDate: activityForm.dueDate || null,
          rating: activityForm.rating ? Number(activityForm.rating) : null,
          itemType: activityForm.itemType || null
        });
      }
      resetForm();
      await Promise.all([refreshActivities(), refreshMeta()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio attività');
    } finally {
      setSavingActivity(false);
    }
  };

  const onUploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await cssService.uploadDocument(file);
      await refreshDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore upload documento');
    } finally {
      setUploading(false);
    }
  };

  const onExtract = async (documentId: string) => {
    setExtractingId(documentId);
    setError(null);
    setValidationSummary(null);
    try {
      const result = await cssService.extractDocument(documentId);
      setActiveBatchId(result.batchId);
      setProposals(result.proposals);
      const decisions: Record<string, boolean> = {};
      result.proposals.forEach((proposal) => {
        decisions[proposal.proposalId] = true;
      });
      setApproved(decisions);
      await refreshDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore estrazione documento');
    } finally {
      setExtractingId(null);
    }
  };

  const onValidateBatch = async () => {
    if (!activeBatchId) return;
    setValidating(true);
    setError(null);
    setValidationSummary(null);
    try {
      const decisions = proposals.map((proposal) => ({
        proposalId: proposal.proposalId,
        decision: approved[proposal.proposalId] ? ('approved' as const) : ('rejected' as const)
      }));
      const result = await cssService.validateBatch(activeBatchId, {
        decisions
      });
      setValidationSummary(`Validazione completata: ${result.applied} applicate, ${result.rejected} scartate.`);
      await Promise.all([refreshActivities(), refreshMeta()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore validazione batch');
    } finally {
      setValidating(false);
    }
  };

  const extractedCount = useMemo(() => proposals.length, [proposals.length]);
  const filteredActivities = useMemo(() => {
    const customerToken = normalizeToken(customerFilter);
    const ownerFilterTokens = splitOwnerTokens(ownerFilter).map((token) => normalizeToken(token));
    const statusToken = normalizeToken(statusFilter);
    const ratingToken = normalizeToken(ratingFilter);
    const queryToken = normalizeToken(query);

    return activities
      .filter((activity) => {
        const customerName = activity.customerName ?? '';
        const issueStatus = activity.issueStatus ?? '';
        const ownerTokens = splitOwnerTokens(activity.cssOwner).map((token) => normalizeToken(token));

        if (customerToken && !customerName.toLowerCase().includes(customerToken)) {
          return false;
        }

        if (ownerFilterTokens.length > 0) {
          const hasOwner = ownerFilterTokens.some((filterOwner) =>
            ownerTokens.some((owner) => owner === filterOwner || owner.includes(filterOwner))
          );
          if (!hasOwner) {
            return false;
          }
        }

        if (statusToken && issueStatus.toLowerCase() !== statusToken) {
          return false;
        }

        if (ratingToken) {
          const currentRating = parseRatingValue(activity.rating);
          if (currentRating == null || String(currentRating) !== ratingToken) {
            return false;
          }
        }

        if (queryToken) {
          const searchable = [
            activity.customerName ?? '',
            activity.issue ?? '',
            activity.issueStatus ?? '',
            activity.listStatus ?? '',
            activity.details ?? '',
            activity.blBu ?? '',
            activity.cssOwner ?? '',
            activity.eosOwners ?? '',
            activity.customerOwners ?? '',
            activity.cssAction ?? '',
            activity.notes ?? '',
            activity.customerPriority ?? '',
            activity.cssPriority ?? '',
            activity.itemType ?? ''
          ]
            .join(' ')
            .toLowerCase();
          if (!searchable.includes(queryToken)) {
            return false;
          }
        }

        return true;
      })
      .filter((activity) => evaluateFilters(activity, advancedFilters));
  }, [activities, customerFilter, ownerFilter, statusFilter, ratingFilter, query, advancedFilters]);
  const sortedActivities = useMemo(() => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    const copy = [...filteredActivities];
    copy.sort((a, b) => {
      switch (sortBy) {
        case 'lastUpdate': {
          return (toComparableDate(a.lastUpdate) - toComparableDate(b.lastUpdate)) * multiplier;
        }
        case 'customerName':
          return a.customerName.localeCompare(b.customerName) * multiplier;
        case 'blBu':
          return (a.blBu ?? '').localeCompare(b.blBu ?? '') * multiplier;
        case 'issue':
          return a.issue.localeCompare(b.issue) * multiplier;
        case 'issueStatus':
          return a.issueStatus.localeCompare(b.issueStatus) * multiplier;
        case 'cssOwner':
          return (a.cssOwner ?? '').localeCompare(b.cssOwner ?? '') * multiplier;
        default:
          return 0;
      }
    });
    return copy;
  }, [filteredActivities, sortBy, sortDirection]);

  const listStatusOptions = useMemo(
    () => uniqueCanonical(activities.flatMap((activity) => splitChoiceTokens(activity.listStatus))),
    [activities]
  );
  const issueStatusOptions = useMemo(
    () =>
      uniqueCanonical([
        ...ISSUE_STATUS_BASE_OPTIONS,
        ...statuses.flatMap((status) => splitChoiceTokens(status)),
        ...activities.flatMap((activity) => splitChoiceTokens(activity.issueStatus))
      ]),
    [activities, statuses]
  );
  const blBuOptions = useMemo(
    () => uniqueCanonical(activities.flatMap((activity) => splitChoiceTokens(activity.blBu))),
    [activities]
  );
  const priorityOptions = useMemo(
    () =>
      uniqueCanonical([
        ...PRIORITY_BASE_OPTIONS,
        ...activities
          .flatMap((activity) => [activity.customerPriority ?? '', activity.cssPriority ?? ''])
          .flatMap((value) => splitChoiceTokens(value))
      ]),
    [activities]
  );
  const itemTypeOptions = useMemo(
    () =>
      uniqueCanonical(
        activities
          .map((activity) => (activity.itemType ?? '').trim())
          .filter((value) => value.length > 0)
      ),
    [activities]
  );
  const eosOwnersOptions = useMemo(
    () => uniqueCanonical(activities.flatMap((activity) => splitOwnerTokens(activity.eosOwners))),
    [activities]
  );
  const customerOwnersOptions = useMemo(
    () => uniqueCanonical(activities.flatMap((activity) => splitOwnerTokens(activity.customerOwners))),
    [activities]
  );
  const cssActionOptions = useMemo(
    () =>
      uniqueCanonical(
        activities
          .map((activity) => (activity.cssAction ?? '').trim())
          .filter((value) => value.length > 0)
      ),
    [activities]
  );
  const ratingOptions = useMemo(
    () =>
      Array.from(
        new Set(
          activities
            .map((activity) => parseRatingValue(activity.rating))
            .filter((value): value is number => value != null)
        )
      ).sort((a, b) => a - b),
    [activities]
  );

  const selectedCount = selectedIds.length;
  const allSelectedOnPage = sortedActivities.length > 0 && selectedCount === sortedActivities.length;
  const visibleColumnCount = COLUMN_DEFINITIONS.filter((column) => visibleColumns[column.key]).length;
  const tableColSpan = visibleColumnCount + 2; // checkbox + actions
  const tableTotalWidth =
    CHECKBOX_COLUMN_WIDTH +
    ACTIONS_COLUMN_WIDTH +
    COLUMN_DEFINITIONS.filter((column) => visibleColumns[column.key]).reduce(
      (sum, column) => sum + COLUMN_WIDTHS[column.key],
      0
    );

  const isColumnVisible = (key: ColumnKey): boolean => visibleColumns[key];

  const setColumnVisibility = (key: ColumnKey, visible: boolean) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: visible }));
  };

  const setAllColumnsVisibility = (visible: boolean) => {
    const next = { ...DEFAULT_VISIBLE_COLUMNS };
    (Object.keys(next) as ColumnKey[]).forEach((key) => {
      next[key] = visible;
    });
    setVisibleColumns(next);
  };

  const onResetExpandedLayout = () => {
    setIsWideMode(true);
    setShowColumnPanel(true);
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    localStorage.removeItem(GRID_PREFS_STORAGE_KEY);
  };

  const onToggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(key);
    setSortDirection(key === 'lastUpdate' ? 'desc' : 'asc');
  };

  const onSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(sortedActivities.map((activity) => activity.activityId));
  };

  const onToggleRow = (activityId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(activityId)) return prev;
        return [...prev, activityId];
      }
      return prev.filter((id) => id !== activityId);
    });
  };

  const onQuickUpdateField = async (
    activity: CssActivity,
    field: EditableChoiceField,
    value: string
  ) => {
    const patch: Parameters<typeof cssService.updateActivity>[1] = {};
    if (field === 'issueStatus') patch.issueStatus = value;
    if (field === 'blBu') patch.blBu = value || null;
    if (field === 'listStatus') patch.listStatus = value || null;
    if (field === 'customerPriority') patch.customerPriority = value || null;
    if (field === 'cssPriority') patch.cssPriority = value || null;
    if (field === 'cssOwner') patch.cssOwner = value || null;

    setQuickUpdatingId(activity.activityId);
    setError(null);
    try {
      await cssService.updateActivity(activity.activityId, patch);
      setActivities((prev) =>
        prev.map((current) =>
          current.activityId === activity.activityId
            ? {
                ...current,
                issueStatus: patch.issueStatus ?? current.issueStatus,
                blBu: patch.blBu !== undefined ? patch.blBu : current.blBu,
                listStatus: patch.listStatus !== undefined ? patch.listStatus : current.listStatus,
                customerPriority:
                  patch.customerPriority !== undefined ? patch.customerPriority : current.customerPriority,
                cssPriority: patch.cssPriority !== undefined ? patch.cssPriority : current.cssPriority,
                cssOwner: patch.cssOwner !== undefined ? patch.cssOwner : current.cssOwner
              }
            : current
        )
      );
      setChoiceEditor(null);
      await refreshMeta();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornamento rapido campo');
    } finally {
      setQuickUpdatingId(null);
    }
  };

  const openNotesEditor = (activity: CssActivity) => {
    setNotesEditor({
      activityId: activity.activityId,
      value: activity.notes ?? ''
    });
  };

  const saveNotesEditor = async () => {
    if (!notesEditor) return;
    setSavingNotes(true);
    setError(null);
    try {
      await cssService.updateActivity(notesEditor.activityId, {
        notes: notesEditor.value || null
      });
      setActivities((prev) =>
        prev.map((activity) =>
          activity.activityId === notesEditor.activityId
            ? { ...activity, notes: notesEditor.value || null }
            : activity
        )
      );
      if (inlineEditId === notesEditor.activityId) {
        setInlineEdit((prev) => ({ ...prev, notes: notesEditor.value }));
      }
      setNotesEditor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio notes');
    } finally {
      setSavingNotes(false);
    }
  };

  useEffect(() => {
    const top = topScrollRef.current;
    const topTrack = topScrollTrackRef.current;
    const table = tableScrollRef.current;
    if (!top || !topTrack || !table) {
      return;
    }

    const syncTrackWidth = () => {
      topTrack.style.width = `${table.scrollWidth}px`;
    };

    const onTopScroll = () => {
      if (isSyncingScrollRef.current) return;
      isSyncingScrollRef.current = true;
      table.scrollLeft = top.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    };

    const onTableScroll = () => {
      if (isSyncingScrollRef.current) return;
      isSyncingScrollRef.current = true;
      top.scrollLeft = table.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    };

    syncTrackWidth();
    top.scrollLeft = table.scrollLeft;

    top.addEventListener('scroll', onTopScroll);
    table.addEventListener('scroll', onTableScroll);
    window.addEventListener('resize', syncTrackWidth);

    return () => {
      top.removeEventListener('scroll', onTopScroll);
      table.removeEventListener('scroll', onTableScroll);
      window.removeEventListener('resize', syncTrackWidth);
    };
  }, [visibleColumns, sortedActivities.length, isWideMode]);

  const onBulkApplyStatus = async () => {
    if (selectedIds.length === 0) {
      return;
    }
    setBulkUpdating(true);
    setError(null);
    try {
      await cssService.bulkUpdateStatus(selectedIds, bulkStatus);
      setSelectedIds([]);
      await Promise.all([refreshActivities(), refreshMeta()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornamento massivo stato');
    } finally {
      setBulkUpdating(false);
    }
  };

  const renderSortLabel = (label: string, key: SortKey): string => {
    if (sortBy !== key) return label;
    return `${label} ${sortDirection === 'asc' ? '↑' : '↓'}`;
  };

  return (
    <div
      className={`space-y-6 ${isWideMode ? 'relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-4 sm:px-6' : ''}`}
    >
      <section className="ul-surface p-5">
        <h1 className="text-2xl font-semibold">CSS - Attività Clienti</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nuova area operativa centralizzata per attività clienti e import meeting report.
          La selezione utenti da Microsoft Graph su SharePoint resta fuori scope in questa fase.
        </p>
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {validationSummary && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {validationSummary}
        </div>
      )}

      <section className="ul-surface">
        <ModernListsLayout
          activities={activities}
          filteredActivities={filteredActivities}
          activeViewId={activeViewId}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={setAdvancedFilters}
          customerFilter={customerFilter}
          onCustomerFilterChange={setCustomerFilter}
          ownerFilter={ownerFilter}
          onOwnerFilterChange={setOwnerFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          ratingFilter={ratingFilter}
          onRatingFilterChange={setRatingFilter}
          query={query}
          onQueryChange={setQuery}
          onCreateActivity={onCreateActivity}
          customers={customers}
          owners={owners}
          statuses={statuses}
          ratingOptions={ratingOptions}
          renderRatingStars={renderRatingStars}
        >
          {/* Table Content */}
          <div className="space-y-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="ul-button ul-button-ghost h-9"
                onClick={() => setShowColumnPanel((prev) => !prev)}
              >
                {showColumnPanel ? 'Chiudi colonne' : 'Mostra/Nascondi colonne'}
              </button>
              <div className="flex items-center gap-1 rounded-lg bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                <span>🔒 Controlli Microsoft Lists applicati</span>
              </div>
              <button
                type="button"
                className="ul-button ul-button-ghost h-9"
                onClick={() => setIsWideMode((prev) => !prev)}
              >
                {isWideMode ? 'Modalità standard' : 'Modalità espansa'}
              </button>
              <button
                type="button"
                className="ul-button ul-button-ghost h-9"
                onClick={onResetExpandedLayout}
              >
                Ripristina vista espansa
              </button>
            </div>

            <div className="mb-2 text-xs text-muted-foreground">
              Colonne visibili: {visibleColumnCount}/{COLUMN_DEFINITIONS.length}. Scorri orizzontalmente la griglia per vedere tutte le colonne.
            </div>

            {showColumnPanel && (
              <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <button type="button" className="ul-button ul-button-ghost h-8 px-3" onClick={() => setAllColumnsVisibility(true)}>
                    Mostra tutte
                  </button>
                  <button type="button" className="ul-button ul-button-ghost h-8 px-3" onClick={() => setAllColumnsVisibility(false)}>
                    Nascondi tutte
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {COLUMN_DEFINITIONS.map((column) => (
                    <label key={column.key} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isColumnVisible(column.key)}
                        onChange={(event) => setColumnVisibility(column.key, event.target.checked)}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-1 overflow-x-auto rounded-md border border-border/60 bg-muted/20" ref={topScrollRef} aria-label="Scroll orizzontale colonne">
              <div ref={topScrollTrackRef} className="h-3 min-w-[2200px]" />
            </div>

            <div ref={tableScrollRef} className={`overflow-x-auto overflow-y-auto rounded-xl border border-border ${isWideMode ? 'max-h-[76vh]' : 'max-h-[58vh]'}`}>
              <table
                className="table-fixed text-left text-sm [&_input.ul-input]:!text-inherit [&_select.ul-input]:!text-inherit [&_textarea.ul-textarea]:!text-inherit"
                style={{ width: tableTotalWidth }}
              >
            <colgroup>
              <col style={{ width: CHECKBOX_COLUMN_WIDTH }} />
              {COLUMN_DEFINITIONS.filter((column) => isColumnVisible(column.key)).map((column) => (
                <col key={column.key} style={{ width: COLUMN_WIDTHS[column.key] }} />
              ))}
              <col style={{ width: ACTIONS_COLUMN_WIDTH }} />
            </colgroup>
            <thead className="sticky top-0 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                <th className="w-12 bg-slate-100 px-3 py-2.5 dark:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={(event) => onSelectAll(event.target.checked)}
                    aria-label="Seleziona tutte le righe"
                  />
                </th>
                {isColumnVisible('customer') && (
                  <th className="bg-slate-100 px-3 py-2.5 dark:bg-slate-800">
                    <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('customerName')}>
                      {renderSortLabel('Customer', 'customerName')}
                    </button>
                  </th>
                )}
                {isColumnVisible('lastUpdate') && (
                  <th className="px-3 py-2">
                    <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('lastUpdate')}>
                      {renderSortLabel('Last Update', 'lastUpdate')}
                    </button>
                  </th>
                )}
                {isColumnVisible('blBu') && (
                  <th className="px-3 py-2">
                    <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('blBu')}>
                      {renderSortLabel('BLs/BUs', 'blBu')}
                    </button>
                  </th>
                )}
                {isColumnVisible('issue') && (
                  <th className="px-3 py-2">
                    <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('issue')}>
                      {renderSortLabel('Issue', 'issue')}
                    </button>
                  </th>
                )}
                {isColumnVisible('issueStatus') && (
                  <th className="px-3 py-2">
                    <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('issueStatus')}>
                      {renderSortLabel('Issue Status', 'issueStatus')}
                    </button>
                  </th>
                )}
                {isColumnVisible('listStatus') && <th className="px-3 py-2">Status (Lista)</th>}
                {isColumnVisible('details') && <th className="px-3 py-2">Details</th>}
                {isColumnVisible('cssOwner') && (
                  <th className="px-3 py-2">
                    <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('cssOwner')}>
                      {renderSortLabel('CSS Owner', 'cssOwner')}
                    </button>
                  </th>
                )}
                {isColumnVisible('eosOwners') && <th className="px-3 py-2">EOS Owners</th>}
                {isColumnVisible('customerOwners') && <th className="px-3 py-2">Customer Owners</th>}
                {isColumnVisible('cssAction') && <th className="px-3 py-2">CSS Action</th>}
                {isColumnVisible('notes') && <th className="px-3 py-2">Notes</th>}
                {isColumnVisible('customerPriority') && <th className="px-3 py-2">Customer Priority</th>}
                {isColumnVisible('cssPriority') && <th className="px-3 py-2">CSS Priority</th>}
                {isColumnVisible('dueDate') && <th className="px-3 py-2">Due Date</th>}
                {isColumnVisible('rating') && <th className="px-3 py-2">Rating (0-5)</th>}
                {isColumnVisible('itemType') && <th className="px-3 py-2">Item Type</th>}
                <th className="px-3 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {selectedCount > 0 && (
                <tr className="border-t border-primary/30 bg-primary/5">
                  <td className="px-3 py-2 text-xs font-semibold text-primary" colSpan={tableColSpan}>
                    {selectedCount} righe selezionate
                    <span className="mx-2 text-muted-foreground">|</span>
                    <select
                      className="mr-2 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                      value={bulkStatus}
                      onChange={(event) => setBulkStatus(event.target.value)}
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                      {!statuses.includes('Action required') && <option value="Action required">Action required</option>}
                      {!statuses.includes('In progress') && <option value="In progress">In progress</option>}
                    </select>
                    <button
                      type="button"
                      className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                      onClick={() => void onBulkApplyStatus()}
                      disabled={bulkUpdating}
                    >
                      {bulkUpdating ? 'Aggiorno...' : 'Aggiorna stato selezionati'}
                    </button>
                  </td>
                </tr>
              )}
              {!isLoading && sortedActivities.length === 0 && (
                <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={tableColSpan}>
                  <div className="space-y-2">
                    <div className="text-2xl">📭</div>
                    <div className="text-sm font-medium">Nessuna attività presente</div>
                    <div className="text-xs text-muted-foreground/70">Prova a modificare i filtri o creane una nuova</div>
                  </div>
                </td></tr>
              )}
              {sortedActivities.map((activity) => {
                const isEditingChoice = (field: EditableChoiceField) =>
                  choiceEditor?.activityId === activity.activityId && choiceEditor.field === field;
                const normalizedBlBu = normalizeChoiceValue(activity.blBu);
                const normalizedIssueStatus = normalizeChoiceValue(activity.issueStatus);
                const normalizedListStatus = normalizeChoiceValue(activity.listStatus);
                const normalizedCustomerPriority = normalizeChoiceValue(activity.customerPriority);
                const normalizedCssPriority = normalizeChoiceValue(activity.cssPriority);
                return (
                <tr
                  key={activity.activityId}
                  className={`border-t border-border/70 align-top transition-colors ${inlineEditId === activity.activityId ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900/30 cursor-pointer'}`}
                  onClick={(event) => {
                    if (inlineEditId === activity.activityId) {
                      return;
                    }
                    const target = event.target as HTMLElement | null;
                    if (target?.closest('button,input,select,textarea,a,label')) {
                      return;
                    }
                    startInlineEdit(activity);
                  }}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(activity.activityId)}
                      onChange={(event) => onToggleRow(activity.activityId, event.target.checked)}
                      aria-label={`Seleziona riga ${activity.issue}`}
                    />
                  </td>
                  {inlineEditId === activity.activityId ? (
                    <>
                      {isColumnVisible('customer') && (
                        <td className="bg-background px-3 py-2">
                          <select className="ul-input h-9 w-full" value={inlineEdit.customerName} onChange={(event) => setInlineEdit((prev) => ({ ...prev, customerName: event.target.value }))}>
                            <option value="" disabled>Seleziona cliente</option>
                            {customers.map((customer) => (
                              <option key={customer} value={customer}>{customer}</option>
                            ))}
                            {!customers.includes(inlineEdit.customerName) && inlineEdit.customerName && (
                              <option value={inlineEdit.customerName}>{inlineEdit.customerName}</option>
                            )}
                          </select>
                        </td>
                      )}
                      {isColumnVisible('lastUpdate') && <td className="px-3 py-2"><input className="ul-input h-9 w-full" type="date" value={inlineEdit.lastUpdate} onChange={(event) => setInlineEdit((prev) => ({ ...prev, lastUpdate: event.target.value }))} /></td>}
                      {isColumnVisible('blBu') && (
                        <td className="px-3 py-2">
                          <select className={`ul-input h-9 w-full ${getChoiceSelectClassName('blBu', inlineEdit.blBu)}`} value={inlineEdit.blBu} onChange={(event) => setInlineEdit((prev) => ({ ...prev, blBu: event.target.value }))}>
                            <option value="">-</option>
                            {blBuOptions.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                            {!blBuOptions.includes(inlineEdit.blBu) && inlineEdit.blBu && (
                              <option value={inlineEdit.blBu}>{inlineEdit.blBu}</option>
                            )}
                          </select>
                        </td>
                      )}
                      {isColumnVisible('issue') && <td className="px-3 py-2"><input className="ul-input h-9 w-full" value={inlineEdit.issue} onChange={(event) => setInlineEdit((prev) => ({ ...prev, issue: event.target.value }))} /></td>}
                      {isColumnVisible('issueStatus') && (
                        <td className="px-3 py-2">
                          <select className={`ul-input h-9 w-full ${getChoiceSelectClassName('issueStatus', inlineEdit.issueStatus)}`} value={inlineEdit.issueStatus} onChange={(event) => setInlineEdit((prev) => ({ ...prev, issueStatus: event.target.value }))}>
                            {issueStatusOptions.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                            {!issueStatusOptions.includes(inlineEdit.issueStatus) && inlineEdit.issueStatus && (
                              <option value={inlineEdit.issueStatus}>{inlineEdit.issueStatus}</option>
                            )}
                          </select>
                        </td>
                      )}
                      {isColumnVisible('listStatus') && (
                        <td className="px-3 py-2">
                          <select className={`ul-input h-9 w-full ${getChoiceSelectClassName('listStatus', inlineEdit.listStatus)}`} value={inlineEdit.listStatus} onChange={(event) => setInlineEdit((prev) => ({ ...prev, listStatus: event.target.value }))}>
                            <option value="">-</option>
                            {listStatusOptions.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                            {!listStatusOptions.includes(inlineEdit.listStatus) && inlineEdit.listStatus && (
                              <option value={inlineEdit.listStatus}>{inlineEdit.listStatus}</option>
                            )}
                          </select>
                        </td>
                      )}
                      {isColumnVisible('details') && <td className="px-3 py-2"><textarea className="ul-textarea min-h-24 w-full" value={inlineEdit.details} onChange={(event) => setInlineEdit((prev) => ({ ...prev, details: event.target.value }))} /></td>}
                      {isColumnVisible('cssOwner') && (
                        <td className="px-3 py-2">
                          <select className="ul-input h-9 w-full" value={inlineEdit.cssOwner} onChange={(event) => setInlineEdit((prev) => ({ ...prev, cssOwner: event.target.value }))}>
                            <option value="">Nessuno</option>
                            {owners.map((owner) => (
                              <option key={owner} value={owner}>{owner}</option>
                            ))}
                            {!owners.includes(inlineEdit.cssOwner) && inlineEdit.cssOwner && (
                              <option value={inlineEdit.cssOwner}>{inlineEdit.cssOwner}</option>
                            )}
                          </select>
                        </td>
                      )}
                      {isColumnVisible('eosOwners') && (
                        <td className="px-3 py-2">
                          <input
                            className="ul-input h-9 w-full"
                            list="css-eos-owners-options"
                            value={inlineEdit.eosOwners}
                            onChange={(event) => setInlineEdit((prev) => ({ ...prev, eosOwners: event.target.value }))}
                          />
                        </td>
                      )}
                      {isColumnVisible('customerOwners') && (
                        <td className="px-3 py-2">
                          <input
                            className="ul-input h-9 w-full"
                            list="css-customer-owners-options"
                            value={inlineEdit.customerOwners}
                            onChange={(event) => setInlineEdit((prev) => ({ ...prev, customerOwners: event.target.value }))}
                          />
                        </td>
                      )}
                      {isColumnVisible('cssAction') && (
                        <td className="px-3 py-2">
                          <input
                            className="ul-input h-9 w-full"
                            list="css-action-options"
                            value={inlineEdit.cssAction}
                            onChange={(event) => setInlineEdit((prev) => ({ ...prev, cssAction: event.target.value }))}
                          />
                        </td>
                      )}
                      {isColumnVisible('notes') && (
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-left hover:bg-muted/35"
                            onClick={(event) => {
                              event.stopPropagation();
                              openNotesEditor({ ...activity, notes: inlineEdit.notes || null });
                            }}
                          >
                            {(inlineEdit.notes || '').trim() ? inlineEdit.notes : 'Modifica notes'}
                          </button>
                        </td>
                      )}
                      {isColumnVisible('customerPriority') && (
                        <td className="px-3 py-2">
                          <select className={`ul-input h-9 w-full ${getChoiceSelectClassName('customerPriority', inlineEdit.customerPriority)}`} value={inlineEdit.customerPriority} onChange={(event) => setInlineEdit((prev) => ({ ...prev, customerPriority: event.target.value }))}>
                            <option value="">-</option>
                            {priorityOptions.map((priority) => (
                              <option key={priority} value={priority}>{priority}</option>
                            ))}
                            {!priorityOptions.includes(inlineEdit.customerPriority) && inlineEdit.customerPriority && (
                              <option value={inlineEdit.customerPriority}>{inlineEdit.customerPriority}</option>
                            )}
                          </select>
                        </td>
                      )}
                      {isColumnVisible('cssPriority') && (
                        <td className="px-3 py-2">
                          <select className={`ul-input h-9 w-full ${getChoiceSelectClassName('cssPriority', inlineEdit.cssPriority)}`} value={inlineEdit.cssPriority} onChange={(event) => setInlineEdit((prev) => ({ ...prev, cssPriority: event.target.value }))}>
                            <option value="">-</option>
                            {priorityOptions.map((priority) => (
                              <option key={priority} value={priority}>{priority}</option>
                            ))}
                            {!priorityOptions.includes(inlineEdit.cssPriority) && inlineEdit.cssPriority && (
                              <option value={inlineEdit.cssPriority}>{inlineEdit.cssPriority}</option>
                            )}
                          </select>
                        </td>
                      )}
                      {isColumnVisible('dueDate') && <td className="px-3 py-2"><input className="ul-input h-9 w-full" type="date" value={inlineEdit.dueDate} onChange={(event) => setInlineEdit((prev) => ({ ...prev, dueDate: event.target.value }))} /></td>}
                      {isColumnVisible('rating') && (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const selected = (parseRatingValue(inlineEdit.rating) ?? 0) >= star;
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  className={`text-base leading-none ${selected ? 'text-amber-500' : 'text-muted-foreground/40'}`}
                                  onClick={() => setInlineEdit((prev) => ({ ...prev, rating: String(star) }))}
                                  aria-label={`${star} stelle`}
                                  title={`${star} stelle`}
                                >
                                  ★
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground underline"
                            onClick={() => setInlineEdit((prev) => ({ ...prev, rating: '' }))}
                          >
                            Nessuno
                          </button>
                        </td>
                      )}
                      {isColumnVisible('itemType') && (
                        <td className="px-3 py-2">
                          <select className="ul-input h-9 w-full" value={inlineEdit.itemType} onChange={(event) => setInlineEdit((prev) => ({ ...prev, itemType: event.target.value }))}>
                            <option value="">Nessuno</option>
                            {itemTypeOptions.map((itemType) => (
                              <option key={itemType} value={itemType}>{itemType}</option>
                            ))}
                            {!itemTypeOptions.includes(inlineEdit.itemType) && inlineEdit.itemType && (
                              <option value={inlineEdit.itemType}>{inlineEdit.itemType}</option>
                            )}
                          </select>
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button type="button" className="text-primary hover:underline" onClick={() => void saveInlineEdit()}>Salva</button>
                          <button type="button" className="text-muted-foreground hover:underline" onClick={cancelInlineEdit}>Annulla</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      {isColumnVisible('customer') && <td className="bg-background px-3 py-2 font-medium">{activity.customerName}</td>}
                      {isColumnVisible('lastUpdate') && <td className="px-3 py-2">{formatDate(activity.lastUpdate)}</td>}
                      {isColumnVisible('blBu') && (
                        <td className="px-3 py-2">
                          {isEditingChoice('blBu') ? (
                            <select
                              className="ul-input h-9 w-full"
                              value={normalizedBlBu}
                              disabled={quickUpdatingId === activity.activityId}
                              onBlur={() => setChoiceEditor(null)}
                              autoFocus
                              onChange={(event) => void onQuickUpdateField(activity, 'blBu', event.target.value)}
                            >
                              <option value="">-</option>
                              {blBuOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                              {normalizedBlBu && !blBuOptions.includes(normalizedBlBu) && (
                                <option value={normalizedBlBu}>{normalizedBlBu}</option>
                              )}
                            </select>
                          ) : (
                            <button
                              type="button"
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${getChoiceChipClassName('blBu', normalizedBlBu)}`}
                              onClick={() => setChoiceEditor({ activityId: activity.activityId, field: 'blBu' })}
                              title="Clicca per cambiare BL/BU"
                            >
                              {normalizedBlBu || '-'}
                            </button>
                          )}
                        </td>
                      )}
                      {isColumnVisible('issue') && <td className="px-3 py-2">{activity.issue}</td>}
                      {isColumnVisible('issueStatus') && (
                        <td className="px-3 py-2">
                          {isEditingChoice('issueStatus') ? (
                            <select
                              className="ul-input h-9 w-full"
                              value={normalizedIssueStatus}
                              disabled={quickUpdatingId === activity.activityId}
                              onBlur={() => setChoiceEditor(null)}
                              autoFocus
                              onChange={(event) => void onQuickUpdateField(activity, 'issueStatus', event.target.value)}
                            >
                              {issueStatusOptions.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                              {normalizedIssueStatus && !issueStatusOptions.includes(normalizedIssueStatus) && (
                                <option value={normalizedIssueStatus}>{normalizedIssueStatus}</option>
                              )}
                            </select>
                          ) : (
                            <button
                              type="button"
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${getChoiceChipClassName('issueStatus', normalizedIssueStatus)}`}
                              onClick={() => setChoiceEditor({ activityId: activity.activityId, field: 'issueStatus' })}
                              title="Clicca per cambiare Issue Status"
                            >
                              {normalizedIssueStatus || '-'}
                            </button>
                          )}
                        </td>
                      )}
                      {isColumnVisible('listStatus') && (
                        <td className="px-3 py-2">
                          {isEditingChoice('listStatus') ? (
                            <select
                              className="ul-input h-9 w-full"
                              value={normalizedListStatus}
                              disabled={quickUpdatingId === activity.activityId}
                              onBlur={() => setChoiceEditor(null)}
                              autoFocus
                              onChange={(event) => void onQuickUpdateField(activity, 'listStatus', event.target.value)}
                            >
                              <option value="">-</option>
                              {listStatusOptions.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                              {normalizedListStatus && !listStatusOptions.includes(normalizedListStatus) && (
                                <option value={normalizedListStatus}>{normalizedListStatus}</option>
                              )}
                            </select>
                          ) : (
                            <button
                              type="button"
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${getChoiceChipClassName('listStatus', normalizedListStatus)}`}
                              onClick={() => setChoiceEditor({ activityId: activity.activityId, field: 'listStatus' })}
                              title="Clicca per cambiare Status lista"
                            >
                              {normalizedListStatus || '-'}
                            </button>
                          )}
                        </td>
                      )}
                      {isColumnVisible('details') && <td className="px-3 py-2">{activity.details ?? '-'}</td>}
                      {isColumnVisible('cssOwner') && (
                        <td className="px-3 py-2">
                          {isEditingChoice('cssOwner') ? (
                            <select
                              className="ul-input h-9 w-full"
                              value={activity.cssOwner ?? ''}
                              disabled={quickUpdatingId === activity.activityId}
                              onBlur={() => setChoiceEditor(null)}
                              autoFocus
                              onChange={(event) => void onQuickUpdateField(activity, 'cssOwner', event.target.value)}
                            >
                              <option value="">Nessuno</option>
                              {owners.map((owner) => (
                                <option key={owner} value={owner}>{owner}</option>
                              ))}
                              {activity.cssOwner && !owners.includes(activity.cssOwner) && (
                                <option value={activity.cssOwner}>{activity.cssOwner}</option>
                              )}
                            </select>
                          ) : (
                            <button
                              type="button"
                              className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700"
                              onClick={() => setChoiceEditor({ activityId: activity.activityId, field: 'cssOwner' })}
                              title="Clicca per cambiare CSS Owner"
                            >
                              {activity.cssOwner ?? '-'}
                            </button>
                          )}
                        </td>
                      )}
                      {isColumnVisible('eosOwners') && <td className="px-3 py-2">{activity.eosOwners ?? '-'}</td>}
                      {isColumnVisible('customerOwners') && <td className="px-3 py-2">{activity.customerOwners ?? '-'}</td>}
                      {isColumnVisible('cssAction') && <td className="px-3 py-2">{activity.cssAction ?? '-'}</td>}
                      {isColumnVisible('notes') && (
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="w-full text-left hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              openNotesEditor(activity);
                            }}
                            title="Modifica notes"
                          >
                            {activity.notes ?? '-'}
                          </button>
                        </td>
                      )}
                      {isColumnVisible('customerPriority') && (
                        <td className="px-3 py-2">
                          {isEditingChoice('customerPriority') ? (
                            <select
                              className="ul-input h-9 w-full"
                              value={normalizedCustomerPriority}
                              disabled={quickUpdatingId === activity.activityId}
                              onBlur={() => setChoiceEditor(null)}
                              autoFocus
                              onChange={(event) => void onQuickUpdateField(activity, 'customerPriority', event.target.value)}
                            >
                              <option value="">-</option>
                              {priorityOptions.map((priority) => (
                                <option key={priority} value={priority}>{priority}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              type="button"
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${getChoiceChipClassName('customerPriority', normalizedCustomerPriority)}`}
                              onClick={() => setChoiceEditor({ activityId: activity.activityId, field: 'customerPriority' })}
                              title="Clicca per cambiare Customer Priority"
                            >
                              {normalizedCustomerPriority || '-'}
                            </button>
                          )}
                        </td>
                      )}
                      {isColumnVisible('cssPriority') && (
                        <td className="px-3 py-2">
                          {isEditingChoice('cssPriority') ? (
                            <select
                              className="ul-input h-9 w-full"
                              value={normalizedCssPriority}
                              disabled={quickUpdatingId === activity.activityId}
                              onBlur={() => setChoiceEditor(null)}
                              autoFocus
                              onChange={(event) => void onQuickUpdateField(activity, 'cssPriority', event.target.value)}
                            >
                              <option value="">-</option>
                              {priorityOptions.map((priority) => (
                                <option key={priority} value={priority}>{priority}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              type="button"
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${getChoiceChipClassName('cssPriority', normalizedCssPriority)}`}
                              onClick={() => setChoiceEditor({ activityId: activity.activityId, field: 'cssPriority' })}
                              title="Clicca per cambiare CSS Priority"
                            >
                              {normalizedCssPriority || '-'}
                            </button>
                          )}
                        </td>
                      )}
                      {isColumnVisible('dueDate') && <td className="px-3 py-2">{formatDate(activity.dueDate)}</td>}
                      {isColumnVisible('rating') && (
                        <td className="px-3 py-2">
                          {activity.rating == null ? '-' : `${renderRatingStars(activity.rating)} (${activity.rating})`}
                        </td>
                      )}
                      {isColumnVisible('itemType') && <td className="px-3 py-2">{activity.itemType ?? '-'}</td>}
                      <td className="px-3 py-2">
                        <div className="flex gap-3">
                          <button className="text-primary hover:underline" onClick={() => onEdit(activity)}>Form</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
              })}
            </tbody>
          </table>
            </div>
            <datalist id="css-eos-owners-options">
              {eosOwnersOptions.map((owner) => (
                <option key={owner} value={owner} />
              ))}
            </datalist>
            <datalist id="css-customer-owners-options">
              {customerOwnersOptions.map((owner) => (
                <option key={owner} value={owner} />
              ))}
            </datalist>
            <datalist id="css-action-options">
              {cssActionOptions.map((action) => (
                <option key={action} value={action} />
              ))}
            </datalist>
          </div>
        </ModernListsLayout>
      </section>

      {isFormModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={resetForm}
        >
          <form
            className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"
            onSubmit={onSaveActivity}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{editingId ? 'Modifica attività' : 'Nuova attività'}</h2>
              <button className="ul-button ul-button-ghost" type="button" onClick={resetForm}>
                Chiudi
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select className="ul-input" value={activityForm.customerName} onChange={(event) => setActivityForm((prev) => ({ ...prev, customerName: event.target.value }))} required>
                <option value="" disabled>Seleziona cliente</option>
                {customers.map((customer) => (
                  <option key={customer} value={customer}>{customer}</option>
                ))}
                {!customers.includes(activityForm.customerName) && activityForm.customerName && (
                  <option value={activityForm.customerName}>{activityForm.customerName}</option>
                )}
              </select>
              <input className="ul-input" placeholder="Issue" value={activityForm.issue} onChange={(event) => setActivityForm((prev) => ({ ...prev, issue: event.target.value }))} required />
              <select className={`ul-input ${getChoiceSelectClassName('listStatus', activityForm.listStatus)}`} value={activityForm.listStatus} onChange={(event) => setActivityForm((prev) => ({ ...prev, listStatus: event.target.value }))}>
                <option value="">Nessuno</option>
                {listStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
                {!listStatusOptions.includes(activityForm.listStatus) && activityForm.listStatus && (
                  <option value={activityForm.listStatus}>{activityForm.listStatus}</option>
                )}
              </select>
              <select className={`ul-input ${getChoiceSelectClassName('issueStatus', activityForm.issueStatus)}`} value={activityForm.issueStatus} onChange={(event) => setActivityForm((prev) => ({ ...prev, issueStatus: event.target.value }))} required>
                {issueStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
                {!issueStatusOptions.includes(activityForm.issueStatus) && activityForm.issueStatus && (
                  <option value={activityForm.issueStatus}>{activityForm.issueStatus}</option>
                )}
              </select>
              <select className="ul-input" value={activityForm.cssOwner} onChange={(event) => setActivityForm((prev) => ({ ...prev, cssOwner: event.target.value }))}>
                <option value="">Nessuno</option>
                {owners.map((owner) => (
                  <option key={owner} value={owner}>{owner}</option>
                ))}
                {!owners.includes(activityForm.cssOwner) && activityForm.cssOwner && (
                  <option value={activityForm.cssOwner}>{activityForm.cssOwner}</option>
                )}
              </select>
              <input className="ul-input" placeholder="EOS Owners" value={activityForm.eosOwners} onChange={(event) => setActivityForm((prev) => ({ ...prev, eosOwners: event.target.value }))} />
              <input className="ul-input" placeholder="Customer Owners" value={activityForm.customerOwners} onChange={(event) => setActivityForm((prev) => ({ ...prev, customerOwners: event.target.value }))} />
              <select className={`ul-input ${getChoiceSelectClassName('blBu', activityForm.blBu)}`} value={activityForm.blBu} onChange={(event) => setActivityForm((prev) => ({ ...prev, blBu: event.target.value }))}>
                <option value="">Nessuno</option>
                {blBuOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
                {!blBuOptions.includes(activityForm.blBu) && activityForm.blBu && (
                  <option value={activityForm.blBu}>{activityForm.blBu}</option>
                )}
              </select>
              <input className="ul-input" placeholder="CSS Action" value={activityForm.cssAction} onChange={(event) => setActivityForm((prev) => ({ ...prev, cssAction: event.target.value }))} />
              <select className={`ul-input ${getChoiceSelectClassName('customerPriority', activityForm.customerPriority)}`} value={activityForm.customerPriority} onChange={(event) => setActivityForm((prev) => ({ ...prev, customerPriority: event.target.value }))}>
                <option value="">Nessuno</option>
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
                {!priorityOptions.includes(activityForm.customerPriority) && activityForm.customerPriority && (
                  <option value={activityForm.customerPriority}>{activityForm.customerPriority}</option>
                )}
              </select>
              <select className={`ul-input ${getChoiceSelectClassName('cssPriority', activityForm.cssPriority)}`} value={activityForm.cssPriority} onChange={(event) => setActivityForm((prev) => ({ ...prev, cssPriority: event.target.value }))}>
                <option value="">Nessuno</option>
                {priorityOptions.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
                {!priorityOptions.includes(activityForm.cssPriority) && activityForm.cssPriority && (
                  <option value={activityForm.cssPriority}>{activityForm.cssPriority}</option>
                )}
              </select>
              <input className="ul-input" type="date" placeholder="Last Update" value={activityForm.lastUpdate} onChange={(event) => setActivityForm((prev) => ({ ...prev, lastUpdate: event.target.value }))} />
              <input className="ul-input" type="date" placeholder="Due Date" value={activityForm.dueDate} onChange={(event) => setActivityForm((prev) => ({ ...prev, dueDate: event.target.value }))} />
              <div className="rounded-full border border-border bg-card px-3 py-2">
                <div className="mb-1 text-xs text-muted-foreground">Rating</div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const selected = (parseRatingValue(activityForm.rating) ?? 0) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        className={`text-xl leading-none ${selected ? 'text-amber-500' : 'text-muted-foreground/40'}`}
                        onClick={() => setActivityForm((prev) => ({ ...prev, rating: String(star) }))}
                        aria-label={`${star} stelle`}
                        title={`${star} stelle`}
                      >
                        ★
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() => setActivityForm((prev) => ({ ...prev, rating: '' }))}
                  >
                    Nessuno
                  </button>
                </div>
              </div>
              <select className="ul-input" value={activityForm.itemType} onChange={(event) => setActivityForm((prev) => ({ ...prev, itemType: event.target.value }))}>
                <option value="">Nessuno</option>
                {itemTypeOptions.map((itemType) => (
                  <option key={itemType} value={itemType}>{itemType}</option>
                ))}
                {!itemTypeOptions.includes(activityForm.itemType) && activityForm.itemType && (
                  <option value={activityForm.itemType}>{activityForm.itemType}</option>
                )}
              </select>
            </div>
            <div className="mt-3 grid gap-3">
              <textarea className="ul-textarea min-h-24" placeholder="Details" value={activityForm.details} onChange={(event) => setActivityForm((prev) => ({ ...prev, details: event.target.value }))} />
              <textarea className="ul-textarea min-h-20" placeholder="Notes" value={activityForm.notes} onChange={(event) => setActivityForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </div>
            <div className="mt-4 flex gap-2">
              <button disabled={savingActivity} className="ul-button ul-button-primary" type="submit">
                {savingActivity ? 'Salvataggio...' : editingId ? 'Aggiorna' : 'Crea attività'}
              </button>
              <button className="ul-button ul-button-ghost" type="button" onClick={resetForm}>
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="ul-surface p-5">
        <h2 className="text-lg font-semibold">Import Meeting Report</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Carica DOCX, DOC o PDF. Il sistema propone aggiornamenti/nuove attività e richiede validazione finale.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="ul-button ul-button-primary cursor-pointer">
            {uploading ? 'Upload...' : 'Carica documento'}
            <input type="file" className="hidden" accept=".docx,.doc,.pdf" onChange={onUploadDocument} disabled={uploading} />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">Nessun documento caricato.</p>}
          {documents.map((document) => (
            <div key={document.documentId} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{document.filename}</div>
                  <div className="text-xs text-muted-foreground">
                    Stato: {document.extractionStatus} • Caricato: {formatDate(document.uploadedAt)}
                  </div>
                  {document.extractionError && (
                    <div className="mt-1 text-xs text-destructive">{document.extractionError}</div>
                  )}
                </div>
                <button
                  className="ul-button ul-button-ghost"
                  onClick={() => void onExtract(document.documentId)}
                  disabled={extractingId === document.documentId}
                >
                  {extractingId === document.documentId ? 'Analisi...' : 'Analizza'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {notesEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={() => !savingNotes && setNotesEditor(null)}>
          <div className="w-full max-w-5xl rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Modifica notes</h3>
              <button className="ul-button ul-button-ghost" type="button" onClick={() => setNotesEditor(null)} disabled={savingNotes}>
                Chiudi
              </button>
            </div>
            <textarea
              className="ul-textarea min-h-[320px] w-full resize-y"
              value={notesEditor.value}
              onChange={(event) => setNotesEditor((prev) => (prev ? { ...prev, value: event.target.value } : prev))}
            />
            <div className="mt-4 flex gap-2">
              <button className="ul-button ul-button-primary" type="button" onClick={() => void saveNotesEditor()} disabled={savingNotes}>
                {savingNotes ? 'Salvataggio...' : 'Salva notes'}
              </button>
              <button className="ul-button ul-button-ghost" type="button" onClick={() => setNotesEditor(null)} disabled={savingNotes}>
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="ul-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Proposte da validare</h2>
          <div className="text-sm text-muted-foreground">
            Batch: {activeBatchId ?? '-'} • Proposte: {extractedCount}
          </div>
        </div>
        {proposals.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nessuna proposta disponibile.</p>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {proposals.map((proposal) => (
                <div key={proposal.proposalId} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        [{proposal.actionType.toUpperCase()}] {proposal.payload.customerName} - {proposal.payload.issue}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Status proposto: {proposal.payload.issueStatus} • Confidence: {(proposal.confidence * 100).toFixed(0)}%
                      </div>
                      {proposal.payload.details && (
                        <p className="mt-1 text-sm text-muted-foreground">{proposal.payload.details}</p>
                      )}
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={approved[proposal.proposalId] ?? true}
                        onChange={(event) =>
                          setApproved((prev) => ({ ...prev, [proposal.proposalId]: event.target.checked }))
                        }
                      />
                      Applica
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button className="ul-button ul-button-primary" onClick={() => void onValidateBatch()} disabled={validating || !activeBatchId}>
                {validating ? 'Validazione...' : 'Conferma validazione'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default CssPage;
