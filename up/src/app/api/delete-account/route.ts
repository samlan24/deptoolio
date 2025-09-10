import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function DELETE() {
  const cookieStore = await cookies();

  // Client for user authentication (using anon key)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Admin client for user deletion (using service role key)
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user has an active subscription that prevents deletion
    const { data: subscription } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (subscription) {
      const now = new Date();
      const periodEnd = new Date(subscription.period_end);

      // Prevent deletion if subscription is active or cancelled but still within period
      const hasActiveSubscription =
        subscription.status === 'active' ||
        subscription.status === 'past_due' ||
        (subscription.status === 'cancelled' && now <= periodEnd);

      // Only allow deletion for free plans or truly expired subscriptions
      const canDelete =
        subscription.plan === 'free' ||
        subscription.status === 'expired' ||
        (subscription.status === 'cancelled' && now > periodEnd);

      if (hasActiveSubscription && !canDelete) {
        return Response.json({
          error: "Cannot delete account with active subscription. Please cancel your subscription first."
        }, { status: 403 });
      }
    }

    // Proceed with deletion if checks pass
    await supabaseAdmin.from("scan_history").delete().eq("user_id", user.id);
    await supabaseAdmin.from("subscriptions").delete().eq("user_id", user.id);

    // Delete the auth user using admin client
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      throw deleteError;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", {
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
    return Response.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}