'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface HierarchicalFolder {
  id: string
  name: string
  description: string | null
  parent_id: string | null
  filter_query: FilterQuery | null
  sort_order: number
  children?: HierarchicalFolder[]
}

interface FilterQuery {
  search?: string
  tags?: string[]
  orientation?: 'landscape' | 'portrait' | 'square' | ''
  dateFrom?: string
  dateTo?: string
}

interface FolderNavProps {
  currentFolderId: string | null
  onFolderSelect: (folder: HierarchicalFolder | null) => void
}

export default function FolderNav({ currentFolderId, onFolderSelect }: FolderNavProps) {
  const [folders, setFolders] = useState<HierarchicalFolder[]>([])
  const [folderTree, setFolderTree] = useState<HierarchicalFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  
  const supabase = createClient()

  // Build tree structure from flat list
  const buildTree = useCallback((items: HierarchicalFolder[], parentId: string | null = null): HierarchicalFolder[] => {
    return items
      .filter(item => item.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map(item => ({
        ...item,
        children: buildTree(items, item.id)
      }))
  }, [])

  // Check if folder has filters (is a "leaf" that shows assets)
  const hasFilters = (fq: FilterQuery | null): boolean => {
    if (!fq) return false
    return !!(fq.search?.trim() || fq.tags?.length || fq.orientation || fq.dateFrom || fq.dateTo)
  }

  // Load folders
  useEffect(() => {
    const loadFolders = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('dam_folders')
        .select('*')
        .order('sort_order')
        .order('name')
      
      setFolders(data || [])
      setLoading(false)
    }
    loadFolders()
  }, [supabase])

  // Build tree when folders change
  useEffect(() => {
    setFolderTree(buildTree(folders))
  }, [folders, buildTree])

  // Auto-expand path to current folder
  useEffect(() => {
    if (currentFolderId && folders.length > 0) {
      const pathIds = new Set<string>()
      let current = folders.find(f => f.id === currentFolderId)
      while (current) {
        if (current.parent_id) {
          pathIds.add(current.parent_id)
        }
        current = folders.find(f => f.id === current?.parent_id)
      }
      setExpandedIds(prev => new Set([...prev, ...pathIds]))
    }
  }, [currentFolderId, folders])

  const toggleExpanded = (folderId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
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

  // Get breadcrumb path for current folder
  const getBreadcrumbs = (): HierarchicalFolder[] => {
    if (!currentFolderId) return []
    const path: HierarchicalFolder[] = []
    let current = folders.find(f => f.id === currentFolderId)
    while (current) {
      path.unshift(current)
      current = folders.find(f => f.id === current?.parent_id)
    }
    return path
  }

  const renderFolderItem = (folder: HierarchicalFolder, depth: number = 0) => {
    const hasChildren = folder.children && folder.children.length > 0
    const isExpanded = expandedIds.has(folder.id)
    const isSelected = folder.id === currentFolderId
    const isLeaf = hasFilters(folder.filter_query)
    
    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
            isSelected
              ? 'bg-cyan-600/20 text-cyan-400'
              : 'hover:bg-zinc-800 text-zinc-300'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (isLeaf) {
              onFolderSelect(folder)
            } else if (hasChildren) {
              toggleExpanded(folder.id, { preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent)
            }
          }}
        >
          {/* Expand/collapse */}
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpanded(folder.id, e)}
              className="w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-white"
            >
              <svg 
                className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <span className="w-4" />
          )}
          
          {/* Icon */}
          <span className="text-sm">
            {isLeaf ? '📄' : hasChildren && isExpanded ? '📂' : '📁'}
          </span>
          
          {/* Name */}
          <span className={`text-sm truncate ${isSelected ? 'font-medium' : ''}`}>
            {folder.name}
          </span>
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {folder.children!.map(child => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const breadcrumbs = getBreadcrumbs()

  if (loading) {
    return (
      <div className="p-3">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-zinc-800 rounded w-3/4"></div>
          <div className="h-4 bg-zinc-800 rounded w-1/2 ml-4"></div>
          <div className="h-4 bg-zinc-800 rounded w-2/3 ml-4"></div>
        </div>
      </div>
    )
  }

  if (folders.length === 0) {
    return (
      <div className="p-3 text-center">
        <p className="text-zinc-500 text-sm">No folders yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="p-2 border-b border-zinc-800">
          <div className="flex items-center gap-1 text-xs text-zinc-400 flex-wrap">
            <button
              onClick={() => onFolderSelect(null)}
              className="hover:text-white"
            >
              All
            </button>
            {breadcrumbs.map((folder, idx) => (
              <span key={folder.id} className="flex items-center gap-1">
                <span className="text-zinc-600">/</span>
                {idx === breadcrumbs.length - 1 ? (
                  <span className="text-cyan-400">{folder.name}</span>
                ) : (
                  <button
                    onClick={() => {
                      // Navigate to this folder (expand to show children)
                      setExpandedIds(prev => new Set([...prev, folder.id]))
                    }}
                    className="hover:text-white"
                  >
                    {folder.name}
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Folder tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* All assets link */}
        <div
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer transition-colors mb-1 ${
            !currentFolderId
              ? 'bg-cyan-600/20 text-cyan-400'
              : 'hover:bg-zinc-800 text-zinc-300'
          }`}
          onClick={() => onFolderSelect(null)}
        >
          <span className="w-4" />
          <span className="text-sm">🏠</span>
          <span className={`text-sm ${!currentFolderId ? 'font-medium' : ''}`}>All Assets</span>
        </div>
        
        {/* Folder tree */}
        {folderTree.map(folder => renderFolderItem(folder))}
      </div>
    </div>
  )
}
