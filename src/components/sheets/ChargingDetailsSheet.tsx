import { Shield } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { ChargingEmergencyHelp } from '../ChargingEmergencyHelp';
import type { ChargingSession } from '../../types';
import { formatCurrency, formatKwh } from '../../utils/format';

export function ChargingDetailsSheet({
  open,
  onClose,
  session,
  targetKwh,
  locale = 'de',
}: {
  open: boolean;
  onClose: () => void;
  session: ChargingSession;
  targetKwh: number;
  locale?: 'de' | 'en';
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={locale === 'de' ? 'Details' : 'Details'}>
      <div className="space-y-4">
        <div className="rounded-xl border border-bc-border bg-bc-surface p-4 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-bc-muted">{locale === 'de' ? 'Ziel' : 'Target'}</span>
            <span>{formatKwh(targetKwh)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <span className="text-bc-muted">{locale === 'de' ? 'Preis' : 'Price'}</span>
            <span>{formatCurrency(session.pricePerKwh)}/kWh</span>
          </div>
          <div className="mt-2 flex justify-between gap-2">
            <span className="text-bc-muted">BC Points</span>
            <span className="text-bc-accent">+{session.pointsEarned}</span>
          </div>
          {session.rewardDiscountEur != null && session.rewardDiscountEur > 0 && (
            <div className="mt-2 flex justify-between gap-2 text-bc-accent">
              <span>{session.rewardLabel ?? (locale === 'de' ? 'Prämienrabatt' : 'Reward')}</span>
              <span>-{formatCurrency(session.rewardDiscountEur)}</span>
            </div>
          )}
          <p className="mt-3 flex items-center gap-2 border-t border-bc-border pt-3 text-xs text-bc-accent">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            {locale === 'de' ? 'Keine Blockiergebühr bei BC Charge' : 'No idle fee at BC Charge'}
          </p>
        </div>
        <ChargingEmergencyHelp session={session} />
      </div>
    </BottomSheet>
  );
}
