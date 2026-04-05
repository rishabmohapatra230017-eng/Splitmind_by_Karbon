import { ArrowRight, IndianRupee, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { GroupSummary } from '../lib/types';

interface GroupCardProps {
  group: GroupSummary;
  onDelete: (group: GroupSummary) => void;
}

export function GroupCard({ group, onDelete }: GroupCardProps) {
  return (
    <div className="surface-card group relative overflow-hidden rounded-[28px] p-5 transition duration-300 hover:-translate-y-1 hover:border-[#74f7c3]/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(116,247,195,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(240,175,90,0.14),transparent_35%)] opacity-90" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#7b8d80]">Active Group</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{group.name}</h3>
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-400">{group.note}</p>
          </div>
          <button
            onClick={() => onDelete(group)}
            className="rounded-full border border-white/10 bg-slate-950/40 p-2 text-slate-400 transition hover:border-rose-400/40 hover:text-rose-300"
            aria-label={`Delete ${group.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="panel-muted rounded-2xl p-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Users className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">People</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">{group.participantCount}</p>
          </div>
          <div className="panel-muted rounded-2xl p-4">
            <div className="flex items-center gap-2 text-slate-400">
              <IndianRupee className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.2em]">Spend</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">{group.totalSpend.toFixed(0)}</p>
          </div>
        </div>

        <div className="panel-muted mt-6 flex items-center justify-between rounded-2xl p-3 text-sm text-slate-300">
          <span>You paid ₹{group.youPaid.toFixed(0)}</span>
          <span>You owe ₹{group.youOwe.toFixed(0)}</span>
        </div>

        <Link
          to={`/groups/${group.id}`}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#74f7c3]/25 bg-[#74f7c3]/10 px-4 py-2 text-sm font-medium text-[#b7f9e4] transition hover:border-[#74f7c3]/45 hover:text-white"
        >
          Open workspace
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
