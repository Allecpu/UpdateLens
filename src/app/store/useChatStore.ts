import { create } from 'zustand';

import type { FilterState } from '../../models/Filters';
import type { ReleaseItem } from '../../models/ReleaseItem';

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
  toggleChat: () => void;
  closeChat: () => void;
  addMessage: (message: Omit<ChatMessage, 'id'>) => void;
};

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const useChatStore = create<ChatState>((set) => ({
  isOpen: false,
  messages: [],
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  closeChat: () => set({ isOpen: false }),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, id: createMessageId() }]
    }))
}));
