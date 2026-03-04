-- Tag Categories - separate table for proper management
CREATE TABLE IF NOT EXISTS dam_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6b7280', -- hex color for UI
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table: tags can belong to multiple categories
CREATE TABLE IF NOT EXISTS dam_tag_categories (
  tag_id UUID REFERENCES dam_tags(id) ON DELETE CASCADE,
  category_id UUID REFERENCES dam_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (tag_id, category_id)
);

-- Migrate existing category data
INSERT INTO dam_categories (name)
SELECT DISTINCT category FROM dam_tags WHERE category IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Populate junction table from existing data
INSERT INTO dam_tag_categories (tag_id, category_id)
SELECT t.id, c.id 
FROM dam_tags t
JOIN dam_categories c ON c.name = t.category
WHERE t.category IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tag_categories_tag ON dam_tag_categories(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_categories_category ON dam_tag_categories(category_id);

-- RLS policies
ALTER TABLE dam_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dam_tag_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON dam_categories FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON dam_tag_categories FOR ALL USING (true);
