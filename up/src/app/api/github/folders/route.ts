// app/api/github/folders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const path = searchParams.get("path") ?? "";

    if (!owner || !repo) {
      return NextResponse.json({ error: "Missing owner or repo param" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.provider_token) {
      return NextResponse.json({ error: "GitHub token missing" }, { status: 401 });
    }

    const token = session.provider_token;

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

    const githubResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error("GitHub API error response:", githubResponse.status, errorText);
      return NextResponse.json(
        { error: `GitHub API error: ${githubResponse.status} ${githubResponse.statusText}` },
        { status: githubResponse.status }
      );
    }

    const data = await githubResponse.json();

    // Data should be array of files/folders for directories
    if (!Array.isArray(data)) {
      console.warn("GitHub content API returned non-array: ", data);
      return NextResponse.json({ error: "Unexpected GitHub API response format" }, { status: 500 });
    }

    // Filter folders only
    const folders = data.filter((item) => item.type === "dir");

    return NextResponse.json(folders);
  } catch (error: any) {
    console.error("Error in /api/github/folders", error);
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 });
  }
}
