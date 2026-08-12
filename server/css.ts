import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getAzureOpenAIConfig } from './chat/AzureServices.js';

export type CssActivity = {
  activityId: string;
  customerId: string;
  customerName: string;
  cssOwner: string | null;
  lastUpdate: string | null;
  blBu: string | null;
  issue: string;
  listStatus: string | null;
  issueStatus: string;
  details: string | null;
  eosOwners: string | null;
  customerOwners: string | null;
  cssAction: string | null;
  notes: string | null;
  customerPriority: string | null;
  cssPriority: string | null;
  dueDate: string | null;
  rating: number | null;
  itemType: string | null;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CssCustomer = {
  customerId: string;
  name: string;
  aliases: string[];
  isActive: boolean;
  activityCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CssDocument = {
  documentId: string;
  filename: string;
  mimeType: string | null;
  fileType: 'docx' | 'doc' | 'pdf';
  extractionStatus: 'pending' | 'processed' | 'failed';
  extractionError: string | null;
  uploadedAt: string;
  processedAt: string | null;
  analysisCount: number;
  lastBatchId: string | null;
  lastAnalyzedAt: string | null;
  lastAiProvider: string | null;
  lastAiModel: string | null;
  lastExtractionNotes: string | null;
  reusedExisting?: boolean;
};

export type CssDocumentBatchSummary = {
  batchId: string;
  documentId: string;
  status: string;
  aiProvider: string;
  aiModel: string | null;
  extractionNotes: string | null;
  proposalCount: number;
  createdAt: string;
  validatedAt: string | null;
  validatedBy: string | null;
};

type CssProposalPayload = {
  customerName: string;
  cssOwner?: string | null;
  blBu?: string | null;
  issue: string;
  listStatus?: string | null;
  issueStatus: string;
  details?: string | null;
  eosOwners?: string | null;
  customerOwners?: string | null;
  cssAction?: string | null;
  notes?: string | null;
  customerPriority?: string | null;
  cssPriority?: string | null;
  dueDate?: string | null;
  rating?: number | null;
  itemType?: string | null;
  lastUpdate?: string | null;
};

export type CssProposal = {
  proposalId: string;
  batchId: string;
  actionType: 'create' | 'update';
  targetActivityId: string | null;
  payload: CssProposalPayload;
  confidence: number;
  decisionStatus: 'pending' | 'approved' | 'rejected';
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

type ActivityRow = {
  activity_id: string;
  customer_id: string;
  customer_name: string;
  css_owner: string | null;
  last_update: string | null;
  bl_bu: string | null;
  issue: string;
  list_status: string | null;
  issue_status: string;
  details: string | null;
  eos_owners: string | null;
  customer_owners: string | null;
  css_action: string | null;
  notes: string | null;
  customer_priority: string | null;
  css_priority: string | null;
  due_date: string | null;
  rating: number | null;
  item_type: string | null;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
};

type ProposalRow = {
  proposal_id: string;
  batch_id: string;
  action_type: 'create' | 'update';
  target_activity_id: string | null;
  payload_json: string;
  confidence: number;
  decision_status: 'pending' | 'approved' | 'rejected';
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

const KNOWN_STATUSES = ['Action required', 'In progress', 'Opportunity', 'Planned', 'Done'] as const;
const EXTRACTION_MODES = ['auto_heuristic_first', 'heuristic_only', 'azure_only'] as const;
const NOISE_CUSTOMER_TOKENS = new Set([
  'che',
  'del',
  'della',
  'dello',
  'dei',
  'degli',
  'delle',
  'di',
  'il',
  'lo',
  'la',
  'i',
  'gli',
  'le',
  'e',
  'ed',
  'a',
  'da',
  'in',
  'su',
  'per',
  'con'
]);

type ExtractionMode = (typeof EXTRACTION_MODES)[number];

const normalizeOwner = (value?: string | null): string | null => {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    return null;
  }
  // SharePoint Person fields often come as "Display Name;#Id"
  const sharePointTokenIndex = normalized.indexOf(';#');
  const cleaned = sharePointTokenIndex >= 0 ? normalized.slice(0, sharePointTokenIndex).trim() : normalized;
  return cleaned || null;
};

const splitOwners = (value?: string | null): string[] => {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    return [];
  }
  // Handles SharePoint person fields:
  // - "Name;#12"
  // - "Name A;#12;#Name B;#34"
  const parts = normalized
    .split(';#')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !/^\d+$/.test(part));
  return Array.from(new Set(parts.map((part) => normalizeOwner(part)).filter(Boolean) as string[]));
};

const normalizeOwnerForStorage = (value?: string | null): string | null => {
  const owners = splitOwners(value);
  if (owners.length === 0) {
    return null;
  }
  return owners.join(', ');
};

const normalizeFilterToken = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase();

const normalizeCustomerName = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, ' ');

const normalizeCustomerMatchKey = (value: string): string =>
  normalizeCustomerName(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCustomerRootKey = (value: string): string => {
  const tokens = normalizeCustomerMatchKey(value)
    .split(' ')
    .filter((token) => token.length > 0)
    .filter((token) => !['spa', 'srl', 'srls', 'snc', 'sas', 'societa', 'società'].includes(token));
  return tokens.join(' ').trim();
};

const splitChoiceTokens = (value?: string | null): string[] => {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    return [];
  }
  const parts = normalized
    .split(';#')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .filter((part) => !/^\d+$/.test(part));
  return Array.from(new Set(parts));
};

const normalizeChoiceValue = (value?: string | null): string | null => {
  const tokens = splitChoiceTokens(value);
  if (tokens.length === 0) {
    return null;
  }
  return tokens[0];
};

