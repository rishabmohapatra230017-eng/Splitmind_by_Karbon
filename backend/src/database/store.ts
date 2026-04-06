import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type SplitMethod = 'equal' | 'custom' | 'percentage';

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  passwordHash: string | null;
  isCurrentUser: boolean;
  createdAt: string;
}

export interface GroupRecord {
  id: number;
  name: string;
  note: string;
  ownerUserId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantRecord {
  id: number;
  groupId: number;
  userId: number | null;
  name: string;
  colorToken: string;
  isCurrentUser: boolean;
  createdAt: string;
}

export interface ExpenseRecord {
  id: number;
  groupId: number;
  description: string;
  note: string;
  amountCents: number;
  paidByParticipantId: number;
  splitMethod: SplitMethod;
  expenseDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSplitRecord {
  id: number;
  expenseId: number;
  participantId: number;
  amountCents: number;
  percentageBasisPoints: number | null;
}

export interface StoreState {
  counters: {
    users: number;
    groups: number;
    participants: number;
    expenses: number;
    expenseSplits: number;
  };
  users: UserRecord[];
  groups: GroupRecord[];
  participants: ParticipantRecord[];
  expenses: ExpenseRecord[];
  expenseSplits: ExpenseSplitRecord[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = process.env.VERCEL ? path.join('/tmp', 'equishare-data') : path.resolve(__dirname, '../../data');
const storePath = path.join(dataDirectory, 'equishare-store.json');

function createEmptyStore(): StoreState {
  return {
    counters: {
      users: 0,
      groups: 0,
      participants: 0,
      expenses: 0,
      expenseSplits: 0
    },
    users: [],
    groups: [],
    participants: [],
    expenses: [],
    expenseSplits: []
  };
}

export function initializeStore() {
  mkdirSync(dataDirectory, { recursive: true });
  if (!existsSync(storePath)) {
    writeFileSync(storePath, JSON.stringify(createEmptyStore(), null, 2));
  }

  return readStore();
}

export function readStore(): StoreState {
  initializeStore();
  return JSON.parse(readFileSync(storePath, 'utf8')) as StoreState;
}

export function writeStore(state: StoreState) {
  writeFileSync(storePath, JSON.stringify(state, null, 2));
}

export function updateStore<T>(updater: (state: StoreState) => T): T {
  const state = readStore();
  const result = updater(state);
  writeStore(state);
  return result;
}

export function nextId(state: StoreState, key: keyof StoreState['counters']) {
  state.counters[key] += 1;
  return state.counters[key];
}

export function resetStore(nextState?: StoreState) {
  writeStore(nextState ?? createEmptyStore());
}

export function toCurrency(amountCents: number) {
  return Number((amountCents / 100).toFixed(2));
}
