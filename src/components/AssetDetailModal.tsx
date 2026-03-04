'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import TagSelector from '@/components/TagSelector'

interface Asset {
  id: string
  name: string
  original_path: string
  width: number | null
  height: number | null
  file_size_bytes: number | null
  mime_type: string | null
  orientation: string | null
  created_at: string
}

interface Metadata {
  id: string
  key: string
  value: string
}

interface ShareLink {
  id: string
  token: string
  expires_at: string
  created_at: string
}

const COMMON_METADATA_KEYS = ['Doctor', 'Location', 'Procedure', 'Patient ID', 'Department', 'Notes']

interface Props {
  asset: Asset
  onClose: () => void
  onUpdate: () => void
  onDelete: () => void
}

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export default function AssetDetailModal({ asset, onClose, onUpdate, onDelete }: Props) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState(asset.name)
  const [saving, setSaving] = useState(false)
  const [savingTags, setSavingTags] = useState(false)
  
  // New tag creation
  const [newTagLabel, setNewTagLabel] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)
  const [showCreateTag, setShowCreateTag] = useState(false)
  
  // Metadata
  const [metadata, setMetadata] = useState<Metadata[]>([])
  const [newMetaKey, setNewMetaKey] = useState('')
  const [newMetaValue, setNewMetaValue] = useState('')
  const [showAddMeta, setShowAddMeta] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  
  // Share links
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareLink, setShareLink] = useState<ShareLink | null>(null)
  const [creatingShare, setCreatingShare] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    loadAssetData()
  }, [asset.id])

  const loadAssetData = async () => {
    setLoading(true)
    
    // Load asset's current tags
    const { data: existingTags } = await supabase
      .from('dam_asset_tags')
      .select('tag_id')
      .eq('asset_id', asset.id)
    
    setSelectedTagIds((existingTags || []).map(t => t.tag_id))
    
    // Load asset's metadata
    const { data: metaData } = await supabase
      .from('dam_asset_metadata')
      .select('*')
      .eq('asset_id', asset.id)
      .order('key')
    
    setMetadata(metaData || [])
    setLoading(false)
  }

  const createShareLink = async () => {
    setCreatingShare(true)
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    
    // Generate token and set 7-day expiry
    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    
    const { data, error } = await supabase
      .from('dam_share_links')
      .insert({
        asset_id: asset.id,
        token,
        expires_at: expiresAt.toISOString(),
        created_by: user?.id || null
      })
      .select()
      .single()
    
    if (!error && data) {
      setShareLink(data)
    }
    
    setCreatingShare(false)
  }

  const getShareUrl = () => {
    if (!shareLink) return ''
    // Build the share URL - using window.location for the base
    const baseUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/vip-dam`
      : ''
    return `${baseUrl}/share/${shareLink.token}`
  }

  const copyShareLink = async () => {
    const url = getShareUrl()
    await navigator.clipboard.writeText(url)
    setCopiedShare(true)
    setTimeout(() => setCopiedShare(false), 2000)
  }

  const closeShareModal = () => {
    setShowShareModal(false)
    setShareLink(null)
    setCopiedShare(false)
  }

  const addMetadata = async () => {
    const key = newMetaKey.trim()
    const value = newMetaValue.trim()
    if (!key || !value) return

    setSavingMeta(true)
    
    const { data, error } = await supabase
      .from('dam_asset_metadata')
      .insert({ asset_id: asset.id, key, value })
      .select()
      .single()

    if (!error && data) {
      setMetadata(prev => [...prev, data])
      setNewMetaKey('')
      setNewMetaValue('')
      setShowAddMeta(false)
      onUpdate()
    }
    
    setSavingMeta(false)
  }

  const removeMetadata = async (metaId: string) => {
    setSavingMeta(true)
    
    const { error } = await supabase
      .from('dam_asset_metadata')
      .delete()
      .eq('id', metaId)

    if (!error) {
      setMetadata(prev => prev.filter(m => m.id !== metaId))
      onUpdate()
    }
    
    setSavingMeta(false)
  }

  const getImageUrl = (thumbnail = false) => {
    if (thumbnail) {
      // Use pre-generated WebP preview
      const previewPath = asset.original_path.replace(/\.[^.]+$/, '.webp')
      return supabase.storage.from('dam-previews').getPublicUrl(previewPath).data.publicUrl
    }
    return supabase.storage.from('dam-originals').getPublicUrl(asset.original_path).data.publicUrl
  }

  const handleTagsChange = async (newTagIds: string[]) => {
    setSavingTags(true)
    
    // Find tags to add and remove
    const toAdd = newTagIds.filter(id => !selectedTagIds.includes(id))
    const toRemove = selectedTagIds.filter(id => !newTagIds.includes(id))
    
    // Remove tags
    if (toRemove.length > 0) {
      await supabase
        .from('dam_asset_tags')
        .delete()
        .eq('asset_id', asset.id)
        .in('tag_id', toRemove)
    }
    
    // Add tags
    if (toAdd.length > 0) {
      const inserts = toAdd.map(tagId => ({
        asset_id: asset.id,
        tag_id: tagId,
        source: 'manual' as const
      }))
      await supabase.from('dam_asset_tags').insert(inserts)
    }
    
    setSelectedTagIds(newTagIds)
    setSavingTags(false)
    onUpdate()
  }

  const saveName = async () => {
    if (name === asset.name) return
    setSaving(true)
    await supabase.from('dam_assets').update({ name }).eq('id', asset.id)
    setSaving(false)
    onUpdate()
  }

  const createTag = async () => {
    const label = newTagLabel.trim()
    if (!label) return
    
    setCreatingTag(true)
    
    // Create the tag
    const { data: newTag, error } = await supabase
      .from('dam_tags')
      .insert({ label, category: null })
      .select()
      .single()
    
    if (error || !newTag) {
      console.error('Error creating tag:', error)
      setCreatingTag(false)
      return
    }
    
    // Assign to asset
    await supabase
      .from('dam_asset_tags')
      .insert({ asset_id: asset.id, tag_id: newTag.id, source: 'manual' })
    
    // Update local state
    setSelectedTagIds(prev => [...prev, newTag.id])
    
    // Reset form
    setNewTagLabel('')
    setShowCreateTag(false)
    setCreatingTag(false)
    onUpdate()
  }

  const handleDelete = async () => {
    if (!confirm('Delete this asset permanently?')) return
    
    // Delete from storage
    await supabase.storage.from('dam-originals').remove([asset.original_path])
    
    // Try to delete preview too
    const previewPath = asset.original_path.replace(/\.[^.]+$/, '.webp')
    await supabase.storage.from('dam-previews').remove([previewPath])
    
    // Delete from database (tags cascade)
    await supabase.from('dam_assets').delete().eq('id', asset.id)
    
    onDelete()
    onClose()
  }

  const downloadAs = async (format: 'original' | 'webp' | 'jpg') => {
    const url = getImageUrl()
    
    if (format === 'original') {
      window.open(url, '_blank')
      return
    }
    
    // For conversions, we'd need a server-side endpoint
    // For now, just download original
    const link = document.createElement('a')
    link.href = url
    link.download = format === 'webp' ? asset.name.replace(/\.[^.]+$/, '.webp') : asset.name
    link.click()
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Header - only visible on small screens */}
        <div className="md:hidden p-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-white truncate">{asset.name}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Image Preview */}
        <div className="flex-1 bg-black flex items-center justify-center min-w-0 min-h-[200px] md:min-h-0">
          <img
            src={getImageUrl(true)}
            alt={asset.name}
            className="max-w-full max-h-[40vh] md:max-h-[90vh] object-contain"
            onError={(e) => {
              // Fallback to original if preview doesn't exist
              const target = e.target as HTMLImageElement
              if (!target.dataset.fallback) {
                target.dataset.fallback = 'true'
                target.src = getImageUrl()
              }
            }}
          />
        </div>

        {/* Sidebar - scrollable on all sizes */}
        <div className="w-full md:w-80 flex flex-col border-t md:border-t-0 md:border-l border-zinc-800 max-h-[50vh] md:max-h-none overflow-y-auto md:overflow-hidden">
          {/* Header - hidden on mobile (shown above) */}
          <div className="hidden md:flex p-4 border-b border-zinc-800 items-center justify-between shrink-0">
            <h2 className="font-semibold text-white truncate">Details</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 md:overflow-y-auto p-4 space-y-4 sm:space-y-6">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={saveName}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            {/* Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-500">Dimensions</span>
                <p className="text-zinc-300">{asset.width}×{asset.height}</p>
              </div>
              <div>
                <span className="text-zinc-500">Size</span>
                <p className="text-zinc-300">{formatFileSize(asset.file_size_bytes)}</p>
              </div>
              <div>
                <span className="text-zinc-500">Type</span>
                <p className="text-zinc-300">{asset.mime_type?.split('/')[1]?.toUpperCase()}</p>
              </div>
              <div>
                <span className="text-zinc-500">Orientation</span>
                <p className="text-zinc-300 capitalize">{asset.orientation}</p>
              </div>
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-zinc-400">Tags</label>
                {savingTags && (
                  <span className="text-xs text-cyan-400 flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving
                  </span>
                )}
              </div>
              
              {loading ? (
                <div className="text-zinc-500 text-sm">Loading...</div>
              ) : (
                <>
                  <TagSelector
                    selectedTagIds={selectedTagIds}
                    onChange={handleTagsChange}
                  />
                  
                  {/* Create new tag section */}
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    {!showCreateTag ? (
                      <button
                        onClick={() => setShowCreateTag(true)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create new tag
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Tag name"
                          value={newTagLabel}
                          onChange={e => setNewTagLabel(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && createTag()}
                          className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={createTag}
                            disabled={!newTagLabel.trim() || creatingTag}
                            className="flex-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {creatingTag ? 'Creating...' : 'Create & Add'}
                          </button>
                          <button
                            onClick={() => {
                              setShowCreateTag(false)
                              setNewTagLabel('')
                            }}
                            className="px-3 py-1.5 text-zinc-400 hover:text-white text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Metadata */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-zinc-400">Metadata</label>
                {savingMeta && (
                  <span className="text-xs text-cyan-400 flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving
                  </span>
                )}
              </div>
              
              {/* Existing metadata */}
              {metadata.length > 0 && (
                <div className="space-y-2 mb-3">
                  {metadata.map(meta => (
                    <div key={meta.id} className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-500 min-w-[80px]">{meta.key}:</span>
                      <span className="text-zinc-300 flex-1 truncate">{meta.value}</span>
                      <button
                        onClick={() => removeMetadata(meta.id)}
                        className="text-zinc-500 hover:text-red-400 p-1"
                        title="Remove"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add metadata */}
              {!showAddMeta ? (
                <button
                  onClick={() => setShowAddMeta(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add metadata
                </button>
              ) : (
                <div className="space-y-2 p-3 bg-zinc-800 rounded-lg">
                  <select
                    value={newMetaKey}
                    onChange={e => setNewMetaKey(e.target.value)}
                    className="w-full px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">Select or type key...</option>
                    {COMMON_METADATA_KEYS.map(key => (
                      <option key={key} value={key}>{key}</option>
                    ))}
                  </select>
                  {newMetaKey === '' && (
                    <input
                      type="text"
                      placeholder="Or enter custom key"
                      value={newMetaKey}
                      onChange={e => setNewMetaKey(e.target.value)}
                      className="w-full px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  )}
                  <input
                    type="text"
                    placeholder="Value"
                    value={newMetaValue}
                    onChange={e => setNewMetaValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addMetadata()}
                    className="w-full px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addMetadata}
                      disabled={!newMetaKey.trim() || !newMetaValue.trim() || savingMeta}
                      className="flex-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddMeta(false)
                        setNewMetaKey('')
                        setNewMetaValue('')
                      }}
                      className="px-3 py-1.5 text-zinc-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Download */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Download</label>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadAs('original')}
                  className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-500"
                >
                  Original
                </button>
                <button
                  onClick={() => downloadAs('webp')}
                  className="flex-1 px-3 py-2 bg-zinc-700 text-white rounded-lg text-sm hover:bg-zinc-600"
                >
                  WebP
                </button>
              </div>
            </div>

            {/* Share */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Share</label>
              <button
                onClick={() => setShowShareModal(true)}
                className="w-full px-3 py-2 bg-zinc-700 text-white rounded-lg text-sm hover:bg-zinc-600 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Create Shareable Link
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-800">
            <button
              onClick={handleDelete}
              className="w-full px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg text-sm"
            >
              Delete Asset
            </button>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
          onClick={closeShareModal}
        >
          <div 
            className="bg-zinc-900 rounded-xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Share Asset</h3>
              <button onClick={closeShareModal} className="text-zinc-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!shareLink ? (
              <div className="text-center py-4">
                <p className="text-zinc-400 text-sm mb-4">
                  Create a shareable link that allows anyone to view and download this asset. The link will expire in 7 days.
                </p>
                <button
                  onClick={createShareLink}
                  disabled={creatingShare}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                >
                  {creatingShare ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Generate Link
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">Shareable URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getShareUrl()}
                      readOnly
                      className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                    />
                    <button
                      onClick={copyShareLink}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        copiedShare 
                          ? 'bg-green-600 text-white' 
                          : 'bg-cyan-600 text-white hover:bg-cyan-500'
                      }`}
                    >
                      {copiedShare ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Expires on {new Date(shareLink.expires_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={closeShareModal}
                    className="w-full px-4 py-2 bg-zinc-700 text-white rounded-lg text-sm hover:bg-zinc-600"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
