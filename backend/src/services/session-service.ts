import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { nextId, readStore, type StoreState, type UserRecord, updateStore } from '../database/store.js';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(48),
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(128)
});

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

export function getCurrentUserRow(): UserRecord | null {
  const state = readStore();
  return state.users.find((user) => user.isCurrentUser) ?? null;
}

export function requireCurrentUserRow(): UserRecord {
  const currentUser = getCurrentUserRow();
  if (!currentUser) {
    throw new Error('You need to log in first');
  }

  return currentUser;
}

export function formatCurrentUser(currentUser: UserRecord) {
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

function clearCurrentSession(state: StoreState) {
  state.users.forEach((user) => {
    user.isCurrentUser = false;
  });
  state.participants.forEach((participant) => {
    participant.isCurrentUser = false;
  });
}

function seedWorkspaceForUser(state: StoreState, userId: number, name: string) {
  const existingGroup = state.participants.find((participant) => participant.userId === userId);
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

  const groupId = nextId(state, 'groups');
  state.groups.push({
    id: groupId,
    name: template.groupName,
    note: template.note,
    ownerUserId: userId,
    createdAt: now,
    updatedAt: now
  });

  const currentParticipantId = nextId(state, 'participants');
  const friendOneId = nextId(state, 'participants');
  const friendTwoId = nextId(state, 'participants');

  state.participants.push({
    id: currentParticipantId,
    groupId,
    userId,
    name,
    colorToken: 'indigo',
    isCurrentUser: true,
    createdAt: now
  });
  state.participants.push({
    id: friendOneId,
    groupId,
    userId: null,
    name: template.expense.friends[0],
    colorToken: 'emerald',
    isCurrentUser: false,
    createdAt: now
  });
  state.participants.push({
    id: friendTwoId,
    groupId,
    userId: null,
    name: template.expense.friends[1],
    colorToken: 'amber',
    isCurrentUser: false,
    createdAt: now
  });

  const expenseId = nextId(state, 'expenses');
  state.expenses.push({
    id: expenseId,
    groupId,
    description: template.expense.description,
    note: template.expense.note,
    amountCents: template.expense.amountCents,
    paidByParticipantId: currentParticipantId,
    splitMethod: 'equal',
    expenseDate: template.expense.expenseDate,
    createdAt: now,
    updatedAt: now
  });

  const equalShare = Math.floor(template.expense.amountCents / 3);
  state.expenseSplits.push({
    id: nextId(state, 'expenseSplits'),
    expenseId,
    participantId: currentParticipantId,
    amountCents: equalShare,
    percentageBasisPoints: null
  });
  state.expenseSplits.push({
    id: nextId(state, 'expenseSplits'),
    expenseId,
    participantId: friendOneId,
    amountCents: equalShare,
    percentageBasisPoints: null
  });
  state.expenseSplits.push({
    id: nextId(state, 'expenseSplits'),
    expenseId,
    participantId: friendTwoId,
    amountCents: template.expense.amountCents - equalShare - equalShare,
    percentageBasisPoints: null
  });
}

export function register(payload: unknown) {
  const input = registerSchema.parse(payload);
  const email = input.email.toLowerCase();

  return formatCurrentUser(
    updateStore((state) => {
      if (state.users.some((user) => user.email === email)) {
        throw new Error('An account with this email already exists');
      }

      clearCurrentSession(state);

      const currentUser: UserRecord = {
        id: nextId(state, 'users'),
        name: input.name,
        email,
        passwordHash: hashPassword(input.password),
        isCurrentUser: true,
        createdAt: new Date().toISOString()
      };

      state.users.push(currentUser);
      seedWorkspaceForUser(state, currentUser.id, currentUser.name);

      return currentUser;
    })
  );
}

export function login(payload: unknown) {
  const input = loginSchema.parse(payload);
  const email = input.email.toLowerCase();

  return formatCurrentUser(
    updateStore((state) => {
      const existingUser = state.users.find((user) => user.email === email);
      if (!existingUser || !existingUser.passwordHash) {
        throw new Error('No account exists for this email');
      }

      if (!verifyPassword(input.password, existingUser.passwordHash)) {
        throw new Error('Incorrect password');
      }

      clearCurrentSession(state);
      existingUser.isCurrentUser = true;
      state.participants.forEach((participant) => {
        if (participant.userId === existingUser.id) {
          participant.name = existingUser.name;
          participant.isCurrentUser = true;
        }
      });
      seedWorkspaceForUser(state, existingUser.id, existingUser.name);

      return existingUser;
    })
  );
}

export function logout() {
  updateStore((state) => {
    clearCurrentSession(state);
  });
}
