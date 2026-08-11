import { create } from 'zustand';

export interface ListTemplate {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'system' | 'custom';
}

export interface ListControl {
  disablePersonalLists: boolean;
  allowedSites: string[];
  disabledTemplates: string[];
  hiddenColumns: string[];
  defaultFilters: Record<string, string[]>;
}

interface ListControlsStore {
  controls: ListControl;
  templates: ListTemplate[];
  
  // Actions
  togglePersonalLists: (disabled: boolean) => void;
  toggleTemplate: (templateId: string, enabled: boolean) => void;
  toggleColumn: (columnName: string) => void;
  setDefaultFilter: (filterKey: string, values: string[]) => void;
  addSite: (siteName: string) => void;
  removeSite: (siteName: string) => void;
  
  // Getters
  isTemplateEnabled: (templateId: string) => boolean;
  isColumnVisible: (columnName: string) => boolean;
  getEnabledTemplates: () => ListTemplate[];
}

const DEFAULT_TEMPLATES: ListTemplate[] = [
  {
    id: 'css-activities',
    name: 'CSS - Attività Clienti',
    description: 'Traccia attività CSS e issues con clienti',
    enabled: true,
    category: 'system',
  },
  {
    id: 'proposals',
    name: 'CSS - Proposte',
    description: 'Gestisci proposte commerciali CSS',
    enabled: true,
    category: 'system',
  },
];

export const useListControlsStore = create<ListControlsStore>((set, get) => ({
  controls: {
    disablePersonalLists: false,
    allowedSites: ['EOS', 'Shared'],
    disabledTemplates: [],
    hiddenColumns: [],
    defaultFilters: {
      'Issue Status': ['Action required'],
      'Customer': [],
    },
  },
  templates: DEFAULT_TEMPLATES,

  togglePersonalLists: (disabled: boolean) =>
    set((state) => ({
      controls: { ...state.controls, disablePersonalLists: disabled },
    })),

  toggleTemplate: (templateId: string, enabled: boolean) =>
    set((state) => ({
      controls: {
        ...state.controls,
        disabledTemplates: enabled
          ? state.controls.disabledTemplates.filter((id) => id !== templateId)
          : [...state.controls.disabledTemplates, templateId],
      },
      templates: state.templates.map((t) =>
        t.id === templateId ? { ...t, enabled } : t
      ),
    })),

  toggleColumn: (columnName: string) =>
    set((state) => ({
      controls: {
        ...state.controls,
        hiddenColumns: state.controls.hiddenColumns.includes(columnName)
          ? state.controls.hiddenColumns.filter((c) => c !== columnName)
          : [...state.controls.hiddenColumns, columnName],
      },
    })),

  setDefaultFilter: (filterKey: string, values: string[]) =>
    set((state) => ({
      controls: {
        ...state.controls,
        defaultFilters: {
          ...state.controls.defaultFilters,
          [filterKey]: values,
        },
      },
    })),

  addSite: (siteName: string) =>
    set((state) => ({
      controls: {
        ...state.controls,
        allowedSites: state.controls.allowedSites.includes(siteName)
          ? state.controls.allowedSites
          : [...state.controls.allowedSites, siteName],
      },
    })),

  removeSite: (siteName: string) =>
    set((state) => ({
      controls: {
        ...state.controls,
        allowedSites: state.controls.allowedSites.filter((s) => s !== siteName),
      },
    })),

  isTemplateEnabled: (templateId: string) => {
    return !get().controls.disabledTemplates.includes(templateId);
  },

  isColumnVisible: (columnName: string) => {
    return !get().controls.hiddenColumns.includes(columnName);
  },

  getEnabledTemplates: () => {
    return get().templates.filter((t) => t.enabled);
  },
}));
