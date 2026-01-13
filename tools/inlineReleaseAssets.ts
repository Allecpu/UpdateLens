import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const releaseDir = path.resolve('release');
const publicDataDir = path.resolve('public', 'data');
const configDir = path.resolve('src', 'data', 'config');

const htmlPath = path.join(distDir, 'index.html');
const releaseHtmlPath = path.join(releaseDir, 'index.html');

const readAsset = async (href: string): Promise<string> => {
  const assetPath = path.join(distDir, href.replace(/^\.\//, ''));
  return readFile(assetPath, 'utf-8');
};

const inlineAssets = async (): Promise<void> => {
  await mkdir(releaseDir, { recursive: true });
  await cp(distDir, releaseDir, { recursive: true, force: true, filter: (src) => !src.endsWith(`${path.sep}index.html`) });
  await mkdir(path.join(releaseDir, 'data'), { recursive: true });
  await cp(publicDataDir, path.join(releaseDir, 'data'), { recursive: true, force: true });
  await mkdir(path.join(releaseDir, 'data', 'config'), { recursive: true });
  await cp(configDir, path.join(releaseDir, 'data', 'config'), { recursive: true, force: true });

  let html = await readFile(htmlPath, 'utf-8');

  html = html.replace(
    /<link[^>]+rel=["']modulepreload["'][^>]*>\s*/g,
    ''
  );

  const cssLinks = Array.from(
    html.matchAll(
      /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g
    )
  );
  for (const match of cssLinks) {
    const href = match[1];
    const css = await readAsset(href);
    const styleTag = `<style>\n${css}\n</style>`;
    html = html.replace(match[0], () => styleTag);
  }

  const moduleScripts = Array.from(
    html.matchAll(
      /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*><\/script>/g
    )
  );
  for (const match of moduleScripts) {
    const src = match[1];
    const js = await readAsset(src);
    const safeJs = js.replace(/<\/script>/gi, '<\\/script>');
    const scriptTag = `<script type="module">\n${safeJs}\n</script>`;
    html = html.replace(match[0], () => scriptTag);
  }

  await writeFile(releaseHtmlPath, html, 'utf-8');
  console.log(`Release HTML inline salvato: ${releaseHtmlPath}`);
};

inlineAssets().catch((error) => {
  console.error('Errore inline release assets:', error);
  process.exitCode = 1;
});
