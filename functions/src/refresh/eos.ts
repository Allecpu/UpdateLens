import * as cheerio from 'cheerio';
import { uploadSnapshot, updateManifest } from '../shared/blobStorage.js';
import {
  todayStamp,
  monthStamp,
  slugify,
  normalizeText,
  parseDateFull
} from '../shared/utils.js';
import type { EosReleaseItem, Snapshot, RefreshResult } from '../shared/types.js';

const SOURCE_URL =
  'https://docs.eos-solutions.it/it/docs/apps-func/whats-new-eos-apps.html';

const monthMap: Record<string, number> = {
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  novembre: 11,
  dicembre: 12
};

const parseAvailability = (text: string): string => {
  const normalized = text.toLowerCase();

  // Match DD/MM/YYYY or DD.MM.YYYY
  const dayMatch = normalized.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (dayMatch) {
    const year = dayMatch[3];
    const month = String(Number(dayMatch[2])).padStart(2, '0');
    return `${year}-${month}`;
  }

  // Match YYYY-MM or YYYY/MM
  const dateMatch = normalized.match(/(20\d{2})[-/](\d{1,2})/);
  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = String(Number(dateMatch[2])).padStart(2, '0');
    return `${year}-${month}`;
  }

  // Match Italian month names
  const monthMatch = normalized.match(
    /(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})/
  );
  if (monthMatch) {
    const month = String(monthMap[monthMatch[1]]).padStart(2, '0');
    return `${monthMatch[2]}-${month}`;
  }

  return monthStamp();
};

const parseEosDateFull = (text: string): string | null => {
  const normalized = text.toLowerCase();
  const dayMatch = normalized.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (!dayMatch) return null;

  const day = String(Number(dayMatch[1])).padStart(2, '0');
  const month = String(Number(dayMatch[2])).padStart(2, '0');
  const year = dayMatch[3];
  return `${year}-${month}-${day}`;
};

const extractItems = (html: string): EosReleaseItem[] => {
  const $ = cheerio.load(html);
  const items: EosReleaseItem[] = [];
  const seen = new Set<string>();

  $('main table tbody tr').each((_idx, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) return;

    const appCell = $(cells[0]);
    const appName = appCell.text().replace(/\s+/g, ' ').trim();
    const code = $(cells[1]).text().replace(/\s+/g, ' ').trim();
    const description = $(cells[2]).text().replace(/\s+/g, ' ').trim();
    const dateText = $(cells[3]).text().replace(/\s+/g, ' ').trim();
    const bcVersionText = $(cells[4]).text().replace(/\s+/g, ' ').trim();
    const link = appCell.find('a').attr('href') || SOURCE_URL;

    if (!appName || !description) return;

    const title = code ? `${appName} (${code})` : appName;
    const id = `eos-${slugify(title)}-${slugify(dateText)}`;
    if (seen.has(id)) return;
    seen.add(id);

    const fullDate = parseEosDateFull(dateText);
    const resolvedUrl = link.startsWith('http') ? link : `https://docs.eos-solutions.it${link}`;
    const minBcVersion = bcVersionText ? Number(bcVersionText) : null;

    items.push({
      id,
      source: 'EOS',
      product: 'EOS Apps',
      title,
      summary: description,
      status: 'Launched',
      availabilityDate: parseAvailability(dateText || appName),
      availabilityDateFull: fullDate ?? undefined,
      firstAvailableDate: fullDate ?? undefined,
      lastUpdatedDate: fullDate ?? undefined,
      minBcVersion: Number.isFinite(minBcVersion) ? minBcVersion : null,
      sourceUrl: resolvedUrl,
      url: resolvedUrl
    });
  });

  return items;
};

export const refreshEos = async (): Promise<RefreshResult> => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    console.log('[RefreshEOS] Fetching EOS whatsnew page...');
    const response = await fetch(SOURCE_URL, {
      headers: { 'User-Agent': 'UpdateLens/1.0 (+offline snapshot generator)' }
    });

    if (!response.ok) {
      throw new Error(`EOS fetch error: ${response.status}`);
    }

    const html = await response.text();

    console.log('[RefreshEOS] Extracting items...');
    const items = extractItems(html);

    const snapshot: Snapshot<EosReleaseItem> = {
      version: 1,
      items
    };

    const filename = `eos_whatsnew_${todayStamp()}.json`;

    console.log(`[RefreshEOS] Uploading snapshot: ${filename}`);
    await uploadSnapshot('eos', filename, snapshot);

    console.log('[RefreshEOS] Updating manifest...');
    await updateManifest({ eos: filename });

    const duration = Date.now() - startTime;
    console.log(`[RefreshEOS] Completed: ${items.length} items in ${duration}ms`);

    return {
      source: 'eos',
      status: 'ok',
      itemCount: items.length,
      duration,
      timestamp,
      filename
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[RefreshEOS] Error: ${errorMessage}`);

    return {
      source: 'eos',
      status: 'failed',
      itemCount: null,
      duration,
      timestamp,
      error: errorMessage
    };
  }
};
