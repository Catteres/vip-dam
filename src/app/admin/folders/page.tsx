'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tag } from '@/lib/types'

interface HierarchicalFolder {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  filter_query: FilterQuery
  sort_order: number
  created_at: string
  children?: HierarchicalFolder[]
}

interface FilterQuery {
  search?: string
  tags?: string[]
  orientation?: 'landscape' | 'portrait' | 'square' | ''
  dateFrom?: string
  dateTo?: string
}

export default function FoldersPage() {
  const [folders, setFolders] = useState<HierarchicalFolder[]>([])
  const [folderTree, setFolderTree] = useState<HierarchicalFolder[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Expanded folders in tree view
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFolder, setEditingFolder] = useState<HierarchicalFolder | null>(null)
  const [parentFolder, setParentFolder] = useState<HierarchicalFolder | null>(null)
  
  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
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
  const [deleteFolder, setDeleteFolder] = useState<HierarchicalFolder | null>(null)
  
  const supabase = createClient()

  // Build tree structure from flat list
  const buildTree = (items: HierarchicalFolder[], parentId: string | null = null): HierarchicalFolder[] => {
    return items
      .filter(item => item.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map(item => ({
        ...item,
        children: buildTree(items, item.id)
      }))
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setFolderTree(buildTree(folders))
  }, [folders])

  const loadData = async () => {
    setLoading(true)
    
    // Load folders
    const { data: foldersData } = await supabase
      .from('dam_folders')
      .select('*')
      .order('sort_order')
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

  const toggleExpanded = (folderId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }

  const openCreateModal = (parent: HierarchicalFolder | null = null) => {
    setEditingFolder(null)
    setParentFolder(parent)
    setName('')
    setDescription('')
    setSelectedParentId(parent?.id || null)
    setFilterQuery({ search: '', tags: [], orientation: '', dateFrom: '', dateTo: '' })
    setPreviewCount(null)
    setIsModalOpen(true)
  }

  const openEditModal = (folder: HierarchicalFolder) => {
    setEditingFolder(folder)
    setParentFolder(null)
    setName(folder.name)
    setDescription(folder.description || '')
    setSelectedParentId(folder.parent_id)
    setFilterQuery(folder.filter_query || { search: '', tags: [], orientation: '', dateFrom: '', dateTo: '' })
    setPreviewCount(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingFolder(null)
    setParentFolder(null)
  }

  // Check if filter has any criteria
  const hasFilters = (fq: FilterQuery): boolean => {
    return !!(fq.search?.trim() || fq.tags?.length || fq.orientation || fq.dateFrom || fq.dateTo)
  }

  // Count matching assets for preview
  const countMatchingAssets = useCallback(async () => {
    if (!hasFilters(filterQuery)) {
      setPreviewCount(null)
      return
    }
    
    setPreviewLoading(true)
    
    try {
      let query = supabase.from('dam_assets').select('id', { count: 'exact', head: true })
      
      if (filterQuery.dateFrom) {
        query = query.gte('created_at', filterQuery.dateFrom)
      }
      if (filterQuery.dateTo) {
        query = query.lte('created_at', filterQuery.dateTo + 'T23:59:59')
      }
      if (filterQuery.orientation) {
        query = query.eq('orientation', filterQuery.orientation)
      }
      
      const { count: basicCount, error } = await query
      
      if (error) {
        setPreviewCount(null)
        return
      }
      
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
          if (filterQuery.search) {
            const searchLower = filterQuery.search.toLowerCase()
            const nameMatch = asset.name.toLowerCase().includes(searchLower)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tagMatch = (asset.dam_asset_tags || []).some((at: any) => 
              at.tag?.label?.toLowerCase().includes(searchLower)
            )
            if (!nameMatch && !tagMatch) return false
          }
          
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isModalOpen && hasFilters(filterQuery)) {
        countMatchingAssets()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [filterQuery, isModalOpen, countMatchingAssets])

  const handleSave = async () => {
    if (!name.trim()) return
    
    setSaving(true)
    
    const cleanedFilter: FilterQuery = {}
    if (filterQuery.search?.trim()) cleanedFilter.search = filterQuery.search.trim()
    if (filterQuery.tags?.length) cleanedFilter.tags = filterQuery.tags
    if (filterQuery.orientation) cleanedFilter.orientation = filterQuery.orientation
    if (filterQuery.dateFrom) cleanedFilter.dateFrom = filterQuery.dateFrom
    if (filterQuery.dateTo) cleanedFilter.dateTo = filterQuery.dateTo
    
    if (editingFolder) {
      const { error } = await supabase
        .from('dam_folders')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          parent_id: selectedParentId,
          filter_query: cleanedFilter
        })
        .eq('id', editingFolder.id)
      
      if (error) {
        console.error('Error updating folder:', error)
        alert('Failed to update folder')
      }
    } else {
      const { error } = await supabase
        .from('dam_folders')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          parent_id: selectedParentId,
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
    setDeleteFolder(null)
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

  const tagsByCategory = allTags.reduce((acc, tag) => {
    const cat = tag.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tag)
    return acc
  }, {} as Record<string, Tag[]>)

  const getFilterSummary = (folder: HierarchicalFolder) => {
    const fq = folder.filter_query
    if (!fq || !hasFilters(fq)) return null
    
    const parts: string[] = []
    if (fq.tags?.length) {
      const tagLabels = fq.tags.map(id => allTags.find(t => t.id === id)?.label).filter(Boolean)
      parts.push(tagLabels.join(', '))
    }
    if (fq.search) parts.push(`"${fq.search}"`)
    if (fq.orientation) parts.push(fq.orientation)
    return parts.join(' • ')
  }

  // Get all possible parent folders (excluding self and descendants)
  const getAvailableParents = (excludeId?: string): HierarchicalFolder[] => {
    if (!excludeId) return folders
    
    const getDescendantIds = (parentId: string): string[] => {
      const children = folders.filter(f => f.parent_id === parentId)
      return [parentId, ...children.flatMap(c => getDescendantIds(c.id))]
    }
    
    const excludeIds = new Set(getDescendantIds(excludeId))
    return folders.filter(f => !excludeIds.has(f.id))
  }

  // Render folder tree item
  const renderFolderItem = (folder: HierarchicalFolder, depth: number = 0) => {
    const hasChildren = folder.children && folder.children.length > 0
    const isExpanded = expandedIds.has(folder.id)
    const filterSummary = getFilterSummary(folder)
    const isLeaf = !hasChildren && hasFilters(folder.filter_query)
    
    return (
      <div key={folder.id}>
        <div 
          className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-zinc-800 group transition-colors ${
            depth > 0 ? 'ml-6' : ''
          }`}
        >
          {/* Expand/collapse button */}
          <button
            onClick={() => hasChildren && toggleExpanded(folder.id)}
            className={`w-5 h-5 flex items-center justify-center text-zinc-500 ${
              hasChildren ? 'hover:text-white cursor-pointer' : 'opacity-0'
            }`}
          >
            {hasChildren && (
              <svg 
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
          
          {/* Folder icon */}
          <span className="text-xl">
            {isLeaf ? '📄' : hasChildren && isExpanded ? '📂' : '📁'}
          </span>
          
          {/* Folder name and info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white truncate">{folder.name}</span>
              {filterSummary && (
                <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full truncate max-w-48">
                  {filterSummary}
                </span>
              )}
              {!filterSummary && !hasChildren && (
                <span className="text-xs text-zinc-500">(empty)</span>
              )}
            </div>
            {folder.description && (
              <p className="text-xs text-zinc-500 truncate">{folder.description}</p>
            )}
          </div>
          
          {/* Actions - always visible on mobile, hover on desktop */}
          <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => openCreateModal(folder)}
              className="p-1.5 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-700 rounded"
              title="Add subfolder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
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
              onClick={() => { setDeleteId(folder.id); setDeleteFolder(folder) }}
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l border-zinc-800 ml-5">
            {folder.children!.map(child => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // Get folder path for display
  const getFolderPath = (folderId: string | null): string => {
    if (!folderId) return ''
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return ''
    const parentPath = getFolderPath(folder.parent_id)
    return parentPath ? `${parentPath} / ${folder.name}` : folder.name
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Folders</h1>
          <p className="text-zinc-400 mt-1">Organize assets with hierarchical folders</p>
        </div>
        <button
          onClick={() => openCreateModal(null)}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Folder
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
          <p className="text-zinc-400 mb-4">Create a folder hierarchy to organize your assets</p>
          <button
            onClick={() => openCreateModal(null)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
          >
            Create Your First Folder
          </button>
        </div>
      )}

      {!loading && folders.length > 0 && (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-2">
          {folderTree.map(folder => renderFolderItem(folder))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-zinc-800">
              <h2 className="text-xl font-bold text-white">
                {editingFolder ? 'Edit Folder' : parentFolder ? `New Subfolder in "${parentFolder.name}"` : 'New Folder'}
              </h2>
              {selectedParentId && !editingFolder && (
                <p className="text-sm text-zinc-400 mt-1">
                  Path: {getFolderPath(selectedParentId)}
                </p>
              )}
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
                  placeholder="e.g., New York"
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              
              {/* Parent Folder (for editing) */}
              {editingFolder && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Parent Folder
                  </label>
                  <select
                    value={selectedParentId || ''}
                    onChange={e => setSelectedParentId(e.target.value || null)}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">None (Root Level)</option>
                    {getAvailableParents(editingFolder.id).map(f => (
                      <option key={f.id} value={f.id}>
                        {getFolderPath(f.id) || f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
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
                  Asset Filters
                  <span className="text-xs text-zinc-500 font-normal">(leave empty for navigation-only folder)</span>
                </h3>
                
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
                
                {/* Preview Count */}
                {hasFilters(filterQuery) && (
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
                      ) : null}
                    </div>
                  </div>
                )}
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
      {deleteId && deleteFolder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-white mb-2">Delete Folder?</h3>
            <p className="text-zinc-400 mb-4">
              This will permanently delete &quot;{deleteFolder.name}&quot;
              {deleteFolder.children && deleteFolder.children.length > 0 && (
                <span className="text-red-400"> and all {deleteFolder.children.length} subfolder(s)</span>
              )}
              . Assets won&apos;t be affected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setDeleteId(null); setDeleteFolder(null) }}
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
