import {
  Accessibility,
  Bell,
  Car,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  History,
  LogOut,
  MapPin,
  MapPinOff,
  Receipt,
  Scale,
  Shield,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getStations } from '../data/stations';
import { StationCard } from '../components/StationCard';
import { useAppStore } from '../store/appStore';
import { formatDate, formatPoints } from '../utils/format';
import { companyInfo } from '../data/company';
import { tierThresholds } from '../data/rewards';
import { getGeoConsent, revokeGeoConsent } from '../utils/geoConsent';

const menuSections = [
  {
    title: 'Laden',
    items: [
      { to: '/fahrzeuge', icon: Car, label: 'Fahrzeuge' },
      { to: '/zahlung', icon: CreditCard, label: 'Zahlung' },
      { to: '/historie', icon: History, label: 'Ladehistorie' },
    ],
  },
  {
    title: 'App',
    items: [
      { to: '/barrierefreiheit', icon: Accessibility, label: 'Barrierefreiheit' },
      { to: '/benachrichtigungen', icon: Bell, label: 'Benachrichtigungen' },
      { to: '/tarife', icon: Receipt, label: 'Tarife & Preise' },
    ],
  },
  {
    title: 'Rechtliches',
    items: [
      { to: '/datenschutz', icon: Shield, label: 'Datenschutz' },
      { to: '/impressum', icon: FileText, label: 'Impressum' },
      { to: '/nutzungsbedingungen', icon: Scale, label: 'Nutzungsbedingungen' },
      { to: '/hilfe', icon: HelpCircle, label: 'Support' },
    ],
  },
];

export function ProfilePage() {
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const deleteAccount = useAppStore((s) => s.deleteAccount);
  const exportUserData = useAppStore((s) => s.exportUserData);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const navigate = useNavigate();
  const geoConsent = getGeoConsent();

  if (!user) {
    return (
      <div className="page-shell flex flex-col items-center text-center">
        <p className="text-bc-muted">Melden Sie sich an, um Ihr Profil zu verwalten.</p>
        <Link to="/anmelden" className="btn-primary mt-6 w-full max-w-xs text-center">
          Anmelden
        </Link>
      </div>
    );
  }

  const favorites = getStations().filter((s) => user.favoriteStationIds.includes(s.id));
  const tier = tierThresholds[user.loyaltyTier];

  const revokeLocation = () => {
    revokeGeoConsent();
    setUserLocation(null);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="page-shell pb-8">
      <h1 className="font-display text-2xl font-bold">Profil</h1>

      <div className="mt-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-gradient font-display text-xl font-bold text-bc-ink">
          {user.firstName[0]}
          {user.lastName[0]}
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-sm text-bc-muted">{user.email}</p>
          <p className="text-xs text-bc-accent">
            {tier.label} · {formatPoints(user.loyaltyPoints)} Points
          </p>
        </div>
      </div>

      <section className="mt-8">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-bc-muted">
          Ihre Daten
        </p>
        <div className="space-y-2 rounded-2xl border border-bc-border bg-bc-elevated p-4">
          <p className="text-sm text-bc-muted">
            Datenexport (Art. 20 DSGVO) und Verwaltung der Standort-Einwilligung.
          </p>
          <button
            type="button"
            onClick={() => exportUserData()}
            className="btn-secondary flex w-full items-center justify-center gap-2 text-sm"
          >
            <Download className="h-4 w-4" />
            Daten exportieren (JSON)
          </button>
          {geoConsent === 'granted' ? (
            <button
              type="button"
              onClick={revokeLocation}
              className="btn-secondary flex w-full items-center justify-center gap-2 text-sm"
            >
              <MapPinOff className="h-4 w-4" />
              Standort-Einwilligung widerrufen
            </button>
          ) : (
            <p className="text-xs text-bc-muted">
              Standort: {geoConsent === 'denied' ? 'abgelehnt' : 'noch nicht festgelegt'} – Banner
              erscheint bei Bedarf auf der Karte.
            </p>
          )}
        </div>
      </section>

      {menuSections.map((section) => (
        <section key={section.title} className="mt-8">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-bc-muted">
            {section.title}
          </p>
          <nav className="overflow-hidden rounded-2xl border border-bc-border bg-bc-elevated">
            {section.items.map(({ to, icon: Icon, label }, i) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center justify-between px-4 py-3.5 transition hover:bg-bc-surface ${
                  i > 0 ? 'border-t border-bc-border' : ''
                }`}
              >
                <span className="flex items-center gap-3 text-sm">
                  <Icon className="h-5 w-5 text-bc-accent" />
                  {label}
                </span>
                <ChevronRight className="h-4 w-4 text-bc-muted" />
              </Link>
            ))}
          </nav>
        </section>
      ))}

      {favorites.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display font-semibold">
            <MapPin className="h-5 w-5 text-bc-accent" />
            Favoriten
          </h2>
          <div className="mt-3 space-y-3">
            {favorites.map((s) => (
              <StationCard key={s.id} station={s} />
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => {
          logout();
          navigate('/anmelden');
        }}
        className="btn-secondary mt-10 flex w-full items-center justify-center gap-2 text-bc-danger border-bc-danger/30"
      >
        <LogOut className="h-4 w-4" />
        Abmelden
      </button>

      <button
        type="button"
        onClick={() => {
          if (
            window.confirm(
              'Alle Kontodaten auf diesem Gerät unwiderruflich löschen? Gespeicherte Zahlungsmethoden werden mit entfernt.'
            )
          ) {
            deleteAccount();
            navigate('/anmelden');
          }
        }}
        className="btn-secondary mt-3 flex w-full items-center justify-center gap-2 text-sm text-bc-muted"
      >
        <Trash2 className="h-4 w-4" />
        Konto auf diesem Gerät löschen
      </button>

      <p className="mt-8 text-center text-xs text-bc-muted">
        {companyInfo.brand} · Mitglied seit {formatDate(user.memberSince).split(' ')[0]}
      </p>
    </div>
  );
}
