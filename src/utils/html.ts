const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  laquo: '«',
  raquo: '»',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ograve: 'ò',
  ugrave: 'ù',
  igrave: 'ì'
};

/**
 * Decodifica le entita' HTML in testo semplice.
 *
 * Le sorgenti Microsoft restituiscono i titoli con le entita' gia' codificate
 * (es. `l&#39;agente di ricerca`): senza decodifica finiscono cosi' come sono
 * nei documenti esportati, dove non esiste alcun browser a interpretarle.
 */
export const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      const decoded = NAMED_ENTITIES[name.toLowerCase()];
      return decoded ?? match;
    });
