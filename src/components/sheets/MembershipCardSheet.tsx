import { QRCodeSVG } from 'qrcode.react';
import { BottomSheet } from '../BottomSheet';
import { useLocale } from '../../i18n/LocaleContext';
import type { UserProfile } from '../../types';

export function MembershipCardSheet({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: UserProfile;
}) {
  const { t } = useLocale();

  return (
    <BottomSheet open={open} onClose={onClose} title={t.gamification.memberCard}>
      <div className="space-y-4 text-center">
        <p className="text-sm text-bc-muted">{t.gamification.memberCardHint}</p>
        <p className="font-mono text-lg font-semibold tracking-wide text-bc-accent">{user.membershipId}</p>
        <div className="mx-auto flex max-w-[200px] justify-center rounded-2xl bg-white p-4">
          <QRCodeSVG value={`BCCHARGE:${user.membershipId}`} size={160} level="M" />
        </div>
        <p className="text-xs text-bc-muted">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-bc-muted">{t.gamification.memberCardScanHint}</p>
      </div>
    </BottomSheet>
  );
}