const toActivity = (row: ActivityRow): CssActivity => ({
  activityId: row.activity_id,
  customerId: row.customer_id,
  customerName: row.customer_name,
  cssOwner: splitOwners(row.css_owner).join(', ') || null,
  lastUpdate: row.last_update,
  blBu: normalizeChoiceValue(row.bl_bu),
  issue: row.issue,
  listStatus: normalizeChoiceValue(row.list_status),
  issueStatus: sanitizeIssueStatus(normalizeChoiceValue(row.issue_status)),
  details: row.details,
  eosOwners: splitOwners(row.eos_owners).join(', ') || null,
  customerOwners: splitOwners(row.customer_owners).join(', ') || null,
  cssAction: row.css_action,
  notes: row.notes,
  customerPriority: normalizeChoiceValue(row.customer_priority),
  cssPriority: normalizeChoiceValue(row.css_priority),
  dueDate: row.due_date,
  rating: row.rating,
  itemType: row.item_type,
  sourceRef: row.source_ref,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toProposal = (row: ProposalRow): CssProposal => ({
  proposalId: row.proposal_id,
  batchId: row.batch_id,
  actionType: row.action_type,
  targetActivityId: row.target_activity_id,
  payload: JSON.parse(row.payload_json) as CssProposalPayload,
  confidence: row.confidence,
  decisionStatus: row.decision_status,
  decisionNote: row.decision_note,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const resolveFileType = (filename: string): 'docx' | 'doc' | 'pdf' => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.docx')) {
    return 'docx';
  }
  if (lower.endsWith('.doc')) {
    return 'doc';
  }
  if (lower.endsWith('.pdf')) {
    return 'pdf';
  }
  throw new Error('Formato documento non supportato. Formati ammessi: DOCX, DOC, PDF.');
};

const normalizeDate = (raw?: string | null): string | null => {
  if (!raw) {
    return null;
  }
  const direct = raw.trim();
  if (!direct) {
    return null;
  }

  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = ddmmyyyy.exec(direct);
  if (match) {
    const dd = match[1].padStart(2, '0');
    const mm = match[2].padStart(2, '0');
    return `${match[3]}-${mm}-${dd}`;
  }

  const parsed = new Date(direct);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
};

const prependDateToDetails = (lastUpdate?: string | null, details?: string | null): string | null => {
  const normalizedDetails = (details ?? '').trim();
  if (!normalizedDetails) {
    return null;
  }
  const normalizedDate = normalizeDate(lastUpdate);
  if (!normalizedDate) {
    return normalizedDetails;
  }
  const alreadyPrefixed = normalizedDetails.startsWith(`[${normalizedDate}]`);
  if (alreadyPrefixed) {
    return normalizedDetails;
  }
  return `[${normalizedDate}] ${normalizedDetails}`;
};

const resolveCustomer = (
  db: Database.Database,
  customerName: string,
  options?: { excludeCustomerId?: string }
): { customerId: string; customerName: string } | null => {
  const normalized = normalizeCustomerName(customerName);
  if (!normalized) {
    throw new Error('Nome cliente obbligatorio');
  }

  const excluded = options?.excludeCustomerId;

  const existing = db
    .prepare(`SELECT customer_id, name FROM css_customers WHERE LOWER(name) = LOWER(?)`)
    .get(normalized) as { customer_id: string; name: string } | undefined;
  if (existing) {
    if (excluded && existing.customer_id === excluded) {
      return null;
    }
    return { customerId: existing.customer_id, customerName: existing.name };
  }

  const rows = db.prepare(`
    SELECT customer_id, name, aliases_json
    FROM css_customers
  `).all() as Array<{ customer_id: string; name: string; aliases_json: string }>;

  const inputKey = normalizeCustomerMatchKey(normalized);
  const inputRootKey = normalizeCustomerRootKey(normalized);
  const aliasMatches: Array<{ customer_id: string; name: string }> = [];
  const rootMatches: Array<{ customer_id: string; name: string }> = [];

  for (const row of rows) {
    if (excluded && row.customer_id === excluded) {
      continue;
    }
    const aliases = toAliases(row.aliases_json);
    const allKeys = [normalizeCustomerMatchKey(row.name), ...aliases.map(normalizeCustomerMatchKey)];
    if (allKeys.includes(inputKey)) {
      aliasMatches.push({ customer_id: row.customer_id, name: row.name });
      continue;
    }

    const rootKeys = [normalizeCustomerRootKey(row.name), ...aliases.map(normalizeCustomerRootKey)].filter(Boolean);
    if (inputRootKey && rootKeys.includes(inputRootKey)) {
      rootMatches.push({ customer_id: row.customer_id, name: row.name });
    }
  }

  if (aliasMatches.length === 1) {
    return { customerId: aliasMatches[0].customer_id, customerName: aliasMatches[0].name };
  }
  if (rootMatches.length === 1) {
    return { customerId: rootMatches[0].customer_id, customerName: rootMatches[0].name };
  }
  return null;
};

const ensureCustomer = (
  db: Database.Database,
  customerName: string,
  options?: { createIfMissing?: boolean }
): { customerId: string; customerName: string } => {
  const normalized = normalizeCustomerName(customerName);
  if (!normalized) {
    throw new Error('Nome cliente obbligatorio');
  }
  const resolved = resolveCustomer(db, normalized);
  if (resolved) {
    return resolved;
  }

  if (options?.createIfMissing === false) {
    throw new Error(`Cliente non trovato in anagrafica: ${normalized}`);
  }

  const now = new Date().toISOString();
  const customerId = randomUUID();
  db.prepare(`
    INSERT INTO css_customers (customer_id, name, aliases_json, is_active, created_at, updated_at)
    VALUES (?, ?, '[]', 1, ?, ?)
  `).run(customerId, normalized, now, now);
  return { customerId, customerName: normalized };
};

const toAliases = (raw: string): string[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => normalizeCustomerName(item))
          .filter((item) => item.length > 0)
      )
    );
  } catch {
    return [];
  }
};

