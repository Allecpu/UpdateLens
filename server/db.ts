import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { initSchema } from './schema';

const resolveDbPath = (): string => {
  const baseDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return path.join(baseDir, 'releaseplans.db');
};

export const createDb = (): Database.Database => {
  const dbPath = resolveDbPath();
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
};
