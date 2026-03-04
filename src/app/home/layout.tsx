import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import HomeSidebar from '@/components/HomeSidebar'

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-900">
      <HomeSidebar user={user} />
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 lg:p-8 pt-20 lg:pt-8">
        {children}
      </main>
    </div>
  )
}
