'use client'

import { useState, useEffect, useRef } from 'react'
import { removeBackground } from '@imgly/background-removal'

interface BackgroundRemoverProps {
  imageUrl: string
  filename: string
  onClose: () => void
}

type BgColor = 'transparent' | 'white' | 'light-gray' | 'dark-gray' | 'custom' | 'image'

const BG_PRESETS: Record<BgColor, { label: string; color: string | null }> = {
  'transparent': { label: 'Transparent', color: null },
  'white': { label: 'White', color: '#FFFFFF' },
  'light-gray': { label: 'Light Gray', color: '#E5E5E5' },
  'dark-gray': { label: 'Dark Gray', color: '#4A4A4A' },
  'custom': { label: 'Custom', color: null },
  'image': { label: 'Image', color: null },
}

export default function BackgroundRemover({ imageUrl, filename, onClose }: BackgroundRemoverProps) {
  const [status, setStatus] = useState<'loading-model' | 'processing' | 'done' | 'error'>('loading-model')
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('Loading AI model...')
  const [removedBgBlob, setRemovedBgBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [bgColor, setBgColor] = useState<BgColor>('white')
  const [customColor, setCustomColor] = useState('#FFFFFF')
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const removedImageRef = useRef<HTMLImageElement | null>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)

  // Process background removal on mount
  useEffect(() => {
    let cancelled = false

    async function process() {
      try {
        setStatus('loading-model')
        setProgress(0)
        
        const blob = await removeBackground(imageUrl, {
          progress: (key, current, total) => {
            if (cancelled) return
            const pct = total > 0 ? Math.round((current / total) * 100) : 0
            setProgress(pct)
            
            if (key.includes('model')) {
              setProgressText('Loading AI model...')
            } else if (key.includes('inference')) {
              setProgressText('Removing background...')
              setStatus('processing')
            }
          }
        })

        if (cancelled) return
        
        setRemovedBgBlob(blob)
        setStatus('done')
        
        // Create image element for compositing
        const img = new Image()
        img.onload = () => {
          removedImageRef.current = img
          updatePreview(blob, 'white')
        }
        img.src = URL.createObjectURL(blob)
        
      } catch (err) {
        if (cancelled) return
        console.error('Background removal failed:', err)
        setStatus('error')
      }
    }

    process()
    return () => { cancelled = true }
  }, [imageUrl])

  // Handle background image upload
  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const img = new Image()
    img.onload = () => {
      setBgImage(img)
      setBgColor('image')
    }
    const url = URL.createObjectURL(file)
    if (bgImageUrl) URL.revokeObjectURL(bgImageUrl)
    setBgImageUrl(url)
    img.src = url
  }

  // Update preview when background color changes
  const updatePreview = (blob: Blob | null = removedBgBlob, color: BgColor = bgColor) => {
    if (!blob || !removedImageRef.current) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const img = removedImageRef.current
    canvas.width = img.width
    canvas.height = img.height
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Fill background
    if (color === 'image' && bgImage) {
      // Scale and center background image to cover canvas (like CSS background-size: cover)
      const scale = Math.max(canvas.width / bgImage.width, canvas.height / bgImage.height)
      const scaledWidth = bgImage.width * scale
      const scaledHeight = bgImage.height * scale
      const x = (canvas.width - scaledWidth) / 2
      const y = (canvas.height - scaledHeight) / 2
      ctx.drawImage(bgImage, x, y, scaledWidth, scaledHeight)
    } else {
      const fillColor = color === 'custom' ? customColor : BG_PRESETS[color].color
      if (fillColor) {
        ctx.fillStyle = fillColor
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
    
    // Draw the image with removed background
    ctx.drawImage(img, 0, 0)
    
    // Create preview URL - use PNG for transparency, JPEG for solid/image backgrounds
    const useJpeg = color !== 'transparent'
    canvas.toBlob((previewBlob) => {
      if (previewBlob) {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(URL.createObjectURL(previewBlob))
      }
    }, useJpeg ? 'image/jpeg' : 'image/png', 0.92)
  }

  useEffect(() => {
    if (status === 'done') {
      updatePreview()
    }
  }, [bgColor, customColor, bgImage, status])

  const handleDownload = async () => {
    if (!canvasRef.current) return
    
    setDownloading(true)
    
    const canvas = canvasRef.current
    const hasBackground = bgColor !== 'transparent'
    const format = hasBackground ? 'image/jpeg' : 'image/png'
    const ext = hasBackground ? 'jpg' : 'png'
    
    canvas.toBlob((blob) => {
      if (!blob) {
        setDownloading(false)
        return
      }
      
      const baseName = filename.replace(/\.[^.]+$/, '')
      const downloadFilename = `${baseName}-nobg.${ext}`
      
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = downloadFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      setDownloading(false)
    }, format, 0.92)
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-zinc-800">
        <h3 className="text-lg font-semibold text-white">Remove Background</h3>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
        {/* Checkered background to show transparency */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
              linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
              linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
          }}
        />
        
        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />
        
        {(status === 'loading-model' || status === 'processing') && (
          <div className="relative z-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4">
              <svg className="animate-spin" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#3f3f46"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#06b6d4"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 2.51} 251`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
            </div>
            <p className="text-white font-medium">{progressText}</p>
            <p className="text-zinc-400 text-sm mt-1">{progress}%</p>
            {status === 'loading-model' && (
              <p className="text-zinc-500 text-xs mt-3">First time may take ~30 seconds</p>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="relative z-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-red-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-white font-medium">Processing failed</p>
            <p className="text-zinc-400 text-sm mt-1">Try a different image or check browser console</p>
          </div>
        )}

        {status === 'done' && previewUrl && (
          <img
            src={previewUrl}
            alt="Preview"
            className="relative z-10 max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        )}
      </div>

      {/* Controls */}
      {status === 'done' && (
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 space-y-4">
          {/* Background Color Selection */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Background</label>
            <div className="flex flex-wrap gap-2">
              {/* Hidden file input */}
              <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                onChange={handleBgImageUpload}
                className="hidden"
              />
              
              {(Object.entries(BG_PRESETS) as [BgColor, { label: string; color: string | null }][]).map(([key, { label, color }]) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === 'image') {
                      bgInputRef.current?.click()
                    } else {
                      setBgColor(key)
                    }
                  }}
                  className={`px-3 py-1.5 text-xs rounded-full flex items-center gap-2 ${
                    bgColor === key
                      ? 'bg-cyan-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {key === 'transparent' ? (
                    <span className="w-4 h-4 rounded-full border border-zinc-600" style={{
                      backgroundImage: `
                        linear-gradient(45deg, #666 25%, transparent 25%),
                        linear-gradient(-45deg, #666 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #666 75%),
                        linear-gradient(-45deg, transparent 75%, #666 75%)
                      `,
                      backgroundSize: '6px 6px',
                      backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px'
                    }} />
                  ) : key === 'custom' ? (
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded-full border-0 cursor-pointer"
                    />
                  ) : key === 'image' ? (
                    bgImage ? (
                      <img 
                        src={bgImageUrl || ''} 
                        alt="bg" 
                        className="w-4 h-4 rounded-full object-cover border border-zinc-600"
                      />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )
                  ) : (
                    <span 
                      className="w-4 h-4 rounded-full border border-zinc-600"
                      style={{ backgroundColor: color || 'transparent' }}
                    />
                  )}
                  {key === 'image' && bgImage ? 'Change' : label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
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
                  Download
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Cancel button when processing */}
      {(status === 'loading-model' || status === 'processing') && (
        <div className="p-4 bg-zinc-900 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 font-medium"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
