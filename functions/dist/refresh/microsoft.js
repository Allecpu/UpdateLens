import * as cheerio from 'cheerio';
import { uploadSnapshot, updateManifest } from '../shared/blobStorage.js';
import { todayStamp, monthStamp, slugify, normalizeText, parseDate, parseDateFull, isValidGuid, resolveAppNameFromProduct, encodeApp, buildReleasePlansUrl, extractCountriesFromText } from '../shared/utils.js';
const SOURCE_URL = 'https://releaseplans.microsoft.com/it-it/allreleaseplans/';
const SNAPSHOT_URL = 'https://releaseplans.microsoft.com/_api/mssh_releaseplansnapshots?$select=mssh_releaseplansnapshotid,mssh_featurename,_mssh_releaseplan_value,mssh_docsurl,mssh_articlepath&$filter=statecode eq 0';
const resolveAppName = (product) => resolveAppNameFromProduct(product);
const buildPublicUrl = (product) => {
    const appName = resolveAppName(product);
    if (!appName) {
        return 'https://releaseplans.microsoft.com/';
    }
    return `https://releaseplans.microsoft.com/?app=${encodeApp(appName)}`;
};
const buildSourceUrl = (product, planId) => {
    const appName = resolveAppName(product);
    if (!planId || !appName || !isValidGuid(planId)) {
        return null;
    }
    return buildReleasePlansUrl(appName, planId);
};
const stripHtml = (value) => {
    const $ = cheerio.load(value);
    return normalizeText($.text());
};
const buildSnapshotKey = (releasePlanId, featureName) => `${releasePlanId}::${normalizeText(featureName).toLowerCase()}`;
const normalizeDocUrl = (value) => {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (/^https?:\/\//i.test(trimmed))
        return trimmed;
    if (trimmed.startsWith('/'))
        return `https://learn.microsoft.com${trimmed}`;
    return null;
};
const fetchSnapshotIndex = async () => {
    const headers = {
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };
    let nextUrl = SNAPSHOT_URL;
    const index = new Map();
    while (nextUrl) {
        const response = await fetch(nextUrl, { headers });
        if (!response.ok) {
            throw new Error(`Snapshot API error: ${response.status}`);
        }
        const payload = (await response.json());
        payload.value.forEach((row) => {
            if (!row._mssh_releaseplan_value || !row.mssh_featurename)
                return;
            const key = buildSnapshotKey(row._mssh_releaseplan_value, row.mssh_featurename);
            if (!index.has(key)) {
                const learnUrl = normalizeDocUrl(row.mssh_docsurl ?? row.mssh_articlepath ?? null);
                index.set(key, { snapshotId: row.mssh_releaseplansnapshotid, learnUrl });
            }
        });
        nextUrl = payload['@odata.nextLink'];
    }
    return index;
};
const buildStatus = (raw) => {
    if (raw['GA date'])
        return 'Launched';
    if (raw['Public preview date'])
        return 'Try now';
    if (raw['Early access date'])
        return 'Planned';
    return 'Unknown';
};
const buildAvailabilityTypes = (raw) => {
    const types = [];
    if (raw['Early access date'])
        types.push('Early Access');
    if (raw['Public preview date'])
        types.push('Public Preview');
    if (raw['GA date'])
        types.push('GA');
    return types;
};
const extractCountriesFromHtmlNode = (html) => {
    if (!html)
        return [];
    const $ = cheerio.load(html);
    const listItems = $('li').map((_, el) => $(el).text()).get();
    const textChunks = listItems.length ? listItems : [$.root().text()];
    return textChunks.flatMap((chunk) => extractCountriesFromText(chunk));
};
const extractItems = (payload, snapshotIndex) => {
    const items = [];
    const seen = new Set();
    payload.results.forEach((raw) => {
        const product = normalizeText(raw['Product name'] ?? '');
        const title = normalizeText(raw['Feature name'] ?? '');
        if (!product || !title)
            return;
        const idBase = raw['Release Plan ID']
            ? `ms-${raw['Release Plan ID']}`
            : `ms-${slugify(`${product}-${title}`)}`;
        if (seen.has(idBase))
            return;
        seen.add(idBase);
        const summaryRaw = raw['Business value'] ?? '';
        const summary = stripHtml(summaryRaw) || 'Dettaglio disponibile nel link ufficiale.';
        const gaMonth = parseDate(raw['GA date'] ?? '');
        const publicMonth = parseDate(raw['Public preview date'] ?? '');
        const earlyMonth = parseDate(raw['Early access date'] ?? '');
        const availability = gaMonth || publicMonth || earlyMonth || monthStamp();
        const gaFull = parseDateFull(raw['GA date'] ?? '');
        const publicFull = parseDateFull(raw['Public preview date'] ?? '');
        const earlyFull = parseDateFull(raw['Early access date'] ?? '');
        const firstAvailableDate = earlyFull || publicFull || gaFull || null;
        const availabilityDateFull = gaFull || publicFull || earlyFull || null;
        const lastUpdated = parseDateFull(raw['Last Gitcommit date'] ?? '');
        const geographyRaw = raw['GeographicAreasDetails'] ?? '';
        const geographyCountries = geographyRaw
            ? extractCountriesFromHtmlNode(geographyRaw)
            : undefined;
        const releasePlanId = raw['Release Plan ID'] ?? null;
        const snapshotKey = releasePlanId && title ? buildSnapshotKey(releasePlanId, title) : null;
        const snapshotEntry = snapshotKey ? snapshotIndex.get(snapshotKey) ?? null : null;
        const snapshotId = snapshotEntry?.snapshotId ?? null;
        const sourcePlanId = snapshotId ?? releasePlanId;
        const learnUrl = snapshotEntry?.learnUrl ?? null;
        const sourceAppName = resolveAppName(product);
        const sourceUrl = buildSourceUrl(product, sourcePlanId ?? undefined);
        items.push({
            id: idBase,
            productId: raw['ProductId'],
            releasePlanId,
            sourcePlanId,
            sourceAppName,
            source: 'Microsoft',
            product,
            category: raw['Investment area'] ? normalizeText(raw['Investment area'] ?? '') : undefined,
            wave: raw['GA Release Wave'] || raw['Public Preview Release Wave'],
            availabilityTypes: buildAvailabilityTypes(raw),
            enabledFor: raw['Enabled for'] ? normalizeText(raw['Enabled for'] ?? '') : undefined,
            geography: geographyRaw ? normalizeText(geographyRaw) : undefined,
            geographyCountries,
            title,
            summary,
            status: buildStatus(raw),
            availabilityDate: availability,
            availabilityDateFull: availabilityDateFull ?? undefined,
            firstAvailableDate: firstAvailableDate ?? undefined,
            lastUpdatedDate: lastUpdated ?? undefined,
            sourceUrl,
            learnUrl,
            url: sourceUrl ?? buildPublicUrl(product)
        });
    });
    return items;
};
export const refreshMicrosoft = async () => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    try {
        console.log('[RefreshMicrosoft] Fetching release plans...');
        const response = await fetch(SOURCE_URL, {
            headers: { 'User-Agent': 'UpdateLens/1.0 (+offline snapshot generator)' }
        });
        if (!response.ok) {
            throw new Error(`Release plans fetch error: ${response.status}`);
        }
        const rawText = await response.text();
        const payload = JSON.parse(rawText);
        console.log('[RefreshMicrosoft] Fetching snapshot index...');
        const snapshotIndex = await fetchSnapshotIndex();
        console.log('[RefreshMicrosoft] Extracting items...');
        const items = extractItems(payload, snapshotIndex);
        const snapshot = {
            version: 1,
            items
        };
        const filename = `microsoft_releaseplans_${todayStamp()}.json`;
        console.log(`[RefreshMicrosoft] Uploading snapshot: ${filename}`);
        await uploadSnapshot('microsoft', filename, snapshot);
        console.log('[RefreshMicrosoft] Updating manifest...');
        await updateManifest({ microsoft: filename });
        const duration = Date.now() - startTime;
        console.log(`[RefreshMicrosoft] Completed: ${items.length} items in ${duration}ms`);
        return {
            source: 'microsoft',
            status: 'ok',
            itemCount: items.length,
            duration,
            timestamp,
            filename
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[RefreshMicrosoft] Error: ${errorMessage}`);
        return {
            source: 'microsoft',
            status: 'failed',
            itemCount: null,
            duration,
            timestamp,
            error: errorMessage
        };
    }
};
