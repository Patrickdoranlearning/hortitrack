#!/bin/bash

echo "=================================================="
echo "B2B PORTAL MIGRATIONS"
echo "=================================================="
echo ""
echo "Copy and paste each migration into your Supabase SQL Editor:"
echo "Dashboard URL: https://supabase.com/dashboard/project/iuixfnuaxlrnntfluqnj/sql/new"
echo ""
echo "=================================================="

migrations=(
  "20251201100000_sales_products_pricing.sql"
  "20251202123500_product_aliases.sql"
  "20251209100000_customer_enhancement.sql"
  "20251215100000_b2b_portal_auth.sql"
  "20251215101000_customer_favorites.sql"
  "20251215102000_customer_resources.sql"
  "20251215103000_order_items_rrp.sql"
)

for migration in "${migrations[@]}"; do
  echo ""
  echo "=================================================="
  echo "MIGRATION: $migration"
  echo "=================================================="
  echo ""
  cat "supabase/migrations/$migration"
  echo ""
  echo "=================================================="
  echo "Press ENTER to continue to next migration..."
  read
done

echo ""
echo "✨ All migrations displayed!"
echo ""
