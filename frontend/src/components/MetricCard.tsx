import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  hint: string;
  accent: 'indigo' | 'emerald' | 'amber';
  icon: ReactNode;
}

const accentStyles = {
  indigo: 'from-[#74f7c3]/30 to-[#1f3130]/10 text-[#9ffbe0]',
  emerald: 'from-[#2ad6a3]/30 to-[#18302b]/10 text-[#7bf0ca]',
  amber: 'from-[#f0af5a]/30 to-[#322214]/10 text-[#ffd091]'
};

export function MetricCard({ label, value, hint, accent, icon }: MetricCardProps) {
  return (
    <div className="surface-card rounded-[26px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{hint}</p>
        </div>
        <div className={`rounded-2xl border border-white/10 bg-gradient-to-br p-3 ${accentStyles[accent]}`}>{icon}</div>
      </div>
    </div>
  );
}
