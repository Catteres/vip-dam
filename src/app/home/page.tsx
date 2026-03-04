import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()

  // Get asset count
  const { count: assetCount } = await supabase
    .from('dam_assets')
    .select('*', { count: 'exact', head: true })

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">Asset Library</h1>
          <p className="text-gray-400 mt-1">{assetCount || 0} assets available</p>
        </div>
        
        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Search assets..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="text-white font-semibold mb-4">Filters</h3>
            
            {/* Staff Filter */}
            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-2">Staff</label>
              <select className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500">
                <option value="">All Staff</option>
              </select>
            </div>
            
            {/* Location Filter */}
            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-2">Location</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-300 text-sm">
                  <input type="checkbox" className="rounded bg-gray-700 border-gray-600" />
                  New York
                </label>
                <label className="flex items-center gap-2 text-gray-300 text-sm">
                  <input type="checkbox" className="rounded bg-gray-700 border-gray-600" />
                  Bogotá
                </label>
              </div>
            </div>
            
            {/* Content Type Filter */}
            <div className="mb-4">
              <label className="text-gray-400 text-sm block mb-2">Content Type</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-300 text-sm">
                  <input type="checkbox" className="rounded bg-gray-700 border-gray-600" />
                  Equipment
                </label>
                <label className="flex items-center gap-2 text-gray-300 text-sm">
                  <input type="checkbox" className="rounded bg-gray-700 border-gray-600" />
                  Headshots
                </label>
                <label className="flex items-center gap-2 text-gray-300 text-sm">
                  <input type="checkbox" className="rounded bg-gray-700 border-gray-600" />
                  Procedures
                </label>
              </div>
            </div>
            
            {/* Orientation Filter */}
            <div>
              <label className="text-gray-400 text-sm block mb-2">Orientation</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-300 text-sm">
                  <input type="checkbox" className="rounded bg-gray-700 border-gray-600" />
                  Landscape
                </label>
                <label className="flex items-center gap-2 text-gray-300 text-sm">
                  <input type="checkbox" className="rounded bg-gray-700 border-gray-600" />
                  Portrait
                </label>
                <label className="flex items-center gap-2 text-gray-300 text-sm">
                  <input type="checkbox" className="rounded bg-gray-700 border-gray-600" />
                  Square
                </label>
              </div>
            </div>
            
            <button className="w-full mt-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg hover:border-gray-500 transition-colors">
              Clear Filters
            </button>
          </div>
        </div>

        {/* Asset Grid */}
        <div className="flex-1">
          {assetCount === 0 || assetCount === null ? (
            <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700 border-dashed">
              <div className="w-16 h-16 bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">No assets yet</h3>
              <p className="text-gray-400 text-sm">
                Assets uploaded by admins will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Asset cards will be rendered here */}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
