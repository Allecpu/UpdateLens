import type { ReleaseItem } from '../models/ReleaseItem';
import { isValidHttpUrl } from '../utils/url';
import { isReleasePlansUrl, isValidGuid } from '../utils/releaseplans';

const groupByProduct = (items: ReleaseItem[]): Record<string, ReleaseItem[]> => {
  return items.reduce((acc, item) => {
    if (!acc[item.productName]) {
      acc[item.productName] = [];
    }
    acc[item.productName].push(item);
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
      const sourceUrl =
        item.source === 'Microsoft' &&
        item.sourceUrl &&
        item.sourcePlanId &&
        isValidGuid(item.sourcePlanId) &&
        isReleasePlansUrl(item.sourceUrl)
          ? item.sourceUrl
          : item.source !== 'Microsoft' &&
              item.sourceUrl &&
              isValidHttpUrl(item.sourceUrl)
            ? item.sourceUrl
            : 'Fonte non disponibile';
      const docUrl =
        item.learnUrl && isValidHttpUrl(item.learnUrl)
          ? item.learnUrl
          : 'Documentazione non disponibile';
      lines.push(`- ${item.title}`);
      lines.push(`  - Stato: ${item.status}`);
      lines.push(`  - Data: ${item.releaseDate}`);
      lines.push(`  - Sintesi: ${item.description}`);
      lines.push(`  - Link: ${sourceUrl}`);
      lines.push(`  - Documentazione: ${docUrl}`);
    });

    lines.push('');
  });

  return lines.join('\n');
};

export const downloadMarkdown = (content: string, filename: string): void => {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
