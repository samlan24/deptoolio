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

export async function GET(request: NextRequest) {
  try {
    // Get page and per_page from request query params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1");
    const per_page = parseInt(searchParams.get("per_page") ?? "10");

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.provider_token) {
      return NextResponse.json(
        { error: "GitHub token not found" },
        { status: 401 }
      );
    }

    const response = await fetch(
      `https://api.github.com/user/repos?sort=updated&per_page=${per_page}&page=${page}`,
      {
        headers: {
          Authorization: `token ${session.provider_token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "dependency-scanner/1.0",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch repositories" },
        { status: response.status }
      );
    }

    const repos = await response.json();

    // Extract pagination info from headers if exists
    const linkHeader = response.headers.get("link");
    // Add custom header or body property as needed for frontend pagination logic

    return NextResponse.json({ repos, linkHeader });
  } catch (error) {
    console.error("Error fetching repos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
