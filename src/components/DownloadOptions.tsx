'use client'

import { useState, useCallback } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'
import Cropper, { Area } from 'react-easy-crop'
import BackgroundRemover from './BackgroundRemover'

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
type AspectPreset = 'free' | '1:1' | '4:5' | '16:9' | '9:16' | '4:3' | '3:2'

const SIZE_PRESETS: Record<SizePreset, { label: string; width?: number }> = {
  original: { label: 'Original' },
  large: { label: 'Large (1920px)', width: 1920 },
  medium: { label: 'Medium (1280px)', width: 1280 },
  small: { label: 'Small (640px)', width: 640 },
  custom: { label: 'Custom' },
}

const ASPECT_PRESETS: Record<AspectPreset, { label: string; value?: number }> = {
  'free': { label: 'Free' },
  '1:1': { label: '1:1 Square', value: 1 },
  '4:5': { label: '4:5 Portrait', value: 4/5 },
  '16:9': { label: '16:9 Wide', value: 16/9 },
  '9:16': { label: '9:16 Story', value: 9/16 },
  '4:3': { label: '4:3', value: 4/3 },
  '3:2': { label: '3:2', value: 3/2 },
}

// Helper function to draw rounded rectangle path
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

// Helper to crop image using canvas
async function getCroppedImg(
  imageSrc: string, 
  pixelCrop: Area, 
  format: string = 'image/jpeg',
  borderRadius: number = 0
): Promise<Blob> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
    image.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2d context')

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // Apply rounded corners if specified (only makes sense for PNG with transparency)
  if (borderRadius > 0) {
    // Clear with transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Create clipping path with rounded corners
    roundedRect(ctx, 0, 0, pixelCrop.width, pixelCrop.height, borderRadius)
    ctx.clip()
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob failed'))
      },
      format,
      0.92
    )
  })
}

