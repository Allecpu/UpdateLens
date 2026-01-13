export const appMappings: Array<{ match: RegExp; app: string }> = [
  { match: /business central/i, app: 'Business Central' },
  { match: /dynamics 365 sales/i, app: 'Sales' },
  { match: /customer insights\s*-\s*journeys/i, app: 'Customer Insights - Journeys' },
  { match: /customer insights\s*-\s*data/i, app: 'Customer Insights - Data' },
  { match: /field service/i, app: 'Field Service' },
  { match: /customer service/i, app: 'Customer Service' },
  { match: /finance/i, app: 'Finance' },
  { match: /supply chain/i, app: 'Supply Chain Management' },
  { match: /commerce/i, app: 'Commerce' },
  { match: /human resources/i, app: 'Human Resources' },
  { match: /project operations/i, app: 'Project Operations' },
  { match: /power platform/i, app: 'Power Platform' },
  { match: /power apps/i, app: 'Power Apps' },
  { match: /power automate/i, app: 'Power Automate' },
  { match: /power bi/i, app: 'Power BI' },
  { match: /copilot studio/i, app: 'Copilot Studio' },
  { match: /intelligent order management/i, app: 'Intelligent Order Management' },
  { match: /sustainability manager/i, app: 'Microsoft Sustainability Manager' }
];

export const normalizeProductApp = (product: string): string => {
  return product
    .replace(/^Microsoft\s+/i, '')
    .replace(/^Dynamics\s*365\s*/i, '')
    .trim();
};

export const resolveAppName = (product: string): string | null => {
  const mapping = appMappings.find((entry) => entry.match.test(product));
  const appName = mapping ? mapping.app : normalizeProductApp(product);
  return appName || null;
};

export const normalizeText = (value: string): string => {
  return value.replace(/\s+/g, ' ').trim();
};

export const parseDateFull = (value: string): string | null => {
  const cleaned = normalizeText(value);
  if (!cleaned) {
    return null;
  }
  const match = cleaned.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (!match) {
    return null;
  }
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = match[3];
  let day: number;
  let month: number;

  if (first > 12 && second <= 12) {
    day = first;
    month = second;
  } else if (second > 12 && first <= 12) {
    day = second;
    month = first;
  } else {
    month = first;
    day = second;
  }

  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}`;
};

export const parseMonthDate = (value: string): string | null => {
  const cleaned = normalizeText(value);
  if (!cleaned) {
    return null;
  }
  const fullMatch = cleaned.match(/(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/);
  if (fullMatch) {
    const first = Number(fullMatch[1]);
    const second = Number(fullMatch[2]);
    const year = fullMatch[3];
    let month: number;

    if (first > 12 && second <= 12) {
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
    } else {
      month = first;
    }

    const monthText = String(month).padStart(2, '0');
    return `${year}-${monthText}-01`;
  }
  const yearMatch = cleaned.match(/(20\d{2})[-/](\d{1,2})/);
  if (yearMatch) {
    const year = yearMatch[1];
    const month = String(Number(yearMatch[2])).padStart(2, '0');
    return `${year}-${month}-01`;
  }
  return null;
};
