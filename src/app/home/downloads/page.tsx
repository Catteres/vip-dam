'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface DownloadEntry {
  id: string
  asset_id: string
  created_at: string
  format: string
  asset?: {
    id: string
    name: string
    original_path: string
    width: number | null
    height: number | null
    mime_type: string | null
  } | null
}

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadEntry[]>([])
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()

  useEffect(() => {
    loadDownloads()
  }, [])

  const loadDownloads = async () => {
    setLoading(true)
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      setLoading(false)
      return
    }

    // Load user's download history (user.id matches dam_users.id)
    const { data, error } = await supabase
      .from('dam_download_log')
      .select(`
        id,
        asset_id,
        created_at,
        format,
        asset:dam_assets (
          id,
          name,
          original_path,
          width,
          height,
          mime_type
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error loading downloads:', error)
    } else {
      // Transform data to match expected interface (asset is returned as array by Supabase)
      const transformed = (data || []).map(d => ({
        ...d,
        asset: Array.isArray(d.asset) ? d.asset[0] : d.asset
      }))
      setDownloads(transformed)
    }
    
    setLoading(false)
  }

  const getImageUrl = (path: string, thumbnail = false) => {
    if (thumbnail) {
      const previewPath = path.replace(/\.[^.]+$/, '.webp')
      return supabase.storage.from('dam-previews').getPublicUrl(previewPath).data.publicUrl
    }
    return supabase.storage.from('dam-originals').getPublicUrl(path).data.publicUrl
  }

  const getFallbackUrl = (path: string) => {
    return supabase.storage.from('dam-originals').getPublicUrl(path, {
      transform: { width: 100, height: 100, resize: 'cover' }
    }).data.publicUrl
  }

  const redownload = async (download: DownloadEntry) => {
    if (!download.asset) return

    // Log the re-download
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.id) {
      await supabase.from('dam_download_log').insert({
        asset_id: download.asset.id,
        user_id: user.id,
        format: download.asset.mime_type || 'unknown',
        width: download.asset.width,
        height: download.asset.height
      })
    }

    const url = getImageUrl(download.asset.original_path)
    const link = document.createElement('a')
    link.href = url
    link.download = download.asset.name
    link.target = '_blank'
    link.click()

    // Refresh to show new download
    loadDownloads()
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  // Group downloads by date
  const groupedDownloads = downloads.reduce((acc, download) => {
    const date = new Date(download.created_at).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(download)
    return acc
  }, {} as Record<string, DownloadEntry[]>)

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xl sm:text-2xl">📥</span>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Download History</h1>
                <p className="text-xs text-zinc-500 hidden sm:block">Your recent downloads</p>
              </div>
            </div>
            <Link
              href="/home"
              className="text-sm text-zinc-400 hover:text-white"
            >
              ← Back to Library
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Stats */}
        <div className="mb-6 text-sm text-zinc-500">
          {downloads.length} downloads in history
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && downloads.length === 0 && (
          <div className="text-center py-12">
            <div className="text-zinc-600 text-5xl mb-4">📥</div>
            <h3 className="text-lg font-medium text-white mb-1">No downloads yet</h3>
            <p className="text-zinc-400 mb-4">
              Assets you download will appear here
            </p>
            <Link
              href="/home"
              className="inline-flex items-center px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
            >
              Browse Library
            </Link>
          </div>
        )}

        {/* Download List */}
        {!loading && downloads.length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedDownloads).map(([date, dateDownloads]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-zinc-500 mb-3">{date}</h3>
                <div className="space-y-2">
                  {dateDownloads.map((download) => (
                    <div
                      key={download.id}
                      className="flex items-center gap-4 p-3 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="w-14 h-14 bg-zinc-800 rounded-lg overflow-hidden shrink-0">
                        {download.asset ? (
                          <img
                            src={getImageUrl(download.asset.original_path, true)}
                            alt={download.asset.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              if (!target.dataset.fallback) {
                                target.dataset.fallback = 'true'
                                target.src = getFallbackUrl(download.asset!.original_path)
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">
                          {download.asset?.name || 'Deleted asset'}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {download.asset ? (
                            <>
                              {download.asset.width}×{download.asset.height} • {download.format}
                            </>
                          ) : (
                            'Asset no longer available'
                          )}
                        </p>
                      </div>

                      {/* Time */}
                      <div className="text-sm text-zinc-500 hidden sm:block">
                        {formatDate(download.created_at)}
                      </div>

                      {/* Download Again Button */}
                      {download.asset && (
                        <button
                          onClick={() => redownload(download)}
                          className="p-2 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-700 rounded-lg transition-colors"
                          title="Download again"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
