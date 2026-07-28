import { getLoyaltyConfig } from './configService.mjs';

export async function computeTier(points) {
  const config = await getLoyaltyConfig();
  const { tierThresholds } = config;
  
  if (points >= tierThresholds.platinum.min) return 'platinum';
  if (points >= tierThresholds.gold.min) return 'gold';
  if (points >= tierThresholds.silver.min) return 'silver';
  return 'bronze';
}

export async function calcPoints(energyKwh, tier) {
  const config = await getLoyaltyConfig();
  const { pointsPerKwh, tierThresholds } = config;
  const mult = tierThresholds[tier]?.multiplier ?? 1;
  return Math.round(energyKwh * pointsPerKwh * mult);
}

export async function applySessionStats(profile, session, { nightPointsMultiplier = 1 } = {}) {
  const config = await getLoyaltyConfig();
  const { pointsPerSession } = config;
  
  const pointsFromKwh = await calcPoints(session.energyKwh, profile.loyaltyTier);
  const totalPoints = Math.round((pointsFromKwh + pointsPerSession) * nightPointsMultiplier);
  
  const loyaltyPoints = profile.loyaltyPoints + totalPoints;
  const loyaltyTier = await computeTier(loyaltyPoints);
  
  return {
    ...profile,
    loyaltyPoints,
    loyaltyTier,
    totalKwh: Math.round((profile.totalKwh + session.energyKwh) * 10) / 10,
    totalSessions: profile.totalSessions + 1,
    co2SavedKg: Math.round((profile.co2SavedKg + session.energyKwh * 0.65) * 10) / 10,
  };
}
