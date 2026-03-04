import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Check user role from dam_users table
    const { data: damUser } = await supabase
      .from('dam_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (damUser?.role === 'admin') {
      redirect('/admin')
    } else {
      redirect('/home')
    }
  } else {
    redirect('/auth/login')
  }
}
