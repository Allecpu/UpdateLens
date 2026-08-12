import { useEffect, useMemo, useRef, useState } from 'react';
import type { CssActivity, CssCustomer, CssProposal } from '../../models/Css';
import { cssService } from '../../services/CssService';
import { loadCustomerIndex } from '../../services/CustomerStorage';
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

const normalizeCustomerKey = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();

const ensureFilterArray = (value?: string | string[]): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
};

const splitChoiceTokens = (value?: string | null): string[] =>
  (value ?? '')
    .split(';#')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !/^\d+$/.test(part));

const normalizeChoiceValue = (value?: string | null): string =>
  (splitChoiceTokens(value)[0] ?? '').replace(/\s+/g, ' ').trim();

const getGroupLabel = (activity: CssActivity, groupBy: GroupByKey): string => {
  if (!groupBy) return '';
  switch (groupBy) {
    case 'status':
      return normalizeChoiceValue(activity.issueStatus) || 'No Status';
    case 'customer':
      return (activity.customerName ?? '').trim() || 'No Customer';
    case 'owner':
      return normalizeOwnerLabel(activity.cssOwner ?? '') || 'No Owner';
    default:
      return '';
  }
};

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
  (value ?? '')
    .normalize('NFKC')
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

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

const trimToNull = (value?: string | null): string | null => {
  const normalized = (value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
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
const CHOICE_PREFS_STORAGE_KEY = 'css-choice-column-prefs';
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
const BLBU_COLOR_OPTIONS = [
  { value: 'green', label: 'Verde' },
  { value: 'blue', label: 'Blu' },
  { value: 'red', label: 'Rosso' },
  { value: 'amber', label: 'Giallo' },
  { value: 'teal', label: 'Turchese' },
  { value: 'violet', label: 'Viola' },
  { value: 'pink', label: 'Rosa' },
  { value: 'slate', label: 'Grigio' }
] as const;

type BlBuColor =
  | 'green'
  | 'blue'
  | 'red'
  | 'amber'
  | 'teal'
  | 'violet'
  | 'pink'
  | 'slate';

type BlBuPrefs = {
  ordered: string[];
  hidden: string[];
  colors: Record<string, BlBuColor>;
};

type ManagedChoiceColumn =
  | 'customer'
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
  | 'rating'
  | 'itemType';

type ChoicePrefsMap = Record<ManagedChoiceColumn, BlBuPrefs>;

const DEFAULT_CHOICE_PREFS: ChoicePrefsMap = {
  customer: { ordered: [], hidden: [], colors: {} },
  blBu: { ordered: [], hidden: [], colors: {} },
  issue: { ordered: [], hidden: [], colors: {} },
  issueStatus: { ordered: [], hidden: [], colors: {} },
  listStatus: { ordered: [], hidden: [], colors: {} },
  details: { ordered: [], hidden: [], colors: {} },
  cssOwner: { ordered: [], hidden: [], colors: {} },
  eosOwners: { ordered: [], hidden: [], colors: {} },
  customerOwners: { ordered: [], hidden: [], colors: {} },
  cssAction: { ordered: [], hidden: [], colors: {} },
  notes: { ordered: [], hidden: [], colors: {} },
  customerPriority: { ordered: [], hidden: [], colors: {} },
  cssPriority: { ordered: [], hidden: [], colors: {} },
  rating: { ordered: [], hidden: [], colors: {} },
  itemType: { ordered: [], hidden: [], colors: {} }
};

const CHOICE_COLUMN_LABELS: Record<ManagedChoiceColumn, string> = {
  customer: 'Customer',
  blBu: 'BLs/BUs',
  issue: 'Issue',
  issueStatus: 'Issue Status',
  listStatus: 'Status (Lista)',
  details: 'Details',
  cssOwner: 'CSS Owner',
  eosOwners: 'EOS Owners',
  customerOwners: 'Customer Owners',
  cssAction: 'CSS Action',
  notes: 'Notes',
  customerPriority: 'Customer Priority',
  cssPriority: 'CSS Priority',
  rating: 'Rating (0-5)',
  itemType: 'Item Type'
};

type EditableChoiceField = 'blBu' | 'issueStatus' | 'listStatus' | 'customerPriority' | 'cssPriority' | 'cssOwner';

const getBlBuColorClassName = (color?: BlBuColor): string => {
  switch (color) {
    case 'green':
      return 'bg-lime-100 text-lime-800';
    case 'blue':
      return 'bg-sky-200 text-sky-800';
    case 'red':
      return 'bg-red-600 text-red-50';
    case 'amber':
      return 'bg-amber-100 text-amber-800';
    case 'teal':
      return 'bg-teal-100 text-teal-800';
    case 'violet':
      return 'bg-violet-100 text-violet-700';
    case 'pink':
      return 'bg-rose-200 text-rose-800';
    case 'slate':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-violet-100 text-violet-700';
  }
};

const getBlBuSelectColorClassName = (color?: BlBuColor): string => {
  switch (color) {
    case 'green':
      return '!bg-lime-100 !text-lime-800 !border-lime-200';
    case 'blue':
      return '!bg-sky-200 !text-sky-800 !border-sky-300';
    case 'red':
      return '!bg-red-600 !text-red-50 !border-red-600';
    case 'amber':
      return '!bg-amber-100 !text-amber-800 !border-amber-200';
    case 'teal':
      return '!bg-teal-100 !text-teal-800 !border-teal-200';
    case 'violet':
      return '!bg-violet-100 !text-violet-700 !border-violet-200';
    case 'pink':
      return '!bg-rose-200 !text-rose-800 !border-rose-300';
    case 'slate':
      return '!bg-slate-200 !text-slate-700 !border-slate-300';
    default:
      return '!bg-violet-100 !text-violet-700 !border-violet-200';
  }
};

const getChoiceChipClassName = (field: EditableChoiceField, value?: string | null, customColor?: BlBuColor): string => {
  const token = normalizeToken(value);
  if (!token) return 'bg-muted text-muted-foreground';
  if (customColor) return getBlBuColorClassName(customColor);

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

const getChoiceSelectClassName = (field: EditableChoiceField, value?: string | null, customColor?: BlBuColor): string => {
  const token = normalizeToken(value);
  if (!token) return '!bg-muted !text-muted-foreground';
  if (customColor) return getBlBuSelectColorClassName(customColor);

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

const getBlBuSwatchClassName = (color: BlBuColor): string => {
  switch (color) {
    case 'green':
      return 'bg-lime-500';
    case 'blue':
      return 'bg-sky-500';
    case 'red':
      return 'bg-red-600';
    case 'amber':
      return 'bg-amber-500';
    case 'teal':
      return 'bg-teal-500';
    case 'violet':
      return 'bg-violet-500';
    case 'pink':
      return 'bg-rose-500';
    case 'slate':
      return 'bg-slate-500';
    default:
      return 'bg-violet-500';
  }
};

const getDerivedChoiceColor = (column: ManagedChoiceColumn, value?: string | null): BlBuColor | undefined => {
  const token = normalizeToken(value);
  if (!token) return undefined;

  if (column === 'issueStatus' || column === 'listStatus') {
    if (token === 'action required') return 'blue';
    if (token === 'in progress') return 'green';
    if (token === 'planned') return 'amber';
    if (token === 'requested') return 'pink';
    if (token === 'stand by') return 'slate';
    if (token === 'monitored') return 'pink';
    if (token === 'closed') return 'green';
    if (token === 'aborted') return 'red';
    if (token === 'opportunity') return 'violet';
    return 'violet';
  }

  if (column === 'customerPriority' || column === 'cssPriority') {
    if (token === 'very high') return 'red';
    if (token === 'high') return 'red';
    if (token === 'medium') return 'teal';
    if (token === 'low') return 'amber';
    if (token === 'undefined') return 'slate';
    return 'violet';
  }

  if (column === 'blBu') {
    if (token.includes('controlling') || token.includes('analytics')) return 'green';
    if (token.includes('customer service')) return 'blue';
    if (token.includes('customer experience')) return 'pink';
    if (token.includes('digital factory')) return 'red';
    if (token.includes('business central')) return 'amber';
    if (token.includes('modern workplace')) return 'teal';
    if (token.includes('azure')) return 'blue';
    if (token.includes('sales')) return 'slate';
    return 'violet';
  }

  return 'violet';
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
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>(['Action required']); // Auto-filter: Action required
  const [ratingFilter, setRatingFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('lastUpdate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('In progress');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [isWideMode, setIsWideMode] = useState(true);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
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
  const [choicePrefsByColumn, setChoicePrefsByColumn] = useState<ChoicePrefsMap>(DEFAULT_CHOICE_PREFS);
  const [columnEditor, setColumnEditor] = useState<ManagedChoiceColumn | null>(null);
  const [columnEditorNewOption, setColumnEditorNewOption] = useState('');
  const [columnEditorNewColor, setColumnEditorNewColor] = useState<BlBuColor>('blue');
  const [columnEditorQuery, setColumnEditorQuery] = useState('');

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
  const [showCustomerManagement, setShowCustomerManagement] = useState(false);
  const [cssCustomers, setCssCustomers] = useState<CssCustomer[]>([]);
  const [loadingCssCustomers, setLoadingCssCustomers] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingCustomerName, setEditingCustomerName] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [mergePrimaryCustomerId, setMergePrimaryCustomerId] = useState('');
  const [mergeSecondaryCustomerId, setMergeSecondaryCustomerId] = useState('');
  const [mergingCustomers, setMergingCustomers] = useState(false);
  const [migratingLegacyCustomers, setMigratingLegacyCustomers] = useState(false);
  const [customerMigrationSummary, setCustomerMigrationSummary] = useState<string | null>(null);
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

  const refreshCssCustomers = async () => {
    setLoadingCssCustomers(true);
    try {
      const result = await cssService.listCustomers();
      setCssCustomers(result.items);
    } finally {
      setLoadingCssCustomers(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([refreshMeta(), refreshActivities(), refreshDocuments(), refreshCssCustomers()]);
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
    setCustomerFilter(ensureFilterArray(activeView.filters.customer));
    setOwnerFilter(ensureFilterArray(activeView.filters.owner));
    setStatusFilter(ensureFilterArray(activeView.filters.status));
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
          customer: customerFilter.length > 0 ? customerFilter : undefined,
          owner: ownerFilter.length > 0 ? ownerFilter : undefined,
          status: statusFilter.length > 0 ? statusFilter : undefined,
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHOICE_PREFS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<ManagedChoiceColumn, Partial<BlBuPrefs>>>;
      const normalizePrefs = (source?: Partial<BlBuPrefs>): BlBuPrefs => ({
        ordered: Array.isArray(source?.ordered) ? source.ordered.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
        hidden: Array.isArray(source?.hidden) ? source.hidden.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
        colors: source?.colors && typeof source.colors === 'object'
          ? Object.fromEntries(
              Object.entries(source.colors).filter(
                ([key, value]) =>
                  typeof key === 'string' &&
                  key.trim().length > 0 &&
                  BLBU_COLOR_OPTIONS.some((option) => option.value === value)
              )
            ) as Record<string, BlBuColor>
          : {}
      });
      setChoicePrefsByColumn({
        customer: normalizePrefs(parsed.customer),
        blBu: normalizePrefs(parsed.blBu),
        issue: normalizePrefs(parsed.issue),
        issueStatus: normalizePrefs(parsed.issueStatus),
        listStatus: normalizePrefs(parsed.listStatus),
        details: normalizePrefs(parsed.details),
        cssOwner: normalizePrefs(parsed.cssOwner),
        eosOwners: normalizePrefs(parsed.eosOwners),
        customerOwners: normalizePrefs(parsed.customerOwners),
        cssAction: normalizePrefs(parsed.cssAction),
        notes: normalizePrefs(parsed.notes),
        customerPriority: normalizePrefs(parsed.customerPriority),
        cssPriority: normalizePrefs(parsed.cssPriority),
        rating: normalizePrefs(parsed.rating),
        itemType: normalizePrefs(parsed.itemType)
      });
    } catch (err) {
      console.warn('Impossibile caricare preferenze colonne a scelta', err);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CHOICE_PREFS_STORAGE_KEY, JSON.stringify(choicePrefsByColumn));
  }, [choicePrefsByColumn]);

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
    const customerName = activityForm.customerName.trim();
    const issue = activityForm.issue.trim();
    if (!customerName || !issue) {
      setError('Customer e Issue sono obbligatori');
      setSavingActivity(false);
      return;
    }
    const issueStatus = activityForm.issueStatus.trim() || 'Action required';

    try {
      if (editingId) {
        await cssService.updateActivity(editingId, {
          ...activityForm,
          customerName,
          issue,
          issueStatus,
          cssOwner: trimToNull(activityForm.cssOwner),
          blBu: trimToNull(activityForm.blBu),
          lastUpdate: trimToNull(activityForm.lastUpdate),
          details: trimToNull(activityForm.details),
          listStatus: trimToNull(activityForm.listStatus),
          eosOwners: trimToNull(activityForm.eosOwners),
          customerOwners: trimToNull(activityForm.customerOwners),
          cssAction: trimToNull(activityForm.cssAction),
          notes: trimToNull(activityForm.notes),
          customerPriority: trimToNull(activityForm.customerPriority),
          cssPriority: trimToNull(activityForm.cssPriority),
          dueDate: trimToNull(activityForm.dueDate),
          rating: activityForm.rating ? Number(activityForm.rating) : null,
          itemType: trimToNull(activityForm.itemType)
        });
      } else {
        await cssService.createActivity({
          ...activityForm,
          customerName,
          issue,
          issueStatus,
          cssOwner: trimToNull(activityForm.cssOwner),
          blBu: trimToNull(activityForm.blBu),
          lastUpdate: trimToNull(activityForm.lastUpdate),
          details: trimToNull(activityForm.details),
          listStatus: trimToNull(activityForm.listStatus),
          eosOwners: trimToNull(activityForm.eosOwners),
          customerOwners: trimToNull(activityForm.customerOwners),
          cssAction: trimToNull(activityForm.cssAction),
          notes: trimToNull(activityForm.notes),
          customerPriority: trimToNull(activityForm.customerPriority),
          cssPriority: trimToNull(activityForm.cssPriority),
          dueDate: trimToNull(activityForm.dueDate),
          rating: activityForm.rating ? Number(activityForm.rating) : null,
          itemType: trimToNull(activityForm.itemType)
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
    const customerTokens = customerFilter.map((value) => normalizeToken(value)).filter((value) => value.length > 0);
    const ownerFilterTokens = ownerFilter
      .flatMap((value) => splitOwnerTokens(value))
      .map((token) => normalizeToken(token))
      .filter((value) => value.length > 0);
    const statusTokens = statusFilter.map((value) => normalizeToken(value)).filter((value) => value.length > 0);
    const ratingToken = normalizeToken(ratingFilter);
    const queryToken = normalizeToken(query);

    return activities
      .filter((activity) => {
        const customerName = activity.customerName ?? '';
        const issueStatus = activity.issueStatus ?? '';
        const ownerTokens = splitOwnerTokens(activity.cssOwner).map((token) => normalizeToken(token));

        if (customerTokens.length > 0) {
          const customerNameToken = normalizeToken(customerName);
          if (!customerTokens.some((token) => customerNameToken.includes(token))) {
            return false;
          }
        }

        if (ownerFilterTokens.length > 0) {
          const hasOwner = ownerFilterTokens.some((filterOwner) =>
            ownerTokens.some((owner) => owner === filterOwner || owner.includes(filterOwner))
          );
          if (!hasOwner) {
            return false;
          }
        }

        if (statusTokens.length > 0) {
          const issueStatusToken = normalizeToken(issueStatus);
          if (!statusTokens.includes(issueStatusToken)) {
            return false;
          }
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
      if (groupBy) {
        const groupCompare = getGroupLabel(a, groupBy).localeCompare(getGroupLabel(b, groupBy));
        if (groupCompare !== 0) {
          return groupCompare;
        }
      }
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
  }, [filteredActivities, sortBy, sortDirection, groupBy]);
  const groupCountsByLabel = useMemo(() => {
    if (!groupBy) return new Map<string, number>();
    return sortedActivities.reduce((acc, activity) => {
      const label = getGroupLabel(activity, groupBy);
      acc.set(label, (acc.get(label) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  }, [sortedActivities, groupBy]);

  const applyChoicePrefs = (base: string[], prefs: BlBuPrefs): string[] => {
    const hidden = new Set(uniqueCanonical(prefs.hidden).map((item) => normalizeToken(item)));
    const ordered = uniqueCanonical(prefs.ordered).filter((item) => !hidden.has(normalizeToken(item)));
    const baseVisible = base.filter((item) => !hidden.has(normalizeToken(item)));
    const remaining = baseVisible.filter(
      (item) => !ordered.some((orderedItem) => normalizeToken(orderedItem) === normalizeToken(item))
    );
    return [...ordered, ...remaining];
  };

  const customerOptions = useMemo(
    () => applyChoicePrefs(uniqueCanonical(customers), choicePrefsByColumn.customer),
    [customers, choicePrefsByColumn.customer]
  );

  const issueOptions = useMemo(
    () =>
      applyChoicePrefs(
        uniqueCanonical(
          activities
            .map((activity) => (activity.issue ?? '').trim())
            .filter((value) => value.length > 0)
        ),
        choicePrefsByColumn.issue
      ),
    [activities, choicePrefsByColumn.issue]
  );

  const listStatusOptions = useMemo(
    () => {
      const base = uniqueCanonical(activities.flatMap((activity) => splitChoiceTokens(activity.listStatus)));
      return applyChoicePrefs(base, choicePrefsByColumn.listStatus);
    },
    [activities, choicePrefsByColumn.listStatus]
  );
  const issueStatusOptions = useMemo(
    () => {
      const base = uniqueCanonical([
        ...ISSUE_STATUS_BASE_OPTIONS,
        ...statuses.flatMap((status) => splitChoiceTokens(status)),
        ...activities.flatMap((activity) => splitChoiceTokens(activity.issueStatus))
      ]);
      return applyChoicePrefs(base, choicePrefsByColumn.issueStatus);
    },
    [activities, statuses, choicePrefsByColumn.issueStatus]
  );
  const baseBlBuOptions = useMemo(
    () => uniqueCanonical(activities.flatMap((activity) => splitChoiceTokens(activity.blBu))),
    [activities]
  );
  const hiddenBlBuOptions = useMemo(
    () => uniqueCanonical(choicePrefsByColumn.blBu.hidden),
    [choicePrefsByColumn.blBu.hidden]
  );
  const blBuOptions = useMemo(() => {
    return applyChoicePrefs(baseBlBuOptions, choicePrefsByColumn.blBu);
  }, [baseBlBuOptions, choicePrefsByColumn.blBu.ordered, hiddenBlBuOptions]);
  const priorityOptions = useMemo(
    () => {
      const base = uniqueCanonical([
        ...PRIORITY_BASE_OPTIONS,
        ...activities
          .flatMap((activity) => [activity.customerPriority ?? '', activity.cssPriority ?? ''])
          .flatMap((value) => splitChoiceTokens(value))
      ]);
      const mergedPrefs: BlBuPrefs = {
        ordered: [
          ...choicePrefsByColumn.customerPriority.ordered,
          ...choicePrefsByColumn.cssPriority.ordered
        ],
        hidden: [
          ...choicePrefsByColumn.customerPriority.hidden,
          ...choicePrefsByColumn.cssPriority.hidden
        ],
        colors: {
          ...choicePrefsByColumn.customerPriority.colors,
          ...choicePrefsByColumn.cssPriority.colors
        }
      };
      return applyChoicePrefs(base, mergedPrefs);
    },
    [activities, choicePrefsByColumn.customerPriority, choicePrefsByColumn.cssPriority]
  );
  const itemTypeOptions = useMemo(
    () => {
      const base = uniqueCanonical(
        activities
          .map((activity) => (activity.itemType ?? '').trim())
          .filter((value) => value.length > 0)
      );
      return applyChoicePrefs(base, choicePrefsByColumn.itemType);
    },
    [activities, choicePrefsByColumn.itemType]
  );
  const eosOwnersOptions = useMemo(
    () =>
      applyChoicePrefs(
        uniqueCanonical(activities.flatMap((activity) => splitOwnerTokens(activity.eosOwners))),
        choicePrefsByColumn.eosOwners
      ),
    [activities, choicePrefsByColumn.eosOwners]
  );
  const customerOwnersOptions = useMemo(
    () =>
      applyChoicePrefs(
        uniqueCanonical(activities.flatMap((activity) => splitOwnerTokens(activity.customerOwners))),
        choicePrefsByColumn.customerOwners
      ),
    [activities, choicePrefsByColumn.customerOwners]
  );
  const cssActionOptions = useMemo(
    () =>
      applyChoicePrefs(
        uniqueCanonical(
          activities
            .map((activity) => (activity.cssAction ?? '').trim())
            .filter((value) => value.length > 0)
        ),
        choicePrefsByColumn.cssAction
      ),
    [activities, choicePrefsByColumn.cssAction]
  );
  const detailsOptions = useMemo(
    () =>
      applyChoicePrefs(
        uniqueCanonical(
          activities
            .map((activity) => (activity.details ?? '').trim())
            .filter((value) => value.length > 0)
        ),
        choicePrefsByColumn.details
      ),
    [activities, choicePrefsByColumn.details]
  );
  const notesOptions = useMemo(
    () =>
      applyChoicePrefs(
        uniqueCanonical(
          activities
            .map((activity) => (activity.notes ?? '').trim())
            .filter((value) => value.length > 0)
        ),
        choicePrefsByColumn.notes
      ),
    [activities, choicePrefsByColumn.notes]
  );
  const cssOwnerOptions = useMemo(
    () => applyChoicePrefs(uniqueCanonical(owners), choicePrefsByColumn.cssOwner),
    [owners, choicePrefsByColumn.cssOwner]
  );
  const ratingOptions = useMemo(
    () => {
      const base = Array.from(
        new Set(
          activities
            .map((activity) => parseRatingValue(activity.rating))
            .filter((value): value is number => value != null)
            .map((value) => String(value))
        )
      ).sort((a, b) => Number(a) - Number(b));
      const shaped = applyChoicePrefs(base, choicePrefsByColumn.rating);
      return shaped
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
    },
    [activities, choicePrefsByColumn.rating]
  );
  const activeColumnOptions = useMemo(
    () => (columnEditor ? getColumnOptions(columnEditor) : []),
    [
      columnEditor,
      customerOptions,
      blBuOptions,
      issueOptions,
      issueStatusOptions,
      listStatusOptions,
      detailsOptions,
      cssOwnerOptions,
      eosOwnersOptions,
      customerOwnersOptions,
      cssActionOptions,
      notesOptions,
      priorityOptions,
      itemTypeOptions,
      ratingOptions
    ]
  );
  const activeHiddenOptions = useMemo(
    () => (columnEditor ? uniqueCanonical(choicePrefsByColumn[columnEditor].hidden) : []),
    [choicePrefsByColumn, columnEditor]
  );
  const filteredColumnEditorOptions = useMemo(() => {
    const queryToken = normalizeToken(columnEditorQuery);
    if (!queryToken) return activeColumnOptions;
    return activeColumnOptions.filter((option) => normalizeToken(option).includes(queryToken));
  }, [activeColumnOptions, columnEditorQuery]);

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

  const resolveChoiceColor = (column: ManagedChoiceColumn, value?: string | null): BlBuColor | undefined => {
    const token = normalizeToken(value);
    if (!token) return undefined;
    const colorMap = Object.entries(choicePrefsByColumn[column].colors).reduce((map, [label, color]) => {
      map.set(normalizeToken(label), color);
      return map;
    }, new Map<string, BlBuColor>());
    return colorMap.get(token);
  };

  const openColumnEditor = (column: ManagedChoiceColumn) => {
    setColumnEditor(column);
    setColumnEditorQuery('');
    setColumnEditorNewOption('');
    setColumnEditorNewColor('blue');
  };

  const closeColumnEditor = () => {
    setColumnEditor(null);
  };

  function getColumnOptions(column: ManagedChoiceColumn): string[] {
    switch (column) {
      case 'customer':
        return customerOptions;
      case 'blBu':
        return blBuOptions;
      case 'issue':
        return issueOptions;
      case 'issueStatus':
        return issueStatusOptions;
      case 'listStatus':
        return listStatusOptions;
      case 'details':
        return detailsOptions;
      case 'cssOwner':
        return cssOwnerOptions;
      case 'eosOwners':
        return eosOwnersOptions;
      case 'customerOwners':
        return customerOwnersOptions;
      case 'cssAction':
        return cssActionOptions;
      case 'notes':
        return notesOptions;
      case 'customerPriority':
      case 'cssPriority':
        return priorityOptions;
      case 'rating':
        return ratingOptions.map((value) => String(value));
      case 'itemType':
        return itemTypeOptions;
      default:
        return [];
    }
  }

  const upsertChoiceOption = () => {
    if (!columnEditor) return;
    const candidate = columnEditorNewOption.trim();
    if (!candidate) return;
    const canonicalExisting = uniqueCanonical([
      ...activeColumnOptions,
      ...choicePrefsByColumn[columnEditor].ordered,
      ...choicePrefsByColumn[columnEditor].hidden
    ]).find((item) => normalizeToken(item) === normalizeToken(candidate));
    const targetLabel = canonicalExisting ?? candidate;
    setChoicePrefsByColumn((prev) => {
      const prefs = prev[columnEditor];
      const alreadyPresent = prefs.ordered.some((item) => normalizeToken(item) === normalizeToken(targetLabel));
      const hidden = prefs.hidden.filter((item) => normalizeToken(item) !== normalizeToken(targetLabel));
      const colors = Object.fromEntries(
        Object.entries(prefs.colors).filter(([label]) => normalizeToken(label) !== normalizeToken(targetLabel))
      ) as Record<string, BlBuColor>;
      return {
        ...prev,
        [columnEditor]: {
          ...prefs,
          ordered: alreadyPresent ? prefs.ordered : [...prefs.ordered, targetLabel],
          hidden,
          colors: {
            ...colors,
            [targetLabel]: columnEditorNewColor
          }
        }
      };
    });
    if (columnEditor === 'blBu') {
      setActivityForm((prev) => ({ ...prev, blBu: targetLabel }));
    }
    setColumnEditorNewOption('');
  };

  const moveChoiceOption = (column: ManagedChoiceColumn, label: string, direction: 'up' | 'down') => {
    setChoicePrefsByColumn((prev) => {
      const prefs = prev[column];
      const ordered = [...prefs.ordered];
      const index = ordered.findIndex((item) => normalizeToken(item) === normalizeToken(label));
      if (index < 0) return prev;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= ordered.length) return prev;
      [ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]];
      return { ...prev, [column]: { ...prefs, ordered } };
    });
  };

  const hideChoiceOption = (column: ManagedChoiceColumn, label: string) => {
    setChoicePrefsByColumn((prev) => {
      const prefs = prev[column];
      return {
        ...prev,
        [column]: {
          ...prefs,
          ordered: prefs.ordered.filter((item) => normalizeToken(item) !== normalizeToken(label)),
          hidden: uniqueCanonical([...prefs.hidden, label])
        }
      };
    });
    if (column === 'blBu' && normalizeToken(activityForm.blBu) === normalizeToken(label)) {
      setActivityForm((prev) => ({ ...prev, blBu: '' }));
    }
  };

  const restoreChoiceOption = (column: ManagedChoiceColumn, label: string) => {
    setChoicePrefsByColumn((prev) => {
      const prefs = prev[column];
      return {
        ...prev,
        [column]: {
          ...prefs,
          hidden: prefs.hidden.filter((item) => normalizeToken(item) !== normalizeToken(label)),
          ordered: prefs.ordered.some((item) => normalizeToken(item) === normalizeToken(label))
            ? prefs.ordered
            : [...prefs.ordered, label]
        }
      };
    });
  };

  const setChoiceOptionColor = (column: ManagedChoiceColumn, label: string, color: BlBuColor) => {
    setChoicePrefsByColumn((prev) => {
      const prefs = prev[column];
      const nextColors = Object.fromEntries(
        Object.entries(prefs.colors).filter(([item]) => normalizeToken(item) !== normalizeToken(label))
      ) as Record<string, BlBuColor>;
      return {
        ...prev,
        [column]: {
          ...prefs,
          colors: {
            ...nextColors,
            [label]: color
          }
        }
      };
    });
  };

  const restoreAllHiddenChoiceOptions = (column: ManagedChoiceColumn) => {
    setChoicePrefsByColumn((prev) => {
      const prefs = prev[column];
      const hidden = uniqueCanonical(prefs.hidden);
      if (hidden.length === 0) return prev;
      const mergedOrdered = uniqueCanonical([...prefs.ordered, ...hidden]);
      return {
        ...prev,
        [column]: {
          ...prefs,
          ordered: mergedOrdered,
          hidden: []
        }
      };
    });
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

  const onCreateCssCustomer = async () => {
    const candidate = newCustomerName.trim();
    if (!candidate) {
      return;
    }
    setCreatingCustomer(true);
    setError(null);
    try {
      await cssService.createCustomer({ name: candidate, isActive: true });
      setNewCustomerName('');
      await Promise.all([refreshCssCustomers(), refreshMeta()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore creazione cliente');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const startEditCssCustomer = (customer: CssCustomer) => {
    setEditingCustomerId(customer.customerId);
    setEditingCustomerName(customer.name);
  };

  const onSaveCssCustomer = async () => {
    if (!editingCustomerId) return;
    const candidate = editingCustomerName.trim();
    if (!candidate) return;
    setSavingCustomer(true);
    setError(null);
    try {
      await cssService.updateCustomer(editingCustomerId, { name: candidate });
      setEditingCustomerId(null);
      setEditingCustomerName('');
      await Promise.all([refreshCssCustomers(), refreshActivities(), refreshMeta()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornamento cliente');
    } finally {
      setSavingCustomer(false);
    }
  };

  const onToggleCssCustomerActive = async (customer: CssCustomer) => {
    setSavingCustomer(true);
    setError(null);
    try {
      await cssService.updateCustomer(customer.customerId, { isActive: !customer.isActive });
      await Promise.all([refreshCssCustomers(), refreshMeta()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore aggiornamento stato cliente');
    } finally {
      setSavingCustomer(false);
    }
  };

  const onMergeCssCustomers = async () => {
    if (!mergePrimaryCustomerId || !mergeSecondaryCustomerId) return;
    if (mergePrimaryCustomerId === mergeSecondaryCustomerId) {
      setError('Seleziona due clienti diversi per il merge');
      return;
    }
    setMergingCustomers(true);
    setError(null);
    try {
      await cssService.mergeCustomers({
        primaryCustomerId: mergePrimaryCustomerId,
        secondaryCustomerId: mergeSecondaryCustomerId
      });
      setMergeSecondaryCustomerId('');
      await Promise.all([refreshCssCustomers(), refreshActivities(), refreshMeta()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore merge clienti');
    } finally {
      setMergingCustomers(false);
    }
  };

  const onMigrateLegacyCustomers = async () => {
    setMigratingLegacyCustomers(true);
    setCustomerMigrationSummary(null);
    setError(null);
    try {
      const legacyIndex = loadCustomerIndex();
      const legacyCustomerNames = uniqueCanonical(
        legacyIndex
          .map((entry) => (entry.name ?? '').trim())
          .filter((name) => name.length > 0)
      );
      const existingCustomers = await cssService.listCustomers();
      const existingKeys = new Set(
        existingCustomers.items.map((customer) => normalizeCustomerKey(customer.name))
      );

      let imported = 0;
      let skipped = 0;
      const failed: string[] = [];

      for (const customerName of legacyCustomerNames) {
        const key = normalizeCustomerKey(customerName);
        if (!key || existingKeys.has(key)) {
          skipped += 1;
          continue;
        }
        try {
          await cssService.createCustomer({ name: customerName, isActive: true });
          existingKeys.add(key);
          imported += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Errore sconosciuto';
          if (message.toLowerCase().includes('già esistente')) {
            skipped += 1;
            existingKeys.add(key);
          } else {
            failed.push(`${customerName}: ${message}`);
          }
        }
      }

      await Promise.all([refreshCssCustomers(), refreshMeta()]);
      setCustomerMigrationSummary(
        `Migrazione legacy completata: ${imported} importati, ${skipped} già presenti, ${failed.length} errori.`
      );
      if (failed.length > 0) {
        setError(`Errori migrazione clienti legacy: ${failed.slice(0, 3).join(' | ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore migrazione clienti legacy');
    } finally {
      setMigratingLegacyCustomers(false);
    }
  };

  const renderSortLabel = (label: string, key: SortKey): string => {
    if (sortBy !== key) return label;
    return `${label} ${sortDirection === 'asc' ? '↑' : '↓'}`;
  };
  const normalizedActivityCustomers = useMemo(
    () =>
      new Set(
        activities
          .map((activity) => normalizeCustomerKey(activity.customerName ?? ''))
          .filter((value) => value.length > 0)
      ),
    [activities]
  );
  const uniqueCustomersCount = useMemo(
    () => uniqueCanonical(activities.map((activity) => (activity.customerName ?? '').trim()).filter((name) => name.length > 0)).length,
    [activities]
  );
  const backendCustomersNotInActivities = useMemo(
    () =>
      cssCustomers.filter(
        (customer) =>
          !normalizedActivityCustomers.has(normalizeCustomerKey(customer.name))
      ),
    [cssCustomers, normalizedActivityCustomers]
  );

  return (
    <div
      className={`space-y-6 ${isWideMode ? 'relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-4 sm:px-6' : ''}`}
    >
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
                {showColumnPanel ? 'Chiudi colonne' : 'Mostra colonne'}
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

            <div ref={tableScrollRef} className={`overflow-x-auto overflow-y-auto rounded-xl border border-border bg-card ${isWideMode ? 'max-h-[76vh]' : 'max-h-[58vh]'}`}>
              <table
                className="table-fixed text-left text-sm whitespace-nowrap [&_input.ul-input]:!text-inherit [&_select.ul-input]:!text-inherit [&_textarea.ul-textarea]:!text-inherit"
                style={{ width: tableTotalWidth }}
              >
            <colgroup>
              <col style={{ width: CHECKBOX_COLUMN_WIDTH }} />
              {COLUMN_DEFINITIONS.filter((column) => isColumnVisible(column.key)).map((column) => (
                <col key={column.key} style={{ width: COLUMN_WIDTHS[column.key] }} />
              ))}
              <col style={{ width: ACTIONS_COLUMN_WIDTH }} />
            </colgroup>
            <thead className="sticky top-0 z-10 border-y border-border bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
              <tr>
                <th className="w-12 bg-slate-50 px-3 py-3 dark:bg-slate-900">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={(event) => onSelectAll(event.target.checked)}
                    aria-label="Seleziona tutte le righe"
                  />
                </th>
                {isColumnVisible('customer') && (
                  <th className="bg-slate-50 px-3 py-3 dark:bg-slate-900">
                    <div className="flex items-center gap-1">
                      <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('customerName')}>
                        {renderSortLabel('Customer', 'customerName')}
                      </button>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('customer')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('lastUpdate') && (
                  <th className="px-3 py-3">
                    <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('lastUpdate')}>
                      {renderSortLabel('Last Update', 'lastUpdate')}
                    </button>
                  </th>
                )}
                {isColumnVisible('blBu') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('blBu')}>
                        {renderSortLabel('BLs/BUs', 'blBu')}
                      </button>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('blBu')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('issue') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('issue')}>
                        {renderSortLabel('Issue', 'issue')}
                      </button>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('issue')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('issueStatus') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('issueStatus')}>
                        {renderSortLabel('Issue Status', 'issueStatus')}
                      </button>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('issueStatus')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('listStatus') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>Status (Lista)</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('listStatus')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('details') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>Details</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('details')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('cssOwner') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" className="hover:text-foreground" onClick={() => onToggleSort('cssOwner')}>
                        {renderSortLabel('CSS Owner', 'cssOwner')}
                      </button>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('cssOwner')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('eosOwners') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>EOS Owners</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('eosOwners')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('customerOwners') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>Customer Owners</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('customerOwners')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('cssAction') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>CSS Action</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('cssAction')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('notes') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>Notes</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('notes')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('customerPriority') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>Customer Priority</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('customerPriority')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('cssPriority') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>CSS Priority</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('cssPriority')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('dueDate') && <th className="px-3 py-3">Due Date</th>}
                {isColumnVisible('rating') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>Rating (0-5)</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('rating')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                {isColumnVisible('itemType') && (
                  <th className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <span>Item Type</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openColumnEditor('itemType')} title="Modifica opzioni colonna">
                        ⚙
                      </button>
                    </div>
                  </th>
                )}
                <th className="px-3 py-3">Azioni</th>
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
              {sortedActivities.map((activity, index) => {
                const isEditingChoice = (field: EditableChoiceField) =>
                  choiceEditor?.activityId === activity.activityId && choiceEditor.field === field;
                const normalizedBlBu = normalizeChoiceValue(activity.blBu);
                const normalizedIssueStatus = normalizeChoiceValue(activity.issueStatus);
                const normalizedListStatus = normalizeChoiceValue(activity.listStatus);
                const normalizedCustomerPriority = normalizeChoiceValue(activity.customerPriority);
                const normalizedCssPriority = normalizeChoiceValue(activity.cssPriority);
                const currentGroupLabel = groupBy ? getGroupLabel(activity, groupBy) : '';
                const previousGroupLabel =
                  groupBy && index > 0 ? getGroupLabel(sortedActivities[index - 1], groupBy) : '';
                const showGroupHeader = Boolean(groupBy) && currentGroupLabel !== previousGroupLabel;
                return ([
                showGroupHeader ? (
                  <tr key={`${activity.activityId}-group`} className="border-t border-border bg-muted/30">
                    <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" colSpan={tableColSpan}>
                      {currentGroupLabel} ({groupCountsByLabel.get(currentGroupLabel) ?? 0})
                    </td>
                  </tr>
                ) : null,
                <tr
                  key={activity.activityId}
                  className={`border-t border-border/70 align-top transition-colors ${inlineEditId === activity.activityId ? 'bg-blue-50 dark:bg-blue-950/30' : 'cursor-pointer even:bg-slate-50/50 hover:bg-slate-50 dark:even:bg-slate-900/20 dark:hover:bg-slate-900/30'}`}
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
                          <select className={`ul-input h-9 w-full ${getChoiceSelectClassName('blBu', inlineEdit.blBu, resolveChoiceColor('blBu', inlineEdit.blBu))}`} value={inlineEdit.blBu} onChange={(event) => setInlineEdit((prev) => ({ ...prev, blBu: event.target.value }))}>
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
                          <select className={`ul-input h-9 w-full ${getChoiceSelectClassName('issueStatus', inlineEdit.issueStatus, resolveChoiceColor('issueStatus', inlineEdit.issueStatus))}`} value={inlineEdit.issueStatus} onChange={(event) => setInlineEdit((prev) => ({ ...prev, issueStatus: event.target.value }))}>
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
                          <select className={`ul-input h-9 w-full ${getChoiceSelectClassName('listStatus', inlineEdit.listStatus, resolveChoiceColor('listStatus', inlineEdit.listStatus))}`} value={inlineEdit.listStatus} onChange={(event) => setInlineEdit((prev) => ({ ...prev, listStatus: event.target.value }))}>
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
                            className="block w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-border bg-muted/20 px-3 py-2 text-left hover:bg-muted/35"
                            onClick={(event) => {
                              event.stopPropagation();
                              openNotesEditor({ ...activity, notes: inlineEdit.notes || null });
                            }}
                            title={(inlineEdit.notes || '').trim() || 'Modifica notes'}
                          >
                            {(inlineEdit.notes || '').trim() ? inlineEdit.notes : 'Modifica notes'}
                          </button>
                        </td>
                      )}
                      {isColumnVisible('customerPriority') && (
                        <td className="px-3 py-2">
                          <select className={`ul-input h-9 w-full ${getChoiceSelectClassName('customerPriority', inlineEdit.customerPriority, resolveChoiceColor('customerPriority', inlineEdit.customerPriority))}`} value={inlineEdit.customerPriority} onChange={(event) => setInlineEdit((prev) => ({ ...prev, customerPriority: event.target.value }))}>
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
                          <select className={`ul-input h-9 w-full ${getChoiceSelectClassName('cssPriority', inlineEdit.cssPriority, resolveChoiceColor('cssPriority', inlineEdit.cssPriority))}`} value={inlineEdit.cssPriority} onChange={(event) => setInlineEdit((prev) => ({ ...prev, cssPriority: event.target.value }))}>
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
                      {isColumnVisible('customer') && (
                        <td className="bg-background px-3 py-2 font-medium">
                          <span className="block overflow-hidden text-ellipsis whitespace-nowrap" title={activity.customerName}>
                            {activity.customerName}
                          </span>
                        </td>
                      )}
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
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${getChoiceChipClassName('blBu', normalizedBlBu, resolveChoiceColor('blBu', normalizedBlBu))}`}
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
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${getChoiceChipClassName('issueStatus', normalizedIssueStatus, resolveChoiceColor('issueStatus', normalizedIssueStatus))}`}
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
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${getChoiceChipClassName('listStatus', normalizedListStatus, resolveChoiceColor('listStatus', normalizedListStatus))}`}
                              onClick={() => setChoiceEditor({ activityId: activity.activityId, field: 'listStatus' })}
                              title="Clicca per cambiare Status lista"
                            >
                              {normalizedListStatus || '-'}
                            </button>
                          )}
                        </td>
                      )}
                      {isColumnVisible('details') && (
                        <td className="px-3 py-2">
                          <span className="block overflow-hidden text-ellipsis whitespace-nowrap" title={activity.details ?? '-'}>
                            {activity.details ?? '-'}
                          </span>
                        </td>
                      )}
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
                              className="block w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-left text-sm font-semibold text-slate-700"
                              onClick={() => setChoiceEditor({ activityId: activity.activityId, field: 'cssOwner' })}
                              title={activity.cssOwner ?? 'Clicca per cambiare CSS Owner'}
                            >
                              {activity.cssOwner ?? '-'}
                            </button>
                          )}
                        </td>
                      )}
                      {isColumnVisible('eosOwners') && (
                        <td className="px-3 py-2">
                          <span className="block overflow-hidden text-ellipsis whitespace-nowrap" title={activity.eosOwners ?? '-'}>
                            {activity.eosOwners ?? '-'}
                          </span>
                        </td>
                      )}
                      {isColumnVisible('customerOwners') && <td className="px-3 py-2">{activity.customerOwners ?? '-'}</td>}
                      {isColumnVisible('cssAction') && <td className="px-3 py-2">{activity.cssAction ?? '-'}</td>}
                      {isColumnVisible('notes') && (
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              openNotesEditor(activity);
                            }}
                            title={activity.notes ?? 'Modifica notes'}
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
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${getChoiceChipClassName('customerPriority', normalizedCustomerPriority, resolveChoiceColor('customerPriority', normalizedCustomerPriority))}`}
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
                              className={`rounded-full px-3 py-1 text-sm font-semibold ${getChoiceChipClassName('cssPriority', normalizedCssPriority, resolveChoiceColor('cssPriority', normalizedCssPriority))}`}
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
              ]);
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
            <datalist id="css-customers-options">
              {customerOptions.map((customer) => (
                <option key={customer} value={customer} />
              ))}
            </datalist>
            <datalist id="css-owners-options">
              {cssOwnerOptions.map((owner) => (
                <option key={owner} value={owner} />
              ))}
            </datalist>
            <datalist id="css-issue-options">
              {issueOptions.map((issue) => (
                <option key={issue} value={issue} />
              ))}
            </datalist>
            <datalist id="css-blbu-options">
              {blBuOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <datalist id="css-item-type-options">
              {itemTypeOptions.map((itemType) => (
                <option key={itemType} value={itemType} />
              ))}
            </datalist>
            <datalist id="css-list-status-options">
              {listStatusOptions.map((status) => (
                <option key={status} value={status} />
              ))}
            </datalist>
            <datalist id="css-issue-status-options">
              {issueStatusOptions.map((status) => (
                <option key={status} value={status} />
              ))}
            </datalist>
            <datalist id="css-priority-options">
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority} />
              ))}
            </datalist>
          </div>
        </ModernListsLayout>
      </section>

      <section className="ul-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Gestione clienti (integrata in CSS)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              I record CSS sono attività: qui la gestione usa l'anagrafica unificata backend (`css_customers`).
            </p>
          </div>
          <button
            type="button"
            className="ul-button ul-button-ghost"
            onClick={() => setShowCustomerManagement((prev) => !prev)}
          >
            {showCustomerManagement ? 'Nascondi' : 'Apri gestione clienti'}
          </button>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Clienti unici da attività: {uniqueCustomersCount} • Clienti anagrafica backend: {cssCustomers.length} • Attività totali: {activities.length}
        </div>
        {showCustomerManagement && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="rounded-xl border border-border/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">Migrazione clienti legacy (localStorage)</div>
                  <div className="text-xs text-muted-foreground">
                    Importa in backend i clienti storici come attivi, evitando duplicati.
                  </div>
                </div>
                <button
                  type="button"
                  className="ul-button ul-button-ghost"
                  onClick={() => void onMigrateLegacyCustomers()}
                  disabled={migratingLegacyCustomers}
                >
                  {migratingLegacyCustomers ? 'Migrazione...' : 'Importa clienti legacy'}
                </button>
              </div>
              {customerMigrationSummary && (
                <div className="mt-2 text-xs text-muted-foreground">{customerMigrationSummary}</div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                className="ul-input"
                placeholder="Nuovo cliente..."
                value={newCustomerName}
                onChange={(event) => setNewCustomerName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void onCreateCssCustomer();
                  }
                }}
              />
              <button
                type="button"
                className="ul-button ul-button-primary"
                onClick={() => void onCreateCssCustomer()}
                disabled={creatingCustomer}
              >
                {creatingCustomer ? 'Creazione...' : 'Aggiungi cliente'}
              </button>
            </div>

            <div className="rounded-xl border border-border/60 p-3">
              <div className="mb-2 text-sm font-medium">Merge clienti (deduplica)</div>
              <div className="grid gap-2 md:grid-cols-3">
                <select
                  className="ul-input"
                  value={mergePrimaryCustomerId}
                  onChange={(event) => setMergePrimaryCustomerId(event.target.value)}
                >
                  <option value="">Cliente primario (da mantenere)</option>
                  {cssCustomers.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <select
                  className="ul-input"
                  value={mergeSecondaryCustomerId}
                  onChange={(event) => setMergeSecondaryCustomerId(event.target.value)}
                >
                  <option value="">Cliente secondario (da unire)</option>
                  {cssCustomers.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ul-button ul-button-ghost"
                  onClick={() => void onMergeCssCustomers()}
                  disabled={mergingCustomers}
                >
                  {mergingCustomers ? 'Merge...' : 'Esegui merge'}
                </button>
              </div>
            </div>

            {loadingCssCustomers ? (
              <div className="text-sm text-muted-foreground">Caricamento clienti...</div>
            ) : (
              <div className="space-y-2">
                {cssCustomers.map((customer) => (
                  <div key={customer.customerId} className="rounded-xl border border-border/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {editingCustomerId === customer.customerId ? (
                          <input
                            className="ul-input"
                            value={editingCustomerName}
                            onChange={(event) => setEditingCustomerName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                void onSaveCssCustomer();
                              }
                            }}
                          />
                        ) : (
                          <div className="font-medium">{customer.name}</div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          Attività collegate: {customer.activityCount} • Stato: {customer.isActive ? 'Attivo' : 'Inattivo'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingCustomerId === customer.customerId ? (
                          <>
                            <button type="button" className="ul-button ul-button-primary" onClick={() => void onSaveCssCustomer()} disabled={savingCustomer}>
                              Salva
                            </button>
                            <button type="button" className="ul-button ul-button-ghost" onClick={() => setEditingCustomerId(null)}>
                              Annulla
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="ul-button ul-button-ghost" onClick={() => startEditCssCustomer(customer)}>
                              Modifica nome
                            </button>
                            <button
                              type="button"
                              className="ul-button ul-button-ghost"
                              onClick={() => void onToggleCssCustomerActive(customer)}
                              disabled={savingCustomer}
                            >
                              {customer.isActive ? 'Disattiva' : 'Riattiva'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {cssCustomers.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nessun cliente in anagrafica backend.</div>
                )}
              </div>
            )}

            {backendCustomersNotInActivities.length > 0 && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50/40 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                Clienti anagrafici senza attività associate: {backendCustomersNotInActivities.map((customer) => customer.name).join(', ')}
              </div>
            )}
          </div>
        )}
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
              <input
                className="ul-input"
                placeholder="Customer"
                list="css-customers-options"
                value={activityForm.customerName}
                onChange={(event) => setActivityForm((prev) => ({ ...prev, customerName: event.target.value }))}
                required
              />
              <input className="ul-input" placeholder="Issue" list="css-issue-options" value={activityForm.issue} onChange={(event) => setActivityForm((prev) => ({ ...prev, issue: event.target.value }))} required />
              <input
                className={`ul-input ${getChoiceSelectClassName('listStatus', activityForm.listStatus, resolveChoiceColor('listStatus', activityForm.listStatus))}`}
                placeholder="Status (Lista)"
                list="css-list-status-options"
                value={activityForm.listStatus}
                onChange={(event) => setActivityForm((prev) => ({ ...prev, listStatus: event.target.value }))}
              />
              <input
                className={`ul-input ${getChoiceSelectClassName('issueStatus', activityForm.issueStatus, resolveChoiceColor('issueStatus', activityForm.issueStatus))}`}
                placeholder="Issue Status"
                list="css-issue-status-options"
                value={activityForm.issueStatus}
                onChange={(event) => setActivityForm((prev) => ({ ...prev, issueStatus: event.target.value }))}
                required
              />
              <input
                className="ul-input"
                placeholder="CSS Owner"
                list="css-owners-options"
                value={activityForm.cssOwner}
                onChange={(event) => setActivityForm((prev) => ({ ...prev, cssOwner: event.target.value }))}
              />
              <input className="ul-input" placeholder="EOS Owners" value={activityForm.eosOwners} onChange={(event) => setActivityForm((prev) => ({ ...prev, eosOwners: event.target.value }))} />
              <input className="ul-input" placeholder="Customer Owners" value={activityForm.customerOwners} onChange={(event) => setActivityForm((prev) => ({ ...prev, customerOwners: event.target.value }))} />
              <input
                className={`ul-input ${getChoiceSelectClassName('blBu', activityForm.blBu, resolveChoiceColor('blBu', activityForm.blBu))}`}
                placeholder="BLs/BUs"
                list="css-blbu-options"
                value={activityForm.blBu}
                onChange={(event) => setActivityForm((prev) => ({ ...prev, blBu: event.target.value }))}
              />
              <input className="ul-input" placeholder="CSS Action" value={activityForm.cssAction} onChange={(event) => setActivityForm((prev) => ({ ...prev, cssAction: event.target.value }))} />
              <input
                className={`ul-input ${getChoiceSelectClassName('customerPriority', activityForm.customerPriority, resolveChoiceColor('customerPriority', activityForm.customerPriority))}`}
                placeholder="Customer Priority"
                list="css-priority-options"
                value={activityForm.customerPriority}
                onChange={(event) => setActivityForm((prev) => ({ ...prev, customerPriority: event.target.value }))}
              />
              <input
                className={`ul-input ${getChoiceSelectClassName('cssPriority', activityForm.cssPriority, resolveChoiceColor('cssPriority', activityForm.cssPriority))}`}
                placeholder="CSS Priority"
                list="css-priority-options"
                value={activityForm.cssPriority}
                onChange={(event) => setActivityForm((prev) => ({ ...prev, cssPriority: event.target.value }))}
              />
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
              <input
                className="ul-input"
                placeholder="Item Type"
                list="css-item-type-options"
                value={activityForm.itemType}
                onChange={(event) => setActivityForm((prev) => ({ ...prev, itemType: event.target.value }))}
              />
            </div>
            <div className="mt-3 grid gap-3">
              <textarea className="ul-textarea min-h-24" placeholder="Details" value={activityForm.details} onChange={(event) => setActivityForm((prev) => ({ ...prev, details: event.target.value }))} />
              <textarea className="ul-textarea min-h-20" placeholder="Notes" value={activityForm.notes} onChange={(event) => setActivityForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Nuova attività: compila i campi e salva. Le opzioni delle colonne si gestiscono dall'intestazione tabella.
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

      {columnEditor && (
        <div className="fixed inset-0 z-50 bg-black/25" onClick={closeColumnEditor}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold">Modifica colonna</h3>
                <p className="text-sm text-muted-foreground">{CHOICE_COLUMN_LABELS[columnEditor]}</p>
              </div>
              <button type="button" className="ul-button ul-button-ghost h-9 px-3 text-sm" onClick={closeColumnEditor}>Chiudi</button>
            </div>

            <div className="space-y-3">
              <input
                className="ul-input h-10"
                placeholder={`Nuova opzione ${CHOICE_COLUMN_LABELS[columnEditor]}`}
                value={columnEditorNewOption}
                onChange={(event) => setColumnEditorNewOption(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    upsertChoiceOption();
                  }
                }}
              />
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 text-xs font-medium text-muted-foreground">Colore nuova opzione</div>
                <div className="flex flex-wrap gap-2">
                  {BLBU_COLOR_OPTIONS.map((option) => {
                    const selected = columnEditorNewColor === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`h-7 w-7 rounded-full border border-white/70 shadow-sm transition hover:scale-105 ${getBlBuSwatchClassName(option.value)} ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        onClick={() => setColumnEditorNewColor(option.value)}
                        aria-label={`Colore ${option.label}`}
                        title={option.label}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" className="ul-button ul-button-primary h-10 px-4" onClick={upsertChoiceOption}>
                  Aggiungi
                </button>
              </div>
              <input
                className="ul-input h-10"
                placeholder="Cerca opzione..."
                value={columnEditorQuery}
                onChange={(event) => setColumnEditorQuery(event.target.value)}
              />
              <div className="text-xs text-muted-foreground">
                Opzioni attive: {activeColumnOptions.length} • Nascoste: {activeHiddenOptions.length}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {filteredColumnEditorOptions.map((option) => {
                const actualIndex = activeColumnOptions.findIndex((item) => normalizeToken(item) === normalizeToken(option));
                const color = resolveChoiceColor(columnEditor, option) ?? getDerivedChoiceColor(columnEditor, option) ?? 'violet';
                const canMoveUp = actualIndex > 0;
                const canMoveDown = actualIndex < activeColumnOptions.length - 1;
                return (
                  <div key={option} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${getBlBuColorClassName(color)}`}>{option}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" className="ul-button ul-button-ghost h-8 px-2 text-xs disabled:opacity-40" disabled={!canMoveUp} onClick={() => moveChoiceOption(columnEditor, option, 'up')}>↑</button>
                        <button type="button" className="ul-button ul-button-ghost h-8 px-2 text-xs disabled:opacity-40" disabled={!canMoveDown} onClick={() => moveChoiceOption(columnEditor, option, 'down')}>↓</button>
                        <button type="button" className="ul-button ul-button-ghost h-8 px-3 text-xs text-red-600" onClick={() => hideChoiceOption(columnEditor, option)}>Elimina</button>
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg border border-border bg-muted/20 p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Colore:</span>
                        {BLBU_COLOR_OPTIONS.map((choice) => {
                          const selected = color === choice.value;
                          return (
                            <button
                              key={choice.value}
                              type="button"
                              className={`h-6 w-6 rounded-full border border-white/70 shadow-sm transition hover:scale-105 ${getBlBuSwatchClassName(choice.value)} ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                              onClick={() => setChoiceOptionColor(columnEditor, option, choice.value)}
                              aria-label={`Colore ${choice.label}`}
                              title={choice.label}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredColumnEditorOptions.length === 0 && (
                <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">Nessuna opzione trovata.</div>
              )}
            </div>

            {activeHiddenOptions.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opzioni nascoste</div>
                  <button type="button" className="ul-button ul-button-ghost h-7 px-2 text-xs" onClick={() => restoreAllHiddenChoiceOptions(columnEditor)}>
                    Ripristina tutte
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeHiddenOptions.map((option) => (
                    <button key={option} type="button" className="ul-button ul-button-ghost h-8 px-3 text-xs" onClick={() => restoreChoiceOption(columnEditor, option)}>
                      Ripristina: {option}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
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
