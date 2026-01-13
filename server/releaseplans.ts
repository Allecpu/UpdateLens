export const RELEASEPLANS_BASE_URL = 'https://releaseplans.microsoft.com/';

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
