import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { equiShareSchemaSql } from './schema.js';

type SqliteDatabase = Database.Database;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.resolve(__dirname, '../../data');
const databasePath = path.join(dataDirectory, 'equishare.sqlite');

mkdirSync(dataDirectory, { recursive: true });

const db: SqliteDatabase = new Database(databasePath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function initializeDatabase(): SqliteDatabase {
  db.exec(equiShareSchemaSql);
  const columns = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  const hasPasswordHash = columns.some((column) => column.name === 'password_hash');
  if (!hasPasswordHash) {
    db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
  }
  return db;
}

export function getDatabase(): SqliteDatabase {
  return db;
}

export function toCurrency(amountCents: number) {
  return Number((amountCents / 100).toFixed(2));
}
