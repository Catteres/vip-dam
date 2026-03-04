import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Get counts (will fail gracefully if tables don't exist yet)
  const [
    { count: assetCount },
    { count: tagCount },
    { count: folderCount },
    { count: userCount },
  ] = await Promise.all([
    supabase.from('dam_assets').select('*', { count: 'exact', head: true }),
    supabase.from('dam_tags').select('*', { count: 'exact', head: true }),
    supabase.from('dam_folders').select('*', { count: 'exact', head: true }),
    supabase.from('dam_users').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    { name: 'Total Assets', value: assetCount || 0, icon: '🖼️', href: '/admin/assets', color: 'from-cyan-500 to-teal-600' },
    { name: 'Tags', value: tagCount || 0, icon: '🏷️', href: '/admin/tags', color: 'from-purple-500 to-pink-600' },
    { name: 'Folders', value: folderCount || 0, icon: '📁', href: '/admin/folders', color: 'from-amber-500 to-orange-600' },
    { name: 'Users', value: userCount || 0, icon: '👤', href: '/admin/users', color: 'from-green-500 to-emerald-600' },
  ]

  return (
    <div>
      <h1 className="text-2xl lg:text-3xl font-bold text-white mb-6 lg:mb-8">Admin Dashboard</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="bg-gray-800 rounded-xl p-4 lg:p-6 border border-gray-700 hover:border-gray-600 transition-all hover:transform hover:scale-[1.02]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-gray-400 text-sm">{stat.name}</p>
                <p className="text-2xl lg:text-3xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-xl lg:text-2xl`}>
                {stat.icon}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-xl p-4 lg:p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link 
            href="/admin/assets"
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 rounded-xl transition-colors"
          >
            <span className="text-2xl">📤</span>
            <span className="text-white text-sm font-medium">Upload Assets</span>
          </Link>
          <Link 
            href="/admin/tags"
            className="flex flex-col items-center gap-2 p-4 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors"
          >
            <span className="text-2xl">🏷️</span>
            <span className="text-white text-sm font-medium">Manage Tags</span>
          </Link>
          <Link 
            href="/admin/folders"
            className="flex flex-col items-center gap-2 p-4 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors"
          >
            <span className="text-2xl">📁</span>
            <span className="text-white text-sm font-medium">Create Folder</span>
          </Link>
          <Link 
            href="/admin/users"
            className="flex flex-col items-center gap-2 p-4 bg-gray-700 hover:bg-gray-600 rounded-xl transition-colors"
          >
            <span className="text-2xl">👤</span>
            <span className="text-white text-sm font-medium">Add User</span>
          </Link>
        </div>
      </div>

      {/* Setup Notice */}
      <div className="mt-6 bg-amber-900/30 border border-amber-700 rounded-xl p-4 lg:p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="text-amber-300 font-semibold">Database Setup Required</h3>
            <p className="text-amber-200/80 text-sm mt-1">
              Run the database migrations to create the required tables. The asset upload and management features will be available once the schema is set up.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