export default function DownloadOptions({ asset, supabase, currentUserId }: DownloadOptionsProps) {
  const [format, setFormat] = useState<Format>('original')
  const [sizePreset, setSizePreset] = useState<SizePreset>('original')
  const [customWidth, setCustomWidth] = useState('')
  const [quality, setQuality] = useState(85)
  const [downloading, setDownloading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Crop state
  const [showCropper, setShowCropper] = useState(false)
  const [showBgRemover, setShowBgRemover] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>('1:1')
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [borderRadius, setBorderRadius] = useState(0) // 0 = no rounding, up to 50 = full circle for square

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const getImageUrl = () => {
    return supabase.storage.from('dam-originals').getPublicUrl(asset.original_path).data.publicUrl
  }

  const getDownloadUrl = () => {
    const baseUrl = getImageUrl()
    
    if (format === 'original' && sizePreset === 'original') {
      return baseUrl
    }

    const params = new URLSearchParams()
    
    if (sizePreset === 'custom' && customWidth) {
      params.set('width', customWidth)
    } else if (sizePreset !== 'original' && SIZE_PRESETS[sizePreset].width) {
      params.set('width', String(SIZE_PRESETS[sizePreset].width))
    }
    
    if (format !== 'original') {
      params.set('format', format)
    }
    
    if ((format === 'webp' || format === 'jpg') && quality !== 85) {
      params.set('quality', String(quality))
    }

    const url = new URL(baseUrl)
    const pathParts = url.pathname.split('/object/public/')
    if (pathParts.length === 2) {
      url.pathname = `/storage/v1/render/image/public/${pathParts[1]}`
    }
    params.forEach((value, key) => url.searchParams.set(key, value))
    
    return url.toString()
  }

  const getFilename = (cropped = false, formatOverride?: string) => {
    const baseName = asset.name.replace(/\.[^.]+$/, '')
    const useFormat = formatOverride || format
    const ext = useFormat === 'original' ? asset.name.split('.').pop() : useFormat
    
    let suffix = ''
    if (cropped) {
      suffix += '-cropped'
    }
    if (sizePreset === 'custom' && customWidth) {
      suffix += `-${customWidth}w`
    } else if (sizePreset !== 'original' && SIZE_PRESETS[sizePreset].width) {
      suffix += `-${SIZE_PRESETS[sizePreset].width}w`
    }
    
    return `${baseName}${suffix}.${ext}`
  }

  const handleDownload = async (useCrop = false) => {
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
          width: useCrop && croppedAreaPixels ? croppedAreaPixels.width : width,
          height: useCrop && croppedAreaPixels ? croppedAreaPixels.height : 
                  (asset.height && asset.width ? Math.round((width || asset.width) * (asset.height / asset.width)) : null),
          quality: format === 'webp' || format === 'jpg' ? quality : null
        })
      }

      let blob: Blob
      let filename: string

      if (useCrop && croppedAreaPixels) {
        // Apply crop using canvas
        // Force PNG if rounded corners (need transparency)
        const useFormat = borderRadius > 0 ? 'png' : format
        const mimeType = useFormat === 'original' ? (asset.mime_type || 'image/jpeg') : `image/${useFormat}`
        
        // Calculate pixel border radius (percentage of smaller dimension)
        const minDim = Math.min(croppedAreaPixels.width, croppedAreaPixels.height)
        const pixelRadius = Math.round((borderRadius / 100) * (minDim / 2))
        
        blob = await getCroppedImg(getImageUrl(), croppedAreaPixels, mimeType, pixelRadius)
        filename = getFilename(true, borderRadius > 0 ? 'png' : undefined)
        setShowCropper(false)
      } else {
        // Direct download
        const url = getDownloadUrl()
        const response = await fetch(url)
        blob = await response.blob()
        filename = getFilename()
      }

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
      const url = getDownloadUrl()
      window.open(url, '_blank')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">Download</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCropper(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Crop
            </button>
            <button
              onClick={() => setShowBgRemover(true)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Background
            </button>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              {showAdvanced ? 'Simple' : 'Options'}
            </button>
          </div>
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
              onClick={() => handleDownload(false)}
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
              onClick={() => { setFormat('original'); setSizePreset('original'); handleDownload(false) }}
              disabled={downloading}
              className="px-3 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 font-medium text-sm disabled:opacity-50"
            >
              Original
            </button>
            <button
              onClick={() => { setFormat('webp'); setSizePreset('original'); setTimeout(() => handleDownload(false), 0) }}
              disabled={downloading}
              className="px-3 py-2.5 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 font-medium text-sm disabled:opacity-50"
            >
              WebP
            </button>
            <button
              onClick={() => { setFormat('jpg'); setSizePreset('original'); setTimeout(() => handleDownload(false), 0) }}
              disabled={downloading}
              className="px-3 py-2.5 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 font-medium text-sm disabled:opacity-50"
            >
              JPG
            </button>
          </div>
        )}
      </div>

      {/* Background Remover Modal */}
      {showBgRemover && (
        <BackgroundRemover
          imageUrl={getImageUrl()}
          filename={asset.name}
          onClose={() => setShowBgRemover(false)}
        />
      )}

      {/* Crop Modal */}
      {showCropper && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col">
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-zinc-800">
            <h3 className="text-lg font-semibold text-white">Crop Image</h3>
            <button
              onClick={() => setShowCropper(false)}
              className="text-zinc-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Cropper */}
          <div className="flex-1 relative">
            <Cropper
              image={getImageUrl()}
              crop={crop}
              zoom={zoom}
              aspect={ASPECT_PRESETS[aspectPreset].value}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              style={{
                containerStyle: { background: '#18181b' },
                cropAreaStyle: { 
                  border: '2px solid #06b6d4',
                  borderRadius: `${borderRadius}%`
                }
              }}
              classes={{
                cropAreaClassName: 'transition-all duration-200'
              }}
            />
            {/* Rounded corners preview overlay */}
            {borderRadius > 0 && croppedAreaPixels && (
              <div 
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                style={{ zIndex: 10 }}
              >
                <div 
                  className="border-2 border-cyan-400 border-dashed opacity-60"
                  style={{
                    borderRadius: `${borderRadius}%`,
                    width: croppedAreaPixels.width > 0 ? '50%' : 0,
                    aspectRatio: croppedAreaPixels.width / croppedAreaPixels.height
                  }}
                />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 bg-zinc-900 border-t border-zinc-800 space-y-4">
            {/* Aspect Ratio Presets */}
            <div>
              <label className="text-xs text-zinc-500 mb-2 block">Aspect Ratio</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ASPECT_PRESETS).map(([key, { label }]) => (
                  <button
                    key={key}
                    onClick={() => setAspectPreset(key as AspectPreset)}
                    className={`px-3 py-1.5 text-xs rounded-full ${
                      aspectPreset === key
                        ? 'bg-cyan-600 text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zoom */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Zoom: {zoom.toFixed(1)}x</label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            {/* Rounded Corners */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-500">
                  Rounded Corners: {borderRadius === 0 ? 'None' : borderRadius === 100 ? 'Circle' : `${borderRadius}%`}
                </label>
                {borderRadius > 0 && (
                  <span className="text-xs text-cyan-400">PNG format</span>
                )}
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={borderRadius}
                onChange={(e) => setBorderRadius(parseInt(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between mt-1">
                <button
                  onClick={() => setBorderRadius(0)}
                  className={`text-xs px-2 py-1 rounded ${borderRadius === 0 ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  Sharp
                </button>
                <button
                  onClick={() => setBorderRadius(20)}
                  className={`text-xs px-2 py-1 rounded ${borderRadius === 20 ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  Rounded
                </button>
                <button
                  onClick={() => setBorderRadius(50)}
                  className={`text-xs px-2 py-1 rounded ${borderRadius === 50 ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  Pill
                </button>
                <button
                  onClick={() => setBorderRadius(100)}
                  className={`text-xs px-2 py-1 rounded ${borderRadius === 100 ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                >
                  Circle
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCropper(false)}
                className="flex-1 py-2.5 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDownload(true)}
                disabled={downloading || !croppedAreaPixels}
                className="flex-1 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Cropped
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
