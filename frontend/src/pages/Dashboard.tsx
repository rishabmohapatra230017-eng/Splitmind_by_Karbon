import { useEffect, useMemo, useState } from 'react';
import { IndianRupee, Layers3, LogOut, Plus, RefreshCcw, Sparkles, Users } from 'lucide-react';

import { api } from '../api';
import { EmptyState } from '../components/EmptyState';
import { GlassModal } from '../components/GlassModal';
import { GroupCard } from '../components/GroupCard';
import { MetricCard } from '../components/MetricCard';
import type { CurrentUser, GroupSummary } from '../lib/types';

interface DashboardProps {
  currentUser: CurrentUser;
  onLogout: () => Promise<void>;
}

export function Dashboard({ currentUser, onLogout }: DashboardProps) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', note: '' });
  const [error, setError] = useState('');

  const totals = useMemo(
    () => ({
      totalSpend: groups.reduce((sum, group) => sum + group.totalSpend, 0),
      totalPaid: groups.reduce((sum, group) => sum + group.youPaid, 0),
      totalOwe: groups.reduce((sum, group) => sum + group.youOwe, 0)
    }),
    [groups]
  );

  async function loadDashboard() {
    setLoading(true);
    try {
      const nextGroups = await api.listGroups();
      setGroups(nextGroups);
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function handleCreateGroup(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const createdGroup = await api.createGroup(form);
      setGroups((current) => [createdGroup, ...current]);
      setForm({ name: '', note: '' });
      setModalOpen(false);
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteGroup(group: GroupSummary) {
    if (!window.confirm(`Delete "${group.name}" and all associated expenses?`)) {
      return;
    }

    try {
      await api.deleteGroup(group.id);
      setGroups((current) => current.filter((entry) => entry.id !== group.id));
      setError('');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to delete group');
    }
  }

  async function handleResetWorkspace() {
    if (!window.confirm(`Reset ${currentUser.name}'s workspace data back to a blank logged-out state?`)) {
      return;
    }

    await api.resetWorkspace();
    await loadDashboard();
  }

  const firstName = currentUser.name.split(' ')[0] ?? currentUser.name;

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pb-12 pt-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(116,247,195,0.22),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(240,175,90,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(45,58,79,0.24),transparent_28%)]" />

      <main className="relative mx-auto max-w-7xl">
        <section className="surface-panel overflow-hidden rounded-[34px] px-6 py-8 sm:px-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-80 bg-[radial-gradient(circle_at_center,rgba(116,247,195,0.16),transparent_60%)] lg:block" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="hero-badge">
                <Sparkles className="h-3.5 w-3.5" />
                SplitMint Karbon Flow
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Welcome back, {currentUser.name}.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                Track shared spends inside a richer mint-and-carbon workspace, keep balances legible at a glance, and move from raw expenses to clean settlements without friction.
              </p>
              <p className="mt-3 text-sm text-slate-400">Signed in as {currentUser.email}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button className="button-secondary" onClick={() => void onLogout()}>
                <LogOut className="h-4 w-4" />
                Log out
              </button>
              <button className="button-secondary" onClick={() => void handleResetWorkspace()}>
                <RefreshCcw className="h-4 w-4" />
                Reset demo data
              </button>
              <button className="button-primary" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" />
                New group
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Active Groups"
            value={groups.length.toString()}
            hint="Curated workspaces for every trip, dinner, and shared plan."
            accent="indigo"
            icon={<Layers3 className="h-6 w-6" />}
          />
          <MetricCard
            label="You Paid"
            value={`₹${totals.totalPaid.toFixed(0)}`}
            hint="What you fronted across all current groups."
            accent="emerald"
            icon={<IndianRupee className="h-6 w-6" />}
          />
          <MetricCard
            label="Participants"
            value={groups.reduce((sum, group) => sum + group.participantCount, 0).toString()}
            hint={`Group spend is ₹${totals.totalSpend.toFixed(0)} with ₹${totals.totalOwe.toFixed(0)} currently owed by you.`}
            accent="amber"
            icon={<Users className="h-6 w-6" />}
          />
        </section>

        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">{firstName}'s shared workspaces</h2>
              <p className="mt-1 text-sm text-slate-400">Only workspaces connected to the signed-in account are shown here.</p>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="surface-card h-72 animate-pulse rounded-[28px]" />
              ))}
            </div>
          ) : groups.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} onDelete={handleDeleteGroup} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No groups yet"
              body={`Create ${firstName}'s first workspace and SplitMint will add you as the first participant automatically.`}
              action={
                <button className="button-primary" onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create your first group
                </button>
              }
            />
          )}
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}
      </main>

      <GlassModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create a new group"
        description={`${currentUser.name} will be added automatically, so you can invite up to three more participants later.`}
      >
        <form className="space-y-5" onSubmit={handleCreateGroup}>
          <label className="field-shell">
            <span className="field-label">Group name</span>
            <input
              className="field-input"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Monsoon Road Trip"
              required
            />
          </label>

          <label className="field-shell">
            <span className="field-label">Note</span>
            <textarea
              className="field-input min-h-[120px] resize-none"
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              placeholder="Why this group exists, where it is headed, or what kind of spending it covers."
            />
          </label>

          <div className="flex justify-end gap-3">
            <button type="button" className="button-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="button-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create group'}
            </button>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}
