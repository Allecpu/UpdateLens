import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { initSchema } from '../server/schema.js';
import { processCssDocument, uploadCssDocument, type CssProposal } from '../server/css.js';

type ExpectedItem = {
  customerName: string;
  issueKeywords: string[];
};

type GoldenCase = {
  id: string;
  filePath: string;
  expected: ExpectedItem[];
};

type GoldenConfig = {
  version: number;
  thresholds: {
    precisionMin: number;
  };
  cases: GoldenCase[];
};

type Metrics = {
  tp: number;
  tpAssisted: number;
  accepted: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const isCustomerMatch = (proposal: CssProposal, expected: ExpectedItem): boolean =>
  normalize(proposal.payload.customerName) === normalize(expected.customerName);

const hasIssueKeywordMatch = (proposal: CssProposal, expected: ExpectedItem): boolean => {
  const issue = normalize(proposal.payload.issue);
  return expected.issueKeywords.some((keyword) => issue.includes(normalize(keyword)));
};

const runExtraction = async (filePath: string, mode: 'heuristic_only' | 'auto_heuristic_first') => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initSchema(db);

  const fileBuffer = fs.readFileSync(filePath);
  const previousMode = process.env.CSS_IMPORT_EXTRACTION_MODE;
  process.env.CSS_IMPORT_EXTRACTION_MODE = mode;
  try {
    const uploaded = await uploadCssDocument(db, {
      filename: path.basename(filePath),
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      contentBase64: fileBuffer.toString('base64'),
      uploadedBy: 'test-css-extract'
    });
    const result = await processCssDocument(db, uploaded.documentId);
    return result;
  } finally {
    process.env.CSS_IMPORT_EXTRACTION_MODE = previousMode;
    db.close();
  }
};

const formatPct = (value: number): string => `${(value * 100).toFixed(1)}%`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const aiJudgeActionable = async (proposal: CssProposal): Promise<boolean | null> => {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21';
  if (!endpoint || !apiKey || !deployment) {
    return null;
  }

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const prompt = [
    'Valuta se questa proposta è una azione concreta e utile da tracciare in una lista attività CSS cliente.',
    'Rispondi SOLO JSON: {"keep":true|false}.',
    `customerName: ${proposal.payload.customerName}`,
    `issue: ${proposal.payload.issue}`,
    `details: ${proposal.payload.details ?? ''}`,
    `status: ${proposal.payload.issueStatus}`
  ].join('\n');

  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a strict JSON classifier.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      })
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return null;
      const parsed = JSON.parse(content) as { keep?: boolean };
      return parsed.keep === true;
    }

    if ((response.status === 429 || response.status === 503) && attempt < maxAttempts - 1) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    return null;
  }
  return null;
};

const computeMetrics = async (
  proposals: CssProposal[],
  expectedItems: ExpectedItem[],
  useAiAssist: boolean
): Promise<Metrics> => {
  const matchedProposalIndexes = new Set<number>();
  const matchedExpectedIndexes = new Set<number>();

  expectedItems.forEach((expectedItem, expectedIndex) => {
    const proposalIndex = proposals.findIndex((proposal, idx) => {
      if (matchedProposalIndexes.has(idx)) return false;
      return isCustomerMatch(proposal, expectedItem) && hasIssueKeywordMatch(proposal, expectedItem);
    });
    if (proposalIndex >= 0) {
      matchedProposalIndexes.add(proposalIndex);
      matchedExpectedIndexes.add(expectedIndex);
    }
  });

  let tpAssisted = 0;
  if (useAiAssist) {
    for (let idx = 0; idx < proposals.length; idx += 1) {
      if (matchedProposalIndexes.has(idx)) continue;
      const keep = await aiJudgeActionable(proposals[idx]);
      if (keep === true) {
        matchedProposalIndexes.add(idx);
        tpAssisted += 1;
      }
    }
  }

  const tp = matchedExpectedIndexes.size;
  const accepted = matchedProposalIndexes.size;
  const fp = Math.max(0, proposals.length - accepted);
  const fn = Math.max(0, expectedItems.length - matchedExpectedIndexes.size);
  const precision = proposals.length > 0 ? accepted / proposals.length : 0;
  const recall = expectedItems.length > 0 ? tp / expectedItems.length : 0;

  return { tp, tpAssisted, accepted, fp, fn, precision, recall };
};

