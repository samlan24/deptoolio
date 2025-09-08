import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's subscription to find current billing period
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('period_start')
    .eq('user_id', user.id)
    .single()

  // Use billing period start instead of calendar month
  const now = new Date();
  const periodStart = subscription?.period_start
    ? new Date(subscription.period_start).toISOString().split('T')[0]
    : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] // fallback

  const { data: monthlyCounts, error } = await supabase
    .from('daily_scan_counts')
    .select('scan_count')
    .eq('user_id', user.id)
    .gte('scan_date', periodStart) // Use billing period instead of calendar month

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const monthlyTotal = monthlyCounts?.reduce((sum, day) => sum + (day.scan_count || 0), 0) || 0

  return NextResponse.json({ monthlyTotal })
}