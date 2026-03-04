'use client'

import AdminSidebar from '@/components/AdminSidebar'
import { UploadProvider } from '@/context/UploadContext'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UploadProvider>
      <div className="flex min-h-screen bg-zinc-900">
        <AdminSidebar />
        {/* Add top padding on mobile for the header bar */}
        <main className="flex-1 overflow-auto pt-14 lg:pt-0">
          {children}
        </main>
      </div>
    </UploadProvider>
  )
}
