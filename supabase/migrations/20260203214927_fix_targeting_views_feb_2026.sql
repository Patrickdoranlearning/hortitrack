-- ================================================
-- FIX TARGETING VIEWS - February 2026
-- ================================================
-- Recreate the smart targeting views that were missing

-- ================================================
-- 1. TARGETING CONFIGURATION TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.targeting_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  config_key text NOT NULL,
  config_value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, config_key)
);

ALTER TABLE public.targeting_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop and recreate to be safe)
DROP POLICY IF EXISTS "Users can view targeting config" ON public.targeting_config;
CREATE POLICY "Users can view targeting config"
  ON public.targeting_config FOR SELECT
  USING (org_id IS NULL OR public.user_in_org(org_id));

DROP POLICY IF EXISTS "Users can update their org targeting config" ON public.targeting_config;
CREATE POLICY "Users can update their org targeting config"
  ON public.targeting_config FOR ALL
  USING (org_id IS NOT NULL AND public.user_in_org(org_id));

-- Insert defaults
INSERT INTO public.targeting_config (org_id, config_key, config_value) VALUES
(NULL, 'probability_weights', '{"frequency_match": 0.30, "seasonality": 0.20, "recency_urgency": 0.20, "customer_value": 0.15, "day_of_week_pattern": 0.15}'::jsonb)
ON CONFLICT (org_id, config_key) DO NOTHING;

INSERT INTO public.targeting_config (org_id, config_key, config_value) VALUES
(NULL, 'route_fit_weights', '{"same_routing_key": 10, "adjacent_routing_key": 7, "same_county": 3, "density_bonus_per_order": 1, "density_bonus_max": 5}'::jsonb)
ON CONFLICT (org_id, config_key) DO NOTHING;

-- ================================================
-- 2. EIRCODE ZONES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS public.eircode_zones (
  routing_key char(3) PRIMARY KEY,
  zone_name text NOT NULL,
  county text NOT NULL,
  adjacent_keys text[] DEFAULT '{}',
  lat numeric(9,6),
  lng numeric(9,6)
);

CREATE INDEX IF NOT EXISTS idx_eircode_zones_county ON public.eircode_zones(county);

-- ================================================
-- 3. CUSTOMER ORDER PATTERNS MATERIALIZED VIEW
-- ================================================
DROP MATERIALIZED VIEW IF EXISTS public.customer_order_patterns CASCADE;

CREATE MATERIALIZED VIEW public.customer_order_patterns AS
WITH order_data AS (
  SELECT
    o.customer_id,
    o.org_id,
    o.created_at,
    o.total_inc_vat,
    EXTRACT(EPOCH FROM (o.created_at - LAG(o.created_at) OVER (
      PARTITION BY o.customer_id ORDER BY o.created_at
    ))) / 86400.0 as days_since_prev,
    EXTRACT(dow FROM o.created_at) as order_dow,
    EXTRACT(week FROM o.created_at) as order_week
  FROM public.orders o
  WHERE o.status::text NOT IN ('cancelled', 'draft')
),
aggregated AS (
  SELECT
    customer_id,
    org_id,
    COUNT(*) as total_orders,
    SUM(total_inc_vat) as total_revenue,
    AVG(total_inc_vat) as avg_order_value,
    MAX(created_at) as last_order_at,
    AVG(days_since_prev) FILTER (WHERE days_since_prev IS NOT NULL) as avg_order_interval,
    STDDEV(days_since_prev) FILTER (WHERE days_since_prev IS NOT NULL) as interval_stddev,
    MODE() WITHIN GROUP (ORDER BY order_dow) as preferred_dow,
    MODE() WITHIN GROUP (ORDER BY order_week) as preferred_week
  FROM order_data
  GROUP BY customer_id, org_id
)
SELECT
  a.*,
  NTILE(4) OVER (PARTITION BY a.org_id ORDER BY a.total_revenue) as value_quartile
FROM aggregated a;

CREATE UNIQUE INDEX idx_customer_order_patterns_pk ON public.customer_order_patterns(customer_id);
CREATE INDEX idx_customer_order_patterns_org ON public.customer_order_patterns(org_id);

-- ================================================
-- 4. REFRESH FUNCTION
-- ================================================
CREATE OR REPLACE FUNCTION public.refresh_customer_order_patterns()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.customer_order_patterns;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to refresh customer_order_patterns: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Manual refresh function
CREATE OR REPLACE FUNCTION public.refresh_customer_order_patterns_manual()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.customer_order_patterns;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- 5. SMART SALES TARGETS VIEW
-- ================================================
DROP VIEW IF EXISTS public.v_smart_sales_targets CASCADE;

