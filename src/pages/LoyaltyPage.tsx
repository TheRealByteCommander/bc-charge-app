import { useEffect, useState } from 'react';
import { Check, Gift, Lock, Trophy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BadgeGrid } from '../components/gamification/BadgeGrid';
import { ChallengesPanel } from '../components/gamification/ChallengesPanel';
import { LeaderboardPanel } from '../components/gamification/LeaderboardPanel';
import { StreakBanner } from '../components/gamification/StreakBanner';
import { LoyaltyCard } from '../components/LoyaltyCard';
import { loyaltyRewards } from '../data/rewards';
import { badges } from '../data/badges';
import { badgeProgressPercent } from '../services/gamification';
import { useAppStore } from '../store/appStore';
import { formatPoints } from '../utils/format';

type Tab = 'overview' | 'badges' | 'challenges' | 'leaderboard';

export function LoyaltyPage() {
  const user = useAppStore((s) => s.user);
  const redeemed = useAppStore((s) => s.redeemedRewardIds);
  const redeemReward = useAppStore((s) => s.redeemReward);
  const syncGamification = useAppStore((s) => s.syncGamification);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    syncGamification();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal beim Öffnen
  }, []);

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

  const g = user.gamification;
  const badgePct = badgeProgressPercent(g);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Übersicht' },
    { id: 'badges', label: `Abzeichen ${g.unlockedBadgeIds.length}/${badges.length}` },
    { id: 'challenges', label: 'Aufgaben' },
    { id: 'leaderboard', label: 'Bestenliste' },
  ];

  return (
    <div className="page-shell pb-8">
      <h1 className="font-display text-2xl font-bold">BC Vorteile</h1>
      <p className="mt-1 text-bc-muted">Points, Abzeichen, Aufgaben und Bestenliste.</p>

      <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${
              tab === t.id ? 'bg-bc-accent text-bc-ink' : 'bg-bc-elevated text-bc-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="mt-6">
            <LoyaltyCard user={user} />
          </div>
          <div className="mt-4">
            <StreakBanner g={g} />
          </div>
          <div className="mt-4 rounded-2xl border border-bc-border bg-bc-elevated p-4 text-center">
            <p className="text-sm text-bc-muted">Fortschritt Abzeichen</p>
            <p className="mt-1 font-display text-2xl font-bold text-bc-accent">{badgePct}%</p>
            <button type="button" className="mt-2 text-sm text-bc-accent" onClick={() => setTab('badges')}>
              Alle Abzeichen anzeigen →
            </button>
          </div>
          <div className="mt-6 rounded-2xl border border-bc-border bg-bc-elevated p-4 text-center">
            <p className="text-sm text-bc-muted">Ihre Mitgliedskarte</p>
            <p className="font-mono text-xs text-bc-accent">{user.membershipId}</p>
            <div className="mt-4 flex justify-center rounded-xl bg-white p-3">
              <QRCodeSVG value={`BCCHARGE:${user.membershipId}`} size={140} level="M" />
            </div>
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
        </>
      )}

      {tab === 'badges' && (
        <div className="mt-6">
          <StreakBanner g={g} />
          <div className="mt-4">
            <BadgeGrid g={g} />
          </div>
        </div>
      )}

      {tab === 'challenges' && (
        <div className="mt-6">
          <ChallengesPanel user={user} />
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 font-display font-semibold">
            <Trophy className="h-5 w-5 text-bc-accent" />
            Bestenliste
          </h2>
          <LeaderboardPanel user={user} />
        </div>
      )}
    </div>
  );
}
