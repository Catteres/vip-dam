'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Admin Error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        {/* Content */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Admin Panel Error
        </h1>
        <p className="text-zinc-400 mb-6">
          Something went wrong in the admin section. This might be a temporary issue with loading data or permissions.
        </p>

        {/* Error details (dev only) */}
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="mb-6 p-4 bg-zinc-800 border border-zinc-700 rounded-lg text-left">
            <p className="text-xs text-zinc-500 mb-1">Error details:</p>
            <p className="text-sm text-amber-400 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-zinc-500 mt-2">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Suggestions */}
        <div className="mb-6 p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg text-left">
          <p className="text-sm text-zinc-400 mb-2">Try these steps:</p>
          <ul className="text-sm text-zinc-500 space-y-1 list-disc list-inside">
            <li>Check your internet connection</li>
            <li>Refresh the page</li>
            <li>Clear your browser cache</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors font-medium"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="px-6 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors font-medium border border-zinc-700 text-center"
          >
            Back to Admin
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors font-medium border border-zinc-700 text-center"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
