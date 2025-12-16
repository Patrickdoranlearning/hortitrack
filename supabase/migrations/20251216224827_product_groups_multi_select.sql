-- Update product_groups to support multiple values per matching rule
-- Change single text/uuid fields to arrays

-- Change match_category from text to text[]
ALTER TABLE public.product_groups
  ALTER COLUMN match_category TYPE text[] USING
    CASE WHEN match_category IS NOT NULL THEN ARRAY[match_category] ELSE NULL END;

-- Change match_family from text to text[]
ALTER TABLE public.product_groups
  ALTER COLUMN match_family TYPE text[] USING
    CASE WHEN match_family IS NOT NULL THEN ARRAY[match_family] ELSE NULL END;

-- Change match_genus from text to text[]
ALTER TABLE public.product_groups
  ALTER COLUMN match_genus TYPE text[] USING
    CASE WHEN match_genus IS NOT NULL THEN ARRAY[match_genus] ELSE NULL END;

-- Change match_size_id from uuid to uuid[]
ALTER TABLE public.product_groups
  DROP CONSTRAINT IF EXISTS product_groups_match_size_id_fkey;

ALTER TABLE public.product_groups
  ALTER COLUMN match_size_id TYPE uuid[] USING
    CASE WHEN match_size_id IS NOT NULL THEN ARRAY[match_size_id] ELSE NULL END;

-- Rename column to reflect it's now an array
ALTER TABLE public.product_groups
  RENAME COLUMN match_size_id TO match_size_ids;

-- Update indexes for array columns (use GIN index for array containment queries)
DROP INDEX IF EXISTS idx_product_groups_match_category;
DROP INDEX IF EXISTS idx_product_groups_match_size;

CREATE INDEX idx_product_groups_match_categories ON public.product_groups USING GIN (match_category) WHERE match_category IS NOT NULL;
CREATE INDEX idx_product_groups_match_families ON public.product_groups USING GIN (match_family) WHERE match_family IS NOT NULL;
CREATE INDEX idx_product_groups_match_genera ON public.product_groups USING GIN (match_genus) WHERE match_genus IS NOT NULL;
CREATE INDEX idx_product_groups_match_size_ids ON public.product_groups USING GIN (match_size_ids) WHERE match_size_ids IS NOT NULL;

-- Update the helper function to work with arrays
CREATE OR REPLACE FUNCTION public.get_product_group_members(p_group_id uuid)
RETURNS TABLE (
    product_id uuid,
    product_name text,
    inclusion_source text  -- 'rule' or 'manual_include'
)
LANGUAGE sql
STABLE
AS $$
    WITH group_rules AS (
        SELECT match_category, match_family, match_genus, match_size_ids, org_id
        FROM public.product_groups
        WHERE id = p_group_id
    ),
    rule_matched AS (
        -- Products matching the group's rules (ANY of the values in each array)
        SELECT DISTINCT
            p.id AS product_id,
            p.name AS product_name,
            'rule' AS inclusion_source
        FROM public.products p
        JOIN public.skus s ON s.id = p.sku_id
        LEFT JOIN public.plant_varieties pv ON pv.id = s.plant_variety_id
        CROSS JOIN group_rules gr
        WHERE p.org_id = gr.org_id
          AND p.is_active = true
          -- Match if array is null OR variety's value is in the array
          AND (gr.match_category IS NULL OR pv.category = ANY(gr.match_category))
          AND (gr.match_family IS NULL OR pv.family = ANY(gr.match_family))
          AND (gr.match_genus IS NULL OR pv.genus = ANY(gr.match_genus))
          AND (gr.match_size_ids IS NULL OR s.size_id = ANY(gr.match_size_ids))
    ),
    manual_included AS (
        -- Manually included products
        SELECT
            pgm.product_id,
            p.name AS product_name,
            'manual_include' AS inclusion_source
        FROM public.product_group_members pgm
        JOIN public.products p ON p.id = pgm.product_id
        WHERE pgm.group_id = p_group_id
          AND pgm.inclusion_type = 'manual_include'
    ),
    manual_excluded AS (
        -- Get IDs to exclude
        SELECT product_id
        FROM public.product_group_members
        WHERE group_id = p_group_id
          AND inclusion_type = 'manual_exclude'
    )
    -- Combine: (rule matches - exclusions) + manual includes
    SELECT product_id, product_name, inclusion_source FROM rule_matched
    WHERE product_id NOT IN (SELECT product_id FROM manual_excluded)
    UNION
    SELECT product_id, product_name, inclusion_source FROM manual_included;
$$;
