import { buildReleasePlansUrl } from '../src/utils/releaseplans';

const appName = 'Customer Insights - Data';
const planId = '62707ce6-3666-f011-bec2-6045bdd81421';
const expected =
  'https://releaseplans.microsoft.com/?app=Customer+Insights+-+Data&planID=62707ce6-3666-f011-bec2-6045bdd81421';

const actual = buildReleasePlansUrl(appName, planId);

if (actual !== expected) {
  throw new Error(`URL mismatch. Expected ${expected}, got ${actual}`);
}

if (actual.includes('/it-IT/')) {
  throw new Error(`URL includes locale path: ${actual}`);
}

console.log('Releaseplans URL check passed.');
