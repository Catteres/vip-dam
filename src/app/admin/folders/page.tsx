'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Folder, Tag } from '@/lib/types'

interface FilterQuery {
  search?: string
  tags?: string[]
  orientation?: 'landscape' | 'portrait' | 'square' | ''
  dateFrom?: string
  dateTo?: string
}

export default function FoldersPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  
  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [filterQuery, setFilterQuery] = useState<FilterQuery>({
    search: '',
    tags: [],
    orientation: '',
    dateFrom: '',
    dateTo: ''
  })
  
  // Preview count
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  
  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    // Load folders
    const { data: foldersData } = await supabase
      .from('dam_folders')
      .select('*')
      .order('name')
    
    setFolders(foldersData || [])

    // Load all tags for filter builder
    const { data: tags } = await supabase
      .from('dam_tags')
      .select('*')
      .order('category')
      .order('label')
    
    setAllTags(tags || [])
    setLoading(false)
  }

  const openCreateModal = () => {
    setEditingFolder(null)
    setName('')
    setDescription('')
    setFilterQuery({ search: '', tags: [], orientation: '', dateFrom: '', dateTo: '' })
    setPreviewCount(null)
    setIsModalOpen(true)
  }

  const openEditModal = (folder: Folder) => {
    setEditingFolder(folder)
    setName(folder.name)
    setDescription(folder.description || '')
    setFilterQuery(folder.filter_query as FilterQuery || { search: '', tags: [], orientation: '', dateFrom: '', dateTo: '' })
    setPreviewCount(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingFolder(null)
  }

  // Count matching assets for preview
  const countMatchingAssets = useCallback(async () => {
    setPreviewLoading(true)
    
    try {
      // Build query to count matching assets
      let query = supabase.from('dam_assets').select('id', { count: 'exact', head: true })
      
      // Apply date filters
      if (filterQuery.dateFrom) {
        query = query.gte('created_at', filterQuery.dateFrom)
      }
      if (filterQuery.dateTo) {
        query = query.lte('created_at', filterQuery.dateTo + 'T23:59:59')
      }
      
      // Apply orientation filter
      if (filterQuery.orientation) {
        query = query.eq('orientation', filterQuery.orientation)
      }
      
      // For search and tags, we need to do a more complex query
      // First get all assets that match basic filters
      const { count: basicCount, error } = await query
      
      if (error) {
        console.error('Error counting assets:', error)
        setPreviewCount(null)
        return
      }
      
      // If there are tag filters or search, we need to fetch and filter client-side
      // for simplicity (in production, this would be a more efficient query)
      if (filterQuery.tags?.length || filterQuery.search) {
        const { data: assets } = await supabase
          .from('dam_assets')
          .select(`
            id, name,
            dam_asset_tags (
              tag:dam_tags (id, label)
            )
          `)
          .order('created_at', { ascending: false })
        
        const filteredAssets = (assets || []).filter(asset => {
          // Date filters
          // (already applied in initial query for efficiency, but re-check here)
          
          // Search filter
          if (filterQuery.search) {
            const searchLower = filterQuery.search.toLowerCase()
            const nameMatch = asset.name.toLowerCase().includes(searchLower)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tagMatch = (asset.dam_asset_tags || []).some((at: any) => 
              at.tag?.label?.toLowerCase().includes(searchLower)
            )
            if (!nameMatch && !tagMatch) return false
          }
          
          // Tag filter
          if (filterQuery.tags && filterQuery.tags.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const assetTagIds = (asset.dam_asset_tags || []).map((at: any) => at.tag?.id).filter(Boolean)
            if (!filterQuery.tags.every(tagId => assetTagIds.includes(tagId))) {
              return false
            }
          }
          
          return true
        })
        
        setPreviewCount(filteredAssets.length)
      } else {
        setPreviewCount(basicCount || 0)
      }
    } catch (err) {
      console.error('Error in preview:', err)
      setPreviewCount(null)
    }
    
    setPreviewLoading(false)
  }, [filterQuery, supabase])

  // Debounce preview count
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isModalOpen) {
        countMatchingAssets()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [filterQuery, isModalOpen, countMatchingAssets])

  const handleSave = async () => {
    if (!name.trim()) return
    
    setSaving(true)
    
    // Clean up filter query - remove empty values
    const cleanedFilter: FilterQuery = {}
    if (filterQuery.search?.trim()) cleanedFilter.search = filterQuery.search.trim()
    if (filterQuery.tags?.length) cleanedFilter.tags = filterQuery.tags
    if (filterQuery.orientation) cleanedFilter.orientation = filterQuery.orientation
    if (filterQuery.dateFrom) cleanedFilter.dateFrom = filterQuery.dateFrom
    if (filterQuery.dateTo) cleanedFilter.dateTo = filterQuery.dateTo
    
    if (editingFolder) {
      // Update
      const { error } = await supabase
        .from('dam_folders')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          filter_query: cleanedFilter
        })
        .eq('id', editingFolder.id)
      
      if (error) {
        console.error('Error updating folder:', error)
        alert('Failed to update folder')
      }
    } else {
      // Create
      const { error } = await supabase
        .from('dam_folders')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          filter_query: cleanedFilter
        })
      
      if (error) {
        console.error('Error creating folder:', error)
        alert('Failed to create folder')
      }
    }
    
    setSaving(false)
    closeModal()
    loadData()
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('dam_folders')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting folder:', error)
      alert('Failed to delete folder')
    }
    
    setDeleteId(null)
    loadData()
  }

  const toggleTag = (tagId: string) => {
    setFilterQuery(prev => ({
      ...prev,
      tags: prev.tags?.includes(tagId)
        ? prev.tags.filter(t => t !== tagId)
        : [...(prev.tags || []), tagId]
    }))
  }

  // Group tags by category for display
  const tagsByCategory = allTags.reduce((acc, tag) => {
    const cat = tag.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tag)
    return acc
  }, {} as Record<string, Tag[]>)

  const getFilterSummary = (folder: Folder) => {
    const fq = folder.filter_query as FilterQuery
    const parts: string[] = []
    if (fq?.search) parts.push(`"${fq.search}"`)
    if (fq?.tags?.length) {
      const tagLabels = fq.tags.map(id => allTags.find(t => t.id === id)?.label).filter(Boolean)
      parts.push(`Tags: ${tagLabels.join(', ')}`)
    }
    if (fq?.orientation) parts.push(`${fq.orientation}`)
    if (fq?.dateFrom || fq?.dateTo) {
      parts.push(`Date: ${fq.dateFrom || '...'} to ${fq.dateTo || '...'}`)
    }
    return parts.length > 0 ? parts.join(' • ') : 'No filters'
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Folders</h1>
          <p className="text-zinc-400 mt-1">Create virtual folders using saved filter queries</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Folder
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        </div>
      )}

      {!loading && folders.length === 0 && (
        <div className="text-center py-12 bg-zinc-800 rounded-lg border border-zinc-700">
          <div className="text-zinc-600 text-5xl mb-4">📁</div>
          <h3 className="text-lg font-medium text-white mb-1">No folders yet</h3>
          <p className="text-zinc-400 mb-4">Create virtual folders to save filter combinations for quick access</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
          >
            Create Your First Folder
          </button>
        </div>
      )}

      {!loading && folders.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {folders.map(folder => (
            <div
              key={folder.id}
              className="bg-zinc-800 rounded-lg border border-zinc-700 p-4 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📁</span>
                  <h3 className="font-semibold text-white">{folder.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditModal(folder)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteId(folder.id)}
                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {folder.description && (
                <p className="text-zinc-400 text-sm mb-3">{folder.description}</p>
              )}
              
              <div className="text-xs text-zinc-500 bg-zinc-900 rounded px-2 py-1.5">
                {getFilterSummary(folder)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white">
                {editingFolder ? 'Edit Folder' : 'Create Folder'}
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Folder Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Doctor Headshots"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />
              </div>
              
              {/* Filter Builder */}
              <div className="space-y-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <h3 className="font-medium text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter Criteria
                </h3>
                
                {/* Search Term */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Search Term</label>
                  <input
                    type="text"
                    value={filterQuery.search || ''}
                    onChange={e => setFilterQuery(prev => ({ ...prev, search: e.target.value }))}
                    placeholder="Search names or tags..."
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
                
                {/* Orientation */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Orientation</label>
                  <select
                    value={filterQuery.orientation || ''}
                    onChange={e => setFilterQuery(prev => ({ ...prev, orientation: e.target.value as FilterQuery['orientation'] }))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">Any orientation</option>
                    <option value="landscape">Landscape</option>
                    <option value="portrait">Portrait</option>
                    <option value="square">Square</option>
                  </select>
                </div>
                
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">From Date</label>
                    <input
                      type="date"
                      value={filterQuery.dateFrom || ''}
                      onChange={e => setFilterQuery(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">To Date</label>
                    <input
                      type="date"
                      value={filterQuery.dateTo || ''}
                      onChange={e => setFilterQuery(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                {/* Tags */}
                {Object.keys(tagsByCategory).length > 0 && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-2">Tags</label>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {Object.entries(tagsByCategory).map(([category, tags]) => (
                        <div key={category}>
                          <span className="text-xs text-zinc-500">{category}</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tags.map(tag => (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTag(tag.id)}
                                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                                  filterQuery.tags?.includes(tag.id)
                                    ? 'bg-cyan-600 text-white'
                                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                                }`}
                              >
                                {tag.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Preview Count */}
                <div className="pt-3 border-t border-zinc-700">
                  <div className="flex items-center gap-2 text-sm">
                    {previewLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-500"></div>
                        <span className="text-zinc-400">Counting matches...</span>
                      </>
                    ) : previewCount !== null ? (
                      <>
                        <span className="text-cyan-400 font-semibold">{previewCount}</span>
                        <span className="text-zinc-400">asset{previewCount !== 1 ? 's' : ''} match this filter</span>
                      </>
                    ) : (
                      <span className="text-zinc-500">Unable to preview</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || saving}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {editingFolder ? 'Save Changes' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-white mb-2">Delete Folder?</h3>
            <p className="text-zinc-400 mb-6">
              This will permanently delete this folder. Assets won&apos;t be affected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
