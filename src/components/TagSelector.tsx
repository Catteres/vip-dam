'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Tag {
  id: string
  label: string
  category: string | null
}

interface Category {
  id: string
  name: string
  color: string
  sort_order: number
}

interface TagWithCategory extends Tag {
  categories: Category[]
}

interface Props {
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  className?: string
  compact?: boolean  // For inline use in upload queue
}

export default function TagSelector({ selectedTagIds, onChange, className = '', compact = false }: Props) {
  const [tags, setTags] = useState<TagWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isExpanded, setIsExpanded] = useState(!compact)
  
  const supabase = createClient()

  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    setLoading(true)
    
    // Load categories
    const { data: categoriesData } = await supabase
      .from('dam_categories')
      .select('*')
      .order('sort_order')
    
    // Load tags
    const { data: tagsData } = await supabase
      .from('dam_tags')
      .select('*')
      .order('label')
    
    // Load junction table
    const { data: junctionData } = await supabase
      .from('dam_tag_categories')
      .select('tag_id, category_id')
    
    // Build tag-to-categories map
    const tagCategories = new Map<string, string[]>()
    junctionData?.forEach(j => {
      const existing = tagCategories.get(j.tag_id) || []
      tagCategories.set(j.tag_id, [...existing, j.category_id])
    })
    
    // Enrich tags with their categories
    const categoriesById = new Map(categoriesData?.map(c => [c.id, c]) || [])
    const enrichedTags: TagWithCategory[] = (tagsData || []).map(tag => ({
      ...tag,
      categories: (tagCategories.get(tag.id) || [])
        .map(catId => categoriesById.get(catId))
        .filter(Boolean) as Category[]
    }))
    
    setCategories(categoriesData || [])
    setTags(enrichedTags)
    setLoading(false)
  }

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags
    const query = searchQuery.toLowerCase()
    return tags.filter(tag => 
      tag.label.toLowerCase().includes(query) ||
      tag.categories.some(c => c.name.toLowerCase().includes(query))
    )
  }, [tags, searchQuery])

  // Group tags by their primary category (first one) or 'Other'
  const tagsByCategory = useMemo(() => {
    const grouped: Record<string, TagWithCategory[]> = {}
    
    // Initialize with categories in order
    categories.forEach(cat => {
      grouped[cat.name] = []
    })
    grouped['Other'] = []
    
    filteredTags.forEach(tag => {
      const primaryCategory = tag.categories[0]?.name || 'Other'
      if (!grouped[primaryCategory]) grouped[primaryCategory] = []
      grouped[primaryCategory].push(tag)
    })
    
    // Remove empty categories
    return Object.fromEntries(
      Object.entries(grouped).filter(([, tags]) => tags.length > 0)
    )
  }, [filteredTags, categories])

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  const getCategoryColor = (categoryName: string): string => {
    const category = categories.find(c => c.name === categoryName)
    return category?.color || '#71717a' // zinc-500 fallback
  }

  // Get selected tag objects for display
  const selectedTags = useMemo(() => {
    return tags.filter(t => selectedTagIds.includes(t.id))
  }, [tags, selectedTagIds])

  if (loading) {
    return (
      <div className={`text-zinc-500 text-sm ${className}`}>
        Loading tags...
      </div>
    )
  }

  // Compact mode for upload queue
  if (compact) {
    return (
      <div className={className}>
        {/* Selected tags pill display */}
        {selectedTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selectedTags.map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-cyan-600/30 text-cyan-300"
              >
                {tag.categories[0] && (
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: tag.categories[0].color }}
                  />
                )}
                {tag.label}
                <button
                  onClick={() => toggleTag(tag.id)}
                  className="hover:text-white ml-0.5"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        
        {/* Toggle button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
        >
          <svg 
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {isExpanded ? 'Hide tags' : `Add tags${selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}`}
        </button>
        
        {isExpanded && (
          <div className="mt-2 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            {/* Search */}
            <input
              type="text"
              placeholder="Search tags..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-xs placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent mb-2"
            />
            
            {/* Tags by category */}
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {Object.entries(tagsByCategory).map(([categoryName, categoryTags]) => (
                <div key={categoryName}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: getCategoryColor(categoryName) }}
                    />
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{categoryName}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {categoryTags.map(tag => {
                      const isSelected = selectedTagIds.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTag(tag.id)}
                          className={`
                            px-2 py-0.5 text-xs rounded-full transition-colors
                            ${isSelected
                              ? 'bg-cyan-600 text-white'
                              : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                            }
                          `}
                        >
                          {tag.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Full mode for modal
  return (
    <div className={className}>
      {/* Search */}
      <input
        type="text"
        placeholder="Search tags..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent mb-3"
      />
      
      {/* Tags grouped by category */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {Object.entries(tagsByCategory).map(([categoryName, categoryTags]) => (
          <div key={categoryName}>
            <div className="flex items-center gap-2 mb-1.5">
              <span 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: getCategoryColor(categoryName) }}
              />
              <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
                {categoryName}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categoryTags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`
                      px-2.5 py-1 text-xs rounded-full transition-colors
                      ${isSelected
                        ? 'bg-cyan-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }
                    `}
                  >
                    {tag.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        
        {Object.keys(tagsByCategory).length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-4">
            {searchQuery ? 'No tags found' : 'No tags available'}
          </p>
        )}
      </div>
    </div>
  )
}
