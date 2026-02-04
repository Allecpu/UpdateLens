import { useEffect, useRef, useMemo, useCallback } from 'react';
import type { ChatMessage as ChatMessageData, ChatTab, SearchScope } from '../../store/useChatStore';
import ChatMessage from './ChatMessage';
import ChatInput, { type ChatInputHandle } from './ChatInput';
import ChatHistoryPanel from './ChatHistoryPanel';
import ChatHelpPanel from './ChatHelpPanel';

type QuickReply = {
  label: string;
  text: string;
};

const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { label: 'Fabric + GA 30gg', text: 'Fabric ultimi 30 giorni in GA' },
  { label: 'EOS preview', text: 'EOS in preview' },
  { label: 'Quanti elementi?', text: 'quanti elementi ci sono?' },
  { label: 'Reset filtri', text: 'mostra tutto' }
];

/**
 * Truncate text to max length with ellipsis
 */
const truncate = (text: string, maxLen: number): string => {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
};

type ChatWindowProps = {
  messages: ChatMessageData[];
  queryHistory: string[];
  activeTab: ChatTab;
  searchScope: SearchScope;
  activeFilterCount: number;
  isProcessing?: boolean;
  onClose: () => void;
  onClearChat: () => void;
  onSend: (text: string) => void;
  onApplyFilters: (filterPatch: Partial<Record<string, unknown>>) => void;
  onSetActiveTab: (tab: ChatTab) => void;
  onSetSearchScope: (scope: SearchScope) => void;
  onDeleteFromHistory: (query: string) => void;
  onClearHistory: () => void;
};

const TAB_LABELS: Record<ChatTab, { icon: string; label: string }> = {
  chat: { icon: '💬', label: 'Chat' },
  history: { icon: '📜', label: 'Cronologia' },
  help: { icon: '❓', label: 'Help' }
};

const ChatWindow = ({
  messages,
  queryHistory,
  activeTab,
  searchScope,
  activeFilterCount,
  isProcessing = false,
  onClose,
  onClearChat,
  onSend,
  onApplyFilters,
  onSetActiveTab,
  onSetSearchScope,
  onDeleteFromHistory,
  onClearHistory
}: ChatWindowProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputHandle>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle selecting a query from history or help examples
  // Automatically switches to chat tab and sends the message
  const handleSelectQuery = useCallback((query: string) => {
    // Debounce protection against double-clicks
    if (isProcessingRef.current) return;

    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    isProcessingRef.current = true;

    // Switch to chat tab first
    onSetActiveTab('chat');

    // Send the query immediately
    onSend(trimmedQuery);

    // Reset debounce flag after a short delay
    setTimeout(() => {
      isProcessingRef.current = false;
    }, 300);
  }, [onSetActiveTab, onSend]);

  const handleApplyFilters = (message: ChatMessageData) => {
    if (message.filterPatch) {
      onApplyFilters(message.filterPatch);
    }
  };

  // Build quick replies: mix history and defaults
  const quickReplies = useMemo(() => {
    const historyReplies: QuickReply[] = queryHistory.slice(0, 2).map(q => ({
      label: truncate(q, 16),
      text: q
    }));

    // Get defaults that aren't in history
    const historyTexts = new Set(queryHistory.map(q => q.toLowerCase()));
    const filteredDefaults = DEFAULT_QUICK_REPLIES
      .filter(r => !historyTexts.has(r.text.toLowerCase()))
      .slice(0, 4 - historyReplies.length);

    return [...historyReplies, ...filteredDefaults];
  }, [queryHistory]);

  return (
    <div className="flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="font-semibold">Assistente UpdateLens</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClearChat}
            className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Azzera chat"
          >
            Azzera chat
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Chiudi chat"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        {(['chat', 'history', 'help'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onSetActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {TAB_LABELS[tab].icon} {TAB_LABELS[tab].label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && (
        <>
          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onApplyFilters={() => handleApplyFilters(message)}
              />
            ))}
            {/* Typing indicator */}
            {isProcessing && (
              <div className="flex justify-start" role="status" aria-live="polite" aria-label="Assistente in elaborazione">
                <div className="min-w-[120px] rounded-2xl rounded-bl-md border border-border/70 bg-muted px-4 py-3">
                  <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                    Assistente sta elaborando...
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary/80" style={{ animationDelay: '0ms' }} />
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary/70" style={{ animationDelay: '150ms' }} />
                    <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary/60" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
              {queryHistory.length > 0 && (
                <span className="w-full text-[10px] text-muted-foreground mb-1">
                  Recenti:
                </span>
              )}
              {quickReplies.map((reply, index) => (
                <button
                  key={`${reply.text}-${index}`}
                  type="button"
                  onClick={() => onSend(reply.text)}
                  className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {reply.label}
                </button>
              ))}
            </div>
          )}

          {/* Search Scope Toggle */}
          <div className="border-t border-border px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">🔍 Cerca in:</span>
              <div className="flex rounded-lg border border-border bg-muted/30">
                <button
                  type="button"
                  onClick={() => onSetSearchScope('current')}
                  className={`px-2 py-1 rounded-l-lg transition-colors ${
                    searchScope === 'current'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  Filtri attuali
                </button>
                <button
                  type="button"
                  onClick={() => onSetSearchScope('all')}
                  className={`px-2 py-1 rounded-r-lg transition-colors ${
                    searchScope === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  Tutti
                </button>
              </div>
            </div>
            {searchScope === 'current' && activeFilterCount > 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {activeFilterCount} filtri attivi
              </p>
            )}
          </div>

          {/* Input */}
          <ChatInput ref={inputRef} onSend={onSend} disabled={isProcessing} />
        </>
      )}

      {activeTab === 'history' && (
        <ChatHistoryPanel
          history={queryHistory}
          onSelectQuery={handleSelectQuery}
          onDeleteQuery={onDeleteFromHistory}
          onClearAll={onClearHistory}
        />
      )}

      {activeTab === 'help' && (
        <ChatHelpPanel onSelectExample={handleSelectQuery} />
      )}
    </div>
  );
};

export default ChatWindow;
