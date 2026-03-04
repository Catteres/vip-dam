'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DownloadLogEntry {
  id: string
  asset_id: string
  user_id: string | null
  format: string
  width: number | null
  height: number | null
  quality: number | null
  created_at: string
  asset?: {
    id: string
    name: string
    original_path: string
  } | null
  user?: {
    id: string
    email: string
  } | null
}

const PAGE_SIZE = 20

export default function ActivityPage() {
  const [logs, setLogs] = useState<DownloadLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  
  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [assetFilter, setAssetFilter] = useState('')
  
  // For filter dropdowns
  const [users, setUsers] = useState<{ id: string; email: string }[]>([])
  const [assets, setAssets] = useState<{ id: string; name: string }[]>([])
  
  const supabase = useMemo(() => createClient(), [])

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      const [usersRes, assetsRes] = await Promise.all([
        supabase.from('dam_users').select('id, email').order('email'),
        supabase.from('dam_assets').select('id, name').order('name').limit(100)
      ])
      setUsers(usersRes.data || [])
      setAssets(assetsRes.data || [])
    }
    loadFilterOptions()
  }, [supabase])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    
    let query = supabase
      .from('dam_download_log')
      .select(`
        id,
        asset_id,
        user_id,
        format,
        width,
        height,
        quality,
        created_at,
        asset:dam_assets(id, name, original_path),
        user:dam_users(id, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
    
    // Apply filters
    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00`)
    }
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59`)
    }
    if (userFilter) {
      query = query.eq('user_id', userFilter)
    }
    if (assetFilter) {
      query = query.eq('asset_id', assetFilter)
    }
    
    // Pagination
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    query = query.range(from, to)
    
    const { data, count, error } = await query
    
    if (error) {
      console.error('Error loading logs:', error)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transformed = (data || []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        asset_id: item.asset_id as string,
        user_id: item.user_id as string | null,
        format: item.format as string,
        width: item.width as number | null,
        height: item.height as number | null,
        quality: item.quality as number | null,
        created_at: item.created_at as string,
        asset: item.asset as DownloadLogEntry['asset'],
        user: item.user as DownloadLogEntry['user']
      }))
      setLogs(transformed)
      setTotalCount(count || 0)
    }
    
    setLoading(false)
  }, [supabase, page, dateFrom, dateTo, userFilter, assetFilter])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setUserFilter('')
    setAssetFilter('')
    setPage(1)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDimensions = (log: DownloadLogEntry) => {
    if (log.width && log.height) {
      return `${log.width}×${log.height}`
    }
    return '-'
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Activity Log</h1>
        <p className="text-zinc-400 mt-1">Track downloads and actions</p>
      </div>

      {/* Filters */}
      <div className="bg-zinc-800 rounded-lg border border-zinc-700 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          {/* Date Range */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-zinc-400 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-zinc-400 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          
          {/* User Filter */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-zinc-400 mb-1">User</label>
            <select
              value={userFilter}
              onChange={e => { setUserFilter(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.email}</option>
              ))}
            </select>
          </div>
          
          {/* Asset Filter */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-zinc-400 mb-1">Asset</label>
            <select
              value={assetFilter}
              onChange={e => { setAssetFilter(e.target.value); setPage(1) }}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">All assets</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          
          {/* Reset */}
          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-zinc-400">
          {totalCount} download{totalCount !== 1 ? 's' : ''} found
        </span>
        {totalPages > 1 && (
          <span className="text-sm text-zinc-500">
            Page {page} of {totalPages}
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 bg-zinc-800 rounded-lg border border-zinc-700">
          <div className="text-zinc-400">Loading...</div>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-zinc-800 rounded-lg border border-zinc-700">
          <div className="text-zinc-600 text-5xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-white mb-1">No Downloads Yet</h3>
          <p className="text-zinc-400">Download activity will appear here</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Asset</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Format</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-zinc-700/50">
                    <td className="px-4 py-3">
                      <span className="text-white text-sm">{log.asset?.name || 'Deleted asset'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-300 text-sm">{log.user?.email || 'Anonymous'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        log.format === 'original' 
                          ? 'bg-cyan-500/20 text-cyan-400' 
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {log.format}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-400 text-sm">{formatDimensions(log)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-zinc-400 text-sm">{formatDate(log.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden space-y-3">
            {logs.map(log => (
              <div key={log.id} className="bg-zinc-800 rounded-lg border border-zinc-700 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm truncate">
                      {log.asset?.name || 'Deleted asset'}
                    </h3>
                    <p className="text-zinc-400 text-xs mt-0.5">
                      {log.user?.email || 'Anonymous'}
                    </p>
                  </div>
                  <span className={`ml-2 shrink-0 inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    log.format === 'original' 
                      ? 'bg-cyan-500/20 text-cyan-400' 
                      : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {log.format}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{formatDimensions(log)}</span>
                  <span>{formatDate(log.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 bg-zinc-700 text-white rounded-lg text-sm hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              
              <div className="flex gap-1">
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-10 h-10 rounded-lg text-sm ${
                        page === pageNum
                          ? 'bg-cyan-600 text-white'
                          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 bg-zinc-700 text-white rounded-lg text-sm hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
