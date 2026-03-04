'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
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

export default function FavoritesPage() {
  const [assets, setAssets] = useState<AssetWithTags[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAsset, setSelectedAsset] = useState<AssetWithTags | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  
  const supabase = createClient()

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    setLoading(true)
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      setLoading(false)
      return
    }

    // Get user's favorites array
    const { data: userData } = await supabase
      .from('dam_users')
      .select('favorites')
      .eq('id', user.id)
      .single()

    const favIds = userData?.favorites || []
    setFavoriteIds(favIds)

    if (favIds.length === 0) {
      setAssets([])
      setLoading(false)
      return
    }

    // Load favorite assets with their tags
    const { data: assetsData, error } = await supabase
      .from('dam_assets')
      .select(`
        *,
        dam_asset_tags (
          tag:dam_tags (*)
        )
      `)
      .in('id', favIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading favorites:', error)
    } else {
      const assetsWithTags = (assetsData || []).map(asset => ({
        ...asset,
        tags: asset.dam_asset_tags?.map((at: any) => at.tag).filter(Boolean) || []
      }))
      setAssets(assetsWithTags)
    }
    
    setLoading(false)
  }

  const removeFavorite = async (assetId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return

    const newFavorites = favoriteIds.filter(id => id !== assetId)
    
    const { error } = await supabase
      .from('dam_users')
      .update({ favorites: newFavorites })
      .eq('id', user.id)

    if (!error) {
      setFavoriteIds(newFavorites)
      setAssets(prev => prev.filter(a => a.id !== assetId))
      if (selectedAsset?.id === assetId) {
        setSelectedAsset(null)
      }
    }
  }

  const getImageUrl = (path: string, thumbnail = false) => {
    if (thumbnail) {
      const previewPath = path.replace(/\.[^.]+$/, '.webp')
      return supabase.storage.from('dam-previews').getPublicUrl(previewPath).data.publicUrl
    }
    return supabase.storage.from('dam-originals').getPublicUrl(path).data.publicUrl
  }

  const getFallbackUrl = (path: string) => {
    return supabase.storage.from('dam-originals').getPublicUrl(path, {
      transform: { width: 400, height: 400, resize: 'cover' }
    }).data.publicUrl
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const downloadAsset = async (asset: AssetWithTags, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    // Log the download
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) {
      await supabase.from('dam_download_log').insert({
        asset_id: asset.id,
        user_id: user.id,
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

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl">❤️</span>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Favorites</h1>
                <p className="text-xs text-zinc-500 hidden sm:block">Your saved assets</p>
              </div>
            </div>
            <Link
              href="/home"
              className="text-sm text-zinc-400 hover:text-white"
            >
              ← Back to Library
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Results Count */}
        <div className="mb-4 text-sm text-zinc-500">
          {assets.length} {assets.length === 1 ? 'favorite' : 'favorites'}
        </div>

        {/* Loading Skeleton */}
        {loading && <AssetGridSkeleton variant="favorites" count={12} />}

        {/* Empty State */}
        {!loading && assets.length === 0 && (
          <div className="text-center py-12">
            <div className="text-zinc-600 text-5xl mb-4">❤️</div>
            <h3 className="text-lg font-medium text-white mb-1">No favorites yet</h3>
            <p className="text-zinc-400 mb-4">
              Click the heart icon on any asset to add it to your favorites
            </p>
            <Link
              href="/home"
              className="inline-flex items-center px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
            >
              Browse Library
            </Link>
          </div>
        )}

        {/* Asset Grid */}
        {!loading && assets.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
            {assets.map((asset) => (
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
                  </div>
                </div>

                {/* Remove from favorites button */}
                <button
                  onClick={(e) => removeFavorite(asset.id, e)}
                  className="absolute top-2 left-2 p-2 bg-zinc-900/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Remove from favorites"
                >
                  <svg className="w-4 h-4 text-red-400 hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
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
            {/* Image */}
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
                  onClick={() => removeFavorite(selectedAsset.id)}
                  className="w-full py-2.5 sm:py-3 bg-zinc-800 text-red-400 rounded-lg hover:bg-zinc-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  Remove from Favorites
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
