import { z } from 'zod';

import { getDatabase, toCurrency } from '../database/sqlite.js';
import { formatCurrentUser, requireCurrentUserRow } from './session-service.js';

const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(48),
  note: z.string().trim().max(160).optional().default('')
});

type GroupSummaryRow = {
  id: number;
  name: string;
  note: string;
  created_at: string;
  updated_at: string;
  participant_count: number;
  total_spend_cents: number | null;
  you_paid_cents: number | null;
  you_owe_cents: number | null;
}

export function getCurrentUser() {
  return formatCurrentUser(requireCurrentUserRow());
}

export function listGroups() {
  const db = getDatabase();
  const currentUser = requireCurrentUserRow();

  const rows = db
    .prepare(
      `
      SELECT
        g.id,
        g.name,
        g.note,
        g.created_at,
        g.updated_at,
        COALESCE((
          SELECT COUNT(*)
          FROM participants p
          WHERE p.group_id = g.id
        ), 0) AS participant_count,
        COALESCE((
          SELECT SUM(e.amount_cents)
          FROM expenses e
          WHERE e.group_id = g.id
        ), 0) AS total_spend_cents,
        COALESCE((
          SELECT SUM(e.amount_cents)
          FROM expenses e
          INNER JOIN participants payer ON payer.id = e.paid_by_participant_id
          WHERE e.group_id = g.id AND payer.user_id = @currentUserId
        ), 0) AS you_paid_cents,
        COALESCE((
          SELECT SUM(es.amount_cents)
          FROM expense_splits es
          INNER JOIN participants cp ON cp.id = es.participant_id
          WHERE cp.group_id = g.id AND cp.user_id = @currentUserId
        ), 0) AS you_owe_cents
      FROM groups g
      INNER JOIN participants membership
        ON membership.group_id = g.id
       AND membership.user_id = @currentUserId
      ORDER BY g.updated_at DESC, g.id DESC
      `
    )
    .all({ currentUserId: currentUser.id }) as GroupSummaryRow[];

  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participantCount: row.participant_count,
    totalSpend: toCurrency(row.total_spend_cents ?? 0),
    youPaid: toCurrency(row.you_paid_cents ?? 0),
    youOwe: toCurrency(row.you_owe_cents ?? 0)
  }));
}

export function createGroup(payload: unknown) {
  const input = createGroupSchema.parse(payload);
  const db = getDatabase();
  const currentUser = requireCurrentUserRow();
  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    const groupResult = db
      .prepare(
        `
        INSERT INTO groups (name, note, owner_user_id, created_at, updated_at)
        VALUES (@name, @note, @ownerUserId, @createdAt, @updatedAt)
        `
      )
      .run({
        name: input.name,
        note: input.note,
        ownerUserId: currentUser.id,
        createdAt: now,
        updatedAt: now
      });

    const groupId = Number(groupResult.lastInsertRowid);

    db.prepare(
      `
      INSERT INTO participants (group_id, user_id, name, color_token, is_current_user, created_at)
      VALUES (@groupId, @userId, @name, @colorToken, 1, @createdAt)
      `
    ).run({
      groupId,
      userId: currentUser.id,
      name: currentUser.name,
      colorToken: 'indigo',
      createdAt: now
    });

    return groupId;
  });

  const groupId = transaction();
  const group = listGroups().find((entry) => entry.id === String(groupId));
  if (!group) {
    throw new Error('Failed to load created group');
  }

  return group;
}

export function deleteGroup(groupId: string) {
  const db = getDatabase();

  const result = db
    .prepare(
      `
      DELETE FROM groups
      WHERE id = ?
      `
    )
    .run(Number(groupId));

  if (result.changes === 0) {
    throw new Error('Group not found');
  }
}
