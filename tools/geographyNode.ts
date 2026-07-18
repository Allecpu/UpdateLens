import * as cheerio from 'cheerio';
import { dedupeCaseInsensitive, extractCountriesFromText } from '../src/utils/geographyBase';

const normalizeHtmlInput = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => (typeof entry === 'string' ? [entry] : []))
      .join(' ');
  }
  return typeof value === 'string' ? value : '';
};

export const extractCountriesFromHtmlNode = (value: unknown): string[] => {
  const html = normalizeHtmlInput(value);
  if (!html) {
    return [];
  }
  const $ = cheerio.load(html);
  const listItems = $('li')
    .map((_, el) => $(el).text())
    .get();
  const textChunks = listItems.length ? listItems : [$.root().text()];
  const countries = textChunks.flatMap((chunk) => extractCountriesFromText(chunk));
  return dedupeCaseInsensitive(countries);
};
