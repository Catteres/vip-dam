'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Tag {
  id: string
  label: string
  category: string | null
}

interface Asset {
  id: string
  name: string
  original_path: string
}

interface BulkActionsBarProps {
  selectedIds: Set<string>
  assets: Asset[]
  allTags: Tag[]
  onClearSelection: () => void
  onRefresh: () => void
}

export default function BulkActionsBar({
  selectedIds,
  assets,
  allTags,
  onClearSelection,
  onRefresh
}: BulkActionsBarProps) {
  const [showTagModal, setShowTagModal] = useState<'add' | 'remove' | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  
  const supabase = createClient()
  const selectedCount = selectedIds.size

  if (selectedCount === 0) return null

  const selectedAssets = assets.filter(a => selectedIds.has(a.id))

  const handleAddTags = async () => {
    if (selectedTagIds.length === 0) return
    setProcessing(true)

    try {
      // Create asset-tag associations for each selected asset and tag
      const records = []
      for (const assetId of selectedIds) {
        for (const tagId of selectedTagIds) {
          records.push({ asset_id: assetId, tag_id: tagId })
        }
      }

      // Upsert to avoid duplicates
      const { error } = await supabase
        .from('dam_asset_tags')
        .upsert(records, { onConflict: 'asset_id,tag_id', ignoreDuplicates: true })

      if (error) throw error

      setShowTagModal(null)
      setSelectedTagIds([])
      onRefresh()
    } catch (err) {
      console.error('Error adding tags:', err)
      alert('Failed to add tags')
    } finally {
      setProcessing(false)
    }
  }

  const handleRemoveTags = async () => {
    if (selectedTagIds.length === 0) return
    setProcessing(true)

    try {
      // Remove tag associations for selected assets
      for (const assetId of selectedIds) {
        await supabase
          .from('dam_asset_tags')
          .delete()
          .eq('asset_id', assetId)
          .in('tag_id', selectedTagIds)
      }

      setShowTagModal(null)
      setSelectedTagIds([])
      onRefresh()
    } catch (err) {
      console.error('Error removing tags:', err)
      alert('Failed to remove tags')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedCount} asset(s)? This cannot be undone.`)) return
    setProcessing(true)

    try {
      for (const asset of selectedAssets) {
        // Delete from storage
        await supabase.storage.from('dam-originals').remove([asset.original_path])
        // Delete from database (cascade will handle asset_tags)
        await supabase.from('dam_assets').delete().eq('id', asset.id)
      }

      onClearSelection()
      onRefresh()
    } catch (err) {
      console.error('Error deleting:', err)
      alert('Failed to delete some assets')
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = async () => {
    if (selectedCount === 0) return
    setDownloading(true)

    try {
      // For single file, direct download
      if (selectedCount === 1) {
        const asset = selectedAssets[0]
        const { data } = await supabase.storage
          .from('dam-originals')
          .createSignedUrl(asset.original_path, 60)
        
        if (data?.signedUrl) {
          const a = document.createElement('a')
          a.href = data.signedUrl
          a.download = asset.name
          a.click()
        }
        setDownloading(false)
        return
      }

      // For multiple files, use JSZip
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()

      // Download each file and add to zip
      for (const asset of selectedAssets) {
        const { data } = await supabase.storage
          .from('dam-originals')
          .download(asset.original_path)
        
        if (data) {
          zip.file(asset.name, data)
        }
      }

      // Generate and download zip
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vip-dam-export-${selectedCount}-files.zip`
      a.click()
      URL.revokeObjectURL(url)

    } catch (err) {
      console.error('Error downloading:', err)
      alert('Failed to download files')
    } finally {
      setDownloading(false)
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  // Group tags by category
  const tagsByCategory = allTags.reduce((acc, tag) => {
    const cat = tag.category || 'Uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tag)
    return acc
  }, {} as Record<string, Tag[]>)

  return (
    <>
      {/* Bulk Actions Bar - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-zinc-900 border-t border-zinc-700 p-4 z-40 animate-slide-up">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Selection info */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClearSelection}
              className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
              title="Clear selection"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="text-white font-medium">
              {selectedCount} selected
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Add Tags */}
            <button
              onClick={() => { setShowTagModal('add'); setSelectedTagIds([]) }}
              disabled={processing}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="hidden sm:inline">Add Tags</span>
            </button>

            {/* Remove Tags */}
            <button
              onClick={() => { setShowTagModal('remove'); setSelectedTagIds([]) }}
              disabled={processing}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">Remove Tags</span>
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm transition-colors"
            >
              {downloading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              <span className="hidden sm:inline">
                {downloading ? 'Preparing...' : 'Download'}
              </span>
            </button>

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={processing}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tag Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {showTagModal === 'add' ? 'Add Tags' : 'Remove Tags'}
              </h3>
              <button
                onClick={() => setShowTagModal(null)}
                className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 max-h-[50vh] overflow-y-auto">
              <p className="text-sm text-zinc-400 mb-4">
                {showTagModal === 'add'
                  ? `Select tags to add to ${selectedCount} asset(s)`
                  : `Select tags to remove from ${selectedCount} asset(s)`
                }
              </p>

              {Object.entries(tagsByCategory).map(([category, tags]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">{category}</h4>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className={`
                          px-3 py-1.5 text-sm rounded-full transition-colors
                          ${selectedTagIds.includes(tag.id)
                            ? 'bg-cyan-600 text-white'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          }
                        `}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {allTags.length === 0 && (
                <p className="text-zinc-500 text-center py-4">No tags available</p>
              )}
            </div>

            <div className="p-4 border-t border-zinc-700 flex justify-end gap-3">
              <button
                onClick={() => setShowTagModal(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={showTagModal === 'add' ? handleAddTags : handleRemoveTags}
                disabled={selectedTagIds.length === 0 || processing}
                className={`
                  px-4 py-2 rounded-lg font-medium transition-colors
                  ${selectedTagIds.length === 0 || processing
                    ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    : showTagModal === 'add'
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      : 'bg-red-600 hover:bg-red-500 text-white'
                  }
                `}
              >
                {processing ? 'Processing...' : showTagModal === 'add' ? 'Add Tags' : 'Remove Tags'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.2s ease-out;
        }
      `}</style>
    </>
  )
}
