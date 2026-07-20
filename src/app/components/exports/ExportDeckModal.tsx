import { useCallback, useMemo, useState } from 'react';
import type { ReleaseItem } from '../../../models/ReleaseItem';
import type { FilterState } from '../../../models/Filters';
import {
  buildDeckModel,
  downloadBlob,
  renderDeck,
  DEFAULT_DECK_SECTIONS,
  type DeckOptions,
  type DeckSections
} from '../../../exports';

type ExportDeckModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Item gia' filtrati e ordinati dalla Dashboard. */
  items: ReleaseItem[];
  filters: FilterState;
  customerName: string;
};

type SectionKey =
  | 'includeKpis'
  | 'includeFilterContext'
  | 'includeTopProducts'
  | 'includeProductSections'
  | 'includeItemDetails';

const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  {
    key: 'includeKpis',
    label: 'Sintesi KPI',
    hint: 'Totale aggiornamenti e ripartizione per fonte'
  },
  {
    key: 'includeFilterContext',
    label: 'Perimetro del report',
    hint: 'Filtri applicati, numero di aggiornamenti, data di generazione'
  },
  {
    key: 'includeTopProducts',
    label: 'Prodotti più interessati',
    hint: 'Grafico a barre con i primi 10 prodotti'
  },
  {
    key: 'includeProductSections',
    label: 'Novità per prodotto',
    hint: 'Una o più slide per prodotto, max 6 voci per slide'
  },
  {
    key: 'includeItemDetails',
    label: 'Dettaglio aggiornamenti',
    hint: 'Una slide per aggiornamento, con sintesi e link'
  }
];

const ExportDeckModal = ({
  isOpen,
  onClose,
  items,
  filters,
  customerName
}: ExportDeckModalProps) => {
  const [sections, setSections] = useState<DeckSections>({
    ...DEFAULT_DECK_SECTIONS
  });
  const [deckTitle, setDeckTitle] = useState('Release Update');
  const [subtitle, setSubtitle] = useState('Aggiornamenti e novità di prodotto');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo<DeckOptions>(
    () => ({
      ...sections,
      customerName: customerName || 'Cliente',
      deckTitle: deckTitle.trim() || 'Release Update',
      subtitle: subtitle.trim()
    }),
    [sections, customerName, deckTitle, subtitle]
  );

  // Il builder e' puro e veloce: lo si puo' invocare a ogni render per la stima.
  const estimatedSlides = useMemo(
    () => buildDeckModel(items, filters, options).slides.length,
    [items, filters, options]
  );

  const toggleSection = (key: SectionKey) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClose = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const model = buildDeckModel(items, filters, options);
      const blob = await renderDeck(model);
      downloadBlob(blob, model.fileName);
      handleClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Errore durante la generazione';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  const noSections = SECTIONS.every((section) => !sections[section.key]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 text-foreground shadow-2xl">
        <h3 className="mb-1 text-lg font-semibold">Esporta presentazione</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Genera un deck PowerPoint con l&apos;identità EOS Solutions per{' '}
          <span className="font-medium text-foreground">
            {customerName || 'Cliente'}
          </span>
          .
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Titolo
            </label>
            <input
              type="text"
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Sottotitolo
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="mt-5 mb-2 text-xs uppercase text-muted-foreground">
          Sezioni
        </div>
        <div className="space-y-2">
          {/* Copertina e chiusura sono richieste dal brand book EOS: mostrate
              come attive ma non disattivabili. */}
          <label className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-border p-3 opacity-60">
            <input type="checkbox" checked disabled className="mt-0.5" />
            <div>
              <div className="text-sm font-medium">Copertina e chiusura</div>
              <div className="text-xs text-muted-foreground">
                Sempre incluse: richieste dal brand book EOS
              </div>
            </div>
          </label>

          {SECTIONS.map((section) => (
            <label
              key={section.key}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/50"
            >
              <input
                type="checkbox"
                checked={sections[section.key]}
                onChange={() => toggleSection(section.key)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">{section.label}</div>
                <div className="text-xs text-muted-foreground">{section.hint}</div>
              </div>
            </label>
          ))}
        </div>

        {sections.includeItemDetails && (
          <div className="mt-3">
            <label className="mb-1 block text-xs text-muted-foreground">
              Numero massimo di slide di dettaglio
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={sections.maxItemDetailSlides}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                const clamped = Number.isNaN(parsed)
                  ? 1
                  : Math.min(60, Math.max(1, parsed));
                setSections((prev) => ({ ...prev, maxItemDetailSlides: clamped }));
              }}
              className="w-28 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-between rounded-lg bg-accent/40 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {items.length} aggiornamenti selezionati
          </span>
          <span className="font-medium">Slide stimate: {estimatedSlides}</span>
        </div>

        {noSections && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Nessuna sezione selezionata: il deck conterrà solo copertina e chiusura.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="ul-button ul-button-ghost text-xs"
          >
            Annulla
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="ul-button ul-button-primary text-xs"
          >
            {isGenerating ? 'Generazione...' : 'Genera PPTX'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDeckModal;
