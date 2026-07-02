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
import { useLocale } from '../i18n/LocaleContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { StationCard } from '../components/StationCard';
import { useAppStore } from '../store/appStore';
import { formatDate, formatPoints } from '../utils/format';
import { companyInfo } from '../data/company';
import { tierThresholds } from '../data/rewards';
import { getGeoConsent, revokeGeoConsent } from '../utils/geoConsent';

type MenuKey = 'vehicles' | 'payment' | 'history' | 'accessibility' | 'notifications' | 'tariffs' | 'privacy' | 'imprint' | 'terms' | 'support';

interface MenuItem {
  to: string;
  icon: typeof Car;
  labelKey: MenuKey;
}

interface MenuSection {
  titleKey: 'charging' | 'app' | 'legal';
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    titleKey: 'charging',
    items: [
      { to: '/fahrzeuge', icon: Car, labelKey: 'vehicles' },
      { to: '/zahlung', icon: CreditCard, labelKey: 'payment' },
      { to: '/historie', icon: History, labelKey: 'history' },
    ],
  },
  {
    titleKey: 'app',
    items: [
      { to: '/barrierefreiheit', icon: Accessibility, labelKey: 'accessibility' },
      { to: '/benachrichtigungen', icon: Bell, labelKey: 'notifications' },
      { to: '/tarife', icon: Receipt, labelKey: 'tariffs' },
    ],
  },
  {
    titleKey: 'legal',
    items: [
      { to: '/datenschutz', icon: Shield, labelKey: 'privacy' },
      { to: '/impressum', icon: FileText, labelKey: 'imprint' },
      { to: '/nutzungsbedingungen', icon: Scale, labelKey: 'terms' },
      { to: '/hilfe', icon: HelpCircle, labelKey: 'support' },
    ],
  },
];

const sectionTitles = {
  de: { charging: 'Laden', app: 'App', legal: 'Rechtliches' },
  en: { charging: 'Charging', app: 'App', legal: 'Legal' },
};

export function ProfilePage() {
  const { t, locale } = useLocale();
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
        <p className="text-bc-muted">{t.guest.hint}</p>
        <Link to="/anmelden" className="btn-primary mt-6 w-full max-w-xs text-center">
          {t.auth.login}
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
    <div className="page-shell">
      <h1 className="font-display text-2xl font-bold">{t.profile.title}</h1>

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
            {tier.label} · {formatPoints(user.loyaltyPoints)} {t.gamification.points}
          </p>
        </div>
      </div>

      <section className="mt-8">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-bc-muted">
          {t.profile.language}
        </p>
        <div className="rounded-2xl border border-bc-border bg-bc-elevated p-4">
          <LanguageSwitcher />
        </div>
      </section>

      <section className="mt-8">
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-bc-muted">
          {t.profile.yourData}
        </p>
        <div className="space-y-2 rounded-2xl border border-bc-border bg-bc-elevated p-4">
          <p className="text-sm text-bc-muted">{t.profile.dataExport}</p>
          <button
            type="button"
            onClick={() => exportUserData()}
            className="btn-secondary flex w-full items-center justify-center gap-2 text-sm"
          >
            <Download className="h-4 w-4" />
            {t.profile.exportData}
          </button>
          {geoConsent === 'granted' ? (
            <button
              type="button"
              onClick={revokeLocation}
              className="btn-secondary flex w-full items-center justify-center gap-2 text-sm"
            >
              <MapPinOff className="h-4 w-4" />
              {t.profile.revokeLocation}
            </button>
          ) : (
            <p className="text-xs text-bc-muted">
              {geoConsent === 'denied' ? t.profile.locationDenied : t.profile.locationPending} – {t.profile.locationHint}
            </p>
          )}
        </div>
      </section>

      {menuSections.map((section) => (
        <section key={section.titleKey} className="mt-8">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-bc-muted">
            {sectionTitles[locale][section.titleKey]}
          </p>
          <nav className="overflow-hidden rounded-2xl border border-bc-border bg-bc-elevated">
            {section.items.map(({ to, icon: Icon, labelKey }, i) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center justify-between px-4 py-3.5 transition hover:bg-bc-surface ${
                  i > 0 ? 'border-t border-bc-border' : ''
                }`}
              >
                <span className="flex items-center gap-3 text-sm">
                  <Icon className="h-5 w-5 text-bc-accent" />
                  {t.profile[labelKey]}
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
            {t.stations.favorites}
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
        {t.auth.logout}
      </button>

      <button
        type="button"
        onClick={() => {
          if (window.confirm(t.profile.deleteConfirm)) {
            deleteAccount();
            navigate('/anmelden');
          }
        }}
        className="btn-secondary mt-3 flex w-full items-center justify-center gap-2 text-sm text-bc-muted"
      >
        <Trash2 className="h-4 w-4" />
        {t.profile.deleteAccount}
      </button>

      <p className="mt-8 text-center text-xs text-bc-muted">
        {companyInfo.brand} · {t.profile.memberSince} {formatDate(user.memberSince).split(' ')[0]}
      </p>
    </div>
  );
}
