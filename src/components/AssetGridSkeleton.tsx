'use client'

interface AssetGridSkeletonProps {
  count?: number
  variant?: 'home' | 'admin' | 'favorites'
}

export default function AssetGridSkeleton({ 
  count = 12, 
  variant = 'home' 
}: AssetGridSkeletonProps) {
  const gridClasses = {
    home: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
    admin: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
    favorites: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  }

  return (
    <div className={`grid ${gridClasses[variant]} gap-2 sm:gap-4`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="relative bg-zinc-900 rounded-xl overflow-hidden animate-pulse"
        >
          {/* Image placeholder */}
          <div className="aspect-square bg-zinc-800" />

          {/* Bottom info bar placeholder */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-zinc-900 to-transparent">
            {/* Title placeholder */}
            <div className="h-3 bg-zinc-700 rounded w-3/4 mb-2" />
            {/* Dimensions placeholder */}
            <div className="h-2 bg-zinc-700 rounded w-1/2" />
          </div>

          {/* Action button placeholders */}
          <div className="absolute top-2 left-2 w-8 h-8 bg-zinc-800 rounded-lg" />
          <div className="absolute top-2 right-2 w-8 h-8 bg-zinc-800 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
