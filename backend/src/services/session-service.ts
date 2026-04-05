import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { getDatabase } from '../database/sqlite.js';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(48),
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(128)
});

type CurrentUserRow = {
  id: number;
  name: string;
  email: string;
  password_hash: string | null;
};

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, 'hex');

  return original.length === derived.length && timingSafeEqual(original, derived);
}

export function getCurrentUserRow(): CurrentUserRow | null {
  const db = getDatabase();
  const currentUser = db
    .prepare(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE is_current_user = 1
       LIMIT 1`
    )
    .get() as CurrentUserRow | undefined;

  return currentUser ?? null;
}

export function requireCurrentUserRow(): CurrentUserRow {
  const currentUser = getCurrentUserRow();
  if (!currentUser) {
    throw new Error('You need to log in first');
  }

  return currentUser;
}

export function formatCurrentUser(currentUser: CurrentUserRow) {
  return {
    id: String(currentUser.id),
    name: currentUser.name,
    email: currentUser.email,
    initials: currentUser.name
      .split(' ')
      .map((chunk) => chunk[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    accentColor: 'mint'
  };
}

function seedWorkspaceForUser(userId: number, name: string) {
  const db = getDatabase();
  const existingGroup = db
    .prepare(
      `
      SELECT g.id
      FROM groups g
      INNER JOIN participants p ON p.group_id = g.id
      WHERE p.user_id = ?
      LIMIT 1
      `
    )
    .get(userId) as { id: number } | undefined;

  if (existingGroup) {
    return;
  }

  const now = new Date().toISOString();
  const starterTemplates = [
    {
      groupName: `${name.split(' ')[0]}'s Weekend Escape`,
      note: 'A starter workspace for quick trips, food runs, and stay bookings.',
      expense: {
        description: 'Stay booking',
        note: 'Starter expense for the group owner.',
        amountCents: 18600,
        expenseDate: '2026-04-02',
        friends: ['Priya Nair', 'Kabir Khanna']
      }
    },
    {
      groupName: `${name.split(' ')[0]}'s Flat Expenses`,
      note: 'A starter workspace for rent, groceries, and utility splits.',
      expense: {
        description: 'Groceries run',
        note: 'Starter pantry restock for the apartment.',
        amountCents: 2450,
        expenseDate: '2026-04-03',
        friends: ['Aisha Khan', 'Dev Patel']
      }
    },
    {
      groupName: `${name.split(' ')[0]}'s Cafe Crew`,
      note: 'A starter workspace for coffees, cabs, and casual shared expenses.',
      expense: {
        description: 'Cafe bill',
        note: 'Starter coffee and snacks expense.',
        amountCents: 1320,
        expenseDate: '2026-04-04',
        friends: ['Meera Joshi', 'Arjun Rao']
      }
    }
  ];
  const template = starterTemplates[userId % starterTemplates.length];

  const transaction = db.transaction(() => {
    const groupResult = db
      .prepare(
        `
        INSERT INTO groups (name, note, owner_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(
        template.groupName,
        template.note,
        userId,
        now,
        now
      );

    const groupId = Number(groupResult.lastInsertRowid);

    const insertParticipant = db.prepare(
      `
      INSERT INTO participants (group_id, user_id, name, color_token, is_current_user, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    );

    const currentParticipant = insertParticipant.run(groupId, userId, name, 'indigo', 1, now);
    const friendOne = insertParticipant.run(groupId, null, template.expense.friends[0], 'emerald', 0, now);
    const friendTwo = insertParticipant.run(groupId, null, template.expense.friends[1], 'amber', 0, now);

    const expenseResult = db
      .prepare(
        `
        INSERT INTO expenses (group_id, description, note, amount_cents, paid_by_participant_id, split_method, expense_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        groupId,
        template.expense.description,
        template.expense.note,
        template.expense.amountCents,
        Number(currentParticipant.lastInsertRowid),
        'equal',
        template.expense.expenseDate,
        now,
        now
      );

    const expenseId = Number(expenseResult.lastInsertRowid);
    const equalShare = Math.floor(template.expense.amountCents / 3);
    const insertSplit = db.prepare(
      `
      INSERT INTO expense_splits (expense_id, participant_id, amount_cents, percentage_basis_points)
      VALUES (?, ?, ?, ?)
      `
    );

    insertSplit.run(expenseId, Number(currentParticipant.lastInsertRowid), equalShare, null);
    insertSplit.run(expenseId, Number(friendOne.lastInsertRowid), equalShare, null);
    insertSplit.run(
      expenseId,
      Number(friendTwo.lastInsertRowid),
      template.expense.amountCents - equalShare - equalShare,
      null
    );
  });

  transaction();
}

export function register(payload: unknown) {
  const input = registerSchema.parse(payload);
  const db = getDatabase();
  const now = new Date().toISOString();
  const email = input.email.toLowerCase();

  const existingUser = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as { id: number } | undefined;
  if (existingUser) {
    throw new Error('An account with this email already exists');
  }

  const transaction = db.transaction(() => {
    db.prepare(`UPDATE users SET is_current_user = 0`).run();
    db.prepare(`UPDATE participants SET is_current_user = 0`).run();

    db.prepare(
      `
      INSERT INTO users (name, email, password_hash, is_current_user, created_at)
      VALUES (?, ?, ?, 1, ?)
      `
    ).run(input.name, email, hashPassword(input.password), now);

    const currentUser = requireCurrentUserRow();
    seedWorkspaceForUser(currentUser.id, currentUser.name);
    db.prepare(`UPDATE participants SET is_current_user = 1 WHERE user_id = ?`).run(currentUser.id);

    return currentUser;
  });

  return formatCurrentUser(transaction());
}

export function login(payload: unknown) {
  const input = loginSchema.parse(payload);
  const db = getDatabase();
  const email = input.email.toLowerCase();
  const existingUser = db
    .prepare(`SELECT id, name, email, password_hash FROM users WHERE email = ?`)
    .get(email) as CurrentUserRow | undefined;

  if (!existingUser || !existingUser.password_hash) {
    throw new Error('No account exists for this email');
  }

  if (!verifyPassword(input.password, existingUser.password_hash)) {
    throw new Error('Incorrect password');
  }

  const transaction = db.transaction(() => {
    db.prepare(`UPDATE users SET is_current_user = 0`).run();
    db.prepare(`UPDATE participants SET is_current_user = 0`).run();

    db.prepare(`UPDATE users SET is_current_user = 1 WHERE id = ?`).run(existingUser.id);

    const currentUser = requireCurrentUserRow();

    db.prepare(
      `
      UPDATE participants
      SET name = ?
      WHERE user_id = ?
      `
    ).run(currentUser.name, currentUser.id);

    db.prepare(
      `
      UPDATE participants
      SET is_current_user = 1
      WHERE user_id = ?
      `
    ).run(currentUser.id);

    seedWorkspaceForUser(currentUser.id, currentUser.name);

    return currentUser;
  });

  return formatCurrentUser(transaction());
}

export function logout() {
  const db = getDatabase();
  db.prepare(`UPDATE users SET is_current_user = 0`).run();
  db.prepare(`UPDATE participants SET is_current_user = 0`).run();
}
