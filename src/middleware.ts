import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  
  // Normalize path - remove /vip-dam prefix if present (for deployed version)
  const normalizedPath = pathname.replace(/^\/vip-dam/, '') || '/'

  // Auth pages - redirect to appropriate dashboard if already logged in
  if (normalizedPath.startsWith('/auth/login')) {
    if (user) {
      // User is already logged in, redirect based on role
      const { data: userData } = await supabase
        .from('dam_users')
        .select('role')
        .eq('id', user.id)
        .single()

      const url = request.nextUrl.clone()
      if (userData?.role === 'admin') {
        url.pathname = pathname.startsWith('/vip-dam') ? '/vip-dam/admin' : '/admin'
      } else {
        url.pathname = pathname.startsWith('/vip-dam') ? '/vip-dam/home' : '/home'
      }
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Protected routes - require authentication
  const isAdminRoute = normalizedPath.startsWith('/admin')
  const isHomeRoute = normalizedPath.startsWith('/home')
  const isProtectedRoute = isAdminRoute || isHomeRoute

  if (isProtectedRoute && !user) {
    // Not logged in - redirect to login
    const url = request.nextUrl.clone()
    url.pathname = pathname.startsWith('/vip-dam') ? '/vip-dam/auth/login' : '/auth/login'
    return NextResponse.redirect(url)
  }

  if (isProtectedRoute && user) {
    // Fetch user role from dam_users
    const { data: userData } = await supabase
      .from('dam_users')
      .select('role')
      .eq('id', user.id)
      .single()

    // If user not found in dam_users, redirect to login
    if (!userData) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = pathname.startsWith('/vip-dam') ? '/vip-dam/auth/login' : '/auth/login'
      return NextResponse.redirect(url)
    }

    // Admin routes - only admins allowed
    if (isAdminRoute && userData.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = pathname.startsWith('/vip-dam') ? '/vip-dam/home' : '/home'
      return NextResponse.redirect(url)
    }

    // Home routes - any authenticated user allowed (admins and regular users)
    // No additional check needed for /home routes
  }

  // Root path - redirect to appropriate section
  if (normalizedPath === '/' || normalizedPath === '') {
    if (user) {
      const { data: userData } = await supabase
        .from('dam_users')
        .select('role')
        .eq('id', user.id)
        .single()

      const url = request.nextUrl.clone()
      if (userData?.role === 'admin') {
        url.pathname = pathname.startsWith('/vip-dam') ? '/vip-dam/admin' : '/admin'
      } else {
        url.pathname = pathname.startsWith('/vip-dam') ? '/vip-dam/home' : '/home'
      }
      return NextResponse.redirect(url)
    } else {
      const url = request.nextUrl.clone()
      url.pathname = pathname.startsWith('/vip-dam') ? '/vip-dam/auth/login' : '/auth/login'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
