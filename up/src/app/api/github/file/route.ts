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

// Function to search for package.json files in the repository
// Replace your findPackageJsonFiles function with this:
async function findDependencyFiles(owner: string, repo: string, token: string) {
  // Search for multiple dependency file types
  const queries = [
    `filename:package.json repo:${owner}/${repo}`,
    `filename:requirements.txt repo:${owner}/${repo}`,
    `filename:Pipfile repo:${owner}/${repo}`,
    `filename:pyproject.toml repo:${owner}/${repo}`,
    `filename:pom.xml repo:${owner}/${repo}`,
    `filename:build.gradle repo:${owner}/${repo}`,
    `filename:composer.json repo:${owner}/${repo}`,
    `filename:go.mod repo:${owner}/${repo}`,
  ];

  const allFiles = [];

  for (const query of queries) {
    try {
      const response = await fetch(
        `https://api.github.com/search/code?q=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "dependency-scanner/1.0",
          },
        }
      );

      if (response.ok) {
        const searchResult = await response.json();
        if (searchResult.items) {
          allFiles.push(...searchResult.items);
        }
      }
    } catch (error) {
      console.error(`Error searching for ${query}:`, error);
    }
  }

  return allFiles;
}

// Add this function before your GET handler:
function getFileType(filename: string): "npm" | "python" | "go" | "php" | "rust" | "unknown" {
  const lowercaseName = filename.toLowerCase();

  if (lowercaseName.includes("package.json")) {
    return "npm";
  }

  if (
    lowercaseName.includes("requirements") ||
    lowercaseName.includes("pipfile") ||
    lowercaseName.includes("pyproject.toml")
  ) {
    return "python";
  }

  if (lowercaseName.includes("composer.json")) {
    return "php";
  }

  if (lowercaseName.includes("go.mod")) {
    return "go";
  }
  if (lowercaseName.includes("Cargo.toml")) {
    return "rust";
  }


  return "unknown";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Owner and repo are required" },
        { status: 400 }
      );
    }

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

    const dependencyFiles = await findDependencyFiles(
      owner,
      repo,
      session.provider_token
    );

    return NextResponse.json({ files: dependencyFiles });
  } catch (error) {
    console.error("Error searching for dependency files:", error);
    return NextResponse.json(
      { error: "Failed to search for dependency files" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { owner, repo, path = "package.json" } = await request.json();

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Owner and repo are required" },
        { status: 400 }
      );
    }

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
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          Authorization: `token ${session.provider_token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "dependency-scanner/1.0",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "package.json not found at this path" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch file" },
        { status: response.status }
      );
    }

    const fileData = await response.json();

    if (fileData.type !== "file") {
      return NextResponse.json(
        { error: "Path is not a file" },
        { status: 400 }
      );
    }

    // Decode base64 content
    const content = Buffer.from(fileData.content, "base64").toString("utf-8");
    const fileType = getFileType(path);

    return NextResponse.json({ content, sha: fileData.sha, path, fileType });
  } catch (error) {
    console.error("Error fetching file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
