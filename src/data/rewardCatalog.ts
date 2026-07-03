/** Prämien-Katalog mit Fulfillment-Typen (spiegelt server/services/rewardCatalog.mjs). */
export const rewardCatalog = {
  'rw-free-kwh': {
    id: 'rw-free-kwh',
    pointsCost: 400,
    fulfillmentType: 'free_kwh' as const,
    payload: { freeKwh: 5 },
    consumable: true,
    validityDays: 90,
  },
  'rw-kwh-bonus': {
    id: 'rw-kwh-bonus',
    pointsCost: 750,
    fulfillmentType: 'energy_discount' as const,
    payload: { discountPercent: 5 },
    consumable: true,
    validityDays: 90,
  },
  'rw-coffee': {
    id: 'rw-coffee',
    pointsCost: 300,
    fulfillmentType: 'voucher' as const,
    payload: {
      voucherPrefix: 'BCCF',
      partnerName: 'Café Machern',
      partnerAddress: 'Grüner Weg 3, 04827 Machern',
      instructionsDe:
        'Zeigen Sie diesen Gutscheincode an der Kasse. Gilt für einen Kaffee (Espresso, Cappuccino oder Filterkaffee).',
      instructionsEn:
        'Show this voucher code at the counter. Valid for one coffee (espresso, cappuccino or filter coffee).',
    },
    consumable: true,
    validityDays: 90,
  },
  'rw-night': {
    id: 'rw-night',
    pointsCost: 600,
    fulfillmentType: 'night_points' as const,
    payload: { pointsMultiplier: 2, nightStartHour: 22, nightEndHour: 6 },
    consumable: false,
    validityDays: 30,
  },
} as const;

export type RewardCatalogId = keyof typeof rewardCatalog;

export function getRewardDefinition(rewardId: string) {
  return rewardCatalog[rewardId as RewardCatalogId] ?? null;
}
