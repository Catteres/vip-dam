'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App Error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Content */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-zinc-400 mb-6">
          We encountered an unexpected error. Don&apos;t worry, your data is safe.
        </p>

        {/* Error details (dev only) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-6 p-4 bg-zinc-800 border border-zinc-700 rounded-lg text-left">
            <p className="text-xs text-zinc-500 mb-1">Error details:</p>
            <p className="text-sm text-red-400 font-mono break-all">
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
            href="/"
            className="px-6 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors font-medium border border-zinc-700"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
