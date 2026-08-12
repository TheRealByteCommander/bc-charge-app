// Dynamic pricing logic for EV charging


export type PricingFactor = {
  id: string;
  name: string;
  multiplier: number;
  description: string;
};

export type DynamicPricingConfig = {
  basePrice: number;
  timeBasedFactors: {
    startHour: number;
    endHour: number;
    factor: number;
  }[];
  demandMultiplier: number;
};

/**
 * Calculates the current dynamic price based on the time of day and demand.
 */
export function calculateDynamicPrice(
  basePrice: number,
  demandMultiplier: number = 1.0,
  timeFactors: { startHour: number; endHour: number; factor: number }[] = []
): number {
  const now = new Date();
  const hour = now.getHours();

  let timeFactor = 1.0;
  for (const f of timeFactors) {
    if (hour >= f.startHour && hour < f.endHour) {
      timeFactor = f.factor;
      break;
    }
  }

  return Math.round((basePrice * timeFactor * demandMultiplier) * 100) / 100;
}

/**
 * Generates a projection of the price over the next 24 hours.
 */
export function getPriceProjection(
  basePrice: number,
  timeFactors: { startHour: number; endHour: number; factor: number }[] = []
): { hour: number; price: number }[] {
  return Array.from({ length: 24 }, (_, hour) => {
    let factor = 1.0;
    for (const f of timeFactors) {
      if (hour >= f.startHour && hour < f.endHour) {
        factor = f.factor;
        break;
      }
    }
    return { hour, price: Math.round((basePrice * factor) * 100) / 100 };
  });
}
