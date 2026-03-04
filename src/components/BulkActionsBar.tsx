'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// Bulk download limits
const MAX_BULK_FILES = 50
const MAX_BULK_SIZE_BYTES = 500 * 1024 * 1024 // 500MB

interface Tag {
  id: string
  label: string
  category: string | null
}

interface Asset {
  id: string
  name: string
  original_path: string
  file_size_bytes?: number | null
}

interface BulkActionsBarProps {
  selectedIds: Set<string>
  assets: Asset[]
  allTags: Tag[]
  onClearSelection: () => void
  onRefresh: () => void
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
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
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null)
  const [showLimitWarning, setShowLimitWarning] = useState(false)
  const [limitWarningMessage, setLimitWarningMessage] = useState('')
  
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const supabase = createClient()
  const selectedCount = selectedIds.size

  if (selectedCount === 0) return null

  const selectedAssets = assets.filter(a => selectedIds.has(a.id))

  // Calculate total size of selected assets
  const totalSelectedSize = selectedAssets.reduce((sum, asset) => {
    return sum + (asset.file_size_bytes || 0)
  }, 0)

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

  const checkDownloadLimits = (): { allowed: boolean; message: string } => {
    const issues: string[] = []
    
    if (selectedCount > MAX_BULK_FILES) {
      issues.push(`• Too many files: ${selectedCount} selected (max ${MAX_BULK_FILES})`)
    }
    
    if (totalSelectedSize > MAX_BULK_SIZE_BYTES) {
      issues.push(`• Total size too large: ${formatFileSize(totalSelectedSize)} (max ${formatFileSize(MAX_BULK_SIZE_BYTES)})`)
    }
    
    if (issues.length > 0) {
      return {
        allowed: false,
        message: `Cannot download selection:\n\n${issues.join('\n')}\n\nPlease reduce your selection and try again.`
      }
    }
    
    return { allowed: true, message: '' }
  }

  const handleDownload = async () => {
    if (selectedCount === 0) return

    // Check limits before starting
    const limitCheck = checkDownloadLimits()
    if (!limitCheck.allowed) {
      setLimitWarningMessage(limitCheck.message)
      setShowLimitWarning(true)
      return
    }

    setDownloading(true)
    setDownloadProgress(null)

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

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

      setDownloadProgress({ current: 0, total: selectedCount })

      // Download each file and add to zip
      for (let i = 0; i < selectedAssets.length; i++) {
        // Check for cancellation
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Download cancelled')
        }

        const asset = selectedAssets[i]
        setDownloadProgress({ current: i + 1, total: selectedCount })

        const { data } = await supabase.storage
          .from('dam-originals')
          .download(asset.original_path)
        
        if (data) {
          zip.file(asset.name, data)
        }
      }

      // Check for cancellation before generating
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Download cancelled')
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
      if (err instanceof Error && err.message === 'Download cancelled') {
        console.log('Download cancelled by user')
      } else {
        console.error('Error downloading:', err)
        alert('Failed to download files')
      }
    } finally {
      setDownloading(false)
      setDownloadProgress(null)
      abortControllerRef.current = null
    }
  }

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
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
            <span className="text-zinc-500 text-sm hidden sm:inline">
              ({formatFileSize(totalSelectedSize)})
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Add Tags */}
            <button
              onClick={() => { setShowTagModal('add'); setSelectedTagIds([]) }}
              disabled={processing || downloading}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="hidden sm:inline">Add Tags</span>
            </button>

            {/* Remove Tags */}
            <button
              onClick={() => { setShowTagModal('remove'); setSelectedTagIds([]) }}
              disabled={processing || downloading}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">Remove Tags</span>
            </button>

            {/* Download */}
            {downloading ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="hidden sm:inline">
                    {downloadProgress
                      ? `Preparing ${downloadProgress.current} of ${downloadProgress.total}...`
                      : 'Preparing...'
                    }
                  </span>
                </div>
                <button
                  onClick={handleCancelDownload}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
                  title="Cancel download"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="hidden sm:inline">Cancel</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleDownload}
                disabled={processing}
                className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={processing || downloading}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Limit Warning Modal */}
      {showLimitWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-zinc-700 flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">Download Limit Exceeded</h3>
            </div>

            <div className="p-4">
              <p className="text-zinc-300 whitespace-pre-line">{limitWarningMessage}</p>
              
              <div className="mt-4 p-3 bg-zinc-800 rounded-lg">
                <p className="text-sm text-zinc-400">
                  <strong className="text-zinc-300">Current selection:</strong>
                </p>
                <ul className="mt-1 text-sm text-zinc-400">
                  <li>• Files: {selectedCount}</li>
                  <li>• Total size: {formatFileSize(totalSelectedSize)}</li>
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-700 flex justify-end">
              <button
                onClick={() => setShowLimitWarning(false)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

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
