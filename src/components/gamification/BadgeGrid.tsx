import { Lock } from 'lucide-react';
import { badges } from '../../data/badges';
import { useLocale } from '../../i18n/LocaleContext';
import type { GamificationState } from '../../types/gamification';

const rarityBorder: Record<string, string> = {
  common: 'border-bc-border',
  rare: 'border-bc-blue/40',
  epic: 'border-violet-500/40',
  legendary: 'border-bc-accent/50',
};

export function BadgeGrid({ g }: { g: GamificationState }) {
  const { locale } = useLocale();

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {badges.map((badge) => {
        const unlocked = g.unlockedBadgeIds.includes(badge.id);
        return (
          <div
            key={badge.id}
            title={locale === 'de' ? badge.descDe : badge.descEn}
            className={`flex flex-col items-center rounded-xl border p-3 text-center transition ${
              unlocked ? `bg-bc-accent/10 ${rarityBorder[badge.rarity]}` : 'border-bc-border bg-bc-surface opacity-55'
            }`}
          >
            {unlocked ? (
              <span className="text-2xl">{badge.icon}</span>
            ) : (
              <Lock className="h-6 w-6 text-bc-muted" />
            )}
            <p className="mt-1 text-[10px] font-medium leading-tight text-bc-text">
              {locale === 'de' ? badge.titleDe : badge.titleEn}
            </p>
            {unlocked && (
              <p className="mt-0.5 text-[9px] text-bc-accent">+{badge.bonusPoints} P</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
