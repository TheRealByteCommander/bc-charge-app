import { Check, Copy, Gift, Zap } from 'lucide-react';
import { useState } from 'react';
import { findRewardById } from '../data/rewards';
import { useLocale } from '../i18n/LocaleContext';
import type { RewardFulfillment } from '../types';
import { formatDate } from '../utils/format';
import { isFulfillmentActive } from '../services/rewardFulfillment';

function FulfillmentCard({
  fulfillment,
  locale,
}: {
  fulfillment: RewardFulfillment;
  locale: 'de' | 'en';
}) {
  const [copied, setCopied] = useState(false);
  const reward = findRewardById(fulfillment.rewardId);
  const title =
    locale === 'de' ? reward?.title ?? fulfillment.rewardId : reward?.titleEn ?? reward?.title ?? fulfillment.rewardId;
  const active = isFulfillmentActive(fulfillment);
  const voucherCode = fulfillment.payload.voucherCode as string | undefined;
  const instructions =
    locale === 'de'
      ? (fulfillment.payload.instructionsDe as string | undefined)
      : (fulfillment.payload.instructionsEn as string | undefined);

  const copyCode = async () => {
    if (!voucherCode) return;
    try {
      await navigator.clipboard.writeText(voucherCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  };

  return (
    <div
      className={`rounded-2xl border p-4 ${
        active ? 'border-bc-accent/30 bg-bc-accent/5' : 'border-bc-border bg-bc-elevated opacity-80'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bc-accent/15 text-bc-accent">
            {fulfillment.type === 'voucher' ? (
              <Gift className="h-4 w-4" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
          </span>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-0.5 text-xs text-bc-muted">
              {active
                ? locale === 'de'
                  ? 'Aktiv'
                  : 'Active'
                : fulfillment.status === 'used'
                  ? locale === 'de'
                    ? 'Verwendet'
                    : 'Used'
                  : locale === 'de'
                    ? 'Abgelaufen'
                    : 'Expired'}
              {fulfillment.expiresAt && ` · ${locale === 'de' ? 'bis' : 'until'} ${formatDate(fulfillment.expiresAt)}`}
            </p>
          </div>
        </div>
        {active && fulfillment.type !== 'voucher' && (
          <span className="shrink-0 rounded-full bg-bc-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-bc-accent">
            {locale === 'de' ? 'Bereit' : 'Ready'}
          </span>
        )}
      </div>

      {voucherCode && (
        <div className="mt-3 rounded-xl border border-bc-border bg-bc-surface p-3">
          <p className="text-xs text-bc-muted">{locale === 'de' ? 'Gutscheincode' : 'Voucher code'}</p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wider text-bc-accent">{voucherCode}</p>
          {(fulfillment.payload.partnerName as string) && (
            <p className="mt-2 text-sm font-medium">{String(fulfillment.payload.partnerName)}</p>
          )}
          {(fulfillment.payload.partnerAddress as string) && (
            <p className="text-xs text-bc-muted">{String(fulfillment.payload.partnerAddress)}</p>
          )}
          {instructions && <p className="mt-2 text-sm text-bc-muted">{instructions}</p>}
          {active && (
            <button
              type="button"
              onClick={() => void copyCode()}
              className="btn-secondary mt-3 flex w-full items-center justify-center gap-2 text-sm"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied
                ? locale === 'de'
                  ? 'Kopiert!'
                  : 'Copied!'
                : locale === 'de'
                  ? 'Code kopieren'
                  : 'Copy code'}
            </button>
          )}
        </div>
      )}

      {fulfillment.type === 'free_kwh' && active && (
        <p className="mt-3 text-sm text-bc-muted">
          {locale === 'de'
            ? `${fulfillment.payload.freeKwh} kWh werden bei Ihrer nächsten Ladung abgezogen.`
            : `${fulfillment.payload.freeKwh} kWh will be deducted on your next charge.`}
        </p>
      )}

      {fulfillment.type === 'energy_discount' && active && (
        <p className="mt-3 text-sm text-bc-muted">
          {locale === 'de'
            ? `${fulfillment.payload.discountPercent} % Rabatt auf die Energiekosten bei der nächsten Ladung.`
            : `${fulfillment.payload.discountPercent}% off energy costs on your next charge.`}
        </p>
      )}

      {fulfillment.type === 'night_points' && active && (
        <p className="mt-3 text-sm text-bc-muted">
          {locale === 'de'
            ? 'Doppelte BC Points bei Ladungen zwischen 22:00 und 06:00 Uhr.'
            : 'Double BC Points for charges between 10 PM and 6 AM.'}
        </p>
      )}

      {fulfillment.type === 'priority_support' && active && (
        <p className="mt-3 text-sm text-bc-muted">
          {locale === 'de'
            ? 'Priority Support aktiv – verkürzte Wartezeit bei der Hotline.'
            : 'Priority support active – reduced hotline wait time.'}
        </p>
      )}
    </div>
  );
}

export function RewardFulfillmentPanel({ fulfillments }: { fulfillments: RewardFulfillment[] }) {
  const { locale } = useLocale();
  if (!fulfillments.length) return null;

  const sorted = [...fulfillments].sort(
    (a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime()
  );

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Gift className="h-5 w-5 text-bc-accent" />
        {locale === 'de' ? 'Meine Prämien' : 'My rewards'}
      </h2>
      <p className="mt-1 text-sm text-bc-muted">
        {locale === 'de'
          ? 'Gutscheincodes und aktive Ladeprämien.'
          : 'Voucher codes and active charging perks.'}
      </p>
      <div className="mt-3 space-y-3">
        {sorted.map((f) => (
          <FulfillmentCard key={f.id} fulfillment={f} locale={locale} />
        ))}
      </div>
    </section>
  );
}

export function ActiveChargingPerkSelect({
  fulfillments,
  selectedId,
  onChange,
}: {
  fulfillments: RewardFulfillment[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
}) {
  const { locale } = useLocale();
  const active = fulfillments.filter((f) => isFulfillmentActive(f));

  if (!active.length) return null;

  return (
    <div className="rounded-xl border border-bc-accent/25 bg-bc-accent/5 p-3 text-sm">
      <p className="font-medium text-bc-text">
        {locale === 'de' ? 'Ladeprämie einlösen' : 'Apply charging perk'}
      </p>
      <p className="mt-1 text-xs text-bc-muted">
        {locale === 'de'
          ? 'Optional: eine aktive Prämie für diese Sitzung verwenden.'
          : 'Optional: use one active perk for this session.'}
      </p>
      <div className="mt-3 space-y-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="charging-perk"
            checked={!selectedId}
            onChange={() => onChange(null)}
            className="accent-bc-accent"
          />
          <span className="text-bc-muted">{locale === 'de' ? 'Keine Prämie' : 'No perk'}</span>
        </label>
        {active.map((f) => {
          const reward = findRewardById(f.rewardId);
          const label = locale === 'de' ? reward?.title : reward?.titleEn ?? reward?.title;
          return (
            <label key={f.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="charging-perk"
                checked={selectedId === f.id}
                onChange={() => onChange(f.id)}
                className="accent-bc-accent"
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
