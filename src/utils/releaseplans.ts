export const RELEASEPLANS_BASE_URL = 'https://releaseplans.microsoft.com/';

const APP_MAPPINGS: Array<{ match: RegExp; app: string }> = [
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

const normalizeProductApp = (product: string): string => {
  return product
    .replace(/^Microsoft\s+/i, '')
    .replace(/^Dynamics\s*365\s*/i, '')
    .trim();
};

export const resolveAppNameFromProduct = (product: string): string | null => {
  const mapping = APP_MAPPINGS.find((entry) => entry.match.test(product));
  const appName = mapping ? mapping.app : normalizeProductApp(product);
  return appName || null;
};

export const encodeApp = (appName: string): string => {
  const params = new URLSearchParams({ app: appName });
  return params.toString().replace(/^app=/, '');
};

export const buildReleasePlansUrl = (appName: string, planId: string): string => {
  const appParam = encodeApp(appName);
  return `${RELEASEPLANS_BASE_URL}?app=${appParam}&planID=${planId}`;
};

export const isValidGuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
};

export const isReleasePlansUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.hostname !== 'releaseplans.microsoft.com') {
      return false;
    }
    if (parsed.pathname && parsed.pathname !== '/') {
      return false;
    }
    return parsed.searchParams.has('app') && parsed.searchParams.has('planID');
  } catch {
    return false;
  }
};
