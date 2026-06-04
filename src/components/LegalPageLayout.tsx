import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

export function LegalFooterLinks({ className = '' }: { className?: string }) {
  const links = [
    { to: '/impressum', label: 'Impressum' },
    { to: '/datenschutz', label: 'Datenschutz' },
    { to: '/nutzungsbedingungen', label: 'Nutzungsbedingungen' },
    { to: '/barrierefreiheit', label: 'Barrierefreiheit' },
    { to: '/hilfe', label: 'Hilfe' },
  ] as const;

  return (
    <nav
      className={`flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-bc-muted ${className}`}
      aria-label="Rechtliches"
    >
      {links.map(({ to, label }) => (
        <Link key={to} to={to} className="hover:text-bc-accent">
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function LegalPageLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();
  const backTo = user ? '/profil' : '/karte';

  return (
    <div className="page-shell pb-10">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="text-sm text-bc-accent"
      >
        ← Zurück
      </button>
      <h1 className="mt-4 font-display text-2xl font-bold text-bc-text">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-bc-muted">{subtitle}</p>}
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-bc-muted">{children}</div>
      <LegalFooterLinks className="mt-10 border-t border-bc-border pt-6" />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-base font-semibold text-bc-text">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
