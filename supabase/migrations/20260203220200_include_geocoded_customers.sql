-- Fix: Include geocoded customers even with lower scores
-- The map view needs to show customers with coordinates

DROP VIEW IF EXISTS public.v_smart_sales_targets CASCADE;

CREATE VIEW public.v_smart_sales_targets
WITH (security_invoker = true)
AS
WITH
active_delivery_zones AS (
  SELECT
    UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) as routing_key,
    ca.county,
    o.org_id,
    MIN(o.requested_delivery_date) as requested_delivery_date,
    COUNT(DISTINCT o.id) as order_count,
    SUM(COALESCE(o.trolleys_estimated, 1)) as current_load
  FROM public.orders o
  JOIN public.customer_addresses ca ON o.ship_to_address_id = ca.id
  WHERE o.status::text IN ('confirmed', 'picking', 'ready', 'ready_for_dispatch')
    AND o.requested_delivery_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + 7)
    AND ca.eircode IS NOT NULL
  GROUP BY 1, 2, 3
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
          WHEN EXTRACT(EPOCH FROM (NOW() - cop.last_order_at)) / 86400.0 >= cop.avg_order_interval THEN 30
          WHEN EXTRACT(EPOCH FROM (NOW() - cop.last_order_at)) / 86400.0 >= cop.avg_order_interval * 0.8 THEN 21
          ELSE 9
        END +
        CASE
          WHEN cop.value_quartile = 4 THEN 15
          WHEN cop.value_quartile = 3 THEN 10
          WHEN cop.value_quartile = 2 THEN 6
          ELSE 3
        END +
        CASE
          WHEN cop.last_order_at < (NOW() - INTERVAL '8 weeks') THEN 20
          WHEN cop.last_order_at < (NOW() - INTERVAL '6 weeks') THEN 14
          WHEN cop.last_order_at < (NOW() - INTERVAL '4 weeks') THEN 8
          ELSE 0
        END
      ))
    END as probability_score,
    CASE
      WHEN adz.routing_key IS NOT NULL THEN 10 + LEAST(5, COALESCE(adz.order_count, 0))
      WHEN adz.county IS NOT NULL AND ca.county = adz.county THEN 3
      ELSE 0
    END as route_fit_score
  FROM public.customers c
  LEFT JOIN public.customer_addresses ca ON c.id = ca.customer_id AND ca.is_default_shipping = true
  LEFT JOIN public.eircode_zones ez ON UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = ez.routing_key
  LEFT JOIN public.customer_order_patterns cop ON c.id = cop.customer_id
  LEFT JOIN last_interactions li ON c.id = li.customer_id
  LEFT JOIN active_delivery_zones adz ON UPPER(SUBSTRING(REPLACE(ca.eircode, ' ', ''), 1, 3)) = adz.routing_key AND c.org_id = adz.org_id
)
SELECT
  cs.customer_id, cs.org_id, cs.customer_name, cs.phone, cs.email,
  cs.county, cs.city, cs.eircode, cs.routing_key,
  cs.lat, cs.lng, cs.zone_name,
  cs.total_orders, cs.total_revenue, cs.avg_order_value,
  cs.last_order_at, cs.avg_order_interval, cs.preferred_dow, cs.value_quartile,
  cs.last_interaction_at, cs.last_interaction_outcome,
  cs.suggested_delivery_date, cs.van_current_load, cs.zone_order_count,
  cs.probability_score, cs.route_fit_score,
  ROUND((cs.probability_score * 0.6) + (cs.route_fit_score * 2.5))::int as priority_score,
  CASE
    WHEN cs.route_fit_score >= 10 THEN 'route_match'
    WHEN cs.route_fit_score >= 7 THEN 'nearby_route'
    WHEN cs.probability_score >= 70 THEN 'likely_to_order'
    WHEN cs.last_order_at IS NULL THEN 'new_customer'
    WHEN cs.last_order_at < (NOW() - INTERVAL '6 weeks') THEN 'churn_risk'
    ELSE 'routine'
  END::text as target_reason,
  CASE
    WHEN cs.route_fit_score >= 10 THEN 'On ' || COALESCE(cs.county, 'Unknown') || ' route'
    WHEN cs.total_orders IS NULL OR cs.total_orders = 0 THEN 'New customer - no orders yet'
    WHEN cs.last_order_at < (NOW() - INTERVAL '6 weeks') THEN 'Churn risk - ' || EXTRACT(day FROM (NOW() - cs.last_order_at))::int || ' days since order'
    WHEN cs.probability_score >= 70 THEN 'High likelihood to order'
    ELSE 'Regular customer - avg €' || COALESCE(ROUND(cs.avg_order_value)::text, '?')
  END::text as context_note
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
  OR cs.lat IS NOT NULL  -- Include geocoded customers for map
)
ORDER BY
  CASE WHEN cs.route_fit_score >= 7 THEN 0 ELSE 1 END,
  (cs.probability_score * 0.6) + (cs.route_fit_score * 2.5) DESC
LIMIT 200;

GRANT SELECT ON public.v_smart_sales_targets TO authenticated;
