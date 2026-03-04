'use client'

import { useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'

interface Asset {
  id: string
  name: string
  original_path: string
  width: number | null
  height: number | null
  mime_type: string | null
}

interface DownloadOptionsProps {
  asset: Asset
  supabase: SupabaseClient
  currentUserId: string | null
}

type Format = 'original' | 'webp' | 'jpg' | 'png'
type SizePreset = 'original' | 'large' | 'medium' | 'small' | 'custom'

const SIZE_PRESETS: Record<SizePreset, { label: string; width?: number }> = {
  original: { label: 'Original' },
  large: { label: 'Large (1920px)', width: 1920 },
  medium: { label: 'Medium (1280px)', width: 1280 },
  small: { label: 'Small (640px)', width: 640 },
  custom: { label: 'Custom' },
}

export default function DownloadOptions({ asset, supabase, currentUserId }: DownloadOptionsProps) {
  const [format, setFormat] = useState<Format>('original')
  const [sizePreset, setSizePreset] = useState<SizePreset>('original')
  const [customWidth, setCustomWidth] = useState('')
  const [quality, setQuality] = useState(85)
  const [downloading, setDownloading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const getDownloadUrl = () => {
    // Get base URL
    const baseUrl = supabase.storage.from('dam-originals').getPublicUrl(asset.original_path).data.publicUrl
    
    // If no transforms needed, return original
    if (format === 'original' && sizePreset === 'original') {
      return baseUrl
    }

    // Build transform params for Supabase render endpoint
    // Supabase uses /render/image/... with query params
    const params = new URLSearchParams()
    
    // Size
    if (sizePreset === 'custom' && customWidth) {
      params.set('width', customWidth)
    } else if (sizePreset !== 'original' && SIZE_PRESETS[sizePreset].width) {
      params.set('width', String(SIZE_PRESETS[sizePreset].width))
    }
    
    // Format - Supabase uses 'format' param
    if (format !== 'original') {
      params.set('format', format)
    }
    
    // Quality (only for lossy formats)
    if ((format === 'webp' || format === 'jpg') && quality !== 85) {
      params.set('quality', String(quality))
    }

    // Construct render URL
    // Supabase transform URL format: /storage/v1/render/image/public/{bucket}/{path}?{params}
    const url = new URL(baseUrl)
    const pathParts = url.pathname.split('/object/public/')
    if (pathParts.length === 2) {
      url.pathname = `/storage/v1/render/image/public/${pathParts[1]}`
    }
    params.forEach((value, key) => url.searchParams.set(key, value))
    
    return url.toString()
  }

  const getFilename = () => {
    const baseName = asset.name.replace(/\.[^.]+$/, '')
    const ext = format === 'original' ? asset.name.split('.').pop() : format
    
    let suffix = ''
    if (sizePreset === 'custom' && customWidth) {
      suffix = `-${customWidth}w`
    } else if (sizePreset !== 'original' && SIZE_PRESETS[sizePreset].width) {
      suffix = `-${SIZE_PRESETS[sizePreset].width}w`
    }
    
    return `${baseName}${suffix}.${ext}`
  }

  const handleDownload = async () => {
    setDownloading(true)

    try {
      // Log download
      if (currentUserId) {
        const width = sizePreset === 'custom' ? parseInt(customWidth) || asset.width : 
                      SIZE_PRESETS[sizePreset].width || asset.width
        
        await supabase.from('dam_download_log').insert({
          asset_id: asset.id,
          user_id: currentUserId,
          format: format === 'original' ? (asset.mime_type || 'original') : `image/${format}`,
          width: width,
          height: asset.height && asset.width ? Math.round((width || asset.width) * (asset.height / asset.width)) : null,
          quality: format === 'webp' || format === 'jpg' ? quality : null
        })
      }

      // Get URL and trigger download
      const url = getDownloadUrl()
      const filename = getFilename()

      // Fetch and download (to handle CORS and set filename)
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)

    } catch (error) {
      console.error('Download error:', error)
      // Fallback to direct link
      const url = getDownloadUrl()
      window.open(url, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">Download</span>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-cyan-400 hover:text-cyan-300"
        >
          {showAdvanced ? 'Simple' : 'Options'}
        </button>
      </div>

      {showAdvanced ? (
        <div className="space-y-3 p-3 bg-zinc-800 rounded-lg">
          {/* Format Selection */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Format</label>
            <div className="grid grid-cols-4 gap-1">
              {(['original', 'webp', 'jpg', 'png'] as Format[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-2 py-1.5 text-xs rounded ${
                    format === f
                      ? 'bg-cyan-600 text-white'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  {f === 'original' ? 'Original' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Size</label>
            <select
              value={sizePreset}
              onChange={(e) => setSizePreset(e.target.value as SizePreset)}
              className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm"
            >
              {Object.entries(SIZE_PRESETS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            
            {sizePreset === 'custom' && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Width"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm"
                  min="100"
                  max="4096"
                />
                <span className="text-zinc-500 text-sm">px</span>
              </div>
            )}
          </div>

          {/* Quality (only for WebP/JPG) */}
          {(format === 'webp' || format === 'jpg') && (
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">
                Quality: {quality}%
              </label>
              <input
                type="range"
                min="20"
                max="100"
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={downloading || (sizePreset === 'custom' && !customWidth)}
            className="w-full py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 font-medium flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download {format !== 'original' ? format.toUpperCase() : ''}
              </>
            )}
          </button>
        </div>
      ) : (
        /* Quick Download Buttons */
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => { setFormat('original'); setSizePreset('original'); handleDownload() }}
            disabled={downloading}
            className="px-3 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 font-medium text-sm disabled:opacity-50"
          >
            Original
          </button>
          <button
            onClick={() => { setFormat('webp'); setSizePreset('original'); setTimeout(handleDownload, 0) }}
            disabled={downloading}
            className="px-3 py-2.5 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 font-medium text-sm disabled:opacity-50"
          >
            WebP
          </button>
          <button
            onClick={() => { setFormat('jpg'); setSizePreset('original'); setTimeout(handleDownload, 0) }}
            disabled={downloading}
            className="px-3 py-2.5 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 font-medium text-sm disabled:opacity-50"
          >
            JPG
          </button>
        </div>
      )}
    </div>
  )
}
