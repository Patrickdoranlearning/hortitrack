// Central place for toggling incremental features
export const features = {
  aiCare: false, // kill-switch: hide AI Care entirely
} as const;

export type FeatureKey = keyof typeof features;
export const isEnabled = (k: FeatureKey) => !!features[k];
