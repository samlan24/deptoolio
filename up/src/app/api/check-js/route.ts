import { NextRequest, NextResponse } from "next/server";
import semver from "semver";
import pMap from "p-map";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkScanWithRateLimits } from '../../lib/scan-limits'

interface VersionInfo {
  original: string;
  cleaned: string;
  isRange: boolean;
  rangeType?: string;
}

interface DependencyResult {
  name: string;
  currentVersion: string;
  latestVersion: string;
  latestStable: string;
  status: "current" | "outdated" | "major";
  isPrerelease: boolean;
  maintainersCount?: number;
  lastUpdate?: string | null;
  license?: string | null;
}

function extractGitHubRepoInfo(
  url: string
): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/.]+)(\.git)?/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

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



// Helper function to parse version ranges
function parseVersionRange(versionSpec: string): VersionInfo | null {
  const rangeMatch = versionSpec.match(/^([\^~>=<]+)/);
  const rangeType = rangeMatch?.[0];
  const cleaned = versionSpec.replace(/^[\^~>=<]+/, "");

  const coercedVersion = semver.coerce(cleaned);

  if (!coercedVersion) {
    return null;
  }

  return {
    original: versionSpec,
    cleaned: coercedVersion.version,
    isRange: !!rangeType,
    rangeType,
  };
}

// Helper function to fetch with retry logic
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        headers: {
          "User-Agent": "dependency-tracker/1.0",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed for ${url}:`, error);
      if (i === retries) throw error;
      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, i))
      );
    }
  }
  throw new Error("Max retries reached");
}

// Helper function to determine dependency status
function getDependencyStatus(
  currentVersion: string,
  latestVersion: string,
  versionSpec: string
): "current" | "outdated" | "major" {
  // If the version spec range already satisfies the latest version, it's current
  try {
    if (semver.satisfies(latestVersion, versionSpec)) {
      return "current";
    }
  } catch (error) {
    // If semver.satisfies fails, fall back to direct comparison
    console.log(`semver.satisfies failed for ${versionSpec}: ${error}`);
  }

  // Compare versions directly
  if (semver.gte(currentVersion, latestVersion)) {
    return "current";
  }

  const currentMajor = semver.major(currentVersion);
  const latestMajor = semver.major(latestVersion);

  return currentMajor < latestMajor ? "major" : "outdated";
}

// Helper function to get latest stable version
function getLatestStableVersion(packageInfo: any): string {
  const versions = packageInfo.versions || {};
  const stableVersions = Object.keys(versions)
    .filter((v) => {
      try {
        return !semver.prerelease(v);
      } catch {
        return false;
      }
    })
    .sort(semver.rcompare);

  return stableVersions[0] || packageInfo["dist-tags"]?.latest || "";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!file.name.endsWith(".json") && !file.name.endsWith("package.json")) {
      return NextResponse.json(
        { error: "File must be a package.json file" },
        { status: 400 }
      );
    }

    const contents = await file.text();
    let packageJson;

    try {
      packageJson = JSON.parse(contents);
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 }
      );
    }

    if (!packageJson || typeof packageJson !== "object") {
      return NextResponse.json(
        { error: "Invalid package.json structure" },
        { status: 400 }
      );
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (Object.keys(allDeps).length === 0) {
      return NextResponse.json(
        { error: "No dependencies found in package.json" },
        { status: 400 }
      );
    }

    const entries = Object.entries(allDeps);
    const concurrency = 2; // Reduced for better reliability

    const results = await pMap(
      entries,
      async ([name, versionSpecifier]) => {
        if (typeof versionSpecifier !== "string") {
          console.log(`Skipping ${name}: version is not a string`);
          return null;
        }

        // Enhanced skip conditions
        if (
          // Git and URL dependencies
          versionSpecifier.startsWith("git+") ||
          versionSpecifier.startsWith("http") ||
          versionSpecifier.startsWith("https") ||
          versionSpecifier.startsWith("file:") ||
          versionSpecifier.startsWith("npm:") ||
          versionSpecifier.includes("/") ||
          // Workspace and local dependencies
          /^workspace:/.test(versionSpecifier) ||
          versionSpecifier.startsWith("link:") ||
          // Wildcard and tag dependencies
          versionSpecifier.includes("*") ||
          versionSpecifier.includes("x") ||
          versionSpecifier === "latest" ||
          versionSpecifier === "next" ||
          versionSpecifier === "beta" ||
          versionSpecifier === "alpha" ||
          versionSpecifier === "canary" ||
          // Empty or invalid
          versionSpecifier.trim() === "" ||
          versionSpecifier.length > 50 // Suspiciously long version strings
        ) {
          console.log(
            `Skipping ${name}: unsupported version pattern (${versionSpecifier})`
          );
          return null;
        }

        const versionInfo = parseVersionRange(versionSpecifier);

        if (!versionInfo) {
          console.log(
            `Skipping ${name}: cannot parse version from "${versionSpecifier}"`
          );
          return null;
        }

        try {
          const response = await fetchWithRetry(
            `https://registry.npmjs.org/${encodeURIComponent(name)}`
          );

          if (response.status === 404) {
            console.log(`Skipping ${name}: package not found on npm`);
            return null;
          }

          if (response.status === 429) {
            console.log(`Rate limited for ${name}, skipping`);
            return null;
          }

          if (!response.ok) {
            console.log(
              `Skipping ${name}: npm registry returned status ${response.status}`
            );
            return null;
          }

          const packageInfo = await response.json();
          const maintainersCount = Array.isArray(packageInfo.maintainers)
            ? packageInfo.maintainers.length
            : 0;

          const license =
            typeof packageInfo.license === "string"
              ? packageInfo.license
              : packageInfo.license?.type || null;

          if (!packageInfo || typeof packageInfo !== "object") {
            console.log(`Skipping ${name}: invalid package info received`);
            return null;
          }

          const latestVersion = packageInfo["dist-tags"]?.latest;
          const lastUpdate = latestVersion
            ? packageInfo.time?.[latestVersion]
            : null;
          const latestStable = getLatestStableVersion(packageInfo);

          if (!latestVersion) {
            console.log(`Skipping ${name}: no latest version found`);
            return null;
          }

          // Use stable version for comparison if available and different from latest
          const versionToCompare =
            latestStable && latestStable !== latestVersion
              ? latestStable
              : latestVersion;
          const status = getDependencyStatus(
            versionInfo.cleaned,
            versionToCompare,
            versionSpecifier
          );

          const result: DependencyResult = {
            name,
            currentVersion: versionSpecifier,
            latestVersion,
            latestStable: latestStable || latestVersion,
            status,
            isPrerelease: !!semver.prerelease(latestVersion),
            maintainersCount,
            lastUpdate,
            license,
          };

          return result;
        } catch (error) {
          console.error(`Error fetching data for ${name}:`, error);
          return null;
        }
      },
      { concurrency }
    );

    const filteredResults = results.filter(
      (result): result is DependencyResult => result !== null
    );

    if (filteredResults.length === 0) {
      return NextResponse.json(
        { error: "No valid dependencies could be processed" },
        { status: 400 }
      );
    }

    // Enhanced sorting: major updates first, then outdated, then current
    // Within each category, sort alphabetically by name
    filteredResults.sort((a, b) => {
      const statusOrder = { major: 0, outdated: 1, current: 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];

      if (statusDiff !== 0) {
        return statusDiff;
      }

      // If same status, sort alphabetically
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(filteredResults);
  } catch (error) {
    console.error("Error processing request:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in uploaded file" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process package.json" },
      { status: 500 }
    );
  }
}
