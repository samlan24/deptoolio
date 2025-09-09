import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function DELETE() {
  const cookieStore = await cookies();

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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete user data in correct order (foreign keys first)
    await supabase.from("scan_history").delete().eq("user_id", user.id);
    await supabase.from("subscriptions").delete().eq("user_id", user.id);

    // Delete the auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(
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
