import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageData } from '../../store/useChatStore';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

type QuickReply = {
  label: string;
  text: string;
};

const QUICK_REPLIES: QuickReply[] = [
  { label: 'Novità Fabric', text: 'novità per Fabric' },
  { label: 'GA ultimi 30gg', text: 'novità in GA' },
  { label: 'Ultimi 7 giorni', text: 'ultimi 7 giorni' },
  { label: 'Reset filtri', text: 'mostra tutto' }
];

type ChatWindowProps = {
  messages: ChatMessageData[];
  onClose: () => void;
  onSend: (text: string) => void;
  onApplyFilters: (filterPatch: Partial<Record<string, unknown>>) => void;
};

const ChatWindow = ({
  messages,
  onClose,
  onSend,
  onApplyFilters
}: ChatWindowProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleApplyFilters = (message: ChatMessageData) => {
    if (message.filterPatch) {
      onApplyFilters(message.filterPatch);
    }
  };

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

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onApplyFilters={() => handleApplyFilters(message)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
          {QUICK_REPLIES.map((reply) => (
            <button
              key={reply.label}
              type="button"
              onClick={() => onSend(reply.text)}
              className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              {reply.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={onSend} />
    </div>
  );
};

export default ChatWindow;
