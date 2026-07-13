import {
  Accessibility,
  Bell,
  Car,
  CreditCard,
  FileText,
  HelpCircle,
  History,
  LogOut,
  MapPin,
  Receipt,
  Scale,
  Settings,
  Shield,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProfileDataSheet } from '../components/sheets/ProfileDataSheet';
import { MenuRow, MenuSection } from '../components/ui/MenuList';
import { getStations } from '../data/stations';
import { useLocale } from '../i18n/LocaleContext';
import { useAppStore } from '../store/appStore';
import { formatDate, formatPoints } from '../utils/format';
import { companyInfo } from '../data/company';
import { tierThresholds } from '../data/rewards';
import { getGeoConsent, revokeGeoConsent } from '../utils/geoConsent';

export function ProfilePage() {
  const { t, locale } = useLocale();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const deleteAccount = useAppStore((s) => s.deleteAccount);
  const exportUserData = useAppStore((s) => s.exportUserData);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const navigate = useNavigate();
  const [dataOpen, setDataOpen] = useState(false);
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
      <h1 className="font-display text-2xl font-bold tracking-tight">{t.profile.title}</h1>

      <div className="mt-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-gradient font-display text-2xl font-bold text-bc-ink">
          {user.firstName[0]}
          {user.lastName[0]}
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-sm text-bc-muted">{user.email}</p>
          <p className="text-sm text-bc-accent">
            {tier.label} · {formatPoints(user.loyaltyPoints)} P
          </p>
        </div>
      </div>

      <MenuSection title={locale === 'de' ? 'Laden' : 'Charging'}>
        <MenuRow to="/fahrzeuge" icon={Car} label={t.profile.vehicles} detail={`${user.vehicles.length}`} />
        <MenuRow to="/zahlung" icon={CreditCard} label={t.profile.payment} detail={`${user.paymentMethods.length}`} />
        <MenuRow to="/historie" icon={History} label={t.profile.history} />
      </MenuSection>

      <MenuSection title={locale === 'de' ? 'Konto' : 'Account'}>
        <MenuRow
          icon={Settings}
          label={t.profile.yourData}
          detail={locale === 'de' ? 'Sprache, Export, Standort' : 'Language, export, location'}
          onClick={() => setDataOpen(true)}
        />
        {favorites.length > 0 && (
          <MenuRow
            to="/stationen"
            icon={MapPin}
            label={t.stations.favorites}
            detail={`${favorites.length}`}
          />
        )}
        <MenuRow to="/barrierefreiheit" icon={Accessibility} label={t.profile.accessibility} />
        <MenuRow to="/benachrichtigungen" icon={Bell} label={t.profile.notifications} />
        <MenuRow to="/tarife" icon={Receipt} label={t.profile.tariffs} />
      </MenuSection>

      <MenuSection title={locale === 'de' ? 'Rechtliches' : 'Legal'}>
        <MenuRow to="/datenschutz" icon={Shield} label={t.profile.privacy} />
        <MenuRow to="/impressum" icon={FileText} label={t.profile.imprint} />
        <MenuRow to="/nutzungsbedingungen" icon={Scale} label={t.profile.terms} />
        <MenuRow to="/hilfe" icon={HelpCircle} label={t.profile.support} />
      </MenuSection>

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

      <ProfileDataSheet
        open={dataOpen}
        onClose={() => setDataOpen(false)}
        onExport={() => exportUserData()}
        onRevokeLocation={revokeLocation}
        geoConsent={geoConsent}
      />
    </div>
  );
}
