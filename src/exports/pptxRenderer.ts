import type PptxGenJS from 'pptxgenjs';
import type { DeckModel, DeckSlide } from './deckModel';
import {
  EOS_CLAIM,
  EOS_COLORS,
  EOS_DENSITY,
  EOS_FONTS,
  EOS_FONT_SIZES,
  EOS_LAYOUT
} from './brandTokens';
import { EOS_LOGO_COLOR, EOS_LOGO_NEGATIVE } from './eosLogoBase64';

/** Costruttore di pptxgenjs, risolto a runtime. */
export type PptxCtor = new () => PptxGenJS;

/**
 * Interop ESM: il bundle ES di pptxgenjs espone il costruttore sotto
 * `.default`, mentre altri bundler lo restituiscono direttamente. Risolviamo
 * entrambi i casi, cosi' il modulo funziona sia in Vite sia in Node (tsx).
 */
export const resolvePptxCtor = (imported: unknown): PptxCtor => {
  const candidate = imported as { default?: unknown };
  const inner = (candidate?.default as { default?: unknown })?.default;
  return (inner ?? candidate?.default ?? imported) as PptxCtor;
};

type Slide = ReturnType<PptxGenJS['addSlide']>;

const CONTENT_W = EOS_LAYOUT.slideW - EOS_LAYOUT.marginX * 2;

/** Nome del layout custom 16:9 in formato wide. */
const EOS_LAYOUT_NAME = 'EOS_WIDE';

/** Master per le slide di contenuto: fondo chiaro, banda arancione, logo a colori. */
const MASTER_CONTENT = 'EOS_CONTENT';
/** Master per cover e closing: fondo marrone, logo negativo. */
const MASTER_DARK = 'EOS_DARK';

/**
 * Definisce gli slide master.
 *
 * Non e' solo pulizia: pptxgenjs incorpora una copia dell'immagine per OGNI
 * slide che la usa (51 slide = 51 copie del logo, ~420 KB di media inutili in
 * un file destinato all'email). Mettendo il logo e la banda nel master, la
 * risorsa viene memorizzata una volta sola. Corrisponde anche a quanto chiede
 * il par. 5 del Brand Book, che ragiona in termini di slide master.
 */
const defineMasters = (pptx: PptxGenJS): void => {
  pptx.defineSlideMaster({
    title: MASTER_CONTENT,
    background: { color: EOS_COLORS.white },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: EOS_LAYOUT.slideW,
          h: EOS_LAYOUT.titleBandH,
          fill: { color: EOS_COLORS.orange },
          line: { color: EOS_COLORS.orange }
        }
      },
      {
        image: {
          data: EOS_LOGO_COLOR,
          ...EOS_LAYOUT.logo,
          sizing: {
            type: 'contain',
            w: EOS_LAYOUT.logo.w,
            h: EOS_LAYOUT.logo.h
          }
        }
      }
    ]
  });

  pptx.defineSlideMaster({
    title: MASTER_DARK,
    background: { color: EOS_COLORS.brown },
    objects: [
      {
        image: {
          data: EOS_LOGO_NEGATIVE,
          ...EOS_LAYOUT.logoLarge,
          sizing: {
            type: 'contain',
            w: EOS_LAYOUT.logoLarge.w,
            h: EOS_LAYOUT.logoLarge.h
          }
        }
      }
    ]
  });
};

/**
 * Titolo (e sottotitolo) sulla banda del master di contenuto. Banda e logo
 * arrivano dal master, quindi qui resta solo il testo variabile.
 */
const applyChrome = (slide: Slide, title: string, subtitle?: string): void => {
  slide.addText(title, {
    x: EOS_LAYOUT.marginX,
    y: 0.12,
    w: CONTENT_W,
    h: 0.7,
    fontFace: EOS_FONTS.heading,
    fontSize: EOS_FONT_SIZES.slideTitle,
    bold: true,
    color: EOS_COLORS.white,
    valign: 'middle'
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: EOS_LAYOUT.marginX,
      y: EOS_LAYOUT.titleBandH + 0.08,
      w: CONTENT_W,
      h: 0.3,
      fontFace: EOS_FONTS.body,
      fontSize: EOS_FONT_SIZES.caption,
      color: EOS_COLORS.slate
    });
  }
};

