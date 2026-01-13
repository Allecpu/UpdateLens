import { dedupeCaseInsensitive, extractCountriesFromText, normalizeCountry } from './geographyBase';

export const extractCountriesFromHtml = (html: string): string[] => {
  if (!html) {
    return [];
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const listItems = Array.from(doc.querySelectorAll('li'));
  const textChunks = listItems.length
    ? listItems.map((node) => node.textContent ?? '')
    : [doc.body?.textContent ?? ''];

  const countries = textChunks.flatMap((chunk) => extractCountriesFromText(chunk));
  return dedupeCaseInsensitive(countries);
};

export { normalizeCountry };
