import { z } from 'zod';

import { buildExpenseSplitAmounts, computeBalances } from '../domain/balance-engine.js';
import { getDatabase, toCurrency } from '../database/sqlite.js';
import { requireCurrentUserRow } from './session-service.js';

const addParticipantSchema = z.object({
  name: z.string().trim().min(2).max(32),
  colorToken: z.string().trim().min(3).max(20).default('emerald')
});

const createExpenseSchema = z.object({
  description: z.string().trim().min(2).max(80),
  note: z.string().trim().max(160).optional().default(''),
  amount: z.number().positive(),
  expenseDate: z.string().min(10),
  paidByParticipantId: z.string().min(1),
  splitMethod: z.enum(['equal', 'custom', 'percentage']),
  participantIds: z.array(z.string().min(1)).min(1).max(4),
  splits: z
    .array(
      z.object({
        participantId: z.string().min(1),
        amount: z.number().nonnegative().optional(),
        percentage: z.number().min(0).max(100).optional()
      })
    )
    .default([])
});

const expenseMutationSchema = createExpenseSchema.superRefine((value, context) => {
  if (value.participantIds.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select at least one participant'
    });
    return;
  }

  if (value.splitMethod === 'custom') {
    const splitMap = new Map(value.splits.map((split) => [split.participantId, split.amount ?? 0]));
    const total = value.participantIds.reduce((sum, participantId) => sum + (splitMap.get(participantId) ?? 0), 0);
    if (Math.abs(total - value.amount) > 0.009) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Custom split amounts must add up exactly to the expense amount'
      });
    }
  }

  if (value.splitMethod === 'percentage') {
    const splitMap = new Map(value.splits.map((split) => [split.participantId, split.percentage ?? 0]));
    const total = value.participantIds.reduce((sum, participantId) => sum + (splitMap.get(participantId) ?? 0), 0);
    if (Math.abs(total - 100) > 0.009) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Percentage splits must add up to exactly 100'
      });
    }
  }
});

type GroupRow = {
  id: number;
  name: string;
  note: string;
  created_at: string;
  updated_at: string;
};

type ParticipantRow = {
  id: number;
  group_id: number;
  user_id: number | null;
  name: string;
  color_token: string;
  is_current_user: number;
  created_at: string;
};

type ExpenseRow = {
  id: number;
  group_id: number;
  description: string;
  note: string;
  amount_cents: number;
  paid_by_participant_id: number;
  split_method: 'equal' | 'custom' | 'percentage';
  expense_date: string;
  created_at: string;
};

type SplitRow = {
  expense_id: number;
  participant_id: number;
  amount_cents: number;
  percentage_basis_points: number | null;
};

function getGroupRow(groupId: number) {
  const db = getDatabase();
  const currentUser = requireCurrentUserRow();
  const group = db
    .prepare(
      `
      SELECT id, name, note, created_at, updated_at
      FROM groups
      WHERE id = ?
        AND EXISTS (
          SELECT 1
          FROM participants p
          WHERE p.group_id = groups.id
            AND p.user_id = ?
        )
      `
    )
    .get(groupId, currentUser.id) as GroupRow | undefined;

  if (!group) {
    throw new Error('Group not found');
  }

  return group;
}

function getParticipants(groupId: number) {
  const db = getDatabase();
  return db
    .prepare(
      `
      SELECT id, group_id, user_id, name, color_token, is_current_user, created_at
      FROM participants
      WHERE group_id = ?
      ORDER BY is_current_user DESC, id ASC
      `
    )
    .all(groupId) as ParticipantRow[];
}

function getExpenses(groupId: number) {
  const db = getDatabase();
  return db
    .prepare(
      `
      SELECT id, group_id, description, note, amount_cents, paid_by_participant_id, split_method, expense_date, created_at
      FROM expenses
      WHERE group_id = ?
      ORDER BY expense_date DESC, id DESC
      `
    )
    .all(groupId) as ExpenseRow[];
}

