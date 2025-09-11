import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Error fetching user:", {
      message: userError.message,
      code: userError.code,
    });
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }

  const { data: scans, error } = await supabase
    .from("scan_history")
    .select("*")
    .order("scanned_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching scan history:", {
      message: error.message,
      code: error.code,
      userId: user?.id,
    });
    return NextResponse.json(
      { error: "Failed to fetch scan history" },
      { status: 500 }
    );
  }

  return NextResponse.json({ scans });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    console.error("Error fetching user for scan record:", {
      message: userError?.message,
      code: userError?.code,
    });
    return NextResponse.json(
      { error: "User not authenticated" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const {
    repo_name,
    file_path,
    file_type,
    total_deps,
    outdated_count,
    major_count,
  } = body;

  const { data, error } = await supabase
    .from("scan_history")
    .insert({
      user_id: user.id,
      repo_name,
      file_path,
      file_type,
      total_deps,
      outdated_count,
      major_count,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating scan record:", {
      message: error.message,
      code: error.code,
      userId: user.id,
      repoName: repo_name,
    });
    return NextResponse.json(
      { error: "Failed to save scan record" },
      { status: 500 }
    );
  }

  return NextResponse.json({ scan: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get("id");
  if (!scanId) {
    return NextResponse.json({ error: "Scan ID is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("scan_history")
    .delete()
    .eq("id", scanId);

  if (error) {
    console.error("Error deleting scan record:", {
      message: error.message,
      code: error.code,
      userId: user?.id,
      scanId,
    });
    return NextResponse.json(
      { error: "Failed to delete scan record" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
