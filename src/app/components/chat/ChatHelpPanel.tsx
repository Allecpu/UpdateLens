type HelpSection = {
  title: string;
  description: string;
  examples: Array<{
    query: string;
    explanation: string;
  }>;
};

const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'Cosa puoi chiedermi',
    description: 'Scrivi in linguaggio naturale, capisco italiano e inglese',
    examples: [
      { query: 'Fabric ultimi 30 giorni', explanation: 'Novità Fabric recenti' },
      { query: 'Business Central in GA', explanation: 'BC già disponibili' },
      { query: 'Teams in preview', explanation: 'Teams in anteprima' },
      { query: 'quanti elementi ci sono?', explanation: 'Conta risultati' },
    ]
  },
  {
    title: 'Esempi di ricerca',
    description: 'Clicca su un esempio per provarlo',
    examples: [
      { query: 'EOS wave 1 2025', explanation: 'EOS Solutions wave 1' },
      { query: 'Power Platform pianificato', explanation: 'Funzionalità future' },
      { query: 'da gennaio a marzo 2024', explanation: 'Periodo specifico' },
      { query: 'mostra tutto', explanation: 'Reset filtri' },
    ]
  }
];

const TIPS = [
  'Puoi combinare più criteri: "Fabric in GA ultimi 30 giorni"',
  'Usa "wave 1" o "wave 2" per filtrare per release wave',
  'Scrivi "mostra tutto" per rimuovere i filtri',
];

type ChatHelpPanelProps = {
  onSelectExample: (query: string) => void;
};

const ChatHelpPanel = ({ onSelectExample }: ChatHelpPanelProps) => {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Come usare l'assistente</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Scrivi quello che cerchi in linguaggio naturale
        </p>
      </div>

      {/* Sections */}
      <div className="flex-1 px-4 py-3 space-y-4">
        {HELP_SECTIONS.map((section) => (
          <div key={section.title}>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {section.title}
            </h4>
            <div className="space-y-1.5">
              {section.examples.map((example) => (
                <button
                  key={example.query}
                  type="button"
                  onClick={() => onSelectExample(example.query)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted group"
                >
                  <span className="text-sm text-foreground group-hover:text-primary">
                    "{example.query}"
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {example.explanation}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Tips */}
        <div className="pt-2 border-t border-border">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Suggerimenti
          </h4>
          <ul className="space-y-1.5">
            {TIPS.map((tip, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ChatHelpPanel;
