import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  body: string;
  action?: ReactNode;
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="surface-card rounded-[30px] border-dashed px-6 py-12 text-center">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[#74f7c3]/20 bg-gradient-to-br from-[#74f7c3]/15 to-[#f0af5a]/10">
        <div className="h-12 w-12 rounded-[18px] border border-white/10 bg-slate-900/80 shadow-lg shadow-[#27c99a]/20" />
      </div>
      <h3 className="text-2xl font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
