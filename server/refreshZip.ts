import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export type RefreshSource = 'microsoft' | 'eos';

type LatestManifest = {
  microsoft?: string;
  eos?: string;
};

type SnapshotPayload = {
  version: number;
  items: unknown[];
};

const resolveAppVersion = async (): Promise<string> => {
  const pkgPath = path.resolve(repoRoot, 'package.json');
  const raw = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? '0.0.0';
};

const resolveGitCommit = (): string => {
  const envCommit = process.env.VITE_GIT_COMMIT || process.env.GIT_COMMIT;
  if (envCommit) {
    return envCommit.slice(0, 12);
  }
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
};

const runRefreshScripts = async (sources: RefreshSource[]): Promise<void> => {
  if (sources.includes('microsoft')) {
    await execAsync('npm run refresh:microsoft', { cwd: repoRoot });
  }
  if (sources.includes('eos')) {
    await execAsync('npm run refresh:eos', { cwd: repoRoot });
  }
};

const readJson = async <T,>(filePath: string): Promise<T> => {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as T;
};

const loadSnapshot = async (filename: string): Promise<SnapshotPayload> => {
  const snapshotPath = path.resolve(repoRoot, 'public', 'data', filename);
  return readJson<SnapshotPayload>(snapshotPath);
};

export type RefreshZipResult = {
  zipBuffer: Buffer;
  manifest: {
    generatedAt: string;
    appVersion: string;
    gitCommit: string;
    sources: RefreshSource[];
    items: {
      microsoft: number;
      eos: number;
    };
    files: {
      latest: string;
      microsoft?: string;
      eos?: string;
    };
  };
};

export const buildRefreshZip = async (
  sources: RefreshSource[]
): Promise<RefreshZipResult> => {
  const refreshSources = sources.length > 0 ? sources : ['microsoft', 'eos'];
  await runRefreshScripts(refreshSources);

  const latestPath = path.resolve(repoRoot, 'public', 'data', 'latest.json');
  const latest = await readJson<LatestManifest>(latestPath);

  const microsoftFile = latest.microsoft;
  const eosFile = latest.eos;

  const microsoftPayload = microsoftFile ? await loadSnapshot(microsoftFile) : null;
  const eosPayload = eosFile ? await loadSnapshot(eosFile) : null;

  const appVersion = await resolveAppVersion();
  const gitCommit = resolveGitCommit();
  const generatedAt = new Date().toISOString();

  const manifest = {
    generatedAt,
    appVersion,
    gitCommit,
    sources: refreshSources,
    items: {
      microsoft: microsoftPayload?.items.length ?? 0,
      eos: eosPayload?.items.length ?? 0
    },
    files: {
      latest: 'data/latest.json',
      microsoft: microsoftFile ? `data/${microsoftFile}` : undefined,
      eos: eosFile ? `data/${eosFile}` : undefined
    }
  };

  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const dataFolder = zip.folder('data');
  if (!dataFolder) {
    throw new Error('Impossibile creare la cartella data nello ZIP.');
  }

  const latestRaw = await readFile(latestPath, 'utf-8');
  dataFolder.file('latest.json', latestRaw);

  if (microsoftFile && microsoftPayload) {
    const msRaw = await readFile(
      path.resolve(repoRoot, 'public', 'data', microsoftFile),
      'utf-8'
    );
    dataFolder.file(microsoftFile, msRaw);
  }

  if (eosFile && eosPayload) {
    const eosRaw = await readFile(
      path.resolve(repoRoot, 'public', 'data', eosFile),
      'utf-8'
    );
    dataFolder.file(eosFile, eosRaw);
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });

  return { zipBuffer, manifest };
};
