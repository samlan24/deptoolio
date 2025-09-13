import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkScanWithRateLimits } from "../../lib/scan-limits";

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

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required",
          requiresAuth: true,
        },
        { status: 401 }
      );
    }

    // Rate limiting check
    const limitResult = await checkScanWithRateLimits(user.id);

    if (!limitResult.allowed) {
      const status = limitResult.rate_limited
        ? 429
        : limitResult.limit_exceeded
        ? 429
        : 500;

      const headers: Record<string, string> = {};
      if (limitResult.retry_after !== undefined) {
        headers["Retry-After"] = String(limitResult.retry_after);
      }

      return NextResponse.json(limitResult, { status, headers });
    }

    // Input validation
    const { owner, repo, path } = await request.json();

    if (!owner || !repo || !path) {
      return NextResponse.json(
        { error: "Missing owner, repo, or path" },
        { status: 400 }
      );
    }

    // Additional validation
    if (typeof owner !== 'string' || typeof repo !== 'string' || typeof path !== 'string') {
      return NextResponse.json(
        { error: "Invalid parameter types" },
        { status: 400 }
      );
    }

    // Basic sanitization
    const sanitizedOwner = owner.trim();
    const sanitizedRepo = repo.trim();
    const sanitizedPath = path.trim();

    if (!sanitizedOwner || !sanitizedRepo || !sanitizedPath) {
      return NextResponse.json(
        { error: "Parameters cannot be empty" },
        { status: 400 }
      );
    }

    // Validate GitHub username and repo patterns
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-._]){0,38}$/.test(sanitizedOwner)) {
      return NextResponse.json(
        { error: "Invalid GitHub username format" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(sanitizedRepo)) {
      return NextResponse.json(
        { error: "Invalid repository name format" },
        { status: 400 }
      );
    }

    // Send request to microservice with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(
        `${process.env.DEPCHECK_SERVICE_URL}/scan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "deptoolio-scanner/1.0"
          },
          body: JSON.stringify({
            owner: sanitizedOwner,
            repo: sanitizedRepo,
            path: sanitizedPath
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = "Scan failed";

        try {
          const errData = await response.json();
          errorMessage = errData.error || errorMessage;
        } catch {
          // If we can't parse the error response, use status-based message
          switch (response.status) {
            case 400:
              errorMessage = "Invalid request parameters";
              break;
            case 404:
              errorMessage = "Repository or folder not found";
              break;
            case 403:
              errorMessage = "Access denied to repository";
              break;
            case 500:
              errorMessage = "Internal server error during scan";
              break;
            default:
              errorMessage = `Scan service returned status ${response.status}`;
          }
        }

        return NextResponse.json(
          { error: errorMessage },
          { status: response.status >= 500 ? 500 : response.status }
        );
      }

      const data = await response.json();

      // Validate response structure
      if (!data || typeof data !== 'object') {
        return NextResponse.json(
          { error: "Invalid response from scan service" },
          { status: 500 }
        );
      }

      // Ensure expected arrays exist
      const result = {
        unusedDependencies: Array.isArray(data.unusedDependencies) ? data.unusedDependencies : [],
        missingDependencies: Array.isArray(data.missingDependencies) ? data.missingDependencies : [],
        ...data
      };

      return NextResponse.json(result);

    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { error: "Scan request timed out. The repository may be too large or the service is overloaded." },
          { status: 504 }
        );
      }

      console.error("Fetch error:", fetchError);
      return NextResponse.json(
        { error: "Unable to connect to scan service" },
        { status: 503 }
      );
    }

  } catch (error: any) {
    console.error("API Route Error:", error);

    // Handle JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}