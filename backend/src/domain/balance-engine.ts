export interface BalanceParticipant {
  id: number;
  name: string;
  isCurrentUser: boolean;
}

export interface BalanceExpenseSplit {
  participantId: number;
  amountCents: number;
}

export interface BalanceExpense {
  id: number;
  amountCents: number;
  paidByParticipantId: number;
  splits: BalanceExpenseSplit[];
}

export interface BalanceRow {
  participantId: number;
  participantName: string;
  paidCents: number;
  owedCents: number;
  netCents: number;
}

export interface SettlementInstruction {
  fromParticipantId: number;
  fromParticipantName: string;
  toParticipantId: number;
  toParticipantName: string;
  amountCents: number;
}

export interface BalanceResult {
  balances: BalanceRow[];
  settlements: SettlementInstruction[];
  metrics: {
    totalGroupSpendCents: number;
    youPaidCents: number;
    youOweCents: number;
  };
}

/**
 * Computes the exact-cent split values for a new expense.
 *
 * The algorithm intentionally works in integer cents so that we never introduce
 * binary floating-point drift when dividing money. For equal and percentage
 * splits, any remainder cents are distributed deterministically from the start
 * of the participant list so the final allocated cents always sum exactly to
 * the original expense total.
 */
export function buildExpenseSplitAmounts(input: {
  totalCents: number;
  participantIds: number[];
  splitMethod: 'equal' | 'custom' | 'percentage';
  customAmountsCents?: number[];
  percentageBasisPoints?: number[];
}) {
  const { totalCents, participantIds, splitMethod } = input;

  if (participantIds.length === 0) {
    throw new Error('At least one participant is required');
  }

  if (splitMethod === 'equal') {
    const base = Math.floor(totalCents / participantIds.length);
    let remainder = totalCents - base * participantIds.length;

    return participantIds.map((participantId) => {
      const amountCents = base + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      return { participantId, amountCents };
    });
  }

  if (splitMethod === 'custom') {
    const amounts = input.customAmountsCents ?? [];
    if (amounts.length !== participantIds.length) {
      throw new Error('Custom split must include all selected participants');
    }

    const allocated = amounts.reduce((sum, amount) => sum + amount, 0);
    if (allocated !== totalCents) {
      throw new Error('Custom split amounts must add up exactly to the total expense');
    }

    return participantIds.map((participantId, index) => ({
      participantId,
      amountCents: amounts[index]
    }));
  }

  const percentages = input.percentageBasisPoints ?? [];
  if (percentages.length !== participantIds.length) {
    throw new Error('Percentage split must include all selected participants');
  }

  const totalBasisPoints = percentages.reduce((sum, value) => sum + value, 0);
  if (totalBasisPoints !== 10000) {
    throw new Error('Percentages must add up to exactly 100');
  }

  const rawAllocations = participantIds.map((participantId, index) => {
    const weighted = totalCents * percentages[index];
    return {
      participantId,
      amountCents: Math.floor(weighted / 10000),
      remainder: weighted % 10000
    };
  });

  let remainderCents = totalCents - rawAllocations.reduce((sum, entry) => sum + entry.amountCents, 0);
  rawAllocations
    .slice()
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((entry) => {
      if (remainderCents > 0) {
        entry.amountCents += 1;
        remainderCents -= 1;
      }
    });

  return rawAllocations.map(({ participantId, amountCents }) => ({
    participantId,
    amountCents
  }));
}

/**
 * Computes net balances and a minimal settlement plan.
 *
 * Mathematical model:
 * - `paidCents` is cash a participant fronted on behalf of the group.
 * - `owedCents` is the participant's assigned share across all expense splits.
 * - `netCents = paidCents - owedCents`.
 *
 * Positive net means the group owes that participant money.
 * Negative net means the participant owes money back.
 *
 * Because each expense contributes the same amount to total paid and total owed,
 * the global sum of all net balances is always exactly zero when calculations
 * are performed in integer cents.
 */
export function computeBalances(
  participants: BalanceParticipant[],
  expenses: BalanceExpense[]
): BalanceResult {
  const ledger = new Map<number, BalanceRow>();

  participants.forEach((participant) => {
    ledger.set(participant.id, {
      participantId: participant.id,
      participantName: participant.name,
      paidCents: 0,
      owedCents: 0,
      netCents: 0
    });
  });

  expenses.forEach((expense) => {
    const payer = ledger.get(expense.paidByParticipantId);
    if (payer) {
      payer.paidCents += expense.amountCents;
    }

    expense.splits.forEach((split) => {
      const participant = ledger.get(split.participantId);
      if (participant) {
        participant.owedCents += split.amountCents;
      }
    });
  });

  const balances = Array.from(ledger.values()).map((row) => ({
    ...row,
    netCents: row.paidCents - row.owedCents
  }));

  const creditors = balances
    .filter((balance) => balance.netCents > 0)
    .map((balance) => ({ ...balance }))
    .sort((left, right) => right.netCents - left.netCents);
  const debtors = balances
    .filter((balance) => balance.netCents < 0)
    .map((balance) => ({ ...balance, netCents: Math.abs(balance.netCents) }))
    .sort((left, right) => right.netCents - left.netCents);

  const settlements: SettlementInstruction[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amountCents = Math.min(creditor.netCents, debtor.netCents);

    settlements.push({
      fromParticipantId: debtor.participantId,
      fromParticipantName: debtor.participantName,
      toParticipantId: creditor.participantId,
      toParticipantName: creditor.participantName,
      amountCents
    });

    creditor.netCents -= amountCents;
    debtor.netCents -= amountCents;

    if (creditor.netCents === 0) {
      creditorIndex += 1;
    }

    if (debtor.netCents === 0) {
      debtorIndex += 1;
    }
  }

  const currentUser = participants.find((participant) => participant.isCurrentUser);
  const currentUserBalance = currentUser ? ledger.get(currentUser.id) : undefined;

  return {
    balances: balances.sort((left, right) => right.netCents - left.netCents),
    settlements,
    metrics: {
      totalGroupSpendCents: expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
      youPaidCents: currentUserBalance?.paidCents ?? 0,
      youOweCents: currentUserBalance?.owedCents ?? 0
    }
  };
}
