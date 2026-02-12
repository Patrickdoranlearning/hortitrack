// Central place for toggling incremental features
export const features = {
  aiCare: true, // kill-switch: hide AI Care entirely
  materials: false, // deferred to v2 — pots, trays, soil inventory
} as const;

export type FeatureKey = keyof typeof features;
export const isEnabled = (k: FeatureKey) => !!features[k];