function getExpenseSplits(expenseIds: number[]) {
  const db = getDatabase();
  if (expenseIds.length === 0) {
    return [] as SplitRow[];
  }

  const placeholders = expenseIds.map(() => '?').join(', ');
  return db
    .prepare(
      `
      SELECT expense_id, participant_id, amount_cents, percentage_basis_points
      FROM expense_splits
      WHERE expense_id IN (${placeholders})
      ORDER BY expense_id ASC, id ASC
      `
    )
    .all(...expenseIds) as SplitRow[];
}

function buildGroupSummary(groupId: number) {
  const currentUser = requireCurrentUserRow();
  const group = getGroupRow(groupId);
  const participants = getParticipants(groupId);
  const expenses = getExpenses(groupId);
  const splitRows = getExpenseSplits(expenses.map((expense) => expense.id));
  const splitMap = new Map<number, SplitRow[]>();

  splitRows.forEach((split) => {
    const current = splitMap.get(split.expense_id) ?? [];
    current.push(split);
    splitMap.set(split.expense_id, current);
  });

  const balanceResult = computeBalances(
    participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      isCurrentUser: participant.user_id === currentUser.id
    })),
    expenses.map((expense) => ({
      id: expense.id,
      amountCents: expense.amount_cents,
      paidByParticipantId: expense.paid_by_participant_id,
      splits: (splitMap.get(expense.id) ?? []).map((split) => ({
        participantId: split.participant_id,
        amountCents: split.amount_cents
      }))
    }))
  );

  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));

  return {
    group: {
      id: String(group.id),
      name: group.name,
      note: group.note,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      participantCount: participants.length,
      totalSpend: toCurrency(balanceResult.metrics.totalGroupSpendCents),
      youPaid: toCurrency(balanceResult.metrics.youPaidCents),
      youOwe: toCurrency(balanceResult.metrics.youOweCents)
    },
    participants: participants.map((participant) => ({
      id: String(participant.id),
      groupId: String(participant.group_id),
      name: participant.name,
      colorToken: participant.color_token,
      isCurrentUser: participant.user_id === currentUser.id,
      createdAt: participant.created_at
    })),
    expenses: expenses.map((expense) => ({
      id: String(expense.id),
      groupId: String(expense.group_id),
      description: expense.description,
      note: expense.note,
      amount: toCurrency(expense.amount_cents),
      paidByParticipantId: String(expense.paid_by_participant_id),
      paidByName: participantMap.get(expense.paid_by_participant_id)?.name ?? 'Unknown',
      splitMethod: expense.split_method,
      expenseDate: expense.expense_date,
      createdAt: expense.created_at,
      splits: (splitMap.get(expense.id) ?? []).map((split) => ({
        participantId: String(split.participant_id),
        participantName: participantMap.get(split.participant_id)?.name ?? 'Unknown',
        amount: toCurrency(split.amount_cents),
        percentage: typeof split.percentage_basis_points === 'number' ? split.percentage_basis_points / 100 : undefined
      }))
    })),
    balances: balanceResult.balances.map((balance) => ({
      participantId: String(balance.participantId),
      participantName: balance.participantName,
      paid: toCurrency(balance.paidCents),
      owed: toCurrency(balance.owedCents),
      net: toCurrency(balance.netCents)
    })),
    settlements: balanceResult.settlements.map((settlement) => ({
      fromParticipantId: String(settlement.fromParticipantId),
      fromParticipantName: settlement.fromParticipantName,
      toParticipantId: String(settlement.toParticipantId),
      toParticipantName: settlement.toParticipantName,
      amount: toCurrency(settlement.amountCents),
      label: `${settlement.fromParticipantName} pays ${settlement.toParticipantName} ₹${toCurrency(settlement.amountCents).toFixed(2)}`
    })),
    metrics: {
      totalGroupSpend: toCurrency(balanceResult.metrics.totalGroupSpendCents),
      youPaid: toCurrency(balanceResult.metrics.youPaidCents),
      youOwe: toCurrency(balanceResult.metrics.youOweCents)
    }
  };
}

export function getGroupDetail(groupId: string) {
  return buildGroupSummary(Number(groupId));
}

