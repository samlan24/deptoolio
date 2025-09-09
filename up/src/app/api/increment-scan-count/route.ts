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

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

  try {
    // Try to increment existing count for today
    const { data: existing, error: fetchError } = await supabase
      .from('daily_scan_counts')
      .select('*')
      .eq('user_id', user.id)
      .eq('scan_date', today)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw fetchError
    }

    if (existing) {
      // Increment existing count
      const { error: updateError } = await supabase
        .from('daily_scan_counts')
        .update({ scan_count: existing.scan_count + 1 })
        .eq('id', existing.id)

      if (updateError) throw updateError
    } else {
      // Create new entry for today
      const { error: insertError } = await supabase
        .from('daily_scan_counts')
        .insert({
          user_id: user.id,
          scan_date: today,
          scan_count: 1
        })

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
  console.error('Error incrementing scan count:', {
    message: error instanceof Error ? error.message : 'Unknown error',
    code: error?.code,
    userId: user.id
  });
  return NextResponse.json({ error: 'Failed to update scan count' }, { status: 500 });
}
}