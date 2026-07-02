import { Trophy, Users } from 'lucide-react';
import { buildLeaderboard } from '../../services/gamification';
import { tierThresholds } from '../../data/rewards';
import type { UserProfile } from '../../types';
import { formatPoints } from '../../utils/format';
import { useLocale } from '../../i18n/LocaleContext';

export function LeaderboardPanel({ user }: { user: UserProfile }) {
  const { locale } = useLocale();
  const board = buildLeaderboard(user).slice(0, 12);
  const yourEntry = board.find((e) => e.isCurrentUser);

  return (
    <div>
      {yourEntry && (
        <div className="mb-4 rounded-xl border border-bc-accent/30 bg-bc-accent/10 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="h-5 w-5 text-bc-accent" />
            {locale === 'de' ? 'Ihre Statistik' : 'Your Stats'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-bc-elevated p-3 text-center">
              <p className="text-2xl font-bold text-bc-accent">{formatPoints(yourEntry.points)}</p>
              <p className="text-xs text-bc-muted">BC Points</p>
            </div>
            <div className="rounded-lg bg-bc-elevated p-3 text-center">
              <p className="text-2xl font-bold text-bc-accent">{tierThresholds[user.loyaltyTier].label}</p>
              <p className="text-xs text-bc-muted">{locale === 'de' ? 'Stufe' : 'Tier'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-bc-border bg-bc-elevated p-4 text-center">
        <Users className="mx-auto h-10 w-10 text-bc-muted" />
        <p className="mt-3 font-medium">
          {locale === 'de' ? 'Bestenliste kommt bald!' : 'Leaderboard coming soon!'}
        </p>
        <p className="mt-1 text-sm text-bc-muted">
          {locale === 'de'
            ? 'Sobald mehr Nutzer aktiv sind, wird hier die Community-Rangliste angezeigt.'
            : 'Once more users are active, the community rankings will be displayed here.'}
        </p>
      </div>
    </div>
  );
}
