import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '../../store/useChatStore';
import { useFilterStore } from '../../store/useFilterStore';
import type { FilterState } from '../../../models/Filters';
import type { ReleaseItem } from '../../../models/ReleaseItem';
import { loadAllSnapshots } from '../../../services/DataLoader';
import { buildFilterMetadata, type FilterMetadata } from '../../../services/FilterMetadata';
import { filterReleaseItems } from '../../../services/FilterService';
import { parseIntent } from '../../../services/ChatIntentService';
import { generateResponse, getWelcomeMessage } from '../../../services/ChatResponseService';
import ChatToggleButton from './ChatToggleButton';
import ChatWindow from './ChatWindow';

const DEFAULT_FILTERS: FilterState = {
  targetCustomerIds: [],
  targetGroupIds: [],
  targetCssOwners: [],
  products: [],
  sources: [],
  statuses: [],
  categories: [],
  tags: [],
  waves: [],
  months: [],
  availabilityTypes: [],
  enabledFor: [],
  geography: [],
  language: [],
  bcVersions: [],
  periodNewDays: 0,
  periodChangedDays: 0,
  releaseInDays: 0,
  minBcVersionMin: null,
  releaseDateFrom: '',
  releaseDateTo: '',
  sortOrder: 'newest',
  query: '',
  horizonMonths: 12,
  historyMonths: 6
};

const ChatPanel = () => {
  const navigate = useNavigate();
  const {
    isOpen,
    messages,
    queryHistory,
    activeTab,
    searchScope,
    toggleChat,
    closeChat,
    addMessage,
    addToHistory,
    deleteFromHistory,
    clearHistory,
    setActiveTab,
    setSearchScope
  } = useChatStore();
  const { cssFilters, setChatFilters, clearChatFilters } = useFilterStore();

  const [items, setItems] = useState<ReleaseItem[]>([]);
  const [metadata, setMetadata] = useState<FilterMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load data on first open
  useEffect(() => {
    if (isOpen && items.length === 0 && !isLoading) {
      setIsLoading(true);
      loadAllSnapshots()
        .then((result) => {
          setItems(result.items);
          setMetadata(buildFilterMetadata(result.items));
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, items.length, isLoading]);

  // Add welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addMessage({
        type: 'bot',
        text: getWelcomeMessage()
      });
    }
  }, [isOpen, messages.length, addMessage]);

  const handleSend = useCallback(
    (text: string) => {
      if (!metadata || isProcessing) return;

      // Add user message and save to history immediately
      addMessage({
        type: 'user',
        text
      });
      addToHistory(text);

      // Show processing state
      setIsProcessing(true);

      // Defer heavy operations to next tick to allow UI to update
      setTimeout(() => {
        try {
          // Parse intent (NLP processing)
          const intent = parseIntent(text, metadata);

          // Get base filters based on search scope
          const baseFilters = searchScope === 'all'
            ? DEFAULT_FILTERS
            : (cssFilters ?? DEFAULT_FILTERS);

          // Apply filter patch
          let appliedFilters: FilterState;
          if (intent.type === 'RESET_FILTERS') {
            appliedFilters = DEFAULT_FILTERS;
          } else {
            appliedFilters = {
              ...baseFilters,
              ...intent.filterPatch
            };
          }

          // Filter items (O(n) operation)
          const filtered = filterReleaseItems(items, appliedFilters);

          // Generate response
          const response = generateResponse(intent, filtered, items.length);

          // Add bot message
          addMessage({
            type: 'bot',
            text: response.message,
            items: response.items,
            showPreview: response.showPreview,
            canApplyFilters: response.canApplyFilters,
            filterPatch: intent.filterPatch
          });
        } finally {
          setIsProcessing(false);
        }
      }, 0);
    },
    [metadata, items, cssFilters, searchScope, addMessage, addToHistory, isProcessing]
  );

  // Calculate number of active filters
  const activeFilterCount = useMemo(() => {
    if (!cssFilters) return 0;

    let count = 0;
    const arrayFields: (keyof FilterState)[] = [
      'targetCustomerIds', 'targetGroupIds', 'targetCssOwners',
      'products', 'sources', 'statuses', 'categories', 'tags',
      'waves', 'months', 'availabilityTypes', 'enabledFor',
      'geography', 'language', 'bcVersions'
    ];

    for (const field of arrayFields) {
      const value = cssFilters[field];
      if (Array.isArray(value) && value.length > 0) {
        count++;
      }
    }

    // Also count non-empty string/number filters
    if (cssFilters.query && cssFilters.query.trim() !== '') count++;
    if (cssFilters.periodNewDays && cssFilters.periodNewDays > 0) count++;
    if (cssFilters.periodChangedDays && cssFilters.periodChangedDays > 0) count++;
    if (cssFilters.releaseInDays && cssFilters.releaseInDays > 0) count++;
    if (cssFilters.releaseDateFrom && cssFilters.releaseDateFrom !== '') count++;
    if (cssFilters.releaseDateTo && cssFilters.releaseDateTo !== '') count++;

    return count;
  }, [cssFilters]);

  const handleApplyFilters = useCallback(
    (filterPatch: Partial<FilterState>) => {
      // Check if this is a reset
      const isReset = Object.keys(filterPatch).length === 0;

      if (isReset) {
        // Clear chat filters - dashboard will show base filters
        clearChatFilters();
      } else {
        // Set chat filters as temporary overlay (does NOT modify global filters)
        setChatFilters(filterPatch);
      }

      closeChat();
      navigate('/');
    },
    [setChatFilters, clearChatFilters, closeChat, navigate]
  );

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-4">
          <ChatWindow
            messages={messages}
            queryHistory={queryHistory}
            activeTab={activeTab}
            searchScope={searchScope}
            activeFilterCount={activeFilterCount}
            isProcessing={isProcessing}
            onClose={closeChat}
            onSend={handleSend}
            onApplyFilters={handleApplyFilters}
            onSetActiveTab={setActiveTab}
            onSetSearchScope={setSearchScope}
            onDeleteFromHistory={deleteFromHistory}
            onClearHistory={clearHistory}
          />
        </div>
      )}
      <div className="flex justify-end">
        <ChatToggleButton isOpen={isOpen} onClick={toggleChat} />
      </div>
    </div>
  );
};

export default ChatPanel;
