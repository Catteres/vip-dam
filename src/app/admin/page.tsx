'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import AssetDetailModal from '@/components/AssetDetailModal'
import BulkActionsBar from '@/components/BulkActionsBar'

interface Asset {
  id: string
  name: string
  original_path: string
  preview_path: string | null
  width: number | null
  height: number | null
  file_size_bytes: number | null
  mime_type: string | null
  orientation: 'landscape' | 'portrait' | 'square' | null
  processing_status: string
  created_at: string
}

interface Tag {
  id: string
  label: string
  category: string | null
}

interface AssetTag {
  asset_id: string
  tag_id: string
}

export default function AdminLibraryPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [assetTags, setAssetTags] = useState<AssetTag[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [orientationFilter, setOrientationFilter] = useState<string>('')
  
  const supabase = createClient()

  useEffect(() => {
    loadAssets()
    loadTags()
    loadAssetTags()
  }, [])

  const loadTags = async () => {
    const { data } = await supabase
      .from('dam_tags')
      .select('*')
      .order('category')
      .order('label')
    setAllTags(data || [])
  }

  const loadAssetTags = async () => {
    const { data } = await supabase
      .from('dam_asset_tags')
      .select('asset_id, tag_id')
    setAssetTags(data || [])
  }

  const loadAssets = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('dam_assets')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading assets:', error)
    } else {
      setAssets(data || [])
    }
    setLoading(false)
  }

  const getImageUrl = (path: string, thumbnail = false) => {
    if (thumbnail) {
      // Use Supabase image transforms for thumbnails (300x300)
      return supabase.storage.from('dam-originals').getPublicUrl(path, {
        transform: { width: 300, height: 300, resize: 'cover' }
      }).data.publicUrl
    }
    return supabase.storage.from('dam-originals').getPublicUrl(path).data.publicUrl
  }

  const toggleSelect = (id: string, e: React.MouseEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    setSelectedAssets(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const selectAll = () => {
    if (selectedAssets.size === filteredAssets.length) {
      setSelectedAssets(new Set())
    } else {
      setSelectedAssets(new Set(filteredAssets.map(a => a.id)))
    }
  }

  const refreshData = () => {
    loadAssets()
    loadAssetTags()
  }

  const toggleTagFilter = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId]
    )
  }

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    // Search filter
    if (searchQuery && !asset.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    
    // Orientation filter
    if (orientationFilter && asset.orientation !== orientationFilter) {
      return false
    }
    
    // Tag filter - asset must have ALL selected tags
    if (selectedTags.length > 0) {
      const assetTagIds = assetTags
        .filter(at => at.asset_id === asset.id)
        .map(at => at.tag_id)
      const hasAllTags = selectedTags.every(tagId => assetTagIds.includes(tagId))
      if (!hasAllTags) return false
    }
    
    return true
  })

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className={`p-4 sm:p-6 ${selectedAssets.size > 0 ? 'pb-24' : ''}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Asset Library</h1>
          <p className="text-zinc-400 text-sm mt-1">{filteredAssets.length} assets</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* View toggle - hidden on small mobile */}
          <div className="hidden sm:flex border border-zinc-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              List
            </button>
          </div>
          <Link
            href="/admin/upload"
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 text-sm font-medium"
          >
            + Upload
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
        
        {/* Orientation Filter */}
        <select
          value={orientationFilter}
          onChange={e => setOrientationFilter(e.target.value)}
          className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        >
          <option value="">All orientations</option>
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
          <option value="square">Square</option>
        </select>
      </div>

      {/* Tag Filters - separate row on mobile */}
      {allTags.length > 0 && (
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-sm text-zinc-500 shrink-0">Tags:</span>
          <div className="flex gap-1">
            {allTags.slice(0, 5).map(tag => (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.id)}
                className={`
                  px-2 py-1 text-xs rounded-full transition-colors whitespace-nowrap
                  ${selectedTags.includes(tag.id)
                    ? 'bg-cyan-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }
                `}
              >
                {tag.label}
              </button>
            ))}
            {allTags.length > 5 && (
              <span className="text-xs text-zinc-500 px-2 py-1 whitespace-nowrap">+{allTags.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAssets.length === 0 && (
        <div className="text-center py-12">
          <div className="text-zinc-600 text-5xl mb-4">📷</div>
          <h3 className="text-lg font-medium text-white mb-1">
            {assets.length === 0 ? 'No assets yet' : 'No matching assets'}
          </h3>
          <p className="text-zinc-400 mb-4">
            {assets.length === 0 
              ? 'Upload your first images to get started'
              : 'Try adjusting your filters'
            }
          </p>
          {assets.length === 0 && (
            <Link
              href="/admin/upload"
              className="inline-flex items-center px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
            >
              Upload Assets
            </Link>
          )}
        </div>
      )}

      {/* Grid View - always show on mobile, or when grid mode selected */}
      {!loading && filteredAssets.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => setSelectedAsset(asset)}
              className={`
                relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                ${selectedAssets.has(asset.id) 
                  ? 'border-cyan-500 ring-2 ring-cyan-500/30' 
                  : 'border-transparent hover:border-zinc-600'
                }
              `}
            >
              <div className="aspect-square bg-zinc-800">
                <img
                  src={getImageUrl(asset.original_path, true)}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              
              {/* Checkbox */}
              <div 
                onClick={(e) => toggleSelect(asset.id, e)}
                className={`
                  absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center
                  transition-opacity cursor-pointer
                  ${selectedAssets.has(asset.id) 
                    ? 'bg-cyan-500 border-cyan-500 opacity-100' 
                    : 'bg-zinc-900/80 border-zinc-500 opacity-0 group-hover:opacity-100'
                  }
                `}
              >
                {selectedAssets.has(asset.id) && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              {/* Info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{asset.name}</p>
                <p className="text-zinc-400 text-xs">
                  {asset.width}×{asset.height}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {!loading && filteredAssets.length > 0 && viewMode === 'list' && (
        <div className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-700">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedAssets.size === filteredAssets.length && filteredAssets.length > 0}
                    onChange={selectAll}
                    className="rounded border-zinc-600 bg-zinc-700 text-cyan-500 focus:ring-cyan-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Preview</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Dimensions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {filteredAssets.map((asset) => (
                <tr 
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className={`cursor-pointer hover:bg-zinc-700/50 ${selectedAssets.has(asset.id) ? 'bg-cyan-500/10' : ''}`}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedAssets.has(asset.id)}
                      onChange={(e) => toggleSelect(asset.id, e)}
                      className="rounded border-zinc-600 bg-zinc-700 text-cyan-500 focus:ring-cyan-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-12 h-12 bg-zinc-700 rounded overflow-hidden">
                      <img
                        src={getImageUrl(asset.original_path, true)}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-zinc-200 truncate max-w-xs">{asset.name}</p>
                    <p className="text-xs text-zinc-500">{asset.mime_type}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {asset.width}×{asset.height}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {formatFileSize(asset.file_size_bytes)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {formatDate(asset.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <AssetDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onUpdate={refreshData}
          onDelete={() => {
            setSelectedAssets(prev => {
              const newSet = new Set(prev)
              newSet.delete(selectedAsset.id)
              return newSet
            })
            refreshData()
          }}
        />
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedAssets}
        assets={assets}
        allTags={allTags}
        onClearSelection={() => setSelectedAssets(new Set())}
        onRefresh={refreshData}
      />
    </div>
  )
}
