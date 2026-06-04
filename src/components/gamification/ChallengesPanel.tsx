import { Target } from 'lucide-react';
import { weeklyChallenges } from '../../data/challenges';
import { useLocale } from '../../i18n/LocaleContext';
import { getChallengeProgress, isChallengeComplete } from '../../services/gamification';
import { useAppStore } from '../../store/appStore';
import type { UserProfile } from '../../types';

export function ChallengesPanel({ user }: { user: UserProfile }) {
  const { locale } = useLocale();
  const claimWeeklyChallenge = useAppStore((s) => s.claimWeeklyChallenge);
  const g = user.gamification;

  return (
    <div className="space-y-3">
      <p className="text-xs text-bc-muted">
        {locale === 'de'
          ? 'Wöchentliche Ziele · Belohnung in BC Points'
          : 'Weekly goals · Rewards in BC Points'}
      </p>
      {weeklyChallenges.map((ch) => {
        const progress = getChallengeProgress(ch, g);
        const done = g.completedChallengeIds.includes(ch.id);
        const ready = !done && isChallengeComplete(ch, g);
        const pct = Math.min(100, Math.round((progress / ch.target) * 100));

        return (
          <div key={ch.id} className="rounded-2xl border border-bc-border bg-bc-elevated p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1 font-semibold">
                  <Target className="h-4 w-4 text-bc-accent" />
                  {locale === 'de' ? ch.titleDe : ch.titleEn}
                </p>
                <p className="mt-1 text-xs text-bc-muted">
                  {locale === 'de' ? ch.descDe : ch.descEn}
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold text-bc-accent">+{ch.rewardPoints} P</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bc-border">
              <div className="h-full rounded-full bg-accent-gradient transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-bc-muted">
              {progress} / {ch.target}
            </p>
            {ready && (
              <button
                type="button"
                className="btn-primary mt-3 w-full py-2 text-sm"
                onClick={() => claimWeeklyChallenge(ch.id)}
              >
                {locale === 'de' ? 'Belohnung abholen' : 'Claim reward'}
              </button>
            )}
            {done && (
              <p className="mt-2 text-xs font-medium text-bc-accent">
                {locale === 'de' ? 'Abgeschlossen' : 'Completed'}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
