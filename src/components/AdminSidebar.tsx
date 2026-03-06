'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useUpload } from '@/context/UploadContext'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Logo, LogoIcon } from '@/components/Logo'

const navItems = [
  { href: '/admin', label: 'Library', icon: '🖼️' },
  { href: '/admin/upload', label: 'Upload', icon: '⬆️' },
  { href: '/admin/tags', label: 'Tags', icon: '🏷️' },
  { href: '/admin/folders', label: 'Folders', icon: '📁' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/activity', label: 'Activity', icon: '📊' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { isUploading } = useUpload()
  const [isOpen, setIsOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const supabase = createClient()

  // Fetch user email on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email || null)
    }
    getUser()
  }, [supabase.auth])

  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  const handleSignOut = () => {
    // Use server-side logout to properly clear cookies
    window.location.href = '/auth/logout'
  }

  const sidebarContent = (
    <>
      <div className="mb-8">
        <Link href="/admin" className="block">
          <Logo variant="white" className="h-10 w-auto" />
        </Link>
        <p className="text-zinc-500 text-xs mt-2">Digital Asset Manager</p>
      </div>

      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/admin' && pathname.startsWith(item.href))
          
          const linkContent = (
            <>
              <span>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
              {item.href === '/admin/upload' && isUploading && (
                <span className="ml-auto">
                  <svg className="animate-spin h-4 w-4 text-cyan-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </span>
              )}
            </>
          )

          if (isUploading && item.href !== '/admin/upload') {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-600 cursor-not-allowed"
                title="Navigation disabled during upload"
              >
                {linkContent}
              </div>
            )
          }
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-cyan-600 text-white' 
                  : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }
              `}
            >
              {linkContent}
            </Link>
          )
        })}
      </nav>

      <div className="pt-4 border-t border-zinc-800 space-y-2">
        <Link
          href="/home"
          className="flex items-center gap-2 px-3 py-2 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
        >
          <span>👁️</span>
          <span>View as User</span>
        </Link>
        
        {/* User info and logout */}
        <div className="px-3 py-2">
          {userEmail && (
            <p className="text-xs text-zinc-500 truncate mb-2" title={userEmail}>
              {userEmail}
            </p>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-zinc-400 hover:text-red-400 text-sm transition-colors w-full"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-zinc-950 border-b border-zinc-800 flex items-center px-4 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 -ml-2 text-zinc-300 hover:text-white"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/admin" className="ml-2">
          <Logo variant="white" className="h-8 w-auto" />
        </Link>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - desktop always visible, mobile slide-in */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-zinc-950 text-white min-h-screen p-4 flex flex-col border-r border-zinc-800
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1 text-zinc-400 hover:text-white"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {sidebarContent}
      </aside>
    </>
  )
}
