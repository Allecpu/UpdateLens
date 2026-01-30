/**
 * Azure WebJob - Triggers the GitHub Actions data refresh workflow
 * Scheduled to run monthly via Azure WebJobs
 */

const GITHUB_API = 'https://api.github.com';

async function triggerRefresh() {
  const token = process.env.GITHUB_ISSUES_TOKEN || process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || 'Allecpu';
  const repo = process.env.GITHUB_REPO || 'UpdateLens';
  const branch = process.env.GITHUB_REFRESH_BRANCH || 'main';

  if (!token) {
    console.error('[ERROR] GITHUB_TOKEN non configurato');
    process.exit(1);
  }

  console.log(`[INFO] Triggering refresh workflow on ${owner}/${repo}@${branch}`);
  console.log(`[INFO] Time: ${new Date().toISOString()}`);

  try {
    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/refresh-data.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'UpdateLens-WebJob'
        },
        body: JSON.stringify({ ref: branch })
      }
    );

    if (response.status === 204) {
      console.log('[SUCCESS] Workflow triggered successfully');
      console.log('[INFO] Data refresh is now running on GitHub Actions');
      process.exit(0);
    } else {
      const errorText = await response.text();
      console.error(`[ERROR] Failed to trigger workflow: HTTP ${response.status}`);
      console.error(`[ERROR] Response: ${errorText}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('[ERROR] Failed to call GitHub API:', error.message);
    process.exit(1);
  }
}

triggerRefresh();
