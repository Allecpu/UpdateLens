import cron from 'node-cron';
import { spawn } from 'node:child_process';

const DEFAULT_CRON = '0 */6 * * *';

export const runScheduledIngest = () => {
  const schedule = process.env.RELEASEPLANS_CRON ?? DEFAULT_CRON;
  cron.schedule(schedule, () => {
    const child = spawn('node', ['--loader', 'tsx', 'server/ingest.ts'], {
      stdio: 'inherit',
      env: process.env
    });
    child.on('error', (error) => {
      console.error('[Scheduler] Ingest spawn error:', error);
    });
  });
  console.log(`[Scheduler] Ingest scheduled with cron "${schedule}"`);
};
