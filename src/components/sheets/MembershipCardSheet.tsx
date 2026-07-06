import { QRCodeSVG } from 'qrcode.react';
import { BottomSheet } from '../BottomSheet';
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
  return (
    <BottomSheet open={open} onClose={onClose} title="Mitgliedskarte">
      <div className="space-y-4 text-center">
        <p className="text-sm text-bc-muted">Zeigen Sie diesen Code an der Ladestation.</p>
        <p className="font-mono text-sm text-bc-accent">{user.membershipId}</p>
        <div className="mx-auto flex max-w-[200px] justify-center rounded-2xl bg-white p-4">
          <QRCodeSVG value={`BCCHARGE:${user.membershipId}`} size={160} level="M" />
        </div>
        <p className="text-xs text-bc-muted">
          {user.firstName} {user.lastName}
        </p>
      </div>
    </BottomSheet>
  );
}
