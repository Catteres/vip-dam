'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Home Error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-cyan-500/10 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-cyan-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Content */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Unable to Load Assets
        </h1>
        <p className="text-zinc-400 mb-6">
          We&apos;re having trouble loading the asset library. This could be a temporary connection issue.
        </p>

        {/* Error details (dev only) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-6 p-4 bg-zinc-800 border border-zinc-700 rounded-lg text-left">
            <p className="text-xs text-zinc-500 mb-1">Error details:</p>
            <p className="text-sm text-cyan-400 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-zinc-500 mt-2">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors font-medium"
          >
            Try again
          </button>
          <Link
            href="/home"
            className="px-6 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors font-medium border border-zinc-700 text-center"
          >
            Refresh Library
          </Link>
        </div>

        {/* Help text */}
        <p className="mt-8 text-sm text-zinc-500">
          If the problem persists, please contact your administrator.
        </p>
      </div>
    </div>
  )
}
