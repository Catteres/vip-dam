'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Folder } from '@/lib/types'
import AssetGridSkeleton from '@/components/AssetGridSkeleton'

interface Asset {
  id: string
  name: string
  original_path: string
  width: number | null
  height: number | null
  file_size_bytes: number | null
  mime_type: string | null
  orientation: 'landscape' | 'portrait' | 'square' | null
  created_at: string
}

interface Tag {
  id: string
  label: string
  category: string | null
}

interface AssetWithTags extends Asset {
  tags: Tag[]
}

interface FilterQuery {
  search?: string
  tags?: string[]
  orientation?: 'landscape' | 'portrait' | 'square' | ''
  dateFrom?: string
  dateTo?: string
}

export default function HomePage() {
  const [assets, setAssets] = useState<AssetWithTags[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAsset, setSelectedAsset] = useState<AssetWithTags | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [orientationFilter, setOrientationFilter] = useState<string>('')
  
  // Folder filter from URL
  const searchParams = useSearchParams()
  const folderId = searchParams.get('folder')
  const [activeFolder, setActiveFolder] = useState<Folder | null>(null)
  
  const supabase = createClient()

  // Check if current user is admin and load favorites
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        setCurrentUserId(user.id)
        const { data } = await supabase
          .from('dam_users')
          .select('role, favorites')
          .eq('id', user.id)
          .single()
        setIsAdmin(data?.role === 'admin')
        setFavoriteIds(data?.favorites || [])
      }
    }
    loadUserData()
  }, [])

  const toggleFavorite = async (assetId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!currentUserId) return

    const isFavorite = favoriteIds.includes(assetId)
    const newFavorites = isFavorite
      ? favoriteIds.filter(id => id !== assetId)
      : [...favoriteIds, assetId]

    // Optimistic update
    setFavoriteIds(newFavorites)

    const { error } = await supabase
      .from('dam_users')
      .update({ favorites: newFavorites })
      .eq('id', currentUserId)

    if (error) {
      // Revert on error
      setFavoriteIds(favoriteIds)
      console.error('Error updating favorites:', error)
    }
  }

  // Load folder if folderId is in URL
  const loadFolder = useCallback(async () => {
    if (!folderId) {
      setActiveFolder(null)
      return
    }
    
    const { data } = await supabase
      .from('dam_folders')
      .select('*')
      .eq('id', folderId)
      .single()
    
    if (data) {
      setActiveFolder(data)
      // Apply folder's filter_query to local state
      const fq = data.filter_query as FilterQuery
      if (fq) {
        setSearchQuery(fq.search || '')
        setSelectedTags(fq.tags || [])
        setOrientationFilter(fq.orientation || '')
      }
    } else {
      setActiveFolder(null)
    }
  }, [folderId, supabase])

  useEffect(() => {
    loadFolder()
  }, [loadFolder])

  // Reset filters when folder changes to none
  useEffect(() => {
    if (!folderId) {
      setSearchQuery('')
      setSelectedTags([])
      setOrientationFilter('')
    }
  }, [folderId])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    // Load all tags
    const { data: tags } = await supabase
      .from('dam_tags')
      .select('*')
      .order('category')
      .order('label')
    
    setAllTags(tags || [])

    // Load assets with their tags
    const { data: assetsData, error } = await supabase
      .from('dam_assets')
      .select(`
        *,
        dam_asset_tags (
          tag:dam_tags (*)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading assets:', error)
    } else {
      // Transform to include tags array
      const assetsWithTags = (assetsData || []).map(asset => ({
        ...asset,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tags: asset.dam_asset_tags?.map((at: any) => at.tag).filter(Boolean) || []
      }))
      setAssets(assetsWithTags)
    }
    
    setLoading(false)
  }

  const getImageUrl = (path: string, thumbnail = false) => {
    if (thumbnail) {
      // Use pre-generated WebP preview from dam-previews bucket
      const previewPath = path.replace(/\.[^.]+$/, '.webp')
      return supabase.storage.from('dam-previews').getPublicUrl(previewPath).data.publicUrl
    }
    return supabase.storage.from('dam-originals').getPublicUrl(path).data.publicUrl
  }

  // Fallback URL for assets without pre-generated previews
  const getFallbackUrl = (path: string) => {
    return supabase.storage.from('dam-originals').getPublicUrl(path, {
      transform: { width: 400, height: 400, resize: 'cover' }
    }).data.publicUrl
  }

  const toggleTagFilter = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    )
  }

  // Filter assets - including folder date range if applicable
  const filteredAssets = assets.filter(asset => {
    const folderFilter = activeFolder?.filter_query as FilterQuery | undefined
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const nameMatch = asset.name.toLowerCase().includes(query)
      const tagMatch = asset.tags.some(t => t.label.toLowerCase().includes(query))
      if (!nameMatch && !tagMatch) return false
    }
    
    // Orientation filter
    if (orientationFilter && asset.orientation !== orientationFilter) {
      return false
    }

    // Tag filter
    if (selectedTags.length > 0) {
      const assetTagIds = asset.tags.map(t => t.id)
      if (!selectedTags.every(tagId => assetTagIds.includes(tagId))) {
        return false
      }
    }
    
    // Date range filter (from folder)
    if (folderFilter?.dateFrom) {
      const assetDate = new Date(asset.created_at)
      const fromDate = new Date(folderFilter.dateFrom)
      if (assetDate < fromDate) return false
    }
    if (folderFilter?.dateTo) {
      const assetDate = new Date(asset.created_at)
      const toDate = new Date(folderFilter.dateTo + 'T23:59:59')
      if (assetDate > toDate) return false
    }
    
    return true
  })

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const downloadAsset = async (asset: AssetWithTags, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    // Log the download
    if (currentUserId) {
      await supabase.from('dam_download_log').insert({
        asset_id: asset.id,
        user_id: currentUserId,
        format: asset.mime_type || 'unknown',
        width: asset.width,
        height: asset.height
      })
    }
    
    const url = getImageUrl(asset.original_path)
    const link = document.createElement('a')
    link.href = url
    link.download = asset.name
    link.target = '_blank'
    link.click()
  }

  // Group tags by category for filter UI
  const tagsByCategory = allTags.reduce((acc, tag) => {
    const cat = tag.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tag)
    return acc
  }, {} as Record<string, Tag[]>)

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl">📸</span>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">
                  {activeFolder ? (
                    <span className="flex items-center gap-2">
                      <span>📁</span>
                      {activeFolder.name}
                    </span>
                  ) : (
                    'VIP DAM'
                  )}
                </h1>
                <p className="text-xs text-zinc-500 hidden sm:block">
                  {activeFolder?.description || 'Digital Asset Library'}
                </p>
              </div>
            </div>
{isAdmin && (
              <Link
                href="/admin"
                className="text-sm text-zinc-400 hover:text-white"
              >
                Admin →
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Active Folder Banner */}
        {activeFolder && (
          <div className="mb-4 p-3 bg-cyan-900/30 border border-cyan-700/50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400">📁</span>
              <span className="text-cyan-200 text-sm">
                Viewing folder: <strong>{activeFolder.name}</strong>
              </span>
            </div>
            <Link
              href="/home"
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Clear filter
            </Link>
          </div>
        )}

        {/* Search & Filters */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          {/* Search Bar */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="flex-1 relative">
              <svg className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={orientationFilter}
              onChange={e => setOrientationFilter(e.target.value)}
              className="px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">All</option>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
              <option value="square">Square</option>
            </select>
          </div>

          {/* Tag Filters - horizontal scroll on mobile */}
          {Object.keys(tagsByCategory).length > 0 && (
            <div className="overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
              <div className="flex gap-3 sm:gap-4 min-w-max sm:min-w-0 sm:flex-wrap">
                {Object.entries(tagsByCategory).map(([category, tags]) => (
                  <div key={category} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 whitespace-nowrap">{category}:</span>
                    <div className="flex gap-1">
                      {tags.map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => toggleTagFilter(tag.id)}
                          className={`
                            px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-full transition-colors whitespace-nowrap
                            ${selectedTags.includes(tag.id)
                              ? 'bg-cyan-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                            }
                          `}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => setSelectedTags([])}
                    className="text-sm text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 text-sm text-zinc-500">
          {filteredAssets.length} {filteredAssets.length === 1 ? 'asset' : 'assets'}
          {(searchQuery || selectedTags.length > 0 || orientationFilter || activeFolder) && ' matching filters'}
        </div>

        {/* Loading Skeleton */}
        {loading && <AssetGridSkeleton variant="home" count={12} />}

        {/* Empty State */}
        {!loading && filteredAssets.length === 0 && (
          <div className="text-center py-12">
            <div className="text-zinc-600 text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-white mb-1">No assets found</h3>
            <p className="text-zinc-400">
              {assets.length === 0 
                ? 'The library is empty'
                : 'Try adjusting your search or filters'
              }
            </p>
          </div>
        )}

        {/* Asset Grid */}
        {!loading && filteredAssets.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
            {filteredAssets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => setSelectedAsset(asset)}
                className="group relative bg-zinc-900 rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-cyan-500/50 transition-all"
              >
                <div className="aspect-square bg-zinc-800">
                  <img
                    src={getImageUrl(asset.original_path, true)}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      // Fallback to transform if preview doesn't exist
                      const target = e.target as HTMLImageElement
                      if (!target.dataset.fallback) {
                        target.dataset.fallback = 'true'
                        target.src = getFallbackUrl(asset.original_path)
                      }
                    }}
                  />
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-medium truncate">{asset.name}</p>
                    <p className="text-zinc-400 text-xs">{asset.width}×{asset.height}</p>
                    {asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {asset.tags.slice(0, 3).map(tag => (
                          <span key={tag.id} className="px-2 py-0.5 text-xs bg-zinc-700 text-zinc-300 rounded-full">
                            {tag.label}
                          </span>
                        ))}
                        {asset.tags.length > 3 && (
                          <span className="text-xs text-zinc-500">+{asset.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Favorite Button */}
                <button
                  onClick={(e) => toggleFavorite(asset.id, e)}
                  className={`absolute top-2 left-2 p-2 rounded-lg transition-opacity ${
                    favoriteIds.includes(asset.id)
                      ? 'bg-red-600 opacity-100'
                      : 'bg-zinc-900/80 opacity-0 group-hover:opacity-100 hover:bg-red-600'
                  }`}
                  title={favoriteIds.includes(asset.id) ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg 
                    className="w-4 h-4 text-white" 
                    fill={favoriteIds.includes(asset.id) ? 'currentColor' : 'none'} 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>

                {/* Quick Download Button */}
                <button
                  onClick={(e) => downloadAsset(asset, e)}
                  className="absolute top-2 right-2 p-2 bg-zinc-900/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-cyan-600"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedAsset && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={() => setSelectedAsset(null)}
        >
          <button
            onClick={() => setSelectedAsset(null)}
            className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 text-white/60 hover:text-white z-10"
          >
            <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div 
            className="max-w-6xl w-full max-h-[95vh] overflow-y-auto flex flex-col md:flex-row gap-4 sm:gap-6"
            onClick={e => e.stopPropagation()}
          >
            {/* Image - uses preview for fast loading */}
            <div className="flex-1 flex items-center justify-center min-h-[200px]">
              <img
                src={getImageUrl(selectedAsset.original_path, true)}
                alt={selectedAsset.name}
                className="max-w-full max-h-[50vh] md:max-h-[80vh] object-contain rounded-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (!target.dataset.fallback) {
                    target.dataset.fallback = 'true'
                    target.src = getFallbackUrl(selectedAsset.original_path)
                  }
                }}
              />
            </div>

            {/* Info Panel */}
            <div className="md:w-72 bg-zinc-900 rounded-xl p-4 space-y-4 shrink-0">
              <div>
                <h3 className="font-semibold text-white text-base sm:text-lg break-words">{selectedAsset.name}</h3>
                <p className="text-xs sm:text-sm text-zinc-500">{selectedAsset.mime_type}</p>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-zinc-500 text-xs">Dimensions</span>
                  <p className="text-white text-sm">{selectedAsset.width}×{selectedAsset.height}</p>
                </div>
                <div>
                  <span className="text-zinc-500 text-xs">Size</span>
                  <p className="text-white text-sm">{formatFileSize(selectedAsset.file_size_bytes)}</p>
                </div>
                <div>
                  <span className="text-zinc-500 text-xs">Orientation</span>
                  <p className="text-white text-sm capitalize">{selectedAsset.orientation}</p>
                </div>
              </div>

              {selectedAsset.tags.length > 0 && (
                <div>
                  <span className="text-xs text-zinc-500">Tags</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedAsset.tags.map(tag => (
                      <span key={tag.id} className="px-2 py-1 text-xs bg-zinc-800 text-zinc-300 rounded-full">
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => downloadAsset(selectedAsset)}
                  className="w-full py-2.5 sm:py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>

                <button
                  onClick={() => toggleFavorite(selectedAsset.id)}
                  className={`w-full py-2.5 sm:py-3 rounded-lg font-medium flex items-center justify-center gap-2 text-sm sm:text-base ${
                    favoriteIds.includes(selectedAsset.id)
                      ? 'bg-red-600 text-white hover:bg-red-500'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <svg 
                    className="w-5 h-5" 
                    fill={favoriteIds.includes(selectedAsset.id) ? 'currentColor' : 'none'} 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {favoriteIds.includes(selectedAsset.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