const addFooter = (slide: Slide, index: number, total: number): void => {
  // A sinistra: il logo occupa l'angolo in basso a destra.
  slide.addText(`${index} / ${total}`, {
    x: EOS_LAYOUT.marginX,
    y: EOS_LAYOUT.footerY,
    w: 1.2,
    h: 0.3,
    fontFace: EOS_FONTS.body,
    fontSize: EOS_FONT_SIZES.caption,
    color: EOS_COLORS.slate,
    align: 'left'
  });
};

const renderCover = (slide: Slide, data: Extract<DeckSlide, { kind: 'cover' }>): void => {
  // Fondo marrone e logo negativo arrivano dal master EOS_DARK: su fondo scuro
  // il logo a colori e' vietato dal par. 3 del Brand Book.
  slide.addText(data.title, {
    x: EOS_LAYOUT.marginX,
    y: 2.6,
    w: CONTENT_W,
    h: 1.2,
    fontFace: EOS_FONTS.heading,
    fontSize: EOS_FONT_SIZES.coverTitle,
    bold: true,
    color: EOS_COLORS.white
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: EOS_LAYOUT.marginX,
      y: 3.9,
      w: CONTENT_W,
      h: 0.7,
      fontFace: EOS_FONTS.body,
      fontSize: EOS_FONT_SIZES.coverSubtitle,
      color: EOS_COLORS.orange
    });
  }

  slide.addShape('rect', {
    x: EOS_LAYOUT.marginX,
    y: 4.9,
    w: 2.2,
    h: 0.06,
    fill: { color: EOS_COLORS.orange },
    line: { color: EOS_COLORS.orange }
  });

  slide.addText(`${data.customerName}  ·  ${data.generatedAt}`, {
    x: EOS_LAYOUT.marginX,
    y: 5.15,
    w: CONTENT_W,
    h: 0.5,
    fontFace: EOS_FONTS.body,
    fontSize: EOS_FONT_SIZES.body,
    color: EOS_COLORS.lightGrey
  });
};

const renderKpi = (slide: Slide, data: Extract<DeckSlide, { kind: 'kpi' }>): void => {
  applyChrome(slide, data.title);

  const gap = 0.25;
  const count = data.tiles.length;
  const tileW = (CONTENT_W - gap * (count - 1)) / count;

  data.tiles.forEach((tile, index) => {
    const x = EOS_LAYOUT.marginX + index * (tileW + gap);
    slide.addShape('roundRect', {
      x,
      y: 2.3,
      w: tileW,
      h: 2.1,
      fill: { color: EOS_COLORS.lightGrey },
      line: { color: EOS_COLORS.lightGrey },
      rectRadius: 0.12
    });
    slide.addText(String(tile.value), {
      x,
      y: 2.6,
      w: tileW,
      h: 1.0,
      fontFace: EOS_FONTS.heading,
      fontSize: EOS_FONT_SIZES.kpiValue,
      bold: true,
      color: EOS_COLORS.orange,
      align: 'center'
    });
    slide.addText(tile.label, {
      x,
      y: 3.65,
      w: tileW,
      h: 0.5,
      fontFace: EOS_FONTS.body,
      fontSize: EOS_FONT_SIZES.kpiLabel,
      color: EOS_COLORS.brown,
      align: 'center'
    });
  });
};

const renderFilters = (
  slide: Slide,
  data: Extract<DeckSlide, { kind: 'filters' }>
): void => {
  applyChrome(slide, data.title);
  slide.addText(
    data.lines.map((line) => ({ text: line, options: { bullet: true } })),
    {
      x: EOS_LAYOUT.marginX,
      y: EOS_LAYOUT.contentTop + 0.2,
      w: CONTENT_W,
      h: 5.2,
      fontFace: EOS_FONTS.body,
      fontSize: EOS_FONT_SIZES.body,
      color: EOS_COLORS.brown,
      lineSpacingMultiple: 1.3,
      valign: 'top'
    }
  );
};