const run = async () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(currentDir, '..');
  const fixturePath = path.resolve(root, 'tools', 'fixtures', 'cssExtractGolden.json');
  const fixtureRaw = fs.readFileSync(fixturePath, 'utf-8');
  const golden = JSON.parse(fixtureRaw) as GoldenConfig;

  const requireAi = (process.env.CSS_EXTRACT_REQUIRE_AI ?? 'false').toLowerCase() === 'true';
  const hasAzureConfig =
    !!process.env.AZURE_OPENAI_ENDPOINT &&
    !!process.env.AZURE_OPENAI_API_KEY &&
    !!process.env.AZURE_OPENAI_DEPLOYMENT;

  if (requireAi && !hasAzureConfig) {
    throw new Error('CSS benchmark richiede AI ma AZURE_OPENAI_* non è configurato.');
  }

  const useAiAssist = hasAzureConfig;
  let heuristicTotals: Metrics = { tp: 0, tpAssisted: 0, accepted: 0, fp: 0, fn: 0, precision: 0, recall: 0 };
  let hybridTotals: Metrics = { tp: 0, tpAssisted: 0, accepted: 0, fp: 0, fn: 0, precision: 0, recall: 0 };
  let heuristicCount = 0;
  let hybridCount = 0;

  for (const testCase of golden.cases) {
    const absoluteFilePath = path.resolve(root, testCase.filePath);
    assert.ok(fs.existsSync(absoluteFilePath), `File fixture non trovato: ${testCase.filePath}`);

    const heuristic = await runExtraction(absoluteFilePath, 'heuristic_only');
    const heuristicMetrics = await computeMetrics(heuristic.proposals, testCase.expected, false);
    heuristicTotals.tp += heuristicMetrics.tp;
    heuristicTotals.fp += heuristicMetrics.fp;
    heuristicTotals.fn += heuristicMetrics.fn;
    heuristicTotals.accepted += heuristicMetrics.accepted;
    heuristicCount += heuristic.proposals.length;

    const hybrid = await runExtraction(absoluteFilePath, 'auto_heuristic_first');
    const hybridMetrics = await computeMetrics(hybrid.proposals, testCase.expected, useAiAssist);
    hybridTotals.tp += hybridMetrics.tp;
    hybridTotals.accepted += hybridMetrics.accepted;
    hybridTotals.fp += hybridMetrics.fp;
    hybridTotals.fn += hybridMetrics.fn;
    hybridCount += hybrid.proposals.length;

    console.log(`[test:css-extract] case=${testCase.id} heuristic=${heuristic.proposals.length} (${heuristic.notes ?? '-'}) hybrid=${hybrid.proposals.length} (${hybrid.notes ?? '-'}) hybrid_assisted=${hybridMetrics.tpAssisted}`);
  }

  const heuristicPrecision = heuristicCount > 0 ? heuristicTotals.accepted / heuristicCount : 0;
  const hybridPrecision = hybridCount > 0 ? hybridTotals.accepted / hybridCount : 0;
  const hybridDenominator = hybridTotals.tp + hybridTotals.fn;
  const hybridRecall = hybridDenominator > 0 ? hybridTotals.tp / hybridDenominator : 0;

  const precisionMin = golden.thresholds.precisionMin;
  console.log(`[test:css-extract] precision heuristic=${formatPct(heuristicPrecision)} hybrid=${formatPct(hybridPrecision)} recall_hybrid=${formatPct(hybridRecall)} target=${formatPct(precisionMin)} ai_assist=${useAiAssist}`);

  const enforceGate = requireAi || hasAzureConfig;
  if (!enforceGate) {
    console.log('[test:css-extract] AZURE_OPENAI_* non configurato: benchmark informativo, gate non bloccante.');
    console.log('[test:css-extract] OK');
    return;
  }

  if (hybridPrecision < precisionMin) {
    throw new Error(
      `Precisione hybrid sotto soglia: ${formatPct(hybridPrecision)} < ${formatPct(precisionMin)}`
    );
  }

  if (hasAzureConfig && hybridPrecision < heuristicPrecision) {
    throw new Error(
      `Hybrid peggiore di heuristic: ${formatPct(hybridPrecision)} < ${formatPct(heuristicPrecision)}`
    );
  }

  console.log('[test:css-extract] OK');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
