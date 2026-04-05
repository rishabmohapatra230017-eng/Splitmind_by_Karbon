import type { PropsWithChildren } from 'react';

interface GlassModalProps extends PropsWithChildren {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
}

export function GlassModal({ title, description, open, onClose, children }: GlassModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto px-4 py-6 sm:py-10">
      <button className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} aria-label="Close modal" />
      <div className="relative mx-auto flex min-h-full w-full max-w-2xl items-center justify-center">
        <div className="surface-panel relative flex w-full max-w-2xl flex-col overflow-hidden rounded-[28px]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(116,247,195,0.18),transparent_65%)]" />
          <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-6 pb-5 pt-6">
          <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#89a798]">Workspace action</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">{title}</h3>
              {description ? <p className="mt-2 max-w-xl text-sm text-slate-300">{description}</p> : null}
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300 transition hover:border-[#74f7c3]/40 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="max-h-[min(78vh,760px)] overflow-y-auto px-6 py-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