export function addParticipant(groupId: string, payload: unknown) {
  const input = addParticipantSchema.parse(payload);
  const db = getDatabase();
  const numericGroupId = Number(groupId);

  getGroupRow(numericGroupId);

  const currentCount = (db.prepare(`SELECT COUNT(*) as count FROM participants WHERE group_id = ?`).get(numericGroupId) as {
    count: number;
  }).count;

  if (currentCount >= 4) {
    throw new Error('A group can contain at most 4 participants including you');
  }

  db.prepare(
    `
    INSERT INTO participants (group_id, name, color_token, is_current_user, created_at)
    VALUES (?, ?, ?, 0, ?)
    `
  ).run(numericGroupId, input.name, input.colorToken, new Date().toISOString());

  db.prepare(`UPDATE groups SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), numericGroupId);

  return buildGroupSummary(numericGroupId);
}

export function removeParticipant(groupId: string, participantId: string) {
  const db = getDatabase();
  const numericGroupId = Number(groupId);
  const numericParticipantId = Number(participantId);

  const participant = db
    .prepare(
      `
      SELECT id, is_current_user
      FROM participants
      WHERE id = ? AND group_id = ?
      `
    )
    .get(numericParticipantId, numericGroupId) as { id: number; is_current_user: number } | undefined;

  if (!participant) {
    throw new Error('Participant not found');
  }

  if (participant.is_current_user === 1) {
    throw new Error('The current user participant cannot be removed');
  }

  const referenced = (
    db.prepare(
      `
      SELECT COUNT(*) as count
      FROM expenses e
      LEFT JOIN expense_splits es ON es.expense_id = e.id
      WHERE e.group_id = ?
        AND (e.paid_by_participant_id = ? OR es.participant_id = ?)
      `
    ).get(numericGroupId, numericParticipantId, numericParticipantId) as { count: number }
  ).count;

  if (referenced > 0) {
    throw new Error('Remove related expenses before deleting this participant');
  }

  db.prepare(`DELETE FROM participants WHERE id = ? AND group_id = ?`).run(numericParticipantId, numericGroupId);
  db.prepare(`UPDATE groups SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), numericGroupId);

  return buildGroupSummary(numericGroupId);
}

