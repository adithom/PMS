import type { ReactNode } from 'react';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type ModalShellProps = {
  title: string;
  subtitle?: string;
  size?: 'regular' | 'wide';
  className?: string;
  children: ReactNode;
  onClose: () => void;
};

export default function ModalShell({ title, subtitle, size = 'regular', className, children, onClose }: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl',
          size === 'wide' ? 'max-w-5xl' : 'max-w-lg',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}