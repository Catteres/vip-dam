export interface Asset {
  id: string
  name: string
  original_url: string
  preview_url: string | null
  width: number | null
  height: number | null
  file_size_bytes: number | null
  mime_type: string | null
  orientation: 'landscape' | 'portrait' | 'square' | null
  uploaded_by: string | null
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  label: string
  category: string | null  // legacy field
  created_at: string
  categories?: Category[]  // populated via junction
}

export interface Category {
  id: string
  name: string
  color: string
  sort_order: number
  created_at: string
}

export interface TagCategory {
  tag_id: string
  category_id: string
}

export interface AssetTag {
  id: string
  asset_id: string
  tag_id: string
  confidence: number | null  // AI confidence score
  source: 'ai' | 'manual'
  created_at: string
}

export interface DamUser {
  id: string
  email: string
  role: 'admin' | 'user'
  favorites: string[]  // array of asset IDs
  created_at: string
}

export interface Folder {
  id: string
  name: string
  description: string | null
  filter_query: Record<string, unknown>  // JSON storing the filter combination
  created_by: string | null
  created_at: string
}

export interface DownloadLog {
  id: string
  asset_id: string
  user_id: string
  format: string
  width: number | null
  height: number | null
  quality: number | null
  created_at: string
}

export interface AssetMetadata {
  id: string
  asset_id: string
  key: string  // e.g., 'doctor', 'location', 'procedure'
  value: string
  created_at: string
}

// Extended types for queries
export interface AssetWithTags extends Asset {
  tags?: Tag[]
  metadata?: AssetMetadata[]
}
