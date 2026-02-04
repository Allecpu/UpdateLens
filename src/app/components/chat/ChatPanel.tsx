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
import { queryChatBackend } from '../../../services/ChatBackendService';
import { trackChatMetric } from '../../../services/ChatTelemetryService';
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
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  const chatBackendEnabled = env?.VITE_CHAT_BACKEND_ENABLED === 'true';
  const chatAzureEnabled = env?.VITE_CHAT_AZURE_LLM_ENABLED === 'true';
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
      if (isProcessing) return;
      if (!chatBackendEnabled && !metadata) return;

      addMessage({
        type: 'user',
        text
      });
      addToHistory(text);
      trackChatMetric('query_submitted', {
        length: text.length,
        searchScope
      });
      setIsProcessing(true);

      setTimeout(() => {
        const run = async () => {
          const baseFilters =
            searchScope === 'all' ? DEFAULT_FILTERS : (cssFilters ?? DEFAULT_FILTERS);

          if (chatBackendEnabled) {
            try {
              const backendResponse = await queryChatBackend({
                message: text,
                searchScope,
                baseFilters,
                preferAzure: chatAzureEnabled,
                topK: 5
              });
              addMessage({
                type: 'bot',
                text: backendResponse.message,
                items: backendResponse.items,
                showPreview: backendResponse.showPreview,
                canApplyFilters: backendResponse.canApplyFilters,
                filterPatch: backendResponse.filterPatch
              });
              trackChatMetric('response_received', {
                engine: backendResponse.engine,
                fallbackUsed: backendResponse.fallbackUsed,
                hasItems: backendResponse.items.length > 0
              });
              return;
            } catch (error) {
              trackChatMetric('response_error', {
                stage: 'backend',
                message: error instanceof Error ? error.message : String(error)
              });
              console.warn('[Chat] Backend non disponibile, uso fallback locale.', error);
            }
          }

          if (!metadata) {
            addMessage({
              type: 'bot',
              text: 'Dati chat in caricamento, riprova tra qualche secondo.'
            });
            return;
          }

          const intent = parseIntent(text, metadata);
          const appliedFilters: FilterState =
            intent.type === 'RESET_FILTERS'
              ? DEFAULT_FILTERS
              : {
                  ...baseFilters,
                  ...intent.filterPatch
                };
          const filtered = filterReleaseItems(items, appliedFilters);
          const response = generateResponse(intent, filtered, items.length);

          addMessage({
            type: 'bot',
            text: response.message,
            items: response.items,
            showPreview: response.showPreview,
            canApplyFilters: response.canApplyFilters,
            filterPatch: intent.filterPatch
          });
          trackChatMetric('response_received', {
            engine: 'local',
            hasItems: response.items.length > 0,
            intentType: intent.type
          });
        };

        void run().finally(() => {
          setIsProcessing(false);
        });
      }, 0);
    },
    [
      metadata,
      items,
      cssFilters,
      searchScope,
      addMessage,
      addToHistory,
      isProcessing,
      chatBackendEnabled,
      chatAzureEnabled
    ]
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
      trackChatMetric('filters_applied', {
        isReset,
        filterKeys: Object.keys(filterPatch)
      });

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