CREATE VIEW public.v_smart_sales_targets
WITH (security_invoker = true)
AS
WITH
config AS (
  SELECT
    COALESCE(
      (SELECT config_value FROM targeting_config WHERE org_id IS NULL AND config_key = 'probability_weights'),
      '{"frequency_match": 0.30, "seasonality": 0.20, "recency_urgency": 0.20, "customer_value": 0.15, "day_of_week_pattern": 0.15}'::jsonb
    ) as prob_weights,
    COALESCE(
      (SELECT config_value FROM targeting_config WHERE org_id IS NULL AND config_key = 'route_fit_weights'),
      '{"same_routing_key": 10, "adjacent_routing_key": 7, "same_county": 3, "density_bonus_per_order": 1, "density_bonus_max": 5}'::jsonb
    ) as route_weights
),
active_delivery_zones AS (
  SELECT
    UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) as routing_key,
    ca.county,
    o.org_id,
    o.requested_delivery_date,
    COUNT(DISTINCT o.id) as order_count,
    SUM(COALESCE(o.trolleys_estimated, 1)) as current_load
  FROM public.orders o
  JOIN public.customer_addresses ca ON o.ship_to_address_id = ca.id
  WHERE o.status::text IN ('confirmed', 'picking', 'ready', 'ready_for_dispatch')
    AND o.requested_delivery_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7)
  GROUP BY 1, 2, 3, 4
),
last_interactions AS (
  SELECT DISTINCT ON (customer_id)
    customer_id,
    created_at as last_interaction_at,
    outcome as last_interaction_outcome
  FROM public.customer_interactions
  ORDER BY customer_id, created_at DESC
),
customer_scores AS (
  SELECT
    c.id as customer_id,
    c.org_id,
    c.name as customer_name,
    c.phone,
    c.email,
    ca.county,
    ca.city,
    ca.eircode,
    UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) as routing_key,
    ez.lat,
    ez.lng,
    ez.zone_name,
    cop.total_orders,
    cop.total_revenue,
    cop.avg_order_value,
    cop.last_order_at,
    cop.avg_order_interval,
    cop.preferred_dow,
    cop.value_quartile,
    li.last_interaction_at,
    li.last_interaction_outcome,
    adz.requested_delivery_date as suggested_delivery_date,
    adz.current_load as van_current_load,
    adz.order_count as zone_order_count,
    CASE
      WHEN cop.total_orders IS NULL OR cop.total_orders = 0 THEN 30
      ELSE LEAST(100, GREATEST(0,
        CASE
          WHEN cop.avg_order_interval IS NULL THEN 0
          WHEN EXTRACT(EPOCH FROM (NOW() - cop.last_order_at)) / 86400.0 >= cop.avg_order_interval THEN
            ((cfg.prob_weights->>'frequency_match')::numeric * 100)
          WHEN EXTRACT(EPOCH FROM (NOW() - cop.last_order_at)) / 86400.0 >= cop.avg_order_interval * 0.8 THEN
            ((cfg.prob_weights->>'frequency_match')::numeric * 70)
          ELSE ((cfg.prob_weights->>'frequency_match')::numeric * 30)
        END +
        CASE
          WHEN cop.preferred_week = EXTRACT(week FROM CURRENT_DATE) THEN
            ((cfg.prob_weights->>'seasonality')::numeric * 100)
          WHEN ABS(cop.preferred_week - EXTRACT(week FROM CURRENT_DATE)) <= 2 THEN
            ((cfg.prob_weights->>'seasonality')::numeric * 50)
          ELSE 0
        END +
        CASE
          WHEN cop.last_order_at < (NOW() - INTERVAL '8 weeks') THEN
            ((cfg.prob_weights->>'recency_urgency')::numeric * 100)
          WHEN cop.last_order_at < (NOW() - INTERVAL '6 weeks') THEN
            ((cfg.prob_weights->>'recency_urgency')::numeric * 70)
          WHEN cop.last_order_at < (NOW() - INTERVAL '4 weeks') THEN
            ((cfg.prob_weights->>'recency_urgency')::numeric * 40)
          ELSE 0
        END +
        CASE cop.value_quartile
          WHEN 4 THEN ((cfg.prob_weights->>'customer_value')::numeric * 100)
          WHEN 3 THEN ((cfg.prob_weights->>'customer_value')::numeric * 70)
          WHEN 2 THEN ((cfg.prob_weights->>'customer_value')::numeric * 40)
          ELSE ((cfg.prob_weights->>'customer_value')::numeric * 20)
        END +
        CASE
          WHEN cop.preferred_dow = EXTRACT(dow FROM CURRENT_DATE) THEN
            ((cfg.prob_weights->>'day_of_week_pattern')::numeric * 100)
          WHEN ABS(cop.preferred_dow - EXTRACT(dow FROM CURRENT_DATE)) = 1 THEN
            ((cfg.prob_weights->>'day_of_week_pattern')::numeric * 50)
          ELSE 0
        END
      ))
    END as probability_score,
    CASE
      WHEN adz.routing_key IS NOT NULL AND
           UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = adz.routing_key THEN
        (cfg.route_weights->>'same_routing_key')::int +
        LEAST((cfg.route_weights->>'density_bonus_max')::int,
              adz.order_count * (cfg.route_weights->>'density_bonus_per_order')::int)
      WHEN adz.routing_key IS NOT NULL AND
           UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ANY(
             SELECT unnest(ez2.adjacent_keys) FROM eircode_zones ez2 WHERE ez2.routing_key = adz.routing_key
           ) THEN
        (cfg.route_weights->>'adjacent_routing_key')::int +
        LEAST((cfg.route_weights->>'density_bonus_max')::int,
              adz.order_count * (cfg.route_weights->>'density_bonus_per_order')::int)
      WHEN adz.county IS NOT NULL AND ca.county = adz.county THEN
        (cfg.route_weights->>'same_county')::int
      ELSE 0
    END as route_fit_score
  FROM public.customers c
  CROSS JOIN config cfg
  LEFT JOIN public.customer_addresses ca ON c.id = ca.customer_id AND ca.is_default_shipping = true
  LEFT JOIN public.eircode_zones ez ON UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ez.routing_key
  LEFT JOIN public.customer_order_patterns cop ON c.id = cop.customer_id
  LEFT JOIN active_delivery_zones adz ON (
    (UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = adz.routing_key AND c.org_id = adz.org_id)
    OR
    (UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ANY(
      SELECT unnest(ez3.adjacent_keys) FROM eircode_zones ez3 WHERE ez3.routing_key = adz.routing_key
    ) AND c.org_id = adz.org_id)
    OR
    (ca.county = adz.county AND c.org_id = adz.org_id AND ca.eircode IS NULL)
  )
  LEFT JOIN last_interactions li ON c.id = li.customer_id
)
SELECT
  cs.*,
  ROUND((cs.probability_score * 0.6) + (cs.route_fit_score * 2.5))::int as priority_score,
  CASE
    WHEN cs.route_fit_score >= 10 THEN 'route_match'
    WHEN cs.route_fit_score >= 7 THEN 'nearby_route'
    WHEN cs.probability_score >= 70 THEN 'likely_to_order'
    WHEN cs.last_order_at IS NULL THEN 'new_customer'
    WHEN cs.last_order_at < (NOW() - INTERVAL '6 weeks') THEN 'churn_risk'
    ELSE 'routine'
  END as target_reason,
  CASE
    WHEN cs.route_fit_score >= 10 THEN
      'On ' || COALESCE(cs.county, 'Unknown') || ' route ' ||
      COALESCE(to_char(cs.suggested_delivery_date, 'Dy DD Mon'), '') ||
      ' (van ' || COALESCE(cs.van_current_load::text, '?') || '/10 trolleys)' ||
      CASE WHEN cs.avg_order_interval IS NOT NULL
        THEN '. Orders every ' || ROUND(cs.avg_order_interval)::text || ' days'
        ELSE ''
      END
    WHEN cs.route_fit_score >= 7 THEN
      'Adjacent to ' || COALESCE(cs.county, 'Unknown') || ' route. ' ||
      CASE WHEN cs.value_quartile = 4 THEN 'High-value customer.'
           WHEN cs.value_quartile = 3 THEN 'Good customer.'
           ELSE ''
      END
    WHEN cs.total_orders IS NULL OR cs.total_orders = 0 THEN
      'New customer - no orders yet'
    WHEN cs.last_order_at < (NOW() - INTERVAL '6 weeks') THEN
      'Last order ' || EXTRACT(day FROM (NOW() - cs.last_order_at))::int || ' days ago - churn risk'
    WHEN cs.probability_score >= 70 THEN
      'High likelihood to order. ' ||
      CASE WHEN cs.avg_order_interval IS NOT NULL
        THEN 'Usually orders every ' || ROUND(cs.avg_order_interval)::text || ' days'
        ELSE ''
      END
    ELSE
      'Regular customer' ||
      CASE WHEN cs.avg_order_value IS NOT NULL
        THEN ' - avg order ' || ROUND(cs.avg_order_value)::text
        ELSE ''
      END
  END as context_note
