import { Flame } from 'lucide-react';
import type { GamificationState } from '../../types/gamification';

export function StreakBanner({ g }: { g: GamificationState }) {
  if (g.currentStreakDays < 1) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
      <Flame className={`h-8 w-8 shrink-0 text-orange-400 ${g.currentStreakDays >= 3 ? 'animate-pulse' : ''}`} />
      <div>
        <p className="font-display font-semibold text-bc-text">
          {g.currentStreakDays} Tage Ladestreak
        </p>
        <p className="text-xs text-bc-muted">
          Rekord: {g.longestStreakDays} Tage · Täglich laden hält den Streak
        </p>
      </div>
    </div>
  );
}