export function createExpense(groupId: string, payload: unknown) {
  const input = expenseMutationSchema.parse(payload);
  const db = getDatabase();
  const numericGroupId = Number(groupId);
  const participantIds = input.participantIds.map((id) => Number(id));
  const payerId = Number(input.paidByParticipantId);

  getGroupRow(numericGroupId);

  const participants = getParticipants(numericGroupId);
  const participantSet = new Set(participants.map((participant) => participant.id));

  if (!participantSet.has(payerId)) {
    throw new Error('Selected payer is not part of this group');
  }

  if (participantIds.some((participantId) => !participantSet.has(participantId))) {
    throw new Error('All selected participants must belong to the same group');
  }

  const splitPayload = new Map(input.splits.map((split) => [Number(split.participantId), split]));
  const splitAmounts = buildExpenseSplitAmounts({
    totalCents: Math.round(input.amount * 100),
    participantIds,
    splitMethod: input.splitMethod,
    customAmountsCents:
      input.splitMethod === 'custom'
        ? participantIds.map((participantId) => Math.round((splitPayload.get(participantId)?.amount ?? 0) * 100))
        : undefined,
    percentageBasisPoints:
      input.splitMethod === 'percentage'
        ? participantIds.map((participantId) => Math.round((splitPayload.get(participantId)?.percentage ?? 0) * 100))
        : undefined
  });

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    const expenseResult = db
      .prepare(
        `
        INSERT INTO expenses (group_id, description, note, amount_cents, paid_by_participant_id, split_method, expense_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        numericGroupId,
        input.description,
        input.note,
        Math.round(input.amount * 100),
        payerId,
        input.splitMethod,
        input.expenseDate,
        now,
        now
      );

    const expenseId = Number(expenseResult.lastInsertRowid);
    const insertSplit = db.prepare(
      `
      INSERT INTO expense_splits (expense_id, participant_id, amount_cents, percentage_basis_points)
      VALUES (?, ?, ?, ?)
      `
    );

    splitAmounts.forEach((split) => {
      const original = splitPayload.get(split.participantId);
      insertSplit.run(
        expenseId,
        split.participantId,
        split.amountCents,
        input.splitMethod === 'percentage' ? Math.round((original?.percentage ?? 0) * 100) : null
      );
    });

    db.prepare(`UPDATE groups SET updated_at = ? WHERE id = ?`).run(now, numericGroupId);
  });

  transaction();

  return buildGroupSummary(numericGroupId);
}

export function updateExpense(groupId: string, expenseId: string, payload: unknown) {
  const input = expenseMutationSchema.parse(payload);
  const db = getDatabase();
  const numericGroupId = Number(groupId);
  const numericExpenseId = Number(expenseId);
  const participantIds = input.participantIds.map((id) => Number(id));
  const payerId = Number(input.paidByParticipantId);

  getGroupRow(numericGroupId);

  const expense = db
    .prepare(
      `
      SELECT id
      FROM expenses
      WHERE id = ? AND group_id = ?
      `
    )
    .get(numericExpenseId, numericGroupId) as { id: number } | undefined;

  if (!expense) {
    throw new Error('Expense not found');
  }

  const participants = getParticipants(numericGroupId);
  const participantSet = new Set(participants.map((participant) => participant.id));

  if (!participantSet.has(payerId)) {
    throw new Error('Selected payer is not part of this group');
  }

  if (participantIds.some((participantId) => !participantSet.has(participantId))) {
    throw new Error('All selected participants must belong to the same group');
  }

  const splitPayload = new Map(input.splits.map((split) => [Number(split.participantId), split]));
  const splitAmounts = buildExpenseSplitAmounts({
    totalCents: Math.round(input.amount * 100),
    participantIds,
    splitMethod: input.splitMethod,
    customAmountsCents:
      input.splitMethod === 'custom'
        ? participantIds.map((participantId) => Math.round((splitPayload.get(participantId)?.amount ?? 0) * 100))
        : undefined,
    percentageBasisPoints:
      input.splitMethod === 'percentage'
        ? participantIds.map((participantId) => Math.round((splitPayload.get(participantId)?.percentage ?? 0) * 100))
        : undefined
  });

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    db.prepare(
      `
      UPDATE expenses
      SET description = ?, note = ?, amount_cents = ?, paid_by_participant_id = ?, split_method = ?, expense_date = ?, updated_at = ?
      WHERE id = ? AND group_id = ?
      `
    ).run(
      input.description,
      input.note,
      Math.round(input.amount * 100),
      payerId,
      input.splitMethod,
      input.expenseDate,
      now,
      numericExpenseId,
      numericGroupId
    );

    db.prepare(`DELETE FROM expense_splits WHERE expense_id = ?`).run(numericExpenseId);

    const insertSplit = db.prepare(
      `
      INSERT INTO expense_splits (expense_id, participant_id, amount_cents, percentage_basis_points)
      VALUES (?, ?, ?, ?)
      `
    );

    splitAmounts.forEach((split) => {
      const original = splitPayload.get(split.participantId);
      insertSplit.run(
        numericExpenseId,
        split.participantId,
        split.amountCents,
        input.splitMethod === 'percentage' ? Math.round((original?.percentage ?? 0) * 100) : null
      );
    });

    db.prepare(`UPDATE groups SET updated_at = ? WHERE id = ?`).run(now, numericGroupId);
  });

  transaction();

  return buildGroupSummary(numericGroupId);
}

export function deleteExpense(groupId: string, expenseId: string) {
  const db = getDatabase();
  const numericGroupId = Number(groupId);
  const numericExpenseId = Number(expenseId);

  const result = db.prepare(`DELETE FROM expenses WHERE id = ? AND group_id = ?`).run(numericExpenseId, numericGroupId);
  if (result.changes === 0) {
    throw new Error('Expense not found');
  }

  db.prepare(`UPDATE groups SET updated_at = ? WHERE id = ?`).run(new Date().toISOString(), numericGroupId);

  return buildGroupSummary(numericGroupId);
}
