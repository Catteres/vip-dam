import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ token: string }>
}

async function getShareLink(token: string) {
  const cookieStore = await cookies()
  
  // Use service role to bypass RLS for public access
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: shareLink, error } = await supabase
    .from('dam_share_links')
    .select(`
      id,
      token,
      expires_at,
      created_at,
      asset:dam_assets (
        id,
        name,
        original_path,
        width,
        height,
        file_size_bytes,
        mime_type
      )
    `)
    .eq('token', token)
    .single()

  if (error || !shareLink) {
    return null
  }

  return shareLink
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params
  const shareLink = await getShareLink(token)

  if (!shareLink) {
    notFound()
  }

  // Check if link has expired
  const isExpired = new Date(shareLink.expires_at) < new Date()
  
  if (isExpired) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Link Expired</h1>
          <p className="text-zinc-400 max-w-md">
            This share link has expired and is no longer valid. Please request a new link from the asset owner.
          </p>
          <p className="text-zinc-500 text-sm mt-4">
            Expired on {new Date(shareLink.expires_at).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    )
  }

  // Supabase types joined relations as arrays, cast through unknown
  const asset = (Array.isArray(shareLink.asset) ? shareLink.asset[0] : shareLink.asset) as unknown as {
    id: string
    name: string
    original_path: string
    width: number | null
    height: number | null
    file_size_bytes: number | null
    mime_type: string | null
  }

  const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dam-originals/${asset.original_path}`
  const previewPath = asset.original_path.replace(/\.[^.]+$/, '.webp')
  const previewUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/dam-previews/${previewPath}`

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-semibold truncate max-w-[200px] sm:max-w-none">{asset.name}</h1>
            <p className="text-zinc-500 text-xs">Shared via VIP DAM</p>
          </div>
        </div>
        <a 
          href={imageUrl}
          download={asset.name}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="hidden sm:inline">Download</span>
        </a>
      </header>

      {/* Image Container */}
      <div className="flex-1 flex items-center justify-center p-4 bg-black/50">
        <img
          src={previewUrl}
          alt={asset.name}
          className="max-w-full max-h-[calc(100vh-180px)] object-contain rounded-lg shadow-2xl"
          onError={(e) => {
            // Fallback to original if preview doesn't exist
            const target = e.target as HTMLImageElement
            if (!target.dataset.fallback) {
              target.dataset.fallback = 'true'
              target.src = imageUrl
            }
          }}
        />
      </div>

      {/* Footer Info */}
      <footer className="border-t border-zinc-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-400">
          {asset.width && asset.height && (
            <span>{asset.width} × {asset.height}</span>
          )}
          <span>{formatFileSize(asset.file_size_bytes)}</span>
          {asset.mime_type && (
            <span>{asset.mime_type.split('/')[1]?.toUpperCase()}</span>
          )}
          <span className="text-zinc-500">
            Expires {new Date(shareLink.expires_at).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
        </div>
      </footer>
    </div>
  )
}
