import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Filter, IndianRupee, Pencil, Plus, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { api } from '../api';
import { EmptyState } from '../components/EmptyState';
import { GlassModal } from '../components/GlassModal';
import { MetricCard } from '../components/MetricCard';
import type { CurrentUser, GroupDetailPayload, Participant, SplitMethod } from '../lib/types';

const accentOptions = ['indigo', 'emerald', 'amber', 'rose'] as const;

const today = new Date().toISOString().slice(0, 10);

interface GroupDetailProps {
  currentUser: CurrentUser;
}

export function GroupDetail({ currentUser }: GroupDetailProps) {
  const { groupId = '' } = useParams();
  const [detail, setDetail] = useState<GroupDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'history' | 'settle' | 'people'>('history');
  const [search, setSearch] = useState('');
  const [payerFilter, setPayerFilter] = useState('all');
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [participantForm, setParticipantForm] = useState({ name: '', colorToken: 'emerald' });
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    note: '',
    amount: '',
    expenseDate: today,
    paidByParticipantId: '',
    splitMethod: 'equal' as SplitMethod,
    selectedParticipantIds: [] as string[],
    customAmounts: {} as Record<string, string>,
    percentages: {} as Record<string, string>
  });

  async function loadGroup() {
    setLoading(true);
    try {
      const nextDetail = await api.getGroup(groupId);
      setDetail(nextDetail);
      setExpenseForm((current) => ({
        ...current,
        paidByParticipantId: nextDetail.participants[0]?.id ?? '',
        selectedParticipantIds: nextDetail.participants.map((participant) => participant.id)
      }));
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load group');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGroup();
  }, [groupId]);

  const filteredExpenses = useMemo(() => {
    if (!detail) {
      return [];
    }

    return detail.expenses.filter((expense) => {
      const matchesSearch =
        !search.trim() ||
        [expense.description, expense.note, expense.paidByName].some((value) =>
          value.toLowerCase().includes(search.trim().toLowerCase())
        );
      const matchesPayer = payerFilter === 'all' || expense.paidByParticipantId === payerFilter;
      return matchesSearch && matchesPayer;
    });
  }, [detail, payerFilter, search]);

  async function handleAddParticipant(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) {
      return;
    }

    try {
      const nextDetail = await api.addParticipant(detail.group.id, participantForm);
      setDetail(nextDetail);
      setParticipantForm({ name: '', colorToken: 'emerald' });
      setParticipantModalOpen(false);
      setExpenseForm((current) => ({
        ...current,
        paidByParticipantId: nextDetail.participants[0]?.id ?? '',
        selectedParticipantIds: nextDetail.participants.map((participant) => participant.id)
      }));
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to add participant');
    }
  }

  async function handleRemoveParticipant(participant: Participant) {
    if (!detail || participant.isCurrentUser) {
      return;
    }

    if (!window.confirm(`Remove ${participant.name} from this group?`)) {
      return;
    }

    try {
      const nextDetail = await api.removeParticipant(detail.group.id, participant.id);
      setDetail(nextDetail);
      setExpenseForm((current) => ({
        ...current,
        paidByParticipantId: nextDetail.participants[0]?.id ?? '',
        selectedParticipantIds: current.selectedParticipantIds.filter((id) => id !== participant.id)
      }));
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to remove participant');
    }
  }

  async function handleCreateExpense(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) {
      return;
    }

    const participantIds = expenseForm.selectedParticipantIds.length
      ? expenseForm.selectedParticipantIds
      : detail.participants.map((participant) => participant.id);

    if (participantIds.length === 0) {
      setError('Select at least one participant for this expense');
      return;
    }

    if (expenseForm.splitMethod === 'custom' && Math.abs(customTotal - Number(expenseForm.amount || 0)) > 0.009) {
      setError('Custom split amounts must add up exactly to the expense amount');
      return;
    }

    if (expenseForm.splitMethod === 'percentage' && Math.abs(percentageTotal - 100) > 0.009) {
      setError('Percentage splits must add up to exactly 100');
      return;
    }

    try {
      const payload = {
        description: expenseForm.description,
        note: expenseForm.note,
        amount: Number(expenseForm.amount),
        expenseDate: expenseForm.expenseDate,
        paidByParticipantId: expenseForm.paidByParticipantId,
        splitMethod: expenseForm.splitMethod,
        participantIds,
        splits: participantIds.map((participantId) => ({
          participantId,
          amount: expenseForm.splitMethod === 'custom' ? Number(expenseForm.customAmounts[participantId] || 0) : undefined,
          percentage:
            expenseForm.splitMethod === 'percentage' ? Number(expenseForm.percentages[participantId] || 0) : undefined
        }))
      };
      const nextDetail = editingExpenseId
        ? await api.updateExpense(detail.group.id, editingExpenseId, payload)
        : await api.createExpense(detail.group.id, payload);
      setDetail(nextDetail);
      resetExpenseForm(nextDetail);
      setExpenseModalOpen(false);
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save expense');
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!detail) {
      return;
    }

    if (!window.confirm('Delete this expense entry?')) {
      return;
    }

    try {
      const nextDetail = await api.deleteExpense(detail.group.id, expenseId);
      setDetail(nextDetail);
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to delete expense');
    }
  }

  if (loading) {
    return <div className="min-h-screen animate-pulse bg-slate-950" />;
  }

  if (!detail) {
    return (
      <div className="p-6">
        <EmptyState title="Group unavailable" body={error || 'We could not load this shared workspace.'} />
      </div>
    );
  }

  const selectedParticipants = detail.participants.filter((participant) =>
    expenseForm.selectedParticipantIds.includes(participant.id)
  );

  const equalPreview =
    selectedParticipants.length && expenseForm.amount
      ? Number(expenseForm.amount) / selectedParticipants.length
      : 0;
  const customTotal = selectedParticipants.reduce(
    (sum, participant) => sum + Number(expenseForm.customAmounts[participant.id] || 0),
    0
  );
  const percentageTotal = selectedParticipants.reduce(
    (sum, participant) => sum + Number(expenseForm.percentages[participant.id] || 0),
    0
  );

  function resetExpenseForm(nextDetail: GroupDetailPayload) {
    setEditingExpenseId(null);
    setExpenseForm({
      description: '',
      note: '',
      amount: '',
      expenseDate: today,
      paidByParticipantId: nextDetail.participants[0]?.id ?? '',
      splitMethod: 'equal',
      selectedParticipantIds: nextDetail.participants.map((participant) => participant.id),
      customAmounts: {},
      percentages: {}
    });
  }

  function openCreateExpenseModal() {
    if (!detail) {
      return;
    }

    resetExpenseForm(detail);
    setExpenseModalOpen(true);
  }

  function openEditExpenseModal(expenseId: string) {
    if (!detail) {
      return;
    }

    const expense = detail.expenses.find((entry) => entry.id === expenseId);
    if (!expense) {
      return;
    }

    setEditingExpenseId(expense.id);
    setExpenseForm({
      description: expense.description,
      note: expense.note,
      amount: expense.amount.toString(),
      expenseDate: expense.expenseDate,
      paidByParticipantId: expense.paidByParticipantId,
      splitMethod: expense.splitMethod,
      selectedParticipantIds: expense.splits.map((split) => split.participantId),
      customAmounts: Object.fromEntries(expense.splits.map((split) => [split.participantId, split.amount.toString()])),
      percentages: Object.fromEntries(
        expense.splits.map((split) => [split.participantId, split.percentage?.toString() ?? ''])
      )
    });
    setExpenseModalOpen(true);
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pb-12 pt-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(116,247,195,0.2),transparent_25%),radial-gradient(circle_at_top_left,rgba(240,175,90,0.14),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(45,58,79,0.22),transparent_28%)]" />

      <main className="relative mx-auto max-w-7xl">
        <section className="surface-panel rounded-[34px] px-6 py-8 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.24em] text-[#7b8d80]">Karbon Workspace</p>
              <h1 className="mt-2 text-4xl font-semibold text-white">{detail.group.name}</h1>
              <p className="mt-3 text-base leading-7 text-slate-300">{detail.group.note}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="button-secondary" onClick={() => setParticipantModalOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Add participant
              </button>
              <button className="button-primary" onClick={openCreateExpenseModal}>
                <Plus className="h-4 w-4" />
                Add expense
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Total Group Spend"
            value={`₹${detail.metrics.totalGroupSpend.toFixed(0)}`}
            hint="Every expense across the selected group."
            accent="indigo"
            icon={<IndianRupee className="h-6 w-6" />}
          />
          <MetricCard
            label="You Paid"
            value={`₹${detail.metrics.youPaid.toFixed(0)}`}
            hint="Cash covered by the current hardcoded user."
            accent="emerald"
            icon={<CalendarDays className="h-6 w-6" />}
          />
          <MetricCard
            label="You Owe"
            value={`₹${detail.metrics.youOwe.toFixed(0)}`}
            hint="Your total assigned share in this workspace."
            accent="amber"
            icon={<Users className="h-6 w-6" />}
          />
        </section>

        <section className="surface-panel mt-8 rounded-[32px] p-6">
          <div className="flex flex-wrap items-center gap-3">
            {[
              ['history', 'Transaction history'],
              ['settle', 'How to settle up'],
              ['people', 'Participants']
            ].map(([value, label]) => (
              <button
                key={value}
                className={tab === value ? 'tab-active' : 'tab-idle'}
                onClick={() => setTab(value as 'history' | 'settle' | 'people')}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'history' ? (
            <div className="mt-6">
              <div className="grid gap-3 md:grid-cols-[1fr,220px]">
                <label className="field-shell">
                  <span className="field-label flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Search expenses
                  </span>
                  <input
                    className="field-input"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by description, note, or payer"
                  />
                </label>

                <label className="field-shell">
                  <span className="field-label flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filter by payer
                  </span>
                  <select
                    className="field-input"
                    value={payerFilter}
                    onChange={(event) => setPayerFilter(event.target.value)}
                  >
                    <option value="all">Everyone</option>
                    {detail.participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-6 space-y-4">
                {filteredExpenses.length ? (
                  filteredExpenses.map((expense) => (
                    <article
                      key={expense.id}
                      className="surface-card rounded-[26px] p-5 transition hover:border-[#74f7c3]/20"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-semibold text-white">{expense.description}</h3>
                            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#a8c3b5]">
                              {expense.splitMethod}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-400">{expense.note || 'No note added for this transaction.'}</p>
                          <p className="mt-3 text-sm text-slate-400">
                            Paid by <span className="text-white">{expense.paidByName}</span> on{' '}
                            <span className="text-white">{expense.expenseDate}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Amount</p>
                            <p className="mt-2 text-2xl font-semibold text-white">₹{expense.amount.toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => openEditExpenseModal(expense.id)}
                            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-[#74f7c3]/40 hover:text-[#9ffbe0]"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => void handleDeleteExpense(expense.id)}
                            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-rose-400/40 hover:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {expense.splits.map((split) => (
                          <span
                            key={split.participantId}
                            className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-slate-300"
                          >
                            {split.participantName} · ₹{split.amount.toFixed(2)}
                            {typeof split.percentage === 'number' ? ` · ${split.percentage}%` : ''}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="No matching transactions"
                    body="Try changing the search text or payer filter, or add a new expense to populate the history."
                  />
                )}
              </div>
            </div>
          ) : null}

          {tab === 'settle' ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
              <div className="surface-card rounded-[26px] p-5">
                <h3 className="text-xl font-semibold text-white">Minimal settlement plan</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  The balance engine compresses the debt graph into the smallest practical set of transfers for {currentUser.name}.
                </p>

                <div className="mt-6 space-y-3">
                  {detail.settlements.length ? (
                    detail.settlements.map((settlement) => (
                      <div key={settlement.label} className="panel-muted flex items-center justify-between rounded-2xl px-4 py-4">
                        <div className="flex items-center gap-3 text-sm text-slate-300">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{settlement.fromParticipantName}</span>
                          <ArrowRight className="h-4 w-4 text-[#9ffbe0]" />
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{settlement.toParticipantName}</span>
                        </div>
                        <span className="text-lg font-semibold text-[#7bf0ca]">₹{settlement.amount.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="All settled" body="Nobody owes anyone anything right now. The group is perfectly balanced." />
                  )}
                </div>
              </div>

              <div className="surface-card rounded-[26px] p-5">
                <h3 className="text-xl font-semibold text-white">Net balances</h3>
                <div className="mt-5 space-y-3">
                  {detail.balances.map((balance) => (
                    <div key={balance.participantId} className="panel-muted rounded-2xl p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-white">{balance.participantName}</p>
                        <p className={balance.net >= 0 ? 'text-[#7bf0ca]' : 'text-rose-300'}>
                          {balance.net >= 0 ? '+' : ''}
                          ₹{balance.net.toFixed(2)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm text-slate-400">
                        <span>Paid ₹{balance.paid.toFixed(2)}</span>
                        <span>Owed ₹{balance.owed.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'people' ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {detail.participants.map((participant) => (
                <div key={participant.id} className="surface-card rounded-[24px] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white">
                        {participant.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{participant.name}</p>
                        <p className="text-sm text-slate-400">{participant.isCurrentUser ? 'Current user' : 'Participant'}</p>
                      </div>
                    </div>
                    {!participant.isCurrentUser ? (
                      <button
                        onClick={() => void handleRemoveParticipant(participant)}
                        className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-rose-400/40 hover:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}
      </main>

      <GlassModal
        open={participantModalOpen}
        onClose={() => setParticipantModalOpen(false)}
        title="Add a participant"
        description={`Each group supports up to four participants total, including ${currentUser.name}.`}
      >
        <form className="space-y-5" onSubmit={handleAddParticipant}>
          <label className="field-shell">
            <span className="field-label">Participant name</span>
            <input
              className="field-input"
              value={participantForm.name}
              onChange={(event) => setParticipantForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Priya Nair"
              required
            />
          </label>

          <label className="field-shell">
            <span className="field-label">Accent tone</span>
            <select
              className="field-input"
              value={participantForm.colorToken}
              onChange={(event) => setParticipantForm((current) => ({ ...current, colorToken: event.target.value }))}
            >
              {accentOptions.map((accent) => (
                <option key={accent} value={accent}>
                  {accent}
                </option>
              ))}
            </select>
          </label>

          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setParticipantModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button-primary">
              Add participant
            </button>
          </div>
        </form>
      </GlassModal>

      <GlassModal
        open={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          if (detail) {
            resetExpenseForm(detail);
          }
        }}
        title={editingExpenseId ? 'Edit expense' : 'Add expense'}
        description="Choose a split method and EquiShare will keep the cents balanced exactly."
      >
        <form className="space-y-5" onSubmit={handleCreateExpense}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-shell md:col-span-2">
              <span className="field-label">Description</span>
              <input
                className="field-input"
                value={expenseForm.description}
                onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Sunset dinner at Morjim"
                required
              />
            </label>

            <label className="field-shell md:col-span-2">
              <span className="field-label">Note</span>
              <textarea
                className="field-input min-h-[88px] resize-none"
                value={expenseForm.note}
                onChange={(event) => setExpenseForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Optional extra context for the group."
              />
            </label>

            <label className="field-shell">
              <span className="field-label">Amount</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="field-input"
                value={expenseForm.amount}
                onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0.00"
                required
              />
            </label>

            <label className="field-shell">
              <span className="field-label">Date</span>
              <input
                type="date"
                className="field-input"
                value={expenseForm.expenseDate}
                onChange={(event) => setExpenseForm((current) => ({ ...current, expenseDate: event.target.value }))}
                required
              />
            </label>

            <label className="field-shell">
              <span className="field-label">Who paid</span>
              <select
                className="field-input"
                value={expenseForm.paidByParticipantId}
                onChange={(event) =>
                  setExpenseForm((current) => ({ ...current, paidByParticipantId: event.target.value }))
                }
                required
              >
                {detail.participants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-shell">
              <span className="field-label">Split method</span>
              <select
                className="field-input"
                value={expenseForm.splitMethod}
                onChange={(event) =>
                  setExpenseForm((current) => ({ ...current, splitMethod: event.target.value as SplitMethod }))
                }
              >
                <option value="equal">Equal</option>
                <option value="custom">Custom</option>
                <option value="percentage">Percentage</option>
              </select>
            </label>
          </div>

          <div className="surface-card rounded-[24px] p-4">
            <p className="text-sm font-medium text-white">Included participants</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {detail.participants.map((participant) => {
                const active = expenseForm.selectedParticipantIds.includes(participant.id);
                return (
                  <button
                    key={participant.id}
                    type="button"
                    className={active ? 'pill-active' : 'pill-idle'}
                    onClick={() =>
                      setExpenseForm((current) => ({
                        ...current,
                        selectedParticipantIds: active
                          ? current.selectedParticipantIds.filter((id) => id !== participant.id)
                          : [...current.selectedParticipantIds, participant.id]
                      }))
                    }
                  >
                    {participant.name}
                  </button>
                );
              })}
            </div>
          </div>

          {expenseForm.splitMethod === 'equal' ? (
            <div className="surface-card rounded-[24px] p-4 text-sm text-slate-300">
              Each selected participant will be assigned approximately <span className="font-semibold text-white">₹{Number.isFinite(equalPreview) ? equalPreview.toFixed(2) : '0.00'}</span>, with final rounding handled by the balance engine.
            </div>
          ) : null}

          {expenseForm.splitMethod === 'custom' ? (
            <div className="surface-card space-y-3 rounded-[24px] p-4">
              {selectedParticipants.map((participant) => (
                <label key={participant.id} className="field-shell">
                  <span className="field-label">{participant.name}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="field-input"
                    value={expenseForm.customAmounts[participant.id] ?? ''}
                    onChange={(event) =>
                      setExpenseForm((current) => ({
                        ...current,
                        customAmounts: { ...current.customAmounts, [participant.id]: event.target.value }
                      }))
                    }
                    placeholder="0.00"
                  />
                </label>
              ))}
              <p className="text-sm text-slate-400">
                Current custom total: <span className="text-white">₹{customTotal.toFixed(2)}</span>
              </p>
            </div>
          ) : null}

          {expenseForm.splitMethod === 'percentage' ? (
            <div className="surface-card space-y-3 rounded-[24px] p-4">
              {selectedParticipants.map((participant) => (
                <label key={participant.id} className="field-shell">
                  <span className="field-label">{participant.name}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="field-input"
                    value={expenseForm.percentages[participant.id] ?? ''}
                    onChange={(event) =>
                      setExpenseForm((current) => ({
                        ...current,
                        percentages: { ...current.percentages, [participant.id]: event.target.value }
                      }))
                    }
                    placeholder="0"
                  />
                </label>
              ))}
              <p className="text-sm text-slate-400">
                Current percentage total: <span className="text-white">{percentageTotal.toFixed(2)}%</span>
              </p>
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setExpenseModalOpen(false);
                resetExpenseForm(detail);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="button-primary">
              {editingExpenseId ? 'Update expense' : 'Save expense'}
            </button>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}
