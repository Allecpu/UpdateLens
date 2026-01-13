import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { lastUpdateDate, lastUpdateTitle } from './src/version';

const resolveAppVersion = () => {
  const pkgPath = path.resolve(__dirname, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
  return pkg.version ?? '0.0.0';
};

const resolveGitCommit = () => {
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

const appVersion = resolveAppVersion();
const buildTime = new Date().toISOString();
const gitCommit = resolveGitCommit();
const lastUpdateLabel = lastUpdateDate ? `${lastUpdateTitle} (${lastUpdateDate})` : lastUpdateTitle;
const versionStamp = [
  '<!-- app-version-stamp -->',
  `<meta name="app-version" content="${appVersion}" />`,
  `<meta name="app-build-time" content="${buildTime}" />`,
  `<meta name="app-last-update" content="${lastUpdateLabel}" />`,
  `<meta name="app-git-commit" content="${gitCommit}" />`,
  `<!-- UpdateLens v${appVersion} | build: ${buildTime} | lastUpdate: ${lastUpdateLabel} -->`
].join('\n    ');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'inject-version-stamp',
      transformIndexHtml(html) {
        if (html.includes('<!-- app-version-stamp -->')) {
          return html.replace('<!-- app-version-stamp -->', versionStamp);
        }
        return html.replace('</title>', `</title>\n    ${versionStamp}`);
      }
    }
  ],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(buildTime),
    __GIT_COMMIT__: JSON.stringify(gitCommit)
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
    }
  },
  build: {
    chunkSizeWarningLimit: 9000
  }
});
