'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUpload } from '@/context/UploadContext'
import TagSelector from '@/components/TagSelector'

interface UploadingFile {
  id: string
  file: File
  preview: string
  progress: number
  status: 'pending' | 'uploading' | 'complete' | 'error'
  error?: string
  assetId?: string
  selectedTagIds: string[]
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadingFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [globalTags, setGlobalTags] = useState<string[]>([])  // Tags to apply to all new uploads
  const { setIsUploading } = useUpload()
  const supabase = createClient()

  // Track if any file is currently uploading
  const uploadingCount = useMemo(() => files.filter(f => f.status === 'uploading').length, [files])
  
  useEffect(() => {
    setIsUploading(uploadingCount > 0)
  }, [uploadingCount, setIsUploading])

  // Clean up previews on unmount
  useEffect(() => {
    return () => {
      files.forEach(f => URL.revokeObjectURL(f.preview))
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      f.type.startsWith('image/')
    )
    addFiles(droppedFiles)
  }, [globalTags])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(f => 
        f.type.startsWith('image/')
      )
      addFiles(selectedFiles)
    }
  }, [globalTags])

  const addFiles = (newFiles: File[]) => {
    const uploadingFiles: UploadingFile[] = newFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'pending',
      selectedTagIds: [...globalTags]  // Copy global tags to each file
    }))
    setFiles(prev => [...prev, ...uploadingFiles])
  }

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter(f => f.id !== id)
    })
  }

  const updateFileTags = (fileId: string, tagIds: string[]) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, selectedTagIds: tagIds } : f
    ))
  }

  const uploadFile = async (uploadingFile: UploadingFile) => {
    const { file, id, selectedTagIds } = uploadingFile
    
    // Update status to uploading
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, status: 'uploading' as const } : f
    ))

    try {
      // Generate unique filename
      const ext = file.name.split('.').pop()
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(7)
      const filePath = `${timestamp}-${randomId}.${ext}`

      // Upload to dam-originals bucket
      const { error: uploadError } = await supabase.storage
        .from('dam-originals')
        .upload(filePath, file)

      if (uploadError) {
        throw new Error(`Storage: ${uploadError.message}`)
      }

      // Generate and upload WebP thumbnail to dam-previews
      const previewPath = filePath.replace(/\.[^.]+$/, '.webp')
      try {
        const thumbnail = await generateThumbnail(file)
        await supabase.storage
          .from('dam-previews')
          .upload(previewPath, thumbnail, { contentType: 'image/webp' })
      } catch (thumbError) {
        console.warn('Thumbnail generation failed, will use transform fallback:', thumbError)
      }

      // Get image dimensions
      const dimensions = await getImageDimensions(file)
      
      // Determine orientation
      let orientation: 'landscape' | 'portrait' | 'square' = 'square'
      if (dimensions.width > dimensions.height) orientation = 'landscape'
      else if (dimensions.height > dimensions.width) orientation = 'portrait'

      // Create database record
      const { data: asset, error: dbError } = await supabase
        .from('dam_assets')
        .insert({
          name: file.name,
          original_path: filePath,
          width: dimensions.width,
          height: dimensions.height,
          file_size_bytes: file.size,
          mime_type: file.type,
          orientation,
          processing_status: 'completed'
        })
        .select()
        .single()

      if (dbError) {
        throw new Error(`Database: ${dbError.message}`)
      }

      // Insert asset tags if any were selected
      if (selectedTagIds.length > 0) {
        const tagInserts = selectedTagIds.map(tagId => ({
          asset_id: asset.id,
          tag_id: tagId,
          source: 'manual' as const
        }))
        
        const { error: tagsError } = await supabase
          .from('dam_asset_tags')
          .insert(tagInserts)
        
        if (tagsError) {
          console.warn('Failed to insert tags:', tagsError)
          // Don't fail the whole upload for tag errors
        }
      }

      // Update status to complete
      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, status: 'complete' as const, progress: 100, assetId: asset.id } : f
      ))

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Upload error:', errorMessage)
      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, status: 'error' as const, error: errorMessage } : f
      ))
    }
  }

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.width, height: img.height })
        URL.revokeObjectURL(img.src)
      }
      img.onerror = () => {
        resolve({ width: 0, height: 0 })
      }
      img.src = URL.createObjectURL(file)
    })
  }

  // Generate WebP thumbnail for fast library browsing
  const generateThumbnail = (file: File, maxSize = 800): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        
        // Scale down if larger than maxSize
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width)
            width = maxSize
          } else {
            width = Math.round((width * maxSize) / height)
            height = maxSize
          }
        }
        
        canvas.width = width
        canvas.height = height
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas not supported'))
          return
        }
        
        ctx.drawImage(img, 0, 0, width, height)
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to create thumbnail'))
          },
          'image/webp',
          0.85 // Good quality, small size
        )
        
        URL.revokeObjectURL(img.src)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  const uploadAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending')
    for (const file of pendingFiles) {
      await uploadFile(file)
    }
  }

  const clearCompleted = () => {
    setFiles(prev => {
      prev.filter(f => f.status === 'complete').forEach(f => URL.revokeObjectURL(f.preview))
      return prev.filter(f => f.status !== 'complete')
    })
  }

  // Apply global tags to all pending files
  const applyGlobalTagsToPending = () => {
    setFiles(prev => prev.map(f => 
      f.status === 'pending' 
        ? { ...f, selectedTagIds: [...new Set([...f.selectedTagIds, ...globalTags])] }
        : f
    ))
  }

  const pendingCount = files.filter(f => f.status === 'pending').length
  const completedCount = files.filter(f => f.status === 'complete').length
  const errorCount = files.filter(f => f.status === 'error').length

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Upload Assets</h1>
        <p className="text-zinc-400 text-sm mt-1">Drag and drop images or click to select</p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-6 sm:p-12 text-center transition-colors
          ${isDragging 
            ? 'border-cyan-500 bg-cyan-500/10' 
            : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
          }
        `}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <div className="text-zinc-500 mb-4">
            <svg className="mx-auto h-10 w-10 sm:h-12 sm:w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-base sm:text-lg font-medium text-zinc-300">
            {isDragging ? 'Drop images here' : 'Tap to select or drop images'}
          </p>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">PNG, JPG, WEBP up to 50MB each</p>
        </label>
      </div>

      {/* Global Tags for new uploads */}
      <div className="mt-6 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-300">Default Tags for New Uploads</h3>
          {globalTags.length > 0 && pendingCount > 0 && (
            <button
              onClick={applyGlobalTagsToPending}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Apply to {pendingCount} pending
            </button>
          )}
        </div>
        <TagSelector
          selectedTagIds={globalTags}
          onChange={setGlobalTags}
          compact
        />
      </div>

      {/* Upload Queue */}
      {files.length > 0 && (
        <div className="mt-6 sm:mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-white">
              Upload Queue ({files.length} files)
              {errorCount > 0 && (
                <span className="ml-2 text-sm text-red-400">({errorCount} failed)</span>
              )}
            </h2>
            <div className="flex gap-2">
              {completedCount > 0 && (
                <button
                  onClick={clearCompleted}
                  className="px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Clear
                </button>
              )}
              {pendingCount > 0 && uploadingCount === 0 && (
                <button
                  onClick={uploadAll}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 text-sm font-medium"
                >
                  Upload All ({pendingCount})
                </button>
              )}
              {uploadingCount > 0 && (
                <span className="px-3 py-2 bg-zinc-700 text-cyan-400 rounded-lg text-sm font-medium flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading...
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {files.map((uploadingFile) => (
              <div
                key={uploadingFile.id}
                className="p-3 sm:p-4 bg-zinc-800 rounded-lg border border-zinc-700"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Thumbnail */}
                  <div className="w-14 h-14 bg-zinc-700 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={uploadingFile.preview}
                      alt={uploadingFile.file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">
                      {uploadingFile.file.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {uploadingFile.status === 'error' && uploadingFile.error && (
                      <p className="text-xs text-red-400 mt-1 truncate" title={uploadingFile.error}>
                        {uploadingFile.error}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {uploadingFile.status === 'pending' && (
                      <>
                        <span className="px-2 py-1 text-xs bg-zinc-700 text-zinc-400 rounded">
                          Pending
                        </span>
                        <button
                          onClick={() => removeFile(uploadingFile.id)}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                    {uploadingFile.status === 'uploading' && (
                      <span className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Uploading
                      </span>
                    )}
                    {uploadingFile.status === 'complete' && (
                      <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded">
                        ✓ Complete
                      </span>
                    )}
                    {uploadingFile.status === 'error' && (
                      <>
                        <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded">
                          ✕ Error
                        </span>
                        <button
                          onClick={() => removeFile(uploadingFile.id)}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Per-file tag selector (only for pending files) */}
                {uploadingFile.status === 'pending' && (
                  <div className="mt-3 pt-3 border-t border-zinc-700">
                    <TagSelector
                      selectedTagIds={uploadingFile.selectedTagIds}
                      onChange={(tagIds) => updateFileTags(uploadingFile.id, tagIds)}
                      compact
                    />
                  </div>
                )}

                {/* Show selected tags for non-pending files */}
                {uploadingFile.status !== 'pending' && uploadingFile.selectedTagIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {uploadingFile.selectedTagIds.length} tag{uploadingFile.selectedTagIds.length !== 1 ? 's' : ''} applied
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