export const listCssCustomers = (db: Database.Database): CssCustomer[] => {
  const rows = db.prepare(`
    SELECT
      c.customer_id,
      c.name,
      c.aliases_json,
      c.is_active,
      c.created_at,
      c.updated_at,
      COUNT(a.activity_id) AS activity_count
    FROM css_customers c
    LEFT JOIN css_activities a ON a.customer_id = c.customer_id
    GROUP BY c.customer_id, c.name, c.aliases_json, c.is_active, c.created_at, c.updated_at
    ORDER BY c.is_active DESC, c.name ASC
  `).all() as Array<{
    customer_id: string;
    name: string;
    aliases_json: string;
    is_active: number;
    created_at: string;
    updated_at: string;
    activity_count: number;
  }>;

  return rows.map((row) => ({
    customerId: row.customer_id,
    name: row.name,
    aliases: toAliases(row.aliases_json),
    isActive: row.is_active === 1,
    activityCount: Number(row.activity_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

export const createCssCustomer = (
  db: Database.Database,
  payload: { name: string; aliases?: string[] | null; isActive?: boolean }
): CssCustomer => {
  const normalizedName = normalizeCustomerName(payload.name);
  if (!normalizedName) {
    throw new Error('Nome cliente obbligatorio');
  }

  const existing = resolveCustomer(db, normalizedName);
  if (existing) {
    throw new Error('Cliente già esistente');
  }

  const now = new Date().toISOString();
  const customerId = randomUUID();
  const aliases = Array.from(
    new Set(
      (payload.aliases ?? [])
        .map((alias) => normalizeCustomerName(alias))
        .filter((alias) => alias.length > 0 && alias.toLowerCase() !== normalizedName.toLowerCase())
    )
  );
  db.prepare(`
    INSERT INTO css_customers (customer_id, name, aliases_json, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(customerId, normalizedName, JSON.stringify(aliases), payload.isActive === false ? 0 : 1, now, now);

  const created = listCssCustomers(db).find((item) => item.customerId === customerId);
  if (!created) {
    throw new Error('Errore creazione cliente');
  }
  return created;
};

export const updateCssCustomer = (
  db: Database.Database,
  customerId: string,
  patch: { name?: string; aliases?: string[] | null; isActive?: boolean }
): CssCustomer => {
  const current = db.prepare(`
    SELECT customer_id, name, aliases_json, is_active
    FROM css_customers
    WHERE customer_id = ?
  `).get(customerId) as { customer_id: string; name: string; aliases_json: string; is_active: number } | undefined;

  if (!current) {
    throw new Error('Cliente non trovato');
  }

  const nextName = patch.name !== undefined ? normalizeCustomerName(patch.name) : current.name;
  if (!nextName) {
    throw new Error('Nome cliente obbligatorio');
  }

  if (nextName.toLowerCase() !== current.name.toLowerCase()) {
    const duplicate = resolveCustomer(db, nextName, { excludeCustomerId: customerId });
    if (duplicate) {
      throw new Error('Esiste già un cliente con questo nome');
    }
  }

  const nextAliases = patch.aliases !== undefined
    ? Array.from(
        new Set(
          (patch.aliases ?? [])
            .map((alias) => normalizeCustomerName(alias))
            .filter((alias) => alias.length > 0 && alias.toLowerCase() !== nextName.toLowerCase())
        )
      )
    : toAliases(current.aliases_json);

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE css_customers
    SET name = ?, aliases_json = ?, is_active = ?, updated_at = ?
    WHERE customer_id = ?
  `).run(
    nextName,
    JSON.stringify(nextAliases),
    patch.isActive === undefined ? current.is_active : patch.isActive ? 1 : 0,
    now,
    customerId
  );

  const updated = listCssCustomers(db).find((item) => item.customerId === customerId);
  if (!updated) {
    throw new Error('Cliente non trovato dopo aggiornamento');
  }
  return updated;
};

export const mergeCssCustomers = (
  db: Database.Database,
  payload: { primaryCustomerId: string; secondaryCustomerId: string }
): { primary: CssCustomer; mergedActivities: number } => {
  const primary = db.prepare(`
    SELECT customer_id, name, aliases_json
    FROM css_customers
    WHERE customer_id = ?
  `).get(payload.primaryCustomerId) as { customer_id: string; name: string; aliases_json: string } | undefined;

  const secondary = db.prepare(`
    SELECT customer_id, name, aliases_json
    FROM css_customers
    WHERE customer_id = ?
  `).get(payload.secondaryCustomerId) as { customer_id: string; name: string; aliases_json: string } | undefined;

  if (!primary || !secondary) {
    throw new Error('Cliente primario o secondario non trovato');
  }
  if (primary.customer_id === secondary.customer_id) {
    throw new Error('Impossibile unire lo stesso cliente');
  }

  const mergedAliases = Array.from(
    new Set(
      [
        ...toAliases(primary.aliases_json),
        ...toAliases(secondary.aliases_json),
        secondary.name
      ]
        .map((alias) => normalizeCustomerName(alias))
        .filter((alias) => alias.length > 0 && alias.toLowerCase() !== primary.name.toLowerCase())
    )
  );

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const activityResult = db.prepare(`
      UPDATE css_activities
      SET customer_id = ?, updated_at = ?
      WHERE customer_id = ?
    `).run(primary.customer_id, now, secondary.customer_id);

    db.prepare(`
      UPDATE css_customers
      SET aliases_json = ?, updated_at = ?
      WHERE customer_id = ?
    `).run(JSON.stringify(mergedAliases), now, primary.customer_id);

    db.prepare(`DELETE FROM css_customers WHERE customer_id = ?`).run(secondary.customer_id);

    return activityResult.changes;
  });

  const mergedActivities = tx();
  const updatedPrimary = listCssCustomers(db).find((item) => item.customerId === primary.customer_id);
  if (!updatedPrimary) {
    throw new Error('Cliente primario non trovato dopo merge');
  }

  return {
    primary: updatedPrimary,
    mergedActivities
  };
};

const findMatchingActivity = (
  db: Database.Database,
  payload: CssProposalPayload
): { activity_id: string } | null => {
  const row = db.prepare(`
    SELECT a.activity_id
    FROM css_activities a
    JOIN css_customers c ON c.customer_id = a.customer_id
    WHERE LOWER(c.name) = LOWER(?)
      AND LOWER(a.issue) = LOWER(?)
    LIMIT 1
  `).get(payload.customerName.trim(), payload.issue.trim()) as { activity_id: string } | undefined;
  return row ?? null;
};

const sanitizeIssueStatus = (status?: string | null): string => {
  const normalized = (status ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!normalized) {
    return 'Action required';
  }
  const match = KNOWN_STATUSES.find((candidate) => candidate.toLowerCase() === normalized.toLowerCase());
  return match ?? normalized;
};

const normalizeText = (value?: string | null): string =>
  (value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

const hasLetter = (value: string): boolean => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(value);

const isLikelyCustomerName = (value: string): boolean => {
  if (!value || value.length < 3 || value.length > 120) {
    return false;
  }
  if (!hasLetter(value)) {
    return false;
  }
  const tokens = value.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && NOISE_CUSTOMER_TOKENS.has(tokens[0])) {
    return false;
  }
  return true;
};

const isLikelyIssue = (value: string): boolean => {
  if (!value || value.length < 5 || value.length > 300) {
    return false;
  }
  return hasLetter(value);
};

const normalizeProposalPayload = (payload: CssProposalPayload): CssProposalPayload | null => {
  const customerName = normalizeCustomerName(normalizeText(payload.customerName));
  const issue = normalizeText(payload.issue);
  if (!isLikelyCustomerName(customerName) || !isLikelyIssue(issue)) {
    return null;
  }

  return {
    customerName,
    issue,
    issueStatus: sanitizeIssueStatus(payload.issueStatus),
    cssOwner: normalizeOwner(payload.cssOwner) ?? null,
    blBu: normalizeChoiceValue(payload.blBu) ?? null,
    details: normalizeText(payload.details) || null,
    lastUpdate: normalizeDate(payload.lastUpdate) ?? new Date().toISOString().slice(0, 10)
  };
};

const normalizeDraftProposal = (
  proposal: Omit<CssProposal, 'proposalId' | 'batchId' | 'decisionStatus' | 'decisionNote' | 'createdAt' | 'updatedAt'>
): Omit<CssProposal, 'proposalId' | 'batchId' | 'decisionStatus' | 'decisionNote' | 'createdAt' | 'updatedAt'> | null => {
  const payload = normalizeProposalPayload(proposal.payload);
  if (!payload) {
    return null;
  }
  return {
    ...proposal,
    payload
  };
};

const dedupeProposals = (
  proposals: Array<Omit<CssProposal, 'proposalId' | 'batchId' | 'decisionStatus' | 'decisionNote' | 'createdAt' | 'updatedAt'>>
): Array<Omit<CssProposal, 'proposalId' | 'batchId' | 'decisionStatus' | 'decisionNote' | 'createdAt' | 'updatedAt'>> => {
  const seen = new Set<string>();
  return proposals.filter((proposal) => {
    const key = `${proposal.payload.customerName.toLowerCase()}::${proposal.payload.issue.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const getCssExtractionMode = (): ExtractionMode => {
  const raw = normalizeText(process.env.CSS_IMPORT_EXTRACTION_MODE).toLowerCase();
  if (!raw || raw === 'auto' || raw === 'auto_heuristic_first') {
    return 'auto_heuristic_first';
  }
  if (raw === 'heuristic' || raw === 'heuristic_only') {
    return 'heuristic_only';
  }
  if (raw === 'azure' || raw === 'azure_only') {
    return 'azure_only';
  }
  return 'auto_heuristic_first';
};

const inferPrimaryCustomerName = (text: string): string | null => {
  const patterns = [
    /(?:object|oggetto)\s*:\s*(?:visita|incontro)\s+a\s+([A-Z][A-Z0-9& .-]{1,60})/i,
    /\bvisita\s+a\s+([A-Z][A-Z0-9& .-]{1,60})/i,
    /\bdedicat[oa]\s+ad\s+([A-Z][A-Z0-9& .-]{1,60})/i,
    /\ba\s+([A-Z]{2,}(?:\s+[A-Z0-9&.-]{2,}){0,4})\b/
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const candidate = normalizeCustomerName(normalizeText(match?.[1]));
    if (candidate && isLikelyCustomerName(candidate)) {
      return candidate;
    }
  }
  return null;
};

const extractTextFromDocx = async (buffer: Buffer): Promise<string> => {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) {
    throw new Error('DOCX non valido: word/document.xml mancante');
  }
  const xml = await documentXmlFile.async('string');
  return xml
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n+/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
};

const extractTextFromDoc = (buffer: Buffer): string => {
  return buffer
    .toString('latin1')
    .replace(/[^\x09\x0A\x0D\x20-\x7EÀ-ÿ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractTextFromPdf = (buffer: Buffer): string => {
  const raw = buffer.toString('latin1');
  const matches = raw.match(/\(([^()]*)\)/g) ?? [];
  const text = matches
    .map((chunk) => chunk.slice(1, -1).replace(/\\([()\\])/g, '$1'))
    .join(' ');
  return text.replace(/\s+/g, ' ').trim();
};

const extractWithHeuristics = (text: string): Array<Omit<CssProposal, 'proposalId' | 'batchId' | 'decisionStatus' | 'decisionNote' | 'createdAt' | 'updatedAt'>> => {
  const inferredCustomer = inferPrimaryCustomerName(text);
  const lines = text
    .split(/\r?\n|[.;]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 10);

  const proposals: Array<Omit<CssProposal, 'proposalId' | 'batchId' | 'decisionStatus' | 'decisionNote' | 'createdAt' | 'updatedAt'>> = [];
  const actionSentencePattern = /\b(si\s+(?:organizzer[aà]|dovr[aà]|allineer[aà]|proceder[aà])|definizione delle attivit[aà]|presentazione|demo|riprendere l'argomento|approfondimento)\b/i;

  for (const line of lines.slice(0, 120)) {
    const customerMatch = /cliente[:\s-]+([^,;|]+)/i.exec(line);
    const issueMatch = /(attivita|azione|issue|task)[:\s-]+([^,;|]+)/i.exec(line);
    const ownerMatch = /(owner|responsabile|css owner)[:\s-]+([^,;|]+)/i.exec(line);
    const statusMatch = /(status|stato)[:\s-]+([^,;|]+)/i.exec(line);
    const dateMatch = /(scadenza|due date|data)[:\s-]+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i.exec(line);

    const customerCandidate = normalizeCustomerName(normalizeText(customerMatch?.[1])) || inferredCustomer;
    const issueCandidate = normalizeText(issueMatch?.[2]);
    const heuristicIssue = issueCandidate && isLikelyIssue(issueCandidate)
      ? issueCandidate
      : actionSentencePattern.test(line)
      ? normalizeText(line).slice(0, 220)
      : '';
    if (!customerCandidate || !isLikelyCustomerName(customerCandidate) || !heuristicIssue) {
      continue;
    }

    proposals.push({
      actionType: 'create',
      targetActivityId: null,
      confidence: issueCandidate ? 0.64 : 0.56,
      payload: {
        customerName: customerCandidate,
        issue: heuristicIssue,
        issueStatus: sanitizeIssueStatus(statusMatch?.[2]),
        cssOwner: ownerMatch?.[2]?.trim() ?? null,
        details: line,
        lastUpdate: normalizeDate(dateMatch?.[2]) ?? new Date().toISOString().slice(0, 10)
      }
    });
  }

  return proposals;
};

const shouldUseAzureOpenAi = (): boolean => Boolean(getAzureOpenAIConfig());

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
let azureThrottleUntilMs = 0;

const parseRetryDelayMs = (response: Response, attempt: number): number => {
  const retryAfterMs = response.headers.get('retry-after-ms');
  const parsedRetryAfterMs = retryAfterMs ? Number.parseInt(retryAfterMs, 10) : Number.NaN;
  if (Number.isFinite(parsedRetryAfterMs) && parsedRetryAfterMs > 0) {
    return Math.min(parsedRetryAfterMs, 30_000);
  }

  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const retryAfterSeconds = Number.parseInt(retryAfter, 10);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.min(retryAfterSeconds * 1000, 30_000);
    }
    const retryDate = new Date(retryAfter);
    if (!Number.isNaN(retryDate.getTime())) {
      const delta = retryDate.getTime() - Date.now();
      if (delta > 0) {
        return Math.min(delta, 30_000);
      }
    }
  }

  const backoff = 1000 * 2 ** attempt;
  return Math.min(backoff, 10_000);
};

const extractWithAzureOpenAi = async (text: string): Promise<CssProposalPayload[]> => {
  const config = getAzureOpenAIConfig();
  if (!config) {
    throw new Error('Azure OpenAI non configurato');
  }
  const { endpoint, apiKey, deployment, apiVersion } = config;
  const version = apiVersion || '2024-10-21';
  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;
  const maxCharsRaw = Number.parseInt(process.env.CSS_AZURE_MAX_TEXT_CHARS ?? '10000', 10);
  const maxChars = Number.isFinite(maxCharsRaw) && maxCharsRaw > 0 ? Math.min(Math.max(maxCharsRaw, 3000), 20000) : 10000;
  const now = Date.now();
  if (now < azureThrottleUntilMs) {
    const waitSeconds = Math.ceil((azureThrottleUntilMs - now) / 1000);
    throw new Error(`Azure OpenAI temporaneamente in throttling (cooldown ${waitSeconds}s)`);
  }

  const prompt = `
Estrai azioni cliente da questo meeting report.
Rispondi SOLO JSON valido con array "items".
Ogni item: customerName, issue, issueStatus, cssOwner, blBu, details, lastUpdate (YYYY-MM-DD o null).
Se non sei sicuro, usa issueStatus "Action required".
Testo:
${text.slice(0, maxChars)}
`;

  const maxAttemptsRaw = Number.parseInt(process.env.CSS_AZURE_RETRY_MAX_ATTEMPTS ?? '3', 10);
  const maxAttempts = Number.isFinite(maxAttemptsRaw) && maxAttemptsRaw > 0 ? Math.min(maxAttemptsRaw, 6) : 3;

  let response: Response | null = null;
  let lastErrorBody = '';
  let lastStatus = 0;
  let lastRetryDelayMs = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an extraction engine that outputs strict JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (response.ok) {
      break;
    }

    lastStatus = response.status;
    lastErrorBody = await response.text();
    const retryableStatus = response.status === 429 || response.status === 503;
    const hasMoreAttempts = attempt < maxAttempts - 1;
    if (retryableStatus && hasMoreAttempts) {
      const delayMs = parseRetryDelayMs(response, attempt);
      lastRetryDelayMs = delayMs;
      await sleep(delayMs);
      continue;
    }
    break;
  }

  if (!response || !response.ok) {
    const status = response?.status ?? lastStatus;
    const body = lastErrorBody || (response ? await response.text() : '');
    if (status === 429) {
      const cooldownMs = Math.max(lastRetryDelayMs, 30_000);
      azureThrottleUntilMs = Date.now() + cooldownMs;
      throw new Error(`Azure OpenAI rate limit (429), cooldown ${Math.ceil(cooldownMs / 1000)}s`);
    }
    throw new Error(`Azure OpenAI error (${status}): ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Azure OpenAI ha restituito una risposta vuota');
  }

  const json = JSON.parse(content) as { items?: CssProposalPayload[] };
  if (!Array.isArray(json.items)) {
    throw new Error('Formato risposta AI non valido');
  }
  return json.items;
};

export const listCssActivities = (
  db: Database.Database,
  params: { customer?: string; owner?: string; status?: string; query?: string }
): CssActivity[] => {
  const rows = db.prepare(`
    SELECT
      a.activity_id, a.customer_id, c.name AS customer_name, a.css_owner, a.last_update, a.bl_bu,
      a.issue, a.list_status, a.issue_status, a.details, a.eos_owners, a.customer_owners,
      a.css_action, a.notes, a.customer_priority, a.css_priority, a.due_date, a.rating, a.item_type,
      a.source_ref, a.created_at, a.updated_at
    FROM css_activities a
    JOIN css_customers c ON c.customer_id = a.customer_id
    ORDER BY COALESCE(a.last_update, a.updated_at) DESC, c.name ASC
  `).all() as ActivityRow[];

  const customerFilter = normalizeFilterToken(params.customer);
  const ownerFilter = normalizeFilterToken(params.owner);
  const ownerFilterTokensRaw = splitOwners(params.owner);
  const ownerFilterTokens =
    ownerFilterTokensRaw.length > 0
      ? ownerFilterTokensRaw.map((token) => token.toLowerCase())
      : ownerFilter
      ? [normalizeOwner(params.owner)?.toLowerCase() ?? ownerFilter]
      : [];
  const statusFilter = normalizeFilterToken(params.status);
  const queryFilter = normalizeFilterToken(params.query);

  const filteredRows = rows.filter((row) => {
    const customerName = row.customer_name ?? '';
    const owners = splitOwners(row.css_owner);
    const issueStatus = sanitizeIssueStatus(normalizeChoiceValue(row.issue_status));
    const listStatus = normalizeChoiceValue(row.list_status) ?? '';
    const details = row.details ?? '';
    const issue = row.issue ?? '';
    const blBu = normalizeChoiceValue(row.bl_bu) ?? '';
    const notes = row.notes ?? '';
    const eosOwners = row.eos_owners ?? '';
    const customerOwners = row.customer_owners ?? '';
    const cssAction = row.css_action ?? '';
    const itemType = row.item_type ?? '';
    const ownerJoined = owners.join(' ');

    if (customerFilter && !customerName.toLowerCase().includes(customerFilter)) {
      return false;
    }

    if (ownerFilterTokens.length > 0) {
      const ownerLower = owners.map((owner) => owner.toLowerCase());
      const ownerMatch = ownerFilterTokens.some((filterToken) =>
        ownerLower.some((currentOwner) => currentOwner === filterToken || currentOwner.includes(filterToken))
      );
      if (!ownerMatch) {
        return false;
      }
    }

    if (statusFilter && issueStatus.toLowerCase() !== statusFilter) {
      return false;
    }

    if (queryFilter) {
      const searchable = `${customerName} ${issue} ${listStatus} ${issueStatus} ${details} ${blBu} ${notes} ${eosOwners} ${customerOwners} ${cssAction} ${itemType} ${ownerJoined}`.toLowerCase();
      if (!searchable.includes(queryFilter)) {
        return false;
      }
    }

    return true;
  });

  return filteredRows.map(toActivity);
};

export const getCssMeta = (db: Database.Database): { owners: string[]; statuses: string[]; customers: string[] } => {
  const ownersRaw = db
    .prepare(`SELECT DISTINCT css_owner FROM css_activities WHERE css_owner IS NOT NULL AND css_owner != '' ORDER BY css_owner`)
    .all() as Array<{ css_owner: string }>;
  const statusesRaw = db
    .prepare(`SELECT DISTINCT issue_status FROM css_activities WHERE issue_status IS NOT NULL AND issue_status != '' ORDER BY issue_status`)
    .all() as Array<{ issue_status: string }>;
  const customers = db
    .prepare(`SELECT name FROM css_customers WHERE is_active = 1 ORDER BY name`)
    .all() as Array<{ name: string }>;

  const normalizedStatuses = Array.from(
    new Set(statusesRaw.map((row) => sanitizeIssueStatus(normalizeChoiceValue(row.issue_status))).filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));
  return {
    owners: Array.from(new Set(ownersRaw.flatMap((row) => splitOwners(row.css_owner)))).sort((a, b) => a.localeCompare(b)),
    statuses: normalizedStatuses,
    customers: customers.map((row) => row.name)
  };
};

export const createCssActivity = (
  db: Database.Database,
  payload: {
    customerName: string;
    cssOwner?: string | null;
    lastUpdate?: string | null;
    blBu?: string | null;
    issue: string;
    listStatus?: string | null;
    issueStatus: string;
    details?: string | null;
    eosOwners?: string | null;
    customerOwners?: string | null;
    cssAction?: string | null;
    notes?: string | null;
    customerPriority?: string | null;
    cssPriority?: string | null;
    dueDate?: string | null;
    rating?: number | null;
    itemType?: string | null;
    sourceRef?: string | null;
  }
): CssActivity => {
  const issue = payload.issue?.trim();
  if (!issue) {
    throw new Error('Issue obbligatoria');
  }

  const customer = ensureCustomer(db, payload.customerName);
  const now = new Date().toISOString();
  const activityId = randomUUID();
  db.prepare(`
    INSERT INTO css_activities (
      activity_id, customer_id, css_owner, last_update, bl_bu, issue, list_status, issue_status, details,
      eos_owners, customer_owners, css_action, notes, customer_priority, css_priority, due_date, rating, item_type,
      source_ref, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    activityId,
    customer.customerId,
    normalizeOwnerForStorage(payload.cssOwner),
    normalizeDate(payload.lastUpdate) ?? now.slice(0, 10),
    normalizeChoiceValue(payload.blBu),
    issue,
    normalizeChoiceValue(payload.listStatus),
    sanitizeIssueStatus(normalizeChoiceValue(payload.issueStatus)),
    payload.details?.trim() || null,
    normalizeOwnerForStorage(payload.eosOwners),
    normalizeOwnerForStorage(payload.customerOwners),
    payload.cssAction?.trim() || null,
    payload.notes?.trim() || null,
    normalizeChoiceValue(payload.customerPriority),
    normalizeChoiceValue(payload.cssPriority),
    normalizeDate(payload.dueDate) ?? null,
    payload.rating ?? null,
    payload.itemType?.trim() || null,
    payload.sourceRef?.trim() || null,
    now,
    now
  );

  const row = db.prepare(`
    SELECT
      a.activity_id, a.customer_id, c.name AS customer_name, a.css_owner, a.last_update, a.bl_bu,
      a.issue, a.list_status, a.issue_status, a.details, a.eos_owners, a.customer_owners,
      a.css_action, a.notes, a.customer_priority, a.css_priority, a.due_date, a.rating, a.item_type,
      a.source_ref, a.created_at, a.updated_at
    FROM css_activities a
    JOIN css_customers c ON c.customer_id = a.customer_id
    WHERE a.activity_id = ?
  `).get(activityId) as ActivityRow | undefined;
  if (!row) {
    throw new Error('Errore creazione attività');
  }
  return toActivity(row);
};

export const updateCssActivity = (
  db: Database.Database,
  activityId: string,
  patch: {
    customerName?: string;
    cssOwner?: string | null;
    lastUpdate?: string | null;
    blBu?: string | null;
    issue?: string;
    listStatus?: string | null;
    issueStatus?: string;
    details?: string | null;
    eosOwners?: string | null;
    customerOwners?: string | null;
    cssAction?: string | null;
    notes?: string | null;
    customerPriority?: string | null;
    cssPriority?: string | null;
    dueDate?: string | null;
    rating?: number | null;
    itemType?: string | null;
  }
): CssActivity => {
  const current = db.prepare(`
    SELECT a.activity_id, a.customer_id, c.name AS customer_name, a.css_owner, a.last_update, a.bl_bu,
           a.issue, a.list_status, a.issue_status, a.details, a.eos_owners, a.customer_owners,
           a.css_action, a.notes, a.customer_priority, a.css_priority, a.due_date, a.rating, a.item_type,
           a.source_ref, a.created_at, a.updated_at
    FROM css_activities a
    JOIN css_customers c ON c.customer_id = a.customer_id
    WHERE a.activity_id = ?
  `).get(activityId) as ActivityRow | undefined;
  if (!current) {
    throw new Error('Attività non trovata');
  }

  let customerId = current.customer_id;
  if (patch.customerName && patch.customerName.trim() && patch.customerName.trim() !== current.customer_name) {
    customerId = ensureCustomer(db, patch.customerName).customerId;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE css_activities
    SET customer_id = ?,
        css_owner = ?,
        last_update = ?,
        bl_bu = ?,
        issue = ?,
        list_status = ?,
        issue_status = ?,
        details = ?,
        eos_owners = ?,
        customer_owners = ?,
        css_action = ?,
        notes = ?,
        customer_priority = ?,
        css_priority = ?,
        due_date = ?,
        rating = ?,
        item_type = ?,
        updated_at = ?
    WHERE activity_id = ?
  `).run(
    customerId,
    patch.cssOwner === undefined ? normalizeOwnerForStorage(current.css_owner) : normalizeOwnerForStorage(patch.cssOwner),
    patch.lastUpdate === undefined ? current.last_update : normalizeDate(patch.lastUpdate),
    patch.blBu === undefined ? normalizeChoiceValue(current.bl_bu) : normalizeChoiceValue(patch.blBu),
    patch.issue === undefined ? current.issue : patch.issue.trim(),
    patch.listStatus === undefined ? normalizeChoiceValue(current.list_status) : normalizeChoiceValue(patch.listStatus),
    patch.issueStatus === undefined ? sanitizeIssueStatus(normalizeChoiceValue(current.issue_status)) : sanitizeIssueStatus(normalizeChoiceValue(patch.issueStatus)),
    patch.details === undefined ? current.details : patch.details?.trim() || null,
    patch.eosOwners === undefined ? normalizeOwnerForStorage(current.eos_owners) : normalizeOwnerForStorage(patch.eosOwners),
    patch.customerOwners === undefined ? normalizeOwnerForStorage(current.customer_owners) : normalizeOwnerForStorage(patch.customerOwners),
    patch.cssAction === undefined ? current.css_action : patch.cssAction?.trim() || null,
    patch.notes === undefined ? current.notes : patch.notes?.trim() || null,
    patch.customerPriority === undefined ? normalizeChoiceValue(current.customer_priority) : normalizeChoiceValue(patch.customerPriority),
    patch.cssPriority === undefined ? normalizeChoiceValue(current.css_priority) : normalizeChoiceValue(patch.cssPriority),
    patch.dueDate === undefined ? current.due_date : normalizeDate(patch.dueDate),
    patch.rating === undefined ? current.rating : patch.rating,
    patch.itemType === undefined ? current.item_type : patch.itemType?.trim() || null,
    now,
    activityId
  );

  const updated = db.prepare(`
    SELECT a.activity_id, a.customer_id, c.name AS customer_name, a.css_owner, a.last_update, a.bl_bu,
           a.issue, a.list_status, a.issue_status, a.details, a.eos_owners, a.customer_owners,
           a.css_action, a.notes, a.customer_priority, a.css_priority, a.due_date, a.rating, a.item_type,
           a.source_ref, a.created_at, a.updated_at
    FROM css_activities a
    JOIN css_customers c ON c.customer_id = a.customer_id
    WHERE a.activity_id = ?
  `).get(activityId) as ActivityRow | undefined;
  if (!updated) {
    throw new Error('Attività non trovata dopo aggiornamento');
  }
  return toActivity(updated);
};

export const uploadCssDocument = async (
  db: Database.Database,
  data: { filename: string; mimeType?: string | null; contentBase64: string; uploadedBy?: string | null }
): Promise<CssDocument> => {
  if (!data.filename?.trim()) {
    throw new Error('Filename obbligatorio');
  }
  if (!data.contentBase64?.trim()) {
    throw new Error('Contenuto file obbligatorio');
  }
  const fileType = resolveFileType(data.filename);
  const fileBuffer = Buffer.from(data.contentBase64, 'base64');
  if (fileBuffer.length === 0) {
    throw new Error('Contenuto file non valido');
  }

  const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
  const now = new Date().toISOString();
  const existing = db.prepare(`
    SELECT document_id
    FROM css_meeting_documents
    WHERE file_hash = ?
    ORDER BY uploaded_at DESC
    LIMIT 1
  `).get(fileHash) as { document_id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE css_meeting_documents
      SET filename = ?, mime_type = ?, uploaded_by = ?, uploaded_at = ?, content_base64 = ?
      WHERE document_id = ?
    `).run(
      data.filename.trim(),
      data.mimeType?.trim() || null,
      data.uploadedBy?.trim() || null,
      now,
      data.contentBase64,
      existing.document_id
    );
    const current = getCssDocumentSummaryById(db, existing.document_id);
    if (!current) {
      throw new Error('Documento duplicato trovato ma non recuperabile');
    }
    return { ...current, reusedExisting: true };
  }

  const documentId = randomUUID();

  db.prepare(`
    INSERT INTO css_meeting_documents (
      document_id, filename, mime_type, file_type, file_hash, content_base64,
      extracted_text, extraction_status, extraction_error, uploaded_by, uploaded_at, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, ?, ?, NULL)
  `).run(
    documentId,
    data.filename.trim(),
    data.mimeType?.trim() || null,
    fileType,
    fileHash,
    data.contentBase64,
    data.uploadedBy?.trim() || null,
    now
  );

  const inserted = getCssDocumentSummaryById(db, documentId);
  if (!inserted) {
    throw new Error('Documento creato ma non recuperabile');
  }
  return inserted;
};

type DocumentSummaryRow = {
  document_id: string;
  filename: string;
  mime_type: string | null;
  file_type: 'docx' | 'doc' | 'pdf';
  extraction_status: 'pending' | 'processed' | 'failed';
  extraction_error: string | null;
  uploaded_at: string;
  processed_at: string | null;
  analysis_count: number;
  last_batch_id: string | null;
  last_analyzed_at: string | null;
  last_ai_provider: string | null;
  last_ai_model: string | null;
  last_extraction_notes: string | null;
};

const mapDocumentSummary = (row: DocumentSummaryRow): CssDocument => ({
  documentId: row.document_id,
  filename: row.filename,
  mimeType: row.mime_type,
  fileType: row.file_type,
  extractionStatus: row.extraction_status,
  extractionError: row.extraction_error,
  uploadedAt: row.uploaded_at,
  processedAt: row.processed_at,
  analysisCount: Number(row.analysis_count) || 0,
  lastBatchId: row.last_batch_id,
  lastAnalyzedAt: row.last_analyzed_at,
  lastAiProvider: row.last_ai_provider,
  lastAiModel: row.last_ai_model,
  lastExtractionNotes: row.last_extraction_notes
});

const DOCS_SUMMARY_CTE = `
  WITH ranked_docs AS (
    SELECT
      d.document_id,
      d.filename,
      d.mime_type,
      d.file_type,
      d.file_hash,
      d.extraction_status,
      d.extraction_error,
      d.uploaded_at,
      d.processed_at,
      ROW_NUMBER() OVER (PARTITION BY d.file_hash ORDER BY d.uploaded_at DESC, d.document_id DESC) AS row_num
    FROM css_meeting_documents d
  ),
  latest_docs AS (
    SELECT *
    FROM ranked_docs
    WHERE row_num = 1
  )
`;

const getCssDocumentSummaryById = (db: Database.Database, documentId: string): CssDocument | null => {
  const row = db.prepare(`
    ${DOCS_SUMMARY_CTE}
    SELECT
      ld.document_id,
      ld.filename,
      ld.mime_type,
      ld.file_type,
      ld.extraction_status,
      ld.extraction_error,
      ld.uploaded_at,
      ld.processed_at,
      (
        SELECT COUNT(*)
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
      ) AS analysis_count,
      (
        SELECT vb.batch_id
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
        ORDER BY vb.created_at DESC
        LIMIT 1
      ) AS last_batch_id,
      (
        SELECT vb.created_at
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
        ORDER BY vb.created_at DESC
        LIMIT 1
      ) AS last_analyzed_at,
      (
        SELECT vb.ai_provider
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
        ORDER BY vb.created_at DESC
        LIMIT 1
      ) AS last_ai_provider,
      (
        SELECT vb.ai_model
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
        ORDER BY vb.created_at DESC
        LIMIT 1
      ) AS last_ai_model,
      (
        SELECT vb.extraction_notes
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
        ORDER BY vb.created_at DESC
        LIMIT 1
      ) AS last_extraction_notes
    FROM latest_docs ld
    WHERE ld.document_id = ?
  `).get(documentId) as DocumentSummaryRow | undefined;

  return row ? mapDocumentSummary(row) : null;
};

export const listCssDocuments = (db: Database.Database): CssDocument[] => {
  const rows = db.prepare(`
    ${DOCS_SUMMARY_CTE}
    SELECT
      ld.document_id,
      ld.filename,
      ld.mime_type,
      ld.file_type,
      ld.extraction_status,
      ld.extraction_error,
      ld.uploaded_at,
      ld.processed_at,
      (
        SELECT COUNT(*)
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
      ) AS analysis_count,
      (
        SELECT vb.batch_id
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
        ORDER BY vb.created_at DESC
        LIMIT 1
      ) AS last_batch_id,
      (
        SELECT vb.created_at
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
        ORDER BY vb.created_at DESC
        LIMIT 1
      ) AS last_analyzed_at,
      (
        SELECT vb.ai_provider
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
        ORDER BY vb.created_at DESC
        LIMIT 1
      ) AS last_ai_provider,
      (
        SELECT vb.ai_model
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
        ORDER BY vb.created_at DESC
        LIMIT 1
      ) AS last_ai_model,
      (
        SELECT vb.extraction_notes
        FROM css_validation_batches vb
        JOIN css_meeting_documents d2 ON d2.document_id = vb.document_id
        WHERE d2.file_hash = ld.file_hash
        ORDER BY vb.created_at DESC
        LIMIT 1
      ) AS last_extraction_notes
    FROM latest_docs ld
    ORDER BY ld.uploaded_at DESC
    LIMIT 50
  `).all() as DocumentSummaryRow[];
  return rows.map(mapDocumentSummary);
};

export const listCssDocumentBatches = (db: Database.Database, documentId: string): CssDocumentBatchSummary[] => {
  const document = db.prepare(`
    SELECT file_hash
    FROM css_meeting_documents
    WHERE document_id = ?
  `).get(documentId) as { file_hash: string } | undefined;
  if (!document) {
    throw new Error('Documento non trovato');
  }

  const rows = db.prepare(`
    SELECT
      vb.batch_id,
      vb.document_id,
      vb.status,
      vb.ai_provider,
      vb.ai_model,
      vb.extraction_notes,
      vb.created_at,
      vb.validated_at,
      vb.validated_by,
      (
        SELECT COUNT(*)
        FROM css_activity_proposals p
        WHERE p.batch_id = vb.batch_id
      ) AS proposal_count
    FROM css_validation_batches vb
    JOIN css_meeting_documents d ON d.document_id = vb.document_id
    WHERE d.file_hash = ?
    ORDER BY vb.created_at DESC
    LIMIT 40
  `).all(document.file_hash) as Array<{
    batch_id: string;
    document_id: string;
    status: string;
    ai_provider: string;
    ai_model: string | null;
    extraction_notes: string | null;
    created_at: string;
    validated_at: string | null;
    validated_by: string | null;
    proposal_count: number;
  }>;

  return rows.map((row) => ({
    batchId: row.batch_id,
    documentId: row.document_id,
    status: row.status,
    aiProvider: row.ai_provider,
    aiModel: row.ai_model,
    extractionNotes: row.extraction_notes,
    proposalCount: Number(row.proposal_count) || 0,
    createdAt: row.created_at,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by
  }));
};

export const deleteCssDocument = (
  db: Database.Database,
  documentId: string
): { deletedDocuments: number; deletedBatches: number; deletedProposals: number } => {
  const document = db.prepare(`
    SELECT file_hash
    FROM css_meeting_documents
    WHERE document_id = ?
  `).get(documentId) as { file_hash: string } | undefined;
  if (!document) {
    throw new Error('Documento non trovato');
  }

  const deleted = db.transaction(() => {
    const deletedBatches = db.prepare(`
      SELECT COUNT(*) AS count
      FROM css_validation_batches vb
      JOIN css_meeting_documents d ON d.document_id = vb.document_id
      WHERE d.file_hash = ?
    `).get(document.file_hash) as { count: number };

    const deletedProposals = db.prepare(`
      SELECT COUNT(*) AS count
      FROM css_activity_proposals p
      JOIN css_validation_batches vb ON vb.batch_id = p.batch_id
      JOIN css_meeting_documents d ON d.document_id = vb.document_id
      WHERE d.file_hash = ?
    `).get(document.file_hash) as { count: number };

    const removedDocs = db.prepare(`
      DELETE FROM css_meeting_documents
      WHERE file_hash = ?
    `).run(document.file_hash);

    return {
      deletedDocuments: removedDocs.changes,
      deletedBatches: Number(deletedBatches.count) || 0,
      deletedProposals: Number(deletedProposals.count) || 0
    };
  })();

  return deleted;
};

export const bulkUpdateCssActivityStatus = (
  db: Database.Database,
  data: { activityIds: string[]; issueStatus: string }
): { updated: number } => {
  const ids = data.activityIds.filter((id) => id && id.trim().length > 0);
  if (ids.length === 0) {
    throw new Error('Nessuna attività selezionata');
  }
  const status = sanitizeIssueStatus(data.issueStatus);
  const placeholders = ids.map(() => '?').join(',');
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE css_activities
    SET issue_status = ?, updated_at = ?
    WHERE activity_id IN (${placeholders})
  `).run(status, now, ...ids);
  return { updated: result.changes };
};

export const processCssDocument = async (
  db: Database.Database,
  documentId: string
): Promise<{ batchId: string; proposals: CssProposal[]; aiProvider: string; aiModel: string | null; notes: string | null }> => {
  const document = db.prepare(`
    SELECT document_id, filename, file_type, content_base64
    FROM css_meeting_documents
    WHERE document_id = ?
  `).get(documentId) as {
    document_id: string;
    filename: string;
    file_type: 'docx' | 'doc' | 'pdf';
    content_base64: string;
  } | undefined;
  if (!document) {
    throw new Error('Documento non trovato');
  }

  const buffer = Buffer.from(document.content_base64, 'base64');
  let extractedText = '';
  if (document.file_type === 'docx') {
    extractedText = await extractTextFromDocx(buffer);
  } else if (document.file_type === 'doc') {
    extractedText = extractTextFromDoc(buffer);
  } else {
    extractedText = extractTextFromPdf(buffer);
  }

  if (!extractedText.trim()) {
    db.prepare(`
      UPDATE css_meeting_documents
      SET extraction_status = 'failed', extraction_error = ?, processed_at = ?
      WHERE document_id = ?
    `).run('Nessun testo estraibile trovato nel documento', new Date().toISOString(), documentId);
    throw new Error('Nessun testo estraibile trovato nel documento');
  }

  const extractionMode = getCssExtractionMode();
  const aiEnabled = shouldUseAzureOpenAi();
  let aiProvider = 'none';
  let aiModel: string | null = null;
  const notes: string[] = [`mode=${extractionMode}`];

  const heuristic = dedupeProposals(
    extractWithHeuristics(extractedText)
      .map((proposal) => normalizeDraftProposal(proposal))
      .filter((proposal): proposal is Omit<CssProposal, 'proposalId' | 'batchId' | 'decisionStatus' | 'decisionNote' | 'createdAt' | 'updatedAt'> => Boolean(proposal))
  );

  const runAzureExtraction = async (): Promise<Array<Omit<CssProposal, 'proposalId' | 'batchId' | 'decisionStatus' | 'decisionNote' | 'createdAt' | 'updatedAt'>>> => {
    const extractedPayloads = await extractWithAzureOpenAi(extractedText);
    aiProvider = 'azure_openai';
    aiModel = process.env.AZURE_OPENAI_DEPLOYMENT || null;
    const aiProposals = extractedPayloads
      .map((payload) => normalizeProposalPayload(payload))
      .filter((payload): payload is CssProposalPayload => Boolean(payload))
      .map((payload) => ({
        actionType: 'create' as const,
        targetActivityId: null,
        confidence: 0.82,
        payload
      }));
    return dedupeProposals(aiProposals);
  };

  let merged: Array<Omit<CssProposal, 'proposalId' | 'batchId' | 'decisionStatus' | 'decisionNote' | 'createdAt' | 'updatedAt'>> = [];

  if (extractionMode === 'heuristic_only') {
    merged = heuristic;
    notes.push(`heuristic=${heuristic.length}`);
  } else if (extractionMode === 'azure_only') {
    if (!aiEnabled) {
      throw new Error('Modalità azure_only attiva ma Azure OpenAI non configurato');
    }
    merged = await runAzureExtraction();
    notes.push(`azure=${merged.length}`);
  } else {
    notes.push(`heuristic=${heuristic.length}`);
    if (aiEnabled) {
      try {
        const azure = await runAzureExtraction();
        notes.push(`azure=${azure.length}`);
        // In auto mode prefer AI candidates, but keep heuristic-only insights as fallback.
        merged = dedupeProposals([...azure, ...heuristic]);
        if (azure.length > 0 && heuristic.length > 0) {
          aiProvider = 'hybrid';
        }
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : 'errore sconosciuto';
        const compactMessage = rawMessage.replace(/\s+/g, ' ').slice(0, 140);
        notes.push(`azure_error=${compactMessage}`);
        merged = heuristic;
      }
    } else {
      notes.push('azure=disabled');
      merged = heuristic;
    }
  }

  if (merged.length === 0) {
    const fallbackCustomer = inferPrimaryCustomerName(extractedText) ?? 'Cliente da validare';
    merged = [
      {
        actionType: 'create',
        targetActivityId: null,
        confidence: 0.35,
        payload: {
          customerName: fallbackCustomer,
          issue: 'Review meeting report e definire azioni operative',
          issueStatus: 'Action required',
          details: normalizeText(extractedText).slice(0, 400),
          lastUpdate: new Date().toISOString().slice(0, 10)
        }
      }
    ];
    notes.push('manual_review_fallback=1');
  }

  const extractionNotes = notes.join(' | ');

  const now = new Date().toISOString();
  const batchId = randomUUID();
  db.prepare(`
    INSERT INTO css_validation_batches (
      batch_id, document_id, ai_provider, ai_model, extraction_notes, status, created_at, validated_at, validated_by
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?, NULL, NULL)
  `).run(batchId, documentId, aiProvider, aiModel, extractionNotes, now);

  const insertProposal = db.prepare(`
    INSERT INTO css_activity_proposals (
      proposal_id, batch_id, action_type, target_activity_id, payload_json, confidence, decision_status, decision_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
  `);

  for (const proposal of merged) {
    const match = findMatchingActivity(db, proposal.payload);
    insertProposal.run(
      randomUUID(),
      batchId,
      match ? 'update' : proposal.actionType,
      match?.activity_id ?? null,
      JSON.stringify(proposal.payload),
      proposal.confidence,
      now,
      now
    );
  }

  db.prepare(`
    UPDATE css_meeting_documents
    SET extracted_text = ?, extraction_status = 'processed', extraction_error = NULL, processed_at = ?
    WHERE document_id = ?
  `).run(extractedText, now, documentId);

  return {
    batchId,
    proposals: getCssProposalsByBatch(db, batchId),
    aiProvider,
    aiModel,
    notes: extractionNotes
  };
};

export const getCssProposalsByBatch = (db: Database.Database, batchId: string): CssProposal[] => {
  const rows = db.prepare(`
    SELECT proposal_id, batch_id, action_type, target_activity_id, payload_json, confidence,
           decision_status, decision_note, created_at, updated_at
    FROM css_activity_proposals
    WHERE batch_id = ?
    ORDER BY created_at ASC
  `).all(batchId) as ProposalRow[];

  return rows.map(toProposal);
};

export const validateCssBatch = (
  db: Database.Database,
  batchId: string,
  data: {
    reviewer?: string | null;
    approveAll?: boolean;
    decisions?: Array<{
      proposalId: string;
      decision: 'approved' | 'rejected';
      note?: string | null;
      payloadOverride?: Partial<CssProposalPayload>;
    }>;
  }
): { applied: number; rejected: number; proposals: CssProposal[] } => {
  const batch = db
    .prepare(`SELECT batch_id, status FROM css_validation_batches WHERE batch_id = ?`)
    .get(batchId) as { batch_id: string; status: string } | undefined;
  if (!batch) {
    throw new Error('Batch non trovato');
  }
  if (batch.status === 'validated') {
    throw new Error('Batch già validato');
  }

  const existing = getCssProposalsByBatch(db, batchId);
  if (existing.length === 0) {
    throw new Error('Nessuna proposta da validare');
  }

  const decisionsMap = new Map<string, {
    decision: 'approved' | 'rejected';
    note?: string | null;
    payloadOverride?: Partial<CssProposalPayload>;
  }>();
  (data.decisions ?? []).forEach((decision) => {
    decisionsMap.set(decision.proposalId, decision);
  });

  const transaction = db.transaction(() => {
    let applied = 0;
    let rejected = 0;
    for (const proposal of existing) {
      const decision = decisionsMap.get(proposal.proposalId);
      const finalDecision: 'approved' | 'rejected' =
        decision?.decision ?? (data.approveAll ? 'approved' : 'rejected');
      const mergedPayload = {
        ...proposal.payload,
        ...(decision?.payloadOverride ?? {})
      };
      mergedPayload.lastUpdate = normalizeDate(mergedPayload.lastUpdate) ?? new Date().toISOString().slice(0, 10);
      mergedPayload.details = prependDateToDetails(mergedPayload.lastUpdate, mergedPayload.details);

      if (finalDecision === 'approved') {
        if (proposal.actionType === 'update' && proposal.targetActivityId) {
          updateCssActivity(db, proposal.targetActivityId, {
            customerName: mergedPayload.customerName,
            cssOwner: mergedPayload.cssOwner ?? null,
            lastUpdate: mergedPayload.lastUpdate ?? null,
            blBu: mergedPayload.blBu ?? null,
            issue: mergedPayload.issue,
            issueStatus: mergedPayload.issueStatus,
            details: mergedPayload.details ?? null
          });
        } else {
          createCssActivity(db, {
            customerName: mergedPayload.customerName,
            cssOwner: mergedPayload.cssOwner ?? null,
            lastUpdate: mergedPayload.lastUpdate ?? null,
            blBu: mergedPayload.blBu ?? null,
            issue: mergedPayload.issue,
            issueStatus: mergedPayload.issueStatus,
            details: mergedPayload.details ?? null,
            sourceRef: `batch:${batchId}`
          });
        }
        applied += 1;
      } else {
        rejected += 1;
      }

      db.prepare(`
        UPDATE css_activity_proposals
        SET decision_status = ?, decision_note = ?, payload_json = ?, updated_at = ?
        WHERE proposal_id = ?
      `).run(
        finalDecision,
        decision?.note?.trim() || null,
        JSON.stringify(mergedPayload),
        new Date().toISOString(),
        proposal.proposalId
      );
    }

    db.prepare(`
      UPDATE css_validation_batches
      SET status = 'validated', validated_at = ?, validated_by = ?
      WHERE batch_id = ?
    `).run(new Date().toISOString(), data.reviewer?.trim() || null, batchId);

    return { applied, rejected };
  });

  const result = transaction();
  return {
    applied: result.applied,
    rejected: result.rejected,
    proposals: getCssProposalsByBatch(db, batchId)
  };
};
