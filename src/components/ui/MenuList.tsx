import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export function MenuSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      {title ? (
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-bc-muted">{title}</p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-bc-border bg-bc-elevated">{children}</div>
    </section>
  );
}

export function MenuRow({
  to,
  onClick,
  icon: Icon,
  label,
  detail,
  destructive,
}: {
  to?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  label: string;
  detail?: string;
  destructive?: boolean;
}) {
  const className = `flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-bc-surface border-t border-bc-border first:border-t-0 ${
    destructive ? 'text-bc-danger' : ''
  }`;

  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        {Icon ? <Icon className={`h-5 w-5 shrink-0 ${destructive ? 'text-bc-danger' : 'text-bc-accent'}`} /> : null}
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          {detail ? <span className="block truncate text-xs text-bc-muted">{detail}</span> : null}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-bc-muted" />
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
