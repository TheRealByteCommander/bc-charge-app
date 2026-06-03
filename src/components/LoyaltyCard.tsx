import { ChevronRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { nextTierInfo, tierThresholds } from '../data/rewards';
import type { UserProfile } from '../types';
import { formatPoints } from '../utils/format';

const tierColors: Record<string, string> = {
  bronze: 'from-amber-700/40 to-bc-elevated',
  silver: 'from-slate-400/30 to-bc-elevated',
  gold: 'from-yellow-500/30 to-bc-elevated',
  platinum: 'from-bc-accent/30 to-bc-elevated',
};

export function LoyaltyCard({ user }: { user: UserProfile }) {
  const tier = tierThresholds[user.loyaltyTier];
  const { next, remaining } = nextTierInfo(user.loyaltyTier, user.loyaltyPoints);
  const progress = next
    ? ((user.loyaltyPoints - tier.minPoints) / (tierThresholds[next].minPoints - tier.minPoints)) * 100
    : 100;

  return (
    <Link
      to="/vorteile"
      className={`block overflow-hidden rounded-2xl border border-bc-accent/25 bg-gradient-to-br ${tierColors[user.loyaltyTier]} shadow-glow`}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-bc-accent" />
            <span className="font-display text-sm font-semibold uppercase tracking-wider text-bc-accent">
              BC Points · {tier.label}
            </span>
          </div>
          <ChevronRight className="h-5 w-5 text-bc-muted" />
        </div>
        <p className="mt-2 font-display text-3xl font-bold text-bc-text">{formatPoints(user.loyaltyPoints)}</p>
        {next ? (
          <div className="mt-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-bc-border">
              <div
                className="h-full rounded-full bg-accent-gradient transition-all"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-bc-muted">
              Noch {formatPoints(remaining)} Points bis {tierThresholds[next].label}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-xs text-bc-muted">Höchste Stufe erreicht</p>
        )}
      </div>
    </Link>
  );
}
