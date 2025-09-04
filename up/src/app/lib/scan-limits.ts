import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { subscriptionCache } from './subscription-cache'

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

export async function checkScanWithRateLimits(userId: string) {
  const supabase = await createClient()

  // Try to get subscription from cache first
  const cacheKey = `subscription:${userId}`
  let subscriptionData = subscriptionCache.get(cacheKey)

  if (!subscriptionData) {
    // Cache miss - fetch from database and cache it
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('scan_limit, plan')
      .eq('user_id', userId)
      .single()

    if (subError || !subscription) {
      return { allowed: false, error: 'No subscription found' }
    }

    subscriptionData = subscription
    subscriptionCache.set(cacheKey, subscriptionData)
  }

  // Call the stored procedure for rate limiting and monthly limits
  const { data, error } = await supabase.rpc('check_scan_with_rate_limits', {
    p_user_id: userId,
  })

  if (error) {
    console.error('Error checking scan limits:', error)
    return { allowed: false, error: 'Database error' }
  }

  return data
}

