'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tag, Category } from '@/lib/types'

interface TagWithCategories extends Tag {
  dam_tag_categories?: { category_id: string }[]
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#6b7280'
]

export default function TagsPage() {
  const [tags, setTags] = useState<TagWithCategories[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tags' | 'categories'>('tags')
  
  // Tag form
  const [newTagLabel, setNewTagLabel] = useState('')
  const [newTagCategories, setNewTagCategories] = useState<string[]>([])
  
  // Category form
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#6b7280')
  
  // Edit modals
  const [editingTag, setEditingTag] = useState<TagWithCategories | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    
    // Load categories
    const { data: cats } = await supabase
      .from('dam_categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    
    // Load tags with their category associations
    const { data: tagsData } = await supabase
      .from('dam_tags')
      .select('*, dam_tag_categories(category_id)')
      .order('label', { ascending: true })
    
    setCategories(cats || [])
    setTags(tagsData || [])
    setLoading(false)
  }

  // === CATEGORY FUNCTIONS ===
  const addCategory = async () => {
    if (!newCategoryName.trim()) return
    
    const { error } = await supabase
      .from('dam_categories')
      .insert({ name: newCategoryName.trim(), color: newCategoryColor })
    
    if (!error) {
      setNewCategoryName('')
      setNewCategoryColor('#6b7280')
      loadData()
    }
  }

  const updateCategory = async () => {
    if (!editingCategory) return
    
    const { error } = await supabase
      .from('dam_categories')
      .update({ name: editingCategory.name, color: editingCategory.color })
      .eq('id', editingCategory.id)
    
    if (!error) {
      setEditingCategory(null)
      loadData()
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Tags will be unlinked but not deleted.')) return
    
    await supabase.from('dam_categories').delete().eq('id', id)
    loadData()
  }

  // === TAG FUNCTIONS ===
  const addTag = async () => {
    if (!newTagLabel.trim()) return
    
    // Create tag
    const { data: newTag, error } = await supabase
      .from('dam_tags')
      .insert({ label: newTagLabel.trim() })
      .select()
      .single()
    
    if (error || !newTag) return
    
    // Link to categories
    if (newTagCategories.length > 0) {
      await supabase.from('dam_tag_categories').insert(
        newTagCategories.map(catId => ({
          tag_id: newTag.id,
          category_id: catId
        }))
      )
    }
    
    setNewTagLabel('')
    setNewTagCategories([])
    loadData()
  }

  const updateTag = async () => {
    if (!editingTag) return
    
    // Update tag label
    await supabase
      .from('dam_tags')
      .update({ label: editingTag.label })
      .eq('id', editingTag.id)
    
    // Get current category IDs for this tag
    const currentCatIds = editingTag.dam_tag_categories?.map(tc => tc.category_id) || []
    const newCatIds = editingTag.categories?.map(c => c.id) || []
    
    // Remove old links
    const toRemove = currentCatIds.filter(id => !newCatIds.includes(id))
    if (toRemove.length > 0) {
      await supabase
        .from('dam_tag_categories')
        .delete()
        .eq('tag_id', editingTag.id)
        .in('category_id', toRemove)
    }
    
    // Add new links
    const toAdd = newCatIds.filter(id => !currentCatIds.includes(id))
    if (toAdd.length > 0) {
      await supabase.from('dam_tag_categories').insert(
        toAdd.map(catId => ({
          tag_id: editingTag.id,
          category_id: catId
        }))
      )
    }
    
    setEditingTag(null)
    loadData()
  }

  const deleteTag = async (id: string) => {
    if (!confirm('Delete this tag?')) return
    
    await supabase.from('dam_tags').delete().eq('id', id)
    setEditingTag(null)
    loadData()
  }

  // Get category names for a tag
  const getTagCategories = (tag: TagWithCategories): Category[] => {
    const catIds = tag.dam_tag_categories?.map(tc => tc.category_id) || []
    return categories.filter(c => catIds.includes(c.id))
  }

  // Group tags by category for display
  const tagsByCategory = () => {
    const grouped: Record<string, TagWithCategories[]> = { 'Uncategorized': [] }
    
    categories.forEach(cat => {
      grouped[cat.name] = []
    })
    
    tags.forEach(tag => {
      const tagCats = getTagCategories(tag)
      if (tagCats.length === 0) {
        grouped['Uncategorized'].push(tag)
      } else {
        tagCats.forEach(cat => {
          grouped[cat.name].push(tag)
        })
      }
    })
    
    return grouped
  }

  const toggleTagCategory = (catId: string) => {
    setNewTagCategories(prev => 
      prev.includes(catId) 
        ? prev.filter(id => id !== catId)
        : [...prev, catId]
    )
  }

  const toggleEditingTagCategory = (cat: Category) => {
    if (!editingTag) return
    
    const currentCats = editingTag.categories || []
    const hasCat = currentCats.some(c => c.id === cat.id)
    
    setEditingTag({
      ...editingTag,
      categories: hasCat 
        ? currentCats.filter(c => c.id !== cat.id)
        : [...currentCats, cat]
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Tags & Categories</h1>
        <p className="text-zinc-400 mt-1">Organize your assets with tags and categories</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg mb-6 w-fit">
        <button
          onClick={() => setActiveTab('tags')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'tags' 
              ? 'bg-zinc-700 text-white' 
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Tags ({tags.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'categories' 
              ? 'bg-zinc-700 text-white' 
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Categories ({categories.length})
        </button>
      </div>

      {/* === TAGS TAB === */}
      {activeTab === 'tags' && (
        <>
          {/* Add Tag Form */}
          <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 mb-6">
            <h3 className="font-medium text-white mb-3">Add New Tag</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Tag label"
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              
              {categories.length > 0 && (
                <div>
                  <label className="text-sm text-zinc-400 block mb-2">Categories (optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => toggleTagCategory(cat.id)}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          newTagCategories.includes(cat.id)
                            ? 'border-transparent text-white'
                            : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'
                        }`}
                        style={newTagCategories.includes(cat.id) ? { backgroundColor: cat.color } : {}}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <button
                onClick={addTag}
                disabled={!newTagLabel.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Tag
              </button>
            </div>
          </div>

          {/* Tags List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              No tags yet. Add your first tag above.
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(tagsByCategory()).map(([categoryName, categoryTags]) => (
                categoryTags.length > 0 && (
                  <div key={categoryName}>
                    <h3 className="text-sm font-medium text-zinc-500 uppercase mb-2 flex items-center gap-2">
                      {categoryName !== 'Uncategorized' && (
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: categories.find(c => c.name === categoryName)?.color }}
                        />
                      )}
                      {categoryName}
                      <span className="text-zinc-600">({categoryTags.length})</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {categoryTags.map(tag => (
                        <button
                          key={`${categoryName}-${tag.id}`}
                          onClick={() => setEditingTag({ ...tag, categories: getTagCategories(tag) })}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-full text-sm text-zinc-300 hover:border-zinc-500 hover:bg-zinc-750 transition-colors"
                        >
                          {tag.label}
                          <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </>
      )}

      {/* === CATEGORIES TAB === */}
      {activeTab === 'categories' && (
        <>
          {/* Add Category Form */}
          <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 mb-6">
            <h3 className="font-medium text-white mb-3">Add New Category</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-400">Color:</label>
                <div className="flex gap-1 flex-wrap">
                  {DEFAULT_COLORS.slice(0, 8).map(color => (
                    <button
                      key={color}
                      onClick={() => setNewCategoryColor(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        newCategoryColor === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              <button
                onClick={addCategory}
                disabled={!newCategoryName.trim()}
                className="w-full sm:w-auto px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          {/* Categories List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              No categories yet. Add your first category above.
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => {
                const tagCount = tags.filter(t => 
                  t.dam_tag_categories?.some(tc => tc.category_id === cat.id)
                ).length
                
                return (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 p-3 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
                  >
                    <span 
                      className="w-4 h-4 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 text-white">{cat.name}</span>
                    <span className="text-sm text-zinc-500">{tagCount} tags</span>
                    <button
                      onClick={() => setEditingCategory({ ...cat })}
                      className="p-1.5 text-zinc-400 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* === EDIT TAG MODAL === */}
      {editingTag && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-zinc-900 w-full sm:max-w-md sm:rounded-lg rounded-t-2xl border border-zinc-700">
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Edit Tag</h3>
              <button 
                onClick={() => setEditingTag(null)}
                className="text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Label</label>
                <input
                  type="text"
                  value={editingTag.label}
                  onChange={(e) => setEditingTag({ ...editingTag, label: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              
              {categories.length > 0 && (
                <div>
                  <label className="text-sm text-zinc-400 block mb-2">Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => {
                      const isSelected = editingTag.categories?.some(c => c.id === cat.id)
                      return (
                        <button
                          key={cat.id}
                          onClick={() => toggleEditingTagCategory(cat)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            isSelected
                              ? 'border-transparent text-white'
                              : 'border-zinc-600 text-zinc-400 hover:border-zinc-500'
                          }`}
                          style={isSelected ? { backgroundColor: cat.color } : {}}
                        >
                          {cat.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-700 flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
              <button
                onClick={() => deleteTag(editingTag.id)}
                className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                Delete Tag
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingTag(null)}
                  className="flex-1 sm:flex-none px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={updateTag}
                  className="flex-1 sm:flex-none px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === EDIT CATEGORY MODAL === */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-zinc-900 w-full sm:max-w-md sm:rounded-lg rounded-t-2xl border border-zinc-700">
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Edit Category</h3>
              <button 
                onClick={() => setEditingCategory(null)}
                className="text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Name</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="text-sm text-zinc-400 block mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {DEFAULT_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditingCategory({ ...editingCategory, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        editingCategory.color === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-zinc-700 flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
              <button
                onClick={() => deleteCategory(editingCategory.id)}
                className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                Delete Category
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingCategory(null)}
                  className="flex-1 sm:flex-none px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={updateCategory}
                  className="flex-1 sm:flex-none px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
