import { Trophy } from 'lucide-react';
import { buildLeaderboard } from '../../services/gamification';
import { tierThresholds } from '../../data/rewards';
import type { UserProfile } from '../../types';
import { formatPoints } from '../../utils/format';

export function LeaderboardPanel({ user }: { user: UserProfile }) {
  const board = buildLeaderboard(user).slice(0, 12);
  const yourRank = board.find((e) => e.isCurrentUser)?.rank;

  return (
    <div>
      {yourRank != null && (
        <p className="mb-3 rounded-xl border border-bc-accent/30 bg-bc-accent/10 px-3 py-2 text-sm">
          <Trophy className="mr-1 inline h-4 w-4 text-bc-accent" />
          Ihr Rang: <span className="font-bold text-bc-accent">#{yourRank}</span>
        </p>
      )}
      <ol className="space-y-2">
        {board.map((entry) => (
          <li
            key={`${entry.rank}-${entry.displayName}`}
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
              entry.isCurrentUser
                ? 'border border-bc-accent/40 bg-bc-accent/10 font-medium'
                : 'bg-bc-elevated'
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                  entry.rank <= 3 ? 'bg-bc-accent/25 text-bc-accent' : 'bg-bc-surface text-bc-muted'
                }`}
              >
                {entry.rank}
              </span>
              {entry.displayName}
            </span>
            <span className="text-bc-muted">
              {formatPoints(entry.points)} P ·{' '}
              {entry.isCurrentUser ? tierThresholds[user.loyaltyTier].label : entry.tier}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
