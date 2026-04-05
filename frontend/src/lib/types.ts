export type SplitMethod = 'equal' | 'custom' | 'percentage';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  accentColor: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  participantCount: number;
  totalSpend: number;
  youPaid: number;
  youOwe: number;
}

export interface Participant {
  id: string;
  groupId: string;
  name: string;
  isCurrentUser: boolean;
  colorToken: string;
  createdAt: string;
}

export interface ExpenseSplitView {
  participantId: string;
  participantName: string;
  amount: number;
  percentage?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  note: string;
  amount: number;
  paidByParticipantId: string;
  paidByName: string;
  splitMethod: SplitMethod;
  expenseDate: string;
  createdAt: string;
  splits: ExpenseSplitView[];
}

export interface BalanceLine {
  participantId: string;
  participantName: string;
  paid: number;
  owed: number;
  net: number;
}

export interface Settlement {
  fromParticipantId: string;
  fromParticipantName: string;
  toParticipantId: string;
  toParticipantName: string;
  amount: number;
  label: string;
}

export interface GroupDetailPayload {
  group: GroupSummary;
  participants: Participant[];
  expenses: Expense[];
  balances: BalanceLine[];
  settlements: Settlement[];
  metrics: {
    totalGroupSpend: number;
    youPaid: number;
    youOwe: number;
  };
}
