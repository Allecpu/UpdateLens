/**
 * Token di brand EOS Solutions per la generazione di presentazioni.
 *
 * Fonte: Brand Book EOS Solutions (https://eos-docs.azurewebsites.net/brandbook/).
 * In caso di conflitto il Brand Book ufficiale prevale su questo file.
 *
 * Nota sui colori: pptxgenjs vuole hex a 6 cifre SENZA '#'.
 */

/** Palette ufficiale. Par. 1 del Brand Book. */
export const EOS_COLORS = {
  /** Primario. Titoli, bande, accenti, numeri KPI. */
  orange: 'F08019',
  /** Neutro scuro. Corpo testo e fondi scuri. */
  brown: '382F2D',
  /** Accento freddo. */
  cyan: '00B0E8',
  /** Accento scuro freddo. */
  slate: '485870',
  /** Neutro chiaro. Fondi, separatori, righe alternate. */
  lightGrey: 'E7E6E6',
  white: 'FFFFFF'
} as const;

/**
 * Serie colori per i grafici, nell'ordine prescritto dal par. 5 del Brand Book.
 * Punto di configurazione unico: per ripiegare sui soli primari basta ridurre
 * questo array a [orange, brown] e aggiungere varianti di luminosita'.
 */
export const EOS_CHART_SERIES: readonly string[] = [
  EOS_COLORS.orange,
  EOS_COLORS.slate,
  EOS_COLORS.cyan,
  EOS_COLORS.brown
];

/**
 * Tipografia.
 *
 * I font brand (Humble per i titoli, Open Sans per il corpo) NON sono
 * incorporabili in un .pptx: pptxgenjs non ha API di embedding e il formato
 * richiederebbe subsetting con licenza. Humble e' un font custom EOS che nessun
 * destinatario ha installato: dichiararlo produrrebbe una sostituzione
 * silenziosa di PowerPoint con metriche imprevedibili e testo fuori dai box.
 *
 * Si usa quindi Calibri, che e' esattamente il fallback prescritto dal par. 2
 * del Brand Book ed e' presente su ogni installazione Office. Cambiare qui se
 * in futuro i font brand verranno distribuiti ai destinatari.
 */
export const EOS_FONTS = {
  heading: 'Calibri',
  body: 'Calibri'
} as const;

/** Corpi in punti. Par. 2 del Brand Book, colonna PowerPoint. */
export const EOS_FONT_SIZES = {
  coverTitle: 36,
  coverSubtitle: 22,
  slideTitle: 26,
  sectionLabel: 14,
  kpiValue: 40,
  kpiLabel: 13,
  body: 16,
  caption: 12
} as const;

/** Geometria slide, in pollici (LAYOUT_16x9 = 13.333 x 7.5). */
export const EOS_LAYOUT = {
  slideW: 13.333,
  slideH: 7.5,
  marginX: 0.6,
  /** Banda titolo in alto sulle slide di contenuto. */
  titleBandH: 0.95,
  /** Prima riga utile del contenuto, sotto la banda. */
  contentTop: 1.35,
  /** Logo in angolo fisso sulle slide di contenuto. Area di rispetto inclusa. */
  logo: { x: 11.45, y: 0.22, w: 1.35, h: 0.34 },
  /** Logo grande su cover e closing. */
  logoLarge: { x: 0.6, y: 0.6, w: 2.8, h: 0.7 },
  footerY: 7.0
} as const;

/** Claim ufficiale. Par. 11 del Brand Book. */
export const EOS_CLAIM = 'Digital Systems | Human Feelings';

/** Dati di contatto per la slide di chiusura. Par. 11 del Brand Book. */
export const EOS_CONTACT = {
  company: 'EOS Solutions',
  address: 'Via G. Di Vittorio 23, I-39100 Bolzano/Bozen',
  phone: '+39 0471 319650',
  web: 'www.eos-solutions.it'
} as const;

/** Vincoli di densita' imposti dal par. 5 del Brand Book. */
export const EOS_DENSITY = {
  maxBulletsPerSlide: 6
} as const;
