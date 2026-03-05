'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Folder } from '@/lib/types'
import { Logo } from '@/components/Logo'

const navigation = [
  { name: 'Browse', href: '/home', icon: '🖼️' },
  { name: 'Favorites', href: '/home/favorites', icon: '❤️' },
  { name: 'Downloads', href: '/home/downloads', icon: '📥' },
]

export default function HomeSidebar({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [foldersLoading, setFoldersLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Get active folder from URL
  const activeFolderId = searchParams.get('folder')

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    loadFolders()
  }, [])

  const loadFolders = async () => {
    setFoldersLoading(true)
    const { data } = await supabase
      .from('dam_folders')
      .select('*')
      .order('name')
    
    setFolders(data || [])
    setFoldersLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const applyFolderFilter = (folder: Folder) => {
    // Navigate to /home with folder ID in query param
    const params = new URLSearchParams()
    params.set('folder', folder.id)
    router.push(`/home?${params.toString()}`)
  }

  const clearFolderFilter = () => {
    router.push('/home')
  }

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <Logo variant="white" className="h-7 w-auto" />
        <div className="w-10" />
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-gray-800 border-r border-gray-700
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
        `}
      >
        <div className="p-6 hidden lg:block">
          <Link href="/home" className="block">
            <Logo variant="white" className="h-10 w-auto" />
          </Link>
          <p className="text-xs text-gray-400 mt-2">Asset Library</p>
        </div>

        {/* Mobile spacer */}
        <div className="h-16 lg:hidden" />

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = (pathname === item.href && !activeFolderId) || 
              (item.href !== '/home' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
          
          {/* Divider */}
          <div className="pt-4 pb-2">
            <p className="px-4 text-xs text-gray-500 uppercase tracking-wider">Folders</p>
          </div>
          
          {/* Folders List */}
          {foldersLoading ? (
            <div className="px-4 py-2">
              <div className="animate-pulse flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded w-24"></div>
              </div>
            </div>
          ) : folders.length === 0 ? (
            <div className="text-gray-500 text-sm px-4 py-2">
              No folders yet
            </div>
          ) : (
            <div className="space-y-1">
              {folders.map(folder => {
                const isActive = activeFolderId === folder.id
                return (
                  <button
                    key={folder.id}
                    onClick={() => applyFolderFilter(folder)}
                    className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
                      isActive
                        ? 'bg-cyan-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                    title={folder.description || folder.name}
                  >
                    <span className="mr-3 text-lg">📁</span>
                    <span className="truncate">{folder.name}</span>
                  </button>
                )
              })}
              
              {/* Clear folder filter if active */}
              {activeFolderId && (
                <button
                  onClick={clearFolderFilter}
                  className="w-full flex items-center px-4 py-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <span className="mr-3">✕</span>
                  Clear folder filter
                </button>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="ml-2 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
              title="Sign out"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
