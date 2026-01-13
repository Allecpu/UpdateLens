import * as cheerio from 'cheerio';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL =
  'https://docs.eos-solutions.it/it/docs/apps-func/whats-new-eos-apps.html';

type ReleaseItem = {
  id: string;
  source: 'EOS';
  product: string;
  title: string;
  summary: string;
  status: 'Planned' | 'Rolling out' | 'Launched' | 'Unknown';
  availabilityDate: string;
  availabilityDateFull?: string;
  firstAvailableDate?: string;
  lastUpdatedDate?: string;
  minBcVersion?: number | null;
  sourceUrl?: string | null;
  url: string;
};

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

const monthStamp = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const todayStamp = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}_${month}_${day}`;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const parseAvailability = (text: string): string => {
  const normalized = text.toLowerCase();
  const dayMatch = normalized.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (dayMatch) {
    const year = dayMatch[3];
    const month = String(Number(dayMatch[2])).padStart(2, '0');
    return `${year}-${month}`;
  }
  const dateMatch = normalized.match(/(20\d{2})[-/](\d{1,2})/);
  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = String(Number(dateMatch[2])).padStart(2, '0');
    return `${year}-${month}`;
  }

  const monthMatch = normalized.match(
    /(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(20\d{2})/
  );
  if (monthMatch) {
    const month = String(monthMap[monthMatch[1]]).padStart(2, '0');
    return `${monthMatch[2]}-${month}`;
  }

  return monthStamp();
};

const parseDateFull = (text: string): string | null => {
  const normalized = text.toLowerCase();
  const dayMatch = normalized.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (!dayMatch) {
    return null;
  }
  const day = String(Number(dayMatch[1])).padStart(2, '0');
  const month = String(Number(dayMatch[2])).padStart(2, '0');
  const year = dayMatch[3];
  return `${year}-${month}-${day}`;
};

const extractItems = (html: string): ReleaseItem[] => {
  const $ = cheerio.load(html);
  const items: ReleaseItem[] = [];
  const seen = new Set<string>();

  $('main table tbody tr').each((_idx, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) {
      return;
    }
    const appCell = $(cells[0]);
    const appName = appCell.text().replace(/\s+/g, ' ').trim();
    const code = $(cells[1]).text().replace(/\s+/g, ' ').trim();
    const description = $(cells[2]).text().replace(/\s+/g, ' ').trim();
    const dateText = $(cells[3]).text().replace(/\s+/g, ' ').trim();
    const bcVersionText = $(cells[4]).text().replace(/\s+/g, ' ').trim();
    const link = appCell.find('a').attr('href') || SOURCE_URL;

    if (!appName || !description) {
      return;
    }
    const title = code ? `${appName} (${code})` : appName;
    const id = `eos-${slugify(title)}-${slugify(dateText)}`;
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    const fullDate = parseDateFull(dateText);
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

type LatestManifest = {
  microsoft?: string;
  eos?: string;
};

const readManifest = async (filePath: string): Promise<LatestManifest> => {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as LatestManifest;
  } catch {
    return {};
  }
};

const writeManifest = async (filePath: string, updates: LatestManifest): Promise<void> => {
  const current = await readManifest(filePath);
  const next = { ...current, ...updates };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2), 'utf-8');
};

const run = async (): Promise<void> => {
  const response = await fetch(SOURCE_URL, {
    headers: {
      'User-Agent': 'UpdateLens/1.0 (+offline snapshot generator)'
    }
  });
  if (!response.ok) {
    throw new Error(`EOS fetch error: ${response.status}`);
  }
  const html = await response.text();
  const items = extractItems(html);

  const payload = {
    version: 1,
    items
  };

  const filename = `eos_whatsnew_${todayStamp()}.json`;
  const outputPath = path.resolve('src', 'data', 'snapshots', filename);
  const publicPath = path.resolve('public', 'data', filename);
  await mkdir(path.dirname(publicPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
  await writeFile(publicPath, JSON.stringify(payload, null, 2), 'utf-8');
  await writeManifest(path.resolve('public', 'data', 'latest.json'), {
    eos: filename
  });
  await writeManifest(path.resolve('src', 'data', 'snapshots', 'latest.json'), {
    eos: filename
  });
  console.log(`Snapshot EOS salvata: ${outputPath} (${items.length} items)`);
};

run().catch((error) => {
  console.error('Errore refresh EOS:', error);
  process.exitCode = 1;
});
