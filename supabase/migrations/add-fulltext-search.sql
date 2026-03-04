-- Full-text search function for DAM assets
-- Searches across: asset name, tag labels, and metadata values

CREATE OR REPLACE FUNCTION search_dam_assets(search_query TEXT)
RETURNS TABLE (asset_id UUID) AS $$
BEGIN
  IF search_query IS NULL OR TRIM(search_query) = '' THEN
    -- Return all assets if no search query
    RETURN QUERY SELECT id FROM dam_assets;
  ELSE
    -- Search across name, tags, and metadata
    RETURN QUERY
    SELECT DISTINCT a.id
    FROM dam_assets a
    LEFT JOIN dam_asset_tags at ON at.asset_id = a.id
    LEFT JOIN dam_tags t ON t.id = at.tag_id
    LEFT JOIN dam_asset_metadata m ON m.asset_id = a.id
    WHERE 
      a.name ILIKE '%' || search_query || '%'
      OR t.label ILIKE '%' || search_query || '%'
      OR m.value ILIKE '%' || search_query || '%';
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION search_dam_assets(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_dam_assets(TEXT) TO anon;

-- Optional: Add GIN indexes for faster ILIKE searches
CREATE INDEX IF NOT EXISTS idx_dam_assets_name_gin ON dam_assets USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dam_tags_label_gin ON dam_tags USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_dam_metadata_value_gin ON dam_asset_metadata USING gin (value gin_trgm_ops);

-- Note: The GIN indexes require the pg_trgm extension
-- Run this first if not already enabled:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
