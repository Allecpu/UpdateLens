import type { ReleaseItem } from '../models/ReleaseItem';
import { isValidHttpUrl } from '../utils/url';
import { isReleasePlansUrl, isValidGuid } from '../utils/releaseplans';
import { downloadBlob } from '../exports/downloadBlob';
import { decodeHtmlEntities } from '../utils/html';

export type ItemLinks = {
  /** URL della fonte, oppure null se assente o non valido. */
  sourceUrl: string | null;
  /** URL della documentazione Microsoft Learn, oppure null. */
  docUrl: string | null;
};

/**
 * Risolve e valida i link di un item, con regole diverse per sorgente:
 * per Microsoft l'URL deve essere un Release Plans con GUID valido, per le
 * altre sorgenti basta un URL http(s) ben formato.
 *
 * Ritorna null invece di un testo di fallback, cosi' ogni formato di export
 * decide come presentare l'assenza del link.
 */
export const resolveItemLinks = (item: ReleaseItem): ItemLinks => {
  const sourceUrl =
    item.source === 'Microsoft'
      ? item.sourceUrl &&
        item.sourcePlanId &&
        isValidGuid(item.sourcePlanId) &&
        isReleasePlansUrl(item.sourceUrl)
        ? item.sourceUrl
        : null
      : item.sourceUrl && isValidHttpUrl(item.sourceUrl)
        ? item.sourceUrl
        : null;

  const docUrl =
    item.learnUrl && isValidHttpUrl(item.learnUrl) ? item.learnUrl : null;

  return { sourceUrl, docUrl };
};

/**
 * Etichetta prodotto sempre valorizzata.
 *
 * 391 item su 3813 (le release plans Microsoft) hanno `product` ma non
 * `productName`: usando direttamente `productName` i raggruppamenti finivano
 * sotto la chiave letterale "undefined".
 */
export const resolveProductLabel = (item: ReleaseItem): string =>
  item.productName || item.product || 'Altro';

/**
 * Data di disponibilita' con catena di fallback.
 *
 * Gli stessi item privi di `productName` sono anche privi di `releaseDate`, ma
 * hanno `availabilityDateFull` valorizzata: senza fallback l'export mostrava
 * "data non disponibile" su ogni riga.
 */
export const resolveItemDate = (item: ReleaseItem): string | null =>
  item.releaseDate ||
  item.availabilityDateFull ||
  item.availabilityDate ||
  item.firstAvailableDate ||
  null;

export const groupByProduct = (items: ReleaseItem[]): Record<string, ReleaseItem[]> => {
  return items.reduce((acc, item) => {
    const label = resolveProductLabel(item);
    if (!acc[label]) {
      acc[label] = [];
    }
    acc[label].push(item);
    return acc;
  }, {} as Record<string, ReleaseItem[]>);
};

export const buildMarkdown = (items: ReleaseItem[], customerName: string): string => {
  const grouped = groupByProduct(items);
  const lines: string[] = [];

  lines.push(`# Release Update - ${customerName}`);
  lines.push('');

  Object.keys(grouped).forEach((product) => {
    lines.push(`## ${product}`);
    lines.push('');

    grouped[product].forEach((item) => {
      const links = resolveItemLinks(item);
      const sourceUrl = links.sourceUrl ?? 'Fonte non disponibile';
      const docUrl = links.docUrl ?? 'Documentazione non disponibile';
      lines.push(`- ${decodeHtmlEntities(item.title)}`);
      lines.push(`  - Stato: ${item.status}`);
      lines.push(`  - Data: ${resolveItemDate(item) ?? 'Data non disponibile'}`);
      lines.push(`  - Sintesi: ${decodeHtmlEntities(item.description ?? '')}`);
      lines.push(`  - Link: ${sourceUrl}`);
      lines.push(`  - Documentazione: ${docUrl}`);
    });

    lines.push('');
  });

  return lines.join('\n');
};

export const downloadMarkdown = (content: string, filename: string): void => {
  downloadBlob(
    new Blob([content], { type: 'text/markdown;charset=utf-8' }),
    filename
  );
};
