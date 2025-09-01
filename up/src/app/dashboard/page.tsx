import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import DashboardClient from './dashboard-client'
import { redirect } from "next/navigation"

async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen pt-20 max-w-7xl mx-auto px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-white">Dashboard</h1>
        <p className="text-gray-400">Welcome back, {user?.email}</p>
      </div>

      <DashboardClient user={user} />
    </div>
  )
}