'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global Error:', error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-zinc-900 text-white">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                />
              </svg>
            </div>

            {/* Content */}
            <h1 className="text-3xl font-bold text-white mb-3">
              Critical Error
            </h1>
            <p className="text-zinc-400 mb-8 text-lg">
              The application encountered a critical error and needs to recover.
            </p>

            {/* Error details (dev only) */}
            {process.env.NODE_ENV === 'development' && error.message && (
              <div className="mb-8 p-4 bg-zinc-800 border border-red-500/30 rounded-lg text-left">
                <p className="text-xs text-red-400 mb-1 font-semibold">Global error:</p>
                <p className="text-sm text-red-300 font-mono break-all">
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
            <button
              onClick={reset}
              className="px-8 py-4 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors font-semibold text-lg shadow-lg shadow-cyan-500/20"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