FROM customer_scores cs
WHERE NOT EXISTS (
  SELECT 1 FROM public.orders recent_o
  WHERE recent_o.customer_id = cs.customer_id
  AND recent_o.created_at > (NOW() - INTERVAL '5 days')
  AND recent_o.status::text NOT IN ('cancelled', 'draft')
)
AND (cs.last_interaction_at IS NULL OR cs.last_interaction_at < (NOW() - INTERVAL '2 days'))
AND (
  cs.route_fit_score >= 3
  OR cs.probability_score >= 50
  OR cs.total_orders IS NULL
  OR cs.last_order_at < (NOW() - INTERVAL '6 weeks')
)
ORDER BY
  CASE WHEN cs.route_fit_score >= 7 THEN 0 ELSE 1 END,
  (cs.probability_score * 0.6) + (cs.route_fit_score * 2.5) DESC,
  cs.last_order_at ASC NULLS FIRST
LIMIT 100;

-- ================================================
-- 6. DELIVERY ZONES VIEW
-- ================================================
DROP VIEW IF EXISTS public.v_active_delivery_zones CASCADE;

CREATE VIEW public.v_active_delivery_zones
WITH (security_invoker = true)
AS
SELECT
  COALESCE(UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)), 'NO_EIRCODE') as routing_key,
  ca.county,
  o.org_id,
  o.requested_delivery_date,
  COUNT(DISTINCT o.id) as order_count,
  SUM(COALESCE(o.trolleys_estimated, 1)) as total_trolleys,
  ARRAY_AGG(DISTINCT UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)))
    FILTER (WHERE ca.eircode IS NOT NULL) as routing_keys_in_zone,
  MIN(ez.lat) as lat,
  MIN(ez.lng) as lng,
  MIN(ez.zone_name) as zone_name
