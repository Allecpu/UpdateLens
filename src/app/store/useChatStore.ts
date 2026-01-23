import { create } from 'zustand';

import type { FilterState } from '../../models/Filters';
import type { ReleaseItem } from '../../models/ReleaseItem';

const HISTORY_KEY = 'updatelens.chat.history';
const MAX_HISTORY = 10;

export type ChatMessage = {
  id: string;
  type: 'user' | 'bot';
  text: string;
  items?: ReleaseItem[];
  showPreview?: boolean;
  canApplyFilters?: boolean;
  filterPatch?: Partial<FilterState>;
};

type ChatState = {
  isOpen: boolean;
  messages: ChatMessage[];
  queryHistory: string[];
  toggleChat: () => void;
  closeChat: () => void;
  addMessage: (message: Omit<ChatMessage, 'id'>) => void;
  addToHistory: (query: string) => void;
  clearHistory: () => void;
};

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const loadHistory = (): string[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw) as string[];
    }
  } catch {
    // ignore
  }
  return [];
};

const saveHistory = (history: string[]): void => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
};

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  messages: [],
  queryHistory: loadHistory(),
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  closeChat: () => set({ isOpen: false }),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, id: createMessageId() }]
    })),
  addToHistory: (query) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || normalized.length < 3) return;

    const current = get().queryHistory;
    // Remove duplicates and add to front
    const filtered = current.filter(q => q.toLowerCase() !== normalized);
    const updated = [query.trim(), ...filtered].slice(0, MAX_HISTORY);
    saveHistory(updated);
    set({ queryHistory: updated });
  },
  clearHistory: () => {
    localStorage.removeItem(HISTORY_KEY);
    set({ queryHistory: [] });
  }
}));
