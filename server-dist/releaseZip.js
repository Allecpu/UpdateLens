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
const addFolderToZip = async (zip, folderPath, basePath) => {
    const entries = await readdir(folderPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            await addFolderToZip(zip, fullPath, basePath);
        }
        else if (entry.isFile()) {
            const contents = await readFile(fullPath);
            zip.file(relativePath, contents);
        }
    }
};
export const buildReleaseZip = async () => {
    try {
        // Increase maxBuffer to 10MB to prevent crashes on large build outputs
        await execAsync('npm run build:release', { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 });
    }
    catch (error) {
        const stderr = error.stderr ? `\nSTDERR:\n${error.stderr}` : '';
        const stdout = error.stdout ? `\nSTDOUT:\n${error.stdout}` : '';
        throw new Error(`Build failed: ${error.message}${stderr}${stdout}`);
    }
    try {
        await stat(releaseDir);
    }
    catch {
        throw new Error(`Release directory not found at: ${releaseDir}`);
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
