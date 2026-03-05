-- Add folder hierarchy support
-- parent_id allows nested folders like a file system

ALTER TABLE dam_folders 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES dam_folders(id) ON DELETE CASCADE;

-- Add index for efficient hierarchy queries
CREATE INDEX IF NOT EXISTS idx_dam_folders_parent_id ON dam_folders(parent_id);

-- Add sort order for manual folder ordering
ALTER TABLE dam_folders 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
