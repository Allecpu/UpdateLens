type ChatHistoryPanelProps = {
  history: string[];
  onSelectQuery: (query: string) => void;
  onDeleteQuery: (query: string) => void;
  onClearAll: () => void;
};

const ChatHistoryPanel = ({
  history,
  onSelectQuery,
  onDeleteQuery,
  onClearAll
}: ChatHistoryPanelProps) => {
  if (history.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 text-4xl">📭</div>
        <p className="text-sm font-medium text-foreground">Nessuna ricerca recente</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Le tue ricerche appariranno qui
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Le tue ricerche recenti</h3>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-2">
        {history.map((query, index) => (
          <div
            key={`${query}-${index}`}
            className="group flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 transition-colors hover:bg-muted"
          >
            <button
              type="button"
              onClick={() => onSelectQuery(query)}
              className="flex-1 text-left text-sm text-foreground"
            >
              {query}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteQuery(query);
              }}
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
              aria-label={`Elimina "${query}"`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
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
        ))}
      </div>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={onClearAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span>🗑️</span>
          Cancella cronologia
        </button>
      </div>
    </div>
  );
};

export default ChatHistoryPanel;
