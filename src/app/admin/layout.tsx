import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminSidebar from '@/components/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // For now, allow any authenticated user; later check role
  // const { data: damUser } = await supabase
  //   .from('dam_users')
  //   .select('role')
  //   .eq('id', user.id)
  //   .single()
  // 
  // if (damUser?.role !== 'admin') {
  //   redirect('/home')
  // }

  return (
    <div className="flex min-h-screen bg-gray-900">
      <AdminSidebar user={user} />
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 lg:p-8 pt-20 lg:pt-8">
        {children}
      </main>
    </div>
  )
}
