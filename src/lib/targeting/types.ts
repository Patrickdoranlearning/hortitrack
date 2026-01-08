/**
 * Smart Sales Targeting Types
 */

// Target reasons for categorizing customers
export type TargetReason =
  | 'route_match'      // Same routing key as scheduled delivery
  | 'nearby_route'     // Adjacent routing key
  | 'likely_to_order'  // High probability score
  | 'churn_risk'       // No order in 6+ weeks
  | 'new_customer'     // Never ordered
  | 'routine';         // Regular check-in

// Smart target from v_smart_sales_targets view
export interface SmartTarget {
  customer_id: string;
  org_id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  county: string | null;
  city: string | null;
  eircode: string | null;
  routing_key: string | null;
  lat: number | null;
  lng: number | null;
  zone_name: string | null;
  // Order pattern data
  total_orders: number | null;
  total_revenue: number | null;
  avg_order_value: number | null;
  last_order_at: string | null;
  avg_order_interval: number | null;
  preferred_dow: number | null;
  value_quartile: number | null;
  // Interaction data
  last_interaction_at: string | null;
  last_interaction_outcome: string | null;
  // Route match data
  suggested_delivery_date: string | null;
  van_current_load: number | null;
  zone_order_count: number | null;
  // Scores
  probability_score: number;
  route_fit_score: number;
  priority_score: number;
  // Target classification
  target_reason: TargetReason;
  context_note: string;
}

// Active delivery zone summary
export interface DeliveryZone {
  routing_key: string;
  county: string;
  org_id: string;
  requested_delivery_date: string;
  order_count: number;
  total_trolleys: number;
  routing_keys_in_zone: string[] | null;
  lat: number | null;
  lng: number | null;
  zone_name: string | null;
}

// Scheduled delivery for map
export interface ScheduledDelivery {
  order_id: string;
  org_id: string;
  order_number: string;
  requested_delivery_date: string;
  trolleys_estimated: number | null;
  customer_id: string;
  customer_name: string;
  county: string | null;
  city: string | null;
  eircode: string | null;
  routing_key: string | null;
  lat: number | null;
  lng: number | null;
  zone_name: string | null;
}

// Eircode zone reference
export interface EircodeZone {
  routing_key: string;
  zone_name: string;
  county: string;
  adjacent_keys: string[];
  lat: number | null;
  lng: number | null;
}

// Probability weights configuration
export interface ProbabilityWeights {
  frequency_match: number;
  seasonality: number;
  recency_urgency: number;
  customer_value: number;
  day_of_week_pattern: number;
}

// Route fit weights configuration
export interface RouteFitWeights {
  same_routing_key: number;
  adjacent_routing_key: number;
  same_county: number;
  density_bonus_per_order: number;
  density_bonus_max: number;
}

// Targeting configuration
export interface TargetingConfig {
  probability_weights: ProbabilityWeights;
  route_fit_weights: RouteFitWeights;
}

// Default configuration values
export const DEFAULT_PROBABILITY_WEIGHTS: ProbabilityWeights = {
  frequency_match: 0.30,
  seasonality: 0.20,
  recency_urgency: 0.20,
  customer_value: 0.15,
  day_of_week_pattern: 0.15,
};

export const DEFAULT_ROUTE_FIT_WEIGHTS: RouteFitWeights = {
  same_routing_key: 10,
  adjacent_routing_key: 7,
  same_county: 3,
  density_bonus_per_order: 1,
  density_bonus_max: 5,
};

// Filter options for targeting UI
export interface TargetFilters {
  reason?: TargetReason | 'all';
  county?: string;
  routingKey?: string;
  minScore?: number;
}

// Map marker types
export type MapMarkerType = 'scheduled' | 'target_high' | 'target_medium' | 'target_low';

export interface MapMarker {
  id: string;
  type: MapMarkerType;
  lat: number;
  lng: number;
  label: string;
  data: SmartTarget | ScheduledDelivery;
}

// Helper to get marker type from priority score
export function getMarkerType(score: number): MapMarkerType {
  if (score >= 80) return 'target_high';
  if (score >= 50) return 'target_medium';
  return 'target_low';
}

// Helper to get display color for target reason
export function getTargetReasonColor(reason: TargetReason): string {
  switch (reason) {
    case 'route_match':
      return 'green';
    case 'nearby_route':
      return 'emerald';
    case 'likely_to_order':
      return 'blue';
    case 'churn_risk':
      return 'amber';
    case 'new_customer':
      return 'sky';
    case 'routine':
    default:
      return 'gray';
  }
}

// Helper to get display label for target reason
export function getTargetReasonLabel(reason: TargetReason): string {
  switch (reason) {
    case 'route_match':
      return 'Route Match';
    case 'nearby_route':
      return 'Nearby Route';
    case 'likely_to_order':
      return 'Likely to Order';
    case 'churn_risk':
      return 'Churn Risk';
    case 'new_customer':
      return 'New Customer';
    case 'routine':
    default:
      return 'Routine';
  }
}

// Helper to format days since last order
export function formatDaysSinceOrder(lastOrderAt: string | null): string {
  if (!lastOrderAt) return 'Never ordered';
  const days = Math.floor(
    (Date.now() - new Date(lastOrderAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

// Helper to format order interval
export function formatOrderInterval(interval: number | null): string {
  if (!interval) return 'Unknown';
  const rounded = Math.round(interval);
  if (rounded === 7) return 'Weekly';
  if (rounded === 14) return 'Bi-weekly';
  if (rounded >= 28 && rounded <= 31) return 'Monthly';
  return `Every ${rounded} days`;
}
