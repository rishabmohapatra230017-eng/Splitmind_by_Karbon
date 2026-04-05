import { z } from 'zod';

import { buildExpenseSplitAmounts, computeBalances } from '../domain/balance-engine.js';
import { nextId, readStore, toCurrency, type ParticipantRecord, type SplitMethod, updateStore } from '../database/store.js';
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

function getAccessibleGroup(groupId: number) {
  const state = readStore();
  const currentUser = requireCurrentUserRow();
  const participant = state.participants.find((entry) => entry.groupId === groupId && entry.userId === currentUser.id);
  const group = state.groups.find((entry) => entry.id === groupId);

  if (!group || !participant) {
    throw new Error('Group not found');
  }

  return { state, group, currentUser };
}

function getGroupParticipants(state: ReturnType<typeof readStore>, groupId: number) {
  return state.participants
    .filter((participant) => participant.groupId === groupId)
    .sort((left, right) => Number(right.isCurrentUser) - Number(left.isCurrentUser) || left.id - right.id);
}

function getGroupExpenses(state: ReturnType<typeof readStore>, groupId: number) {
  return state.expenses
    .filter((expense) => expense.groupId === groupId)
    .sort((left, right) => right.expenseDate.localeCompare(left.expenseDate) || right.id - left.id);
}

