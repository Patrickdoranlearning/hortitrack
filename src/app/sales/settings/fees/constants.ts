// Standard fee types for easy setup
export const STANDARD_FEE_TYPES = {
  PRE_PRICING: 'pre_pricing',
  DELIVERY_FLAT: 'delivery_flat',
  DELIVERY_PER_KM: 'delivery_per_km',
  HANDLING: 'handling',
  RUSH_ORDER: 'rush_order',
} as const;

export type StandardFeeType = typeof STANDARD_FEE_TYPES[keyof typeof STANDARD_FEE_TYPES];

