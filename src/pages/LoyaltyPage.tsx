import { Check, Gift, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { LoyaltyCard } from '../components/LoyaltyCard';
import { loyaltyRewards } from '../data/rewards';
import { useAppStore } from '../store/appStore';
import { formatPoints } from '../utils/format';

export function LoyaltyPage() {
  const user = useAppStore((s) => s.user);
  const redeemed = useAppStore((s) => s.redeemedRewardIds);
  const redeemReward = useAppStore((s) => s.redeemReward);

  if (!user) {
    return (
      <div className="page-shell text-center">
        <p className="text-bc-muted">Melden Sie sich an für BC Points und Prämien.</p>
        <a href="/anmelden" className="btn-primary mt-6 inline-block">
          Anmelden
        </a>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <h1 className="font-display text-2xl font-bold">BC Vorteile</h1>
      <p className="mt-1 text-bc-muted">Sammeln, einlösen, Stammkunde werden.</p>
      <div className="mt-6">
        <LoyaltyCard user={user} />
      </div>

      <div className="mt-6 rounded-2xl border border-bc-border bg-bc-elevated p-4 text-center">
        <p className="text-sm text-bc-muted">Ihre Mitgliedskarte</p>
        <p className="font-mono text-xs text-bc-accent">{user.membershipId}</p>
        <div className="mt-4 flex justify-center rounded-xl bg-white p-3">
          <QRCodeSVG value={`BCCHARGE:${user.membershipId}`} size={140} level="M" />
        </div>
        <p className="mt-3 text-xs text-bc-muted">Am Ladepunkt vorzeigen für Bonus-Points</p>
      </div>

      <h2 className="mt-8 flex items-center gap-2 font-display text-lg font-semibold">
        <Gift className="h-5 w-5 text-bc-accent" />
        Prämien einlösen
      </h2>
      <div className="mt-3 space-y-3">
        {loyaltyRewards.map((reward) => {
          const done = redeemed.includes(reward.id);
          const canAfford = user.loyaltyPoints >= reward.pointsCost;
          return (
            <div key={reward.id} className="rounded-2xl border border-bc-border bg-bc-elevated p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{reward.title}</h3>
                  <p className="mt-1 text-sm text-bc-muted">{reward.description}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-bc-accent/15 px-2 py-1 text-xs font-bold text-bc-accent">
                  {formatPoints(reward.pointsCost)} P
                </span>
              </div>
              <button
                type="button"
                disabled={done || !canAfford}
                onClick={() => redeemReward(reward.id, reward.pointsCost)}
                className="btn-secondary mt-3 w-full text-sm disabled:opacity-40"
              >
                {done ? (
                  <>
                    <Check className="h-4 w-4 text-bc-accent" />
                    Eingelöst
                  </>
                ) : !canAfford ? (
                  <>
                    <Lock className="h-4 w-4" />
                    Zu wenig Points
                  </>
                ) : (
                  'Jetzt einlösen'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
