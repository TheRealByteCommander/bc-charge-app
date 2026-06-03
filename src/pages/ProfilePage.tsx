import {
  Battery,
  Bell,
  Car,
  ChevronRight,
  CreditCard,
  Globe,
  HelpCircle,
  History,
  LogOut,
  MapPin,
  Receipt,
  Shield,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { getStations } from '../data/stations';
import { StationCard } from '../components/StationCard';
import { useAppStore } from '../store/appStore';
import { formatDate, formatPoints } from '../utils/format';
import { companyInfo } from '../data/company';
import { tierThresholds } from '../data/rewards';

const menuItems = [
  { to: '/ladeplanung', icon: Battery, label: 'Station in der Nähe' },
  { to: '/historie', icon: History, label: 'Ladehistorie' },
  { to: '/fahrzeuge', icon: Car, label: 'Fahrzeuge' },
  { to: '/zahlung', icon: CreditCard, label: 'Zahlungsmethoden' },
  { to: '/benachrichtigungen', icon: Bell, label: 'Benachrichtigungen' },
  { to: '/tarife', icon: Receipt, label: 'Tarife & Preise' },
  { to: '/roaming', icon: Globe, label: 'Roaming & Partner' },
  { to: '/hilfe', icon: HelpCircle, label: 'Hilfe & Support' },
  { to: '/datenschutz', icon: Shield, label: 'Datenschutz' },
];

export function ProfilePage() {
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const deleteAccount = useAppStore((s) => s.deleteAccount);
  const navigate = useNavigate();
  const citrineosConnected = useAppStore((s) => s.citrineosConnected);
  const stationDataSource = useAppStore((s) => s.stationDataSource);
  const refreshCitrineos = useAppStore((s) => s.refreshCitrineosData);
  const citrineosSyncing = useAppStore((s) => s.citrineosSyncing);
  const citrineosSyncError = useAppStore((s) => s.citrineosSyncError);

  if (!user) {
    return (
      <div className="page-shell flex flex-col items-center">
        <Logo />
        <p className="mt-6 text-bc-muted">Ihr BC-Charge-Konto</p>
        <Link to="/anmelden" className="btn-primary mt-6 w-full max-w-xs text-center">
          Anmelden
        </Link>
        <Link to="/registrieren" className="btn-secondary mt-3 w-full max-w-xs text-center">
          Registrieren
        </Link>
      </div>
    );
  }

  const favorites = getStations().filter((s) => user.favoriteStationIds.includes(s.id));
  const tier = tierThresholds[user.loyaltyTier];

  return (
    <div className="page-shell">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gradient font-display text-2xl font-bold text-bc-ink">
          {user.firstName[0]}
          {user.lastName[0]}
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-sm text-bc-muted">{user.email}</p>
          <p className="font-mono text-xs text-bc-accent">{user.membershipId}</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-bc-border bg-bc-elevated p-4">
        <p className="text-sm font-medium">Backend · CitrineOS</p>
        <p className="mt-1 text-xs text-bc-muted">
          {citrineosConnected
            ? `Verbunden · ${stationDataSource === 'citrineos' ? 'Live-Stationen' : 'Demo-Daten'}`
            : 'Offline – Demo-Stationen aktiv'}
        </p>
        {citrineosSyncError && <p className="mt-1 text-xs text-bc-warn">{citrineosSyncError}</p>}
        <button
          type="button"
          className="btn-secondary mt-3 w-full text-sm"
          disabled={citrineosSyncing}
          onClick={() => refreshCitrineos()}
        >
          {citrineosSyncing ? 'Synchronisiere…' : 'Mit CitrineOS synchronisieren'}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-bc-border bg-bc-elevated p-4 text-sm">
        <div>
          <p className="text-bc-muted">Mitglied seit</p>
          <p className="font-medium">{formatDate(user.memberSince).split(' ')[0]}</p>
        </div>
        <div>
          <p className="text-bc-muted">Stufe</p>
          <p className="font-medium text-bc-accent">{tier.label}</p>
        </div>
        <div>
          <p className="text-bc-muted">BC Points</p>
          <p className="font-medium">{formatPoints(user.loyaltyPoints)}</p>
        </div>
        <div>
          <p className="text-bc-muted">Telefon</p>
          <p className="font-medium">{user.phone}</p>
        </div>
      </div>

      <nav className="mt-6 space-y-1">
        {menuItems.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-between rounded-xl px-3 py-3.5 transition hover:bg-bc-elevated"
          >
            <span className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-bc-accent" />
              {label}
            </span>
            <ChevronRight className="h-5 w-5 text-bc-muted" />
          </Link>
        ))}
      </nav>

      {favorites.length > 0 && (
        <>
          <h2 className="mt-8 flex items-center gap-2 font-display font-semibold">
            <MapPin className="h-5 w-5 text-bc-accent" />
            Favoriten
          </h2>
          <div className="mt-3 space-y-3">
            {favorites.map((s) => (
              <StationCard key={s.id} station={s} />
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => {
          if (window.confirm('Alle lokalen Kontodaten auf diesem Gerät unwiderruflich löschen?')) {
            deleteAccount();
            navigate('/anmelden');
          }
        }}
        className="btn-secondary mt-8 flex w-full items-center justify-center gap-2 border-bc-warn/30 text-bc-warn"
      >
        <Trash2 className="h-5 w-5" />
        Lokale Daten löschen (DSGVO)
      </button>

      <button
        type="button"
        onClick={() => {
          logout();
          navigate('/anmelden');
        }}
        className="btn-secondary mt-3 flex w-full items-center justify-center gap-2 text-bc-danger border-bc-danger/30"
      >
        <LogOut className="h-4 w-4" />
        Abmelden
      </button>

      <p className="mt-8 text-center text-xs text-bc-muted">
        {companyInfo.brand} · {companyInfo.legalName}
        <br />
        {companyInfo.street}, {companyInfo.zip} {companyInfo.city}
      </p>
    </div>
  );
}