const renderTopProducts = (
  slide: Slide,
  data: Extract<DeckSlide, { kind: 'topProducts' }>
): void => {
  applyChrome(slide, data.title);

  // Altezza proporzionale al numero di barre: a piena altezza con due sole
  // categorie le barre diventano enormi e il grafico illeggibile.
  const availableH = EOS_LAYOUT.footerY - EOS_LAYOUT.contentTop - 0.2;
  const chartH = Math.min(availableH, Math.max(2, data.rows.length * 0.5 + 0.8));

  slide.addChart(
    'bar',
    [
      {
        name: 'Aggiornamenti',
        labels: data.rows.map((row) => row.label),
        values: data.rows.map((row) => row.count)
      }
    ],
    {
      x: EOS_LAYOUT.marginX,
      y: EOS_LAYOUT.contentTop,
      w: CONTENT_W,
      h: chartH,
      barGapWidthPct: 60,
      valGridLine: { style: 'none' },
      catGridLine: { style: 'none' },
      barDir: 'bar',
      // Serie unica: tutte le barre nel primario. EOS_CHART_SERIES serve
      // quando le serie sono davvero piu' di una, altrimenti colori diversi
      // suggerirebbero una distinzione di significato che non esiste.
      chartColors: [EOS_COLORS.orange],
      showValue: true,
      dataLabelColor: EOS_COLORS.brown,
      dataLabelFontFace: EOS_FONTS.body,
      dataLabelFontSize: EOS_FONT_SIZES.caption,
      catAxisLabelFontFace: EOS_FONTS.body,
      catAxisLabelFontSize: EOS_FONT_SIZES.caption,
      catAxisLabelColor: EOS_COLORS.brown,
      valAxisLabelFontFace: EOS_FONTS.body,
      valAxisLabelFontSize: EOS_FONT_SIZES.caption,
      valAxisLabelColor: EOS_COLORS.brown,
      showLegend: false
    }
  );
};

const renderBullets = (
  slide: Slide,
  data: Extract<DeckSlide, { kind: 'bullets' }>
): void => {
  applyChrome(slide, data.title, data.subtitle);

  const rows = data.bullets.slice(0, EOS_DENSITY.maxBulletsPerSlide);
  const texts: PptxGenJS.TextProps[] = [];

  rows.forEach((bullet) => {
    const meta = bullet.sub?.join(' · ') ?? '';
    const hasMeta = meta.length > 0;

    texts.push({
      text: bullet.text,
      options: {
        bullet: true,
        color: EOS_COLORS.brown,
        fontSize: EOS_FONT_SIZES.body,
        bold: hasMeta,
        hyperlink: bullet.link ? { url: bullet.link } : undefined,
        // Senza meta il punto elenco si chiude qui.
        breakLine: !hasMeta
      }
    });

    if (hasMeta) {
      // Stessa riga logica del titolo: una run separata con breakLine finale.
      // Metterla in un paragrafo a se' la faceva partire dal margine sinistro
      // invece che allineata al testo del punto elenco (indentLevel non viene
      // applicato ai paragrafi senza bullet).
      texts.push({
        text: `  —  ${meta}`,
        options: {
          color: EOS_COLORS.slate,
          fontSize: EOS_FONT_SIZES.caption,
          bold: false,
          breakLine: true
        }
      });
    }
  });

  slide.addText(texts, {
    x: EOS_LAYOUT.marginX,
    y: EOS_LAYOUT.contentTop + 0.25,
    w: CONTENT_W,
    h: 5.1,
    fontFace: EOS_FONTS.body,
    lineSpacingMultiple: 1.15,
    valign: 'top'
  });

  if (data.note) {
    slide.addText(data.note, {
      x: EOS_LAYOUT.marginX,
      y: EOS_LAYOUT.footerY - 0.35,
      w: CONTENT_W - 1.6,
      h: 0.3,
      fontFace: EOS_FONTS.body,
      fontSize: EOS_FONT_SIZES.caption,
      italic: true,
      color: EOS_COLORS.slate
    });
  }
};

