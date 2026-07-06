import { HelpCircle, Map, Route, Sparkles, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BottomSheet } from '../BottomSheet';
import { ChargingPlannerCard } from '../ChargingPlannerCard';
import { LoyaltyCard } from '../LoyaltyCard';
import { MenuRow, MenuSection } from '../ui/MenuList';
import type { UserProfile } from '../../types';

export function HomeMoreSheet({
  open,
  onClose,
  user,
  showPlanner,
}: {
  open: boolean;
  onClose: () => void;
  user: UserProfile;
  showPlanner: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Mehr">
      <div className="space-y-2">
        {showPlanner && (
          <div className="mb-4">
            <ChargingPlannerCard />
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Geladen', value: `${user.totalKwh.toFixed(0)} kWh` },
            { label: 'CO₂', value: `${user.co2SavedKg} kg` },
            { label: 'Sessions', value: String(user.totalSessions) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-bc-border bg-bc-surface p-3 text-center">
              <p className="font-display text-sm font-bold">{stat.value}</p>
              <p className="text-[10px] text-bc-muted">{stat.label}</p>
            </div>
          ))}
        </div>

        <MenuSection>
          <MenuRow to="/karte" icon={Map} label="Karte" />
          <MenuRow to="/vorteile" icon={Sparkles} label="Vorteile & Punkte" />
          <MenuRow to="/reise" icon={Route} label="Reise planen" />
          <MenuRow to="/hilfe" icon={HelpCircle} label="Hilfe" />
        </MenuSection>

        <div className="mt-4">
          <LoyaltyCard user={user} />
        </div>

        <Link to="/scan" className="btn-primary mt-4 flex w-full items-center justify-center gap-2" onClick={onClose}>
          <Zap className="h-4 w-4" />
          Ladepunkt-ID eingeben
        </Link>
      </div>
    </BottomSheet>
  );
}
