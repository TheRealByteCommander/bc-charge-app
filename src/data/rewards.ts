import type { LoyaltyReward, LoyaltyTier } from '../types';

export const loyaltyRewards: LoyaltyReward[] = [
  {
    id: 'rw-free-fee',
    title: 'Gratis Startgebühr',
    titleEn: 'Free Session Fee',
    description: 'Einmalig keine Session-Gebühr bei Ihrer nächsten Ladung ab 20 kWh.',
    descriptionEn: 'No session fee on your next charge of 20+ kWh.',
    pointsCost: 400,
    category: 'charging',
    available: true,
  },
  {
    id: 'rw-kwh-bonus',
    title: '5 % Rabatt auf Energie',
    titleEn: '5% Energy Discount',
    description: 'Gilt für eine vollständige Ladesitzung an BC-Charge-Standorten.',
    descriptionEn: 'Valid for one complete charging session at BC Charge locations.',
    pointsCost: 750,
    category: 'charging',
    available: true,
  },
  {
    id: 'rw-coffee',
    title: 'Kaffee-Gutschein Partner',
    titleEn: 'Coffee Voucher Partner',
    description: 'Gültig bei ausgewählten Café-Partnern in Machern und am Leipziger Hauptbahnhof.',
    descriptionEn: 'Valid at selected café partners in Machern and Leipzig Main Station.',
    pointsCost: 300,
    category: 'partner',
    available: true,
  },
  {
    id: 'rw-priority',
    title: 'Priority Support',
    titleEn: 'Priority Support',
    description: 'Direkte Hotline mit verkürzter Wartezeit für 30 Tage.',
    descriptionEn: 'Direct hotline with reduced wait time for 30 days.',
    pointsCost: 500,
    category: 'exclusive',
    available: true,
  },
  {
    id: 'rw-night',
    title: 'Nachtladen Bonus',
    titleEn: 'Night Charging Bonus',
    description: 'Doppelte BC Points bei Ladungen zwischen 22:00 und 06:00 Uhr.',
    descriptionEn: 'Double BC Points for charges between 10 PM and 6 AM.',
    pointsCost: 600,
    category: 'charging',
    available: true,
  },
  {
    id: 'rw-platinum',
    title: 'Exklusives BC Charge Hoodie',
    titleEn: 'Exclusive BC Charge Hoodie',
    description: 'Premium Merchandise – Versand innerhalb Deutschlands.',
    descriptionEn: 'Premium merchandise – shipping within Germany.',
    pointsCost: 2500,
    category: 'exclusive',
    available: true,
  },
];

export const tierThresholds: Record<LoyaltyTier, { minPoints: number; label: string; multiplier: number }> = {
  bronze: { minPoints: 0, label: 'Bronze', multiplier: 1 },
  silver: { minPoints: 1500, label: 'Silber', multiplier: 1.25 },
  gold: { minPoints: 4000, label: 'Gold', multiplier: 1.5 },
  platinum: { minPoints: 8000, label: 'Platin', multiplier: 2 },
};

export function computeTier(points: number): LoyaltyTier {
  if (points >= tierThresholds.platinum.minPoints) return 'platinum';
  if (points >= tierThresholds.gold.minPoints) return 'gold';
  if (points >= tierThresholds.silver.minPoints) return 'silver';
  return 'bronze';
}

export function nextTierInfo(tier: LoyaltyTier, points: number): { next: LoyaltyTier | null; remaining: number } {
  const order: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum'];
  const idx = order.indexOf(tier);
  if (idx >= order.length - 1) return { next: null, remaining: 0 };
  const next = order[idx + 1];
  return { next, remaining: Math.max(0, tierThresholds[next].minPoints - points) };
}