const renderClosing = (
  slide: Slide,
  data: Extract<DeckSlide, { kind: 'closing' }>
): void => {
  slide.addText(data.claim, {
    x: EOS_LAYOUT.marginX,
    y: 2.9,
    w: CONTENT_W,
    h: 0.9,
    fontFace: EOS_FONTS.heading,
    fontSize: EOS_FONT_SIZES.coverTitle,
    bold: true,
    color: EOS_COLORS.orange
  });

  slide.addText(
    [
      { text: data.contact.company, options: { bold: true, breakLine: true } },
      { text: data.contact.address, options: { breakLine: true } },
      { text: `Tel. ${data.contact.phone}`, options: { breakLine: true } },
      { text: data.contact.web, options: { hyperlink: { url: `https://${data.contact.web}` } } }
    ],
    {
      x: EOS_LAYOUT.marginX,
      y: 4.2,
      w: CONTENT_W,
      h: 1.8,
      fontFace: EOS_FONTS.body,
      fontSize: EOS_FONT_SIZES.body,
      color: EOS_COLORS.white,
      lineSpacingMultiple: 1.25
    }
  );
};

const renderSlide = (pptx: PptxGenJS, data: DeckSlide, index: number, total: number): void => {
  const isDark = data.kind === 'cover' || data.kind === 'closing';
  const slide = pptx.addSlide({
    masterName: isDark ? MASTER_DARK : MASTER_CONTENT
  });

  switch (data.kind) {
    case 'cover':
      renderCover(slide, data);
      return;
    case 'kpi':
      renderKpi(slide, data);
      break;
    case 'filters':
      renderFilters(slide, data);
      break;
    case 'topProducts':
      renderTopProducts(slide, data);
      break;
    case 'bullets':
      renderBullets(slide, data);
      break;
    case 'closing':
      renderClosing(slide, data);
      return;
    default: {
      // Se compare un nuovo tipo di slide, il compilatore fallisce qui.
      const exhaustive: never = data;
      throw new Error(`Tipo di slide non gestito: ${JSON.stringify(exhaustive)}`);
    }
  }

  addFooter(slide, index + 1, total);
};

/**
 * Costruisce la presentazione senza scriverla.
 *
 * Separata da `renderDeck` perche' l'output 'blob' esiste solo nel browser:
 * cosi' uno script Node puo' costruire lo stesso deck e salvarlo come
 * nodebuffer per il collaudo headless.
 */
export const buildPresentation = (
  Ctor: PptxCtor,
  model: DeckModel
): PptxGenJS => {
  const pptx = new Ctor();

  // Layout esplicito derivato da EOS_LAYOUT: i preset di pptxgenjs non
  // corrispondono a queste misure ('LAYOUT_16x9' e' 10 x 5.625 pollici, non
  // 13.333 x 7.5), e usare il preset sbagliato manda fuori slide logo, tile e
  // grafici. Definendo il layout dalle stesse costanti che posizionano gli
  // oggetti, geometria e slide non possono piu' divergere.
  pptx.defineLayout({
    name: EOS_LAYOUT_NAME,
    width: EOS_LAYOUT.slideW,
    height: EOS_LAYOUT.slideH
  });
  pptx.layout = EOS_LAYOUT_NAME;
  pptx.author = 'Update Lens';
  pptx.company = 'EOS Solutions';
  pptx.title = model.fileName.replace(/\.pptx$/, '');
  pptx.subject = EOS_CLAIM;

  defineMasters(pptx);

  const total = model.slides.length;
  model.slides.forEach((slide, index) => renderSlide(pptx, slide, index, total));

  return pptx;
};

/** Genera il file .pptx a partire dal modello del deck. */
export const renderDeck = async (model: DeckModel): Promise<Blob> => {
  // Import dinamico: pptxgenjs pesa ~415 kB e serve solo a chi genera davvero
  // un deck. Caricarlo qui lo tiene fuori dal bundle iniziale — cosa che la
  // vecchia modalita' offline (bundle unico inlinato) impediva.
  const Ctor = resolvePptxCtor(await import('pptxgenjs'));
  const output = await buildPresentation(Ctor, model).write({
    outputType: 'blob'
  });
  return output as Blob;
};
