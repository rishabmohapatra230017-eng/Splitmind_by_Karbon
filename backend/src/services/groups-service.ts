import { z } from 'zod';

import { nextId, readStore, toCurrency, updateStore } from '../database/store.js';
import { formatCurrentUser, requireCurrentUserRow } from './session-service.js';

const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(48),
  note: z.string().trim().max(160).optional().default('')
});

export function getCurrentUser() {
  return formatCurrentUser(requireCurrentUserRow());
}

export function listGroups() {
  const state = readStore();
  const currentUser = requireCurrentUserRow();

  const memberGroupIds = new Set(
    state.participants.filter((participant) => participant.userId === currentUser.id).map((participant) => participant.groupId)
  );

  return state.groups
    .filter((group) => memberGroupIds.has(group.id))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id - left.id)
    .map((group) => {
      const participants = state.participants.filter((participant) => participant.groupId === group.id);
      const expenses = state.expenses.filter((expense) => expense.groupId === group.id);
      const userParticipantIds = new Set(
        participants.filter((participant) => participant.userId === currentUser.id).map((participant) => participant.id)
      );
      const expenseIds = new Set(expenses.map((expense) => expense.id));

      const totalSpendCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
      const youPaidCents = expenses
        .filter((expense) => userParticipantIds.has(expense.paidByParticipantId))
        .reduce((sum, expense) => sum + expense.amountCents, 0);
      const youOweCents = state.expenseSplits
        .filter((split) => expenseIds.has(split.expenseId) && userParticipantIds.has(split.participantId))
        .reduce((sum, split) => sum + split.amountCents, 0);

      return {
        id: String(group.id),
        name: group.name,
        note: group.note,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        participantCount: participants.length,
        totalSpend: toCurrency(totalSpendCents),
        youPaid: toCurrency(youPaidCents),
        youOwe: toCurrency(youOweCents)
      };
    });
}

export function createGroup(payload: unknown) {
  const input = createGroupSchema.parse(payload);
  const currentUser = requireCurrentUserRow();
  const now = new Date().toISOString();

  return updateStore((state) => {
    const groupId = nextId(state, 'groups');
    state.groups.push({
      id: groupId,
      name: input.name,
      note: input.note,
      ownerUserId: currentUser.id,
      createdAt: now,
      updatedAt: now
    });

    const participantId = nextId(state, 'participants');
    state.participants.push({
      id: participantId,
      groupId,
      userId: currentUser.id,
      name: currentUser.name,
      colorToken: 'indigo',
      isCurrentUser: true,
      createdAt: now
    });

    return {
      id: String(groupId),
      name: input.name,
      note: input.note,
      createdAt: now,
      updatedAt: now,
      participantCount: 1,
      totalSpend: 0,
      youPaid: 0,
      youOwe: 0
    };
  });
}

export function deleteGroup(groupId: string) {
  updateStore((state) => {
    const numericGroupId = Number(groupId);
    const existingGroup = state.groups.find((group) => group.id === numericGroupId);
    if (!existingGroup) {
      throw new Error('Group not found');
    }

    const expenseIds = new Set(state.expenses.filter((expense) => expense.groupId === numericGroupId).map((expense) => expense.id));
    state.groups = state.groups.filter((group) => group.id !== numericGroupId);
    state.participants = state.participants.filter((participant) => participant.groupId !== numericGroupId);
    state.expenses = state.expenses.filter((expense) => expense.groupId !== numericGroupId);
    state.expenseSplits = state.expenseSplits.filter((split) => !expenseIds.has(split.expenseId));
  });
}
