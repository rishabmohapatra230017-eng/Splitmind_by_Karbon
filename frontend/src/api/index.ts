import type { CurrentUser, GroupDetailPayload, GroupSummary, SplitMethod } from '../lib/types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getCurrentUser: async () => {
    const payload = await request<{ currentUser: CurrentUser | null }>('/session/current-user');
    return payload.currentUser;
  },
  register: async (input: { name: string; email: string; password: string }) => {
    const payload = await request<{ currentUser: CurrentUser }>('/session/register', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload.currentUser;
  },
  login: async (input: { email: string; password: string }) => {
    const payload = await request<{ currentUser: CurrentUser }>('/session/login', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload.currentUser;
  },
  logout: async () => request<{ ok: boolean }>('/session/logout', { method: 'POST' }),
  resetWorkspace: async () => request<{ ok: boolean }>('/meta/reset', { method: 'POST' }),
  listGroups: async () => {
    const payload = await request<{ groups: GroupSummary[] }>('/groups');
    return payload.groups;
  },
  createGroup: async (input: { name: string; note: string }) => {
    const payload = await request<{ group: GroupSummary }>('/groups', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload.group;
  },
  deleteGroup: async (groupId: string) =>
    request<void>(`/groups/${groupId}`, {
      method: 'DELETE'
    }),
  getGroup: async (groupId: string) => request<GroupDetailPayload>(`/groups/${groupId}`),
  addParticipant: async (groupId: string, input: { name: string; colorToken: string }) =>
    request<GroupDetailPayload>(`/groups/${groupId}/participants`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  removeParticipant: async (groupId: string, participantId: string) =>
    request<GroupDetailPayload>(`/groups/${groupId}/participants/${participantId}`, {
      method: 'DELETE'
    }),
  createExpense: async (
    groupId: string,
    input: {
      description: string;
      note: string;
      amount: number;
      expenseDate: string;
      paidByParticipantId: string;
      splitMethod: SplitMethod;
      participantIds: string[];
      splits: Array<{ participantId: string; amount?: number; percentage?: number }>;
    }
  ) =>
    request<GroupDetailPayload>(`/groups/${groupId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  updateExpense: async (
    groupId: string,
    expenseId: string,
    input: {
      description: string;
      note: string;
      amount: number;
      expenseDate: string;
      paidByParticipantId: string;
      splitMethod: SplitMethod;
      participantIds: string[];
      splits: Array<{ participantId: string; amount?: number; percentage?: number }>;
    }
  ) =>
    request<GroupDetailPayload>(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    }),
  deleteExpense: async (groupId: string, expenseId: string) =>
    request<GroupDetailPayload>(`/groups/${groupId}/expenses/${expenseId}`, {
      method: 'DELETE'
    })
};
