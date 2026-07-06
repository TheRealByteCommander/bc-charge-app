import { Download, MapPinOff } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { useLocale } from '../../i18n/LocaleContext';

export function ProfileDataSheet({
  open,
  onClose,
  onExport,
  onRevokeLocation,
  geoConsent,
}: {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  onRevokeLocation: () => void;
  geoConsent: string | null;
}) {
  const { t } = useLocale();

  return (
    <BottomSheet open={open} onClose={onClose} title={t.profile.yourData}>
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-bc-muted">{t.profile.language}</p>
          <LanguageSwitcher />
        </div>
        <div>
          <p className="mb-2 text-sm text-bc-muted">{t.profile.dataExport}</p>
          <button
            type="button"
            onClick={onExport}
            className="btn-secondary flex w-full items-center justify-center gap-2 text-sm"
          >
            <Download className="h-4 w-4" />
            {t.profile.exportData}
          </button>
        </div>
        <div>
          {geoConsent === 'granted' ? (
            <button
              type="button"
              onClick={onRevokeLocation}
              className="btn-secondary flex w-full items-center justify-center gap-2 text-sm"
            >
              <MapPinOff className="h-4 w-4" />
              {t.profile.revokeLocation}
            </button>
          ) : (
            <p className="text-sm text-bc-muted">
              {geoConsent === 'denied' ? t.profile.locationDenied : t.profile.locationPending} –{' '}
              {t.profile.locationHint}
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
