import * as cheerio from 'cheerio';
import { dedupeCaseInsensitive, extractCountriesFromText } from '../src/utils/geographyBase';

export const extractCountriesFromHtmlNode = (html: string): string[] => {
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
