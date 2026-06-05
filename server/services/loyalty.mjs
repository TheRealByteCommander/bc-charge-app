const tierThresholds = {
  bronze: { min: 0, multiplier: 1 },
  silver: { min: 1500, multiplier: 1.15 },
  gold: { min: 4000, multiplier: 1.3 },
  platinum: { min: 8000, multiplier: 1.5 },
};

export function computeTier(points) {
  if (points >= tierThresholds.platinum.min) return 'platinum';
  if (points >= tierThresholds.gold.min) return 'gold';
  if (points >= tierThresholds.silver.min) return 'silver';
  return 'bronze';
}

export function calcPoints(energyKwh, tier) {
  const mult = tierThresholds[tier]?.multiplier ?? 1;
  return Math.round(energyKwh * 1.2 * mult);
}

export function applySessionStats(profile, session) {
  const points = calcPoints(session.energyKwh, profile.loyaltyTier);
  const loyaltyPoints = profile.loyaltyPoints + points;
  return {
    ...profile,
    loyaltyPoints,
    loyaltyTier: computeTier(loyaltyPoints),
    totalKwh: Math.round((profile.totalKwh + session.energyKwh) * 10) / 10,
    totalSessions: profile.totalSessions + 1,
    co2SavedKg: Math.round((profile.co2SavedKg + session.energyKwh * 0.65) * 10) / 10,
  };
}
