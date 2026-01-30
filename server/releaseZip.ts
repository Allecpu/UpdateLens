import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, stat } from 'node:fs/promises';
import JSZip from 'jszip';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const releaseDir = path.resolve(repoRoot, 'release');

const addFolderToZip = async (zip: JSZip, folderPath: string, basePath: string) => {
  const entries = await readdir(folderPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      await addFolderToZip(zip, fullPath, basePath);
    } else if (entry.isFile()) {
      const contents = await readFile(fullPath);
      zip.file(relativePath, contents);
    }
  }
};

export type ReleaseZipResult = {
  zipBuffer: Buffer;
  generatedAt: string;
};

export const buildReleaseZip = async (): Promise<ReleaseZipResult> => {
  // Check if pre-built release folder exists (deployed from CI)
  let releaseExists = false;
  try {
    await stat(releaseDir);
    releaseExists = true;
  } catch {
    releaseExists = false;
  }

  // Only run build if release folder doesn't exist (local dev or first run)
  if (!releaseExists) {
    try {
      // Increase maxBuffer to 10MB to prevent crashes on large build outputs
      await execAsync('npm run build:release', { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 });
    } catch (error: any) {
      const stderr = error.stderr ? `\nSTDERR:\n${error.stderr}` : '';
      const stdout = error.stdout ? `\nSTDOUT:\n${error.stdout}` : '';
      throw new Error(`Build failed: ${error.message}${stderr}${stdout}`);
    }

    // Verify release folder was created
    try {
      await stat(releaseDir);
    } catch {
      throw new Error(`Release directory not found at: ${releaseDir}`);
    }
  }

  const zip = new JSZip();
  await addFolderToZip(zip, releaseDir, releaseDir);

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });
  return {
    zipBuffer,
    generatedAt: new Date().toISOString()
  };
};
