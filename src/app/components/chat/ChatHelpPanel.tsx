import { useState } from 'react';

type HelpCategory = {
  id: string;
  icon: string;
  title: string;
  description: string;
  examples: string[];
};

const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'product',
    icon: '📦',
    title: 'Filtri Prodotto',
    description: 'Filtra per prodotto specifico',
    examples: ['Fabric', 'Business Central', 'Teams', 'Power Platform']
  },
  {
    id: 'time',
    icon: '📅',
    title: 'Filtri Temporali',
    description: 'Cerca per periodo di tempo',
    examples: ['ultimi 30 giorni', 'da gennaio a marzo 2024', 'wave 1 2024', 'wave 2 2025']
  },
  {
    id: 'availability',
    icon: '🚀',
    title: 'Disponibilità',
    description: 'Filtra per stato disponibilità',
    examples: ['in GA', 'in preview', 'anteprima pubblica']
  },
  {
    id: 'status',
    icon: '📊',
    title: 'Stato Rilascio',
    description: 'Filtra per stato di rilascio',
    examples: ['lanciato', 'pianificato', 'in sviluppo']
  },
  {
    id: 'source',
    icon: '🏢',
    title: 'Sorgente',
    description: 'Filtra per fonte dati',
    examples: ['Microsoft', 'EOS', 'Fabric']
  },
  {
    id: 'combined',
    icon: '🔗',
    title: 'Combinazioni',
    description: 'Combina più filtri insieme',
    examples: ['Fabric ultimi 30 giorni in GA', 'EOS in preview wave 2', 'Teams pianificato 2024']
  },
  {
    id: 'analytics',
    icon: '📈',
    title: 'Analytics',
    description: 'Ottieni informazioni e statistiche',
    examples: ['quanti elementi?', 'confronta Fabric con EOS', 'trend Microsoft']
  },
  {
    id: 'reset',
    icon: '🔄',
    title: 'Reset',
    description: 'Reimposta i filtri',
    examples: ['mostra tutto', 'reset filtri']
  }
];

type ChatHelpPanelProps = {
  onSelectExample: (query: string) => void;
};

const ChatHelpPanel = ({ onSelectExample }: ChatHelpPanelProps) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('product');

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(prev => prev === categoryId ? null : categoryId);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Come posso aiutarti?</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Clicca su un esempio per inserirlo nella chat
        </p>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {HELP_CATEGORIES.map((category) => {
          const isExpanded = expandedCategory === category.id;

          return (
            <div key={category.id} className="rounded-lg">
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted/50"
              >
                <span>{category.icon}</span>
                <span className="flex-1">{category.title}</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {isExpanded && (
                <div className="px-3 pb-2">
                  <p className="mb-2 text-xs text-muted-foreground">{category.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {category.examples.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => onSelectExample(example)}
                        className="rounded-full bg-accent/50 px-3 py-1 text-xs transition-colors hover:bg-accent"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatHelpPanel;