FROM public.orders o
JOIN public.customer_addresses ca ON o.ship_to_address_id = ca.id
LEFT JOIN public.eircode_zones ez ON UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ez.routing_key
WHERE o.status::text IN ('confirmed', 'picking', 'ready', 'ready_for_dispatch')
  AND o.requested_delivery_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7)
GROUP BY 1, 2, 3, 4
ORDER BY o.requested_delivery_date, total_trolleys DESC;

-- ================================================
-- 7. SCHEDULED DELIVERIES VIEW
-- ================================================
DROP VIEW IF EXISTS public.v_scheduled_deliveries_map CASCADE;

CREATE VIEW public.v_scheduled_deliveries_map
WITH (security_invoker = true)
AS
SELECT
  o.id as order_id,
  o.org_id,
  o.order_number,
  o.requested_delivery_date,
  o.trolleys_estimated,
  c.id as customer_id,
  c.name as customer_name,
  ca.county,
  ca.city,
  ca.eircode,
  UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) as routing_key,
  ez.lat,
  ez.lng,
  ez.zone_name
FROM public.orders o
JOIN public.customers c ON o.customer_id = c.id
JOIN public.customer_addresses ca ON o.ship_to_address_id = ca.id
LEFT JOIN public.eircode_zones ez ON UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ez.routing_key
WHERE o.status::text IN ('confirmed', 'picking', 'ready', 'ready_for_dispatch')
  AND o.requested_delivery_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7);

-- ================================================
-- GRANT PERMISSIONS
-- ================================================
GRANT SELECT ON public.targeting_config TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.targeting_config TO authenticated;
GRANT SELECT ON public.eircode_zones TO authenticated;
GRANT SELECT ON public.customer_order_patterns TO authenticated;
GRANT SELECT ON public.v_smart_sales_targets TO authenticated;
GRANT SELECT ON public.v_active_delivery_zones TO authenticated;
GRANT SELECT ON public.v_scheduled_deliveries_map TO authenticated;
