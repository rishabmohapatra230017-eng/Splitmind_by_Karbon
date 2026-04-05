import { getDatabase, initializeDatabase } from './sqlite.js';

export function seedDatabase() {
  initializeDatabase();
  const db = getDatabase();
  db.prepare(`UPDATE users SET is_current_user = 0`).run();
  db.prepare(`UPDATE participants SET is_current_user = 0`).run();
}

export function resetSeedData() {
  initializeDatabase();
  const db = getDatabase();
  const currentUser = db.prepare(`SELECT name, email FROM users WHERE is_current_user = 1 LIMIT 1`).get() as
    | { name: string; email: string }
    | undefined;

  db.exec(`
    DELETE FROM expense_splits;
    DELETE FROM expenses;
    DELETE FROM participants;
    DELETE FROM groups;
    DELETE FROM users;
    DELETE FROM sqlite_sequence WHERE name IN ('users', 'groups', 'participants', 'expenses', 'expense_splits');
  `);

  if (currentUser) {
    db.prepare(
      `
      INSERT INTO users (name, email, is_current_user, created_at)
      VALUES (?, ?, 1, ?)
      `
    ).run(currentUser.name, currentUser.email, new Date().toISOString());
    return;
  }
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase();
  console.log('Prepared SplitMint database with no active user session');
}