function buildGroupSummary(groupId: number) {
  const { state, group, currentUser } = getAccessibleGroup(groupId);
  const participants = getGroupParticipants(state, groupId);
  const expenses = getGroupExpenses(state, groupId);
  const expenseIds = new Set(expenses.map((expense) => expense.id));
  const splitMap = new Map<number, typeof state.expenseSplits>();

  state.expenseSplits
    .filter((split) => expenseIds.has(split.expenseId))
    .forEach((split) => {
      const current = splitMap.get(split.expenseId) ?? [];
      current.push(split);
      splitMap.set(split.expenseId, current);
    });

  const balanceResult = computeBalances(
    participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      isCurrentUser: participant.userId === currentUser.id
    })),
    expenses.map((expense) => ({
      id: expense.id,
      amountCents: expense.amountCents,
      paidByParticipantId: expense.paidByParticipantId,
      splits: (splitMap.get(expense.id) ?? []).map((split) => ({
        participantId: split.participantId,
        amountCents: split.amountCents
      }))
    }))
  );

  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));

  return {
    group: {
      id: String(group.id),
      name: group.name,
      note: group.note,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      participantCount: participants.length,
      totalSpend: toCurrency(balanceResult.metrics.totalGroupSpendCents),
      youPaid: toCurrency(balanceResult.metrics.youPaidCents),
      youOwe: toCurrency(balanceResult.metrics.youOweCents)
    },
    participants: participants.map((participant) => ({
      id: String(participant.id),
      groupId: String(participant.groupId),
      name: participant.name,
      colorToken: participant.colorToken,
      isCurrentUser: participant.userId === currentUser.id,
      createdAt: participant.createdAt
    })),
    expenses: expenses.map((expense) => ({
      id: String(expense.id),
      groupId: String(expense.groupId),
      description: expense.description,
      note: expense.note,
      amount: toCurrency(expense.amountCents),
      paidByParticipantId: String(expense.paidByParticipantId),
      paidByName: participantMap.get(expense.paidByParticipantId)?.name ?? 'Unknown',
      splitMethod: expense.splitMethod,
      expenseDate: expense.expenseDate,
      createdAt: expense.createdAt,
      splits: (splitMap.get(expense.id) ?? []).map((split) => ({
        participantId: String(split.participantId),
        participantName: participantMap.get(split.participantId)?.name ?? 'Unknown',
        amount: toCurrency(split.amountCents),
        percentage: typeof split.percentageBasisPoints === 'number' ? split.percentageBasisPoints / 100 : undefined
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

function ensureParticipantIdsBelong(participants: ParticipantRecord[], ids: number[]) {
  const participantSet = new Set(participants.map((participant) => participant.id));
  return ids.every((id) => participantSet.has(id));
}

function updateGroupTimestamp(state: ReturnType<typeof readStore>, groupId: number, timestamp: string) {
  const group = state.groups.find((entry) => entry.id === groupId);
  if (group) {
    group.updatedAt = timestamp;
  }
}

export function getGroupDetail(groupId: string) {
  return buildGroupSummary(Number(groupId));
}

export function addParticipant(groupId: string, payload: unknown) {
  const input = addParticipantSchema.parse(payload);
  const numericGroupId = Number(groupId);

  updateStore((state) => {
    const currentUser = requireCurrentUserRow();
    const currentMembership = state.participants.find(
      (participant) => participant.groupId === numericGroupId && participant.userId === currentUser.id
    );
    if (!currentMembership) {
      throw new Error('Group not found');
    }

    const currentCount = state.participants.filter((participant) => participant.groupId === numericGroupId).length;
    if (currentCount >= 4) {
      throw new Error('A group can contain at most 4 participants including you');
    }

    state.participants.push({
      id: nextId(state, 'participants'),
      groupId: numericGroupId,
      userId: null,
      name: input.name,
      colorToken: input.colorToken,
      isCurrentUser: false,
      createdAt: new Date().toISOString()
    });
    updateGroupTimestamp(state, numericGroupId, new Date().toISOString());
  });

  return buildGroupSummary(numericGroupId);
}

export function removeParticipant(groupId: string, participantId: string) {
  const numericGroupId = Number(groupId);
  const numericParticipantId = Number(participantId);

  updateStore((state) => {
    const participant = state.participants.find(
      (entry) => entry.id === numericParticipantId && entry.groupId === numericGroupId
    );
    if (!participant) {
      throw new Error('Participant not found');
    }
    if (participant.isCurrentUser) {
      throw new Error('The current user participant cannot be removed');
    }

    const expenseIds = new Set(state.expenses.filter((expense) => expense.groupId === numericGroupId).map((expense) => expense.id));
    const referenced = state.expenses.some(
      (expense) => expense.groupId === numericGroupId && expense.paidByParticipantId === numericParticipantId
    ) || state.expenseSplits.some(
      (split) => expenseIds.has(split.expenseId) && split.participantId === numericParticipantId
    );

    if (referenced) {
      throw new Error('Remove related expenses before deleting this participant');
    }

    state.participants = state.participants.filter((entry) => entry.id !== numericParticipantId);
    updateGroupTimestamp(state, numericGroupId, new Date().toISOString());
  });

  return buildGroupSummary(numericGroupId);
}

function saveExpense(
  state: ReturnType<typeof readStore>,
  groupId: number,
  expenseId: number | null,
  payload: z.infer<typeof expenseMutationSchema>
) {
  const participants = getGroupParticipants(state, groupId);
  const participantIds = payload.participantIds.map((id) => Number(id));
  const payerId = Number(payload.paidByParticipantId);

  if (!ensureParticipantIdsBelong(participants, [...participantIds, payerId])) {
    throw new Error('All selected participants must belong to the same group');
  }

  const splitPayload = new Map(payload.splits.map((split) => [Number(split.participantId), split]));
  const splitAmounts = buildExpenseSplitAmounts({
    totalCents: Math.round(payload.amount * 100),
    participantIds,
    splitMethod: payload.splitMethod,
    customAmountsCents:
      payload.splitMethod === 'custom'
        ? participantIds.map((participantId) => Math.round((splitPayload.get(participantId)?.amount ?? 0) * 100))
        : undefined,
    percentageBasisPoints:
      payload.splitMethod === 'percentage'
        ? participantIds.map((participantId) => Math.round((splitPayload.get(participantId)?.percentage ?? 0) * 100))
        : undefined
  });

  const now = new Date().toISOString();
  const resolvedExpenseId = expenseId ?? nextId(state, 'expenses');

  if (expenseId) {
    const existingExpense = state.expenses.find((expense) => expense.id === expenseId && expense.groupId === groupId);
    if (!existingExpense) {
      throw new Error('Expense not found');
    }

    existingExpense.description = payload.description;
    existingExpense.note = payload.note;
    existingExpense.amountCents = Math.round(payload.amount * 100);
    existingExpense.paidByParticipantId = payerId;
    existingExpense.splitMethod = payload.splitMethod as SplitMethod;
    existingExpense.expenseDate = payload.expenseDate;
    existingExpense.updatedAt = now;
    state.expenseSplits = state.expenseSplits.filter((split) => split.expenseId !== expenseId);
  } else {
    state.expenses.push({
      id: resolvedExpenseId,
      groupId,
      description: payload.description,
      note: payload.note,
      amountCents: Math.round(payload.amount * 100),
      paidByParticipantId: payerId,
      splitMethod: payload.splitMethod as SplitMethod,
      expenseDate: payload.expenseDate,
      createdAt: now,
      updatedAt: now
    });
  }

  splitAmounts.forEach((split) => {
    const original = splitPayload.get(split.participantId);
    state.expenseSplits.push({
      id: nextId(state, 'expenseSplits'),
      expenseId: resolvedExpenseId,
      participantId: split.participantId,
      amountCents: split.amountCents,
      percentageBasisPoints: payload.splitMethod === 'percentage' ? Math.round((original?.percentage ?? 0) * 100) : null
    });
  });

  updateGroupTimestamp(state, groupId, now);
}

export function createExpense(groupId: string, payload: unknown) {
  const input = expenseMutationSchema.parse(payload);
  const numericGroupId = Number(groupId);

  updateStore((state) => {
    const currentUser = requireCurrentUserRow();
    const membership = state.participants.find(
      (participant) => participant.groupId === numericGroupId && participant.userId === currentUser.id
    );
    if (!membership) {
      throw new Error('Group not found');
    }

    saveExpense(state, numericGroupId, null, input);
  });

  return buildGroupSummary(numericGroupId);
}

export function updateExpense(groupId: string, expenseId: string, payload: unknown) {
  const input = expenseMutationSchema.parse(payload);
  const numericGroupId = Number(groupId);
  const numericExpenseId = Number(expenseId);

  updateStore((state) => {
    const currentUser = requireCurrentUserRow();
    const membership = state.participants.find(
      (participant) => participant.groupId === numericGroupId && participant.userId === currentUser.id
    );
    if (!membership) {
      throw new Error('Group not found');
    }

    saveExpense(state, numericGroupId, numericExpenseId, input);
  });

  return buildGroupSummary(numericGroupId);
}

export function deleteExpense(groupId: string, expenseId: string) {
  const numericGroupId = Number(groupId);
  const numericExpenseId = Number(expenseId);

  updateStore((state) => {
    const existingExpense = state.expenses.find(
      (expense) => expense.id === numericExpenseId && expense.groupId === numericGroupId
    );
    if (!existingExpense) {
      throw new Error('Expense not found');
    }

    state.expenses = state.expenses.filter((expense) => expense.id !== numericExpenseId);
    state.expenseSplits = state.expenseSplits.filter((split) => split.expenseId !== numericExpenseId);
    updateGroupTimestamp(state, numericGroupId, new Date().toISOString());
  });

  return buildGroupSummary(numericGroupId);
}
