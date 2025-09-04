import { NextRequest, NextResponse } from "next/server";
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

interface GoProxyVersionInfo {
  Version: string;
  Time: string;
}

interface PkgGoDevResponse {
  module: {
    path: string;
    version: string;
  };
  license?: string;
  published_at?: string;
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

// Helper function to parse Go module version
function parseVersionRange(versionSpec: string): VersionInfo | null {
  // Go modules typically don't use range operators like npm/composer
  // They use exact versions with 'v' prefix
  const cleaned = versionSpec.replace(/^v/, "");

  // Basic validation for semantic version pattern
  if (!/^\d+(\.\d+)?(\.\d+)?/.test(cleaned)) {
    return null;
  }

  return {
    original: versionSpec,
    cleaned: cleaned,
    isRange: false, // Go modules typically use exact versions
    rangeType: undefined,
  };
}

// Helper function to check if a version is prerelease
function isPrerelease(version: string): boolean {
  return (
    /-(alpha|beta|rc|pre|dev|snapshot)/i.test(version) ||
    /-\d{14}-[a-f0-9]{12}$/.test(version)
  ); // Go pseudo-versions
}

// Helper function to compare semantic versions
function compareVersions(version1: string, version2: string): number {
  const v1 = version1.replace(/^v/, "").split(/[.-]/);
  const v2 = version2.replace(/^v/, "").split(/[.-]/);

  const maxLength = Math.max(v1.length, v2.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = v1[i] || "0";
    const part2 = v2[i] || "0";

    // Handle numeric parts
    if (!isNaN(Number(part1)) && !isNaN(Number(part2))) {
      const num1 = parseInt(part1, 10);
      const num2 = parseInt(part2, 10);
      if (num1 !== num2) {
        return num1 - num2;
      }
    } else {
      // Handle pre-release identifiers
      const order = { dev: 0, alpha: 1, beta: 2, rc: 3, pre: 4 };
      const order1 = order[part1.toLowerCase() as keyof typeof order] ?? 5;
      const order2 = order[part2.toLowerCase() as keyof typeof order] ?? 5;

      if (order1 !== order2) {
        return order1 - order2;
      }

      // String comparison for other cases
      if (part1 !== part2) {
        return part1.localeCompare(part2);
      }
    }
  }

  return 0;
}

// Helper function to get major version number
function getMajorVersion(version: string): number {
  const match = version.replace(/^v/, "").match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Helper function to fetch with retry logic
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "go-dependency-tracker/1.0",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed for ${url}:`, error);
      if (i === retries) throw error;
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
  latestVersion: string
): "current" | "outdated" | "major" {
  if (compareVersions(currentVersion, latestVersion) >= 0) {
    return "current";
  }

  const currentMajor = getMajorVersion(currentVersion);
  const latestMajor = getMajorVersion(latestVersion);

  return currentMajor < latestMajor ? "major" : "outdated";
}

// Helper function to get versions from Go proxy
async function getVersionsFromProxy(modulePath: string): Promise<string[]> {
  try {
    const response = await fetchWithRetry(
      `https://proxy.golang.org/${encodeURIComponent(modulePath)}/@v/list`
    );

    if (!response.ok) {
      throw new Error(`Go proxy returned status ${response.status}`);
    }

    const versionsText = await response.text();
    return versionsText.split("\n").filter((v) => v.trim() !== "");
  } catch (error) {
    console.log(
      `Failed to fetch versions from Go proxy for ${modulePath}:`,
      error
    );
    return [];
  }
}

// Helper function to get latest stable version
function getLatestStableVersion(versions: string[]): string {
  const stableVersions = versions
    .filter((v) => !isPrerelease(v))
    .sort((a, b) => compareVersions(b, a)); // Sort descending

  return stableVersions[0] || "";
}

// Helper function to get latest version (including prereleases)
function getLatestVersion(versions: string[]): string {
  const sortedVersions = versions.sort((a, b) => compareVersions(b, a)); // Sort descending

  return sortedVersions[0] || "";
}

// Parse go.mod file content
function parseGoMod(content: string): Record<string, string> {
  const dependencies: Record<string, string> = {};
  const lines = content.split("\n");
  let inRequireBlock = false;
  let inIndirectBlock = false;

  for (let line of lines) {
    line = line.trim();

    // Skip comments and empty lines
    if (line.startsWith("//") || line === "") {
      continue;
    }

    // Handle require block
    if (line.startsWith("require (")) {
      inRequireBlock = true;
      continue;
    }

    if (inRequireBlock && line === ")") {
      inRequireBlock = false;
      continue;
    }

    // Check for indirect dependencies marker
    if (line.includes("// indirect")) {
      inIndirectBlock = true;
    }

    // Parse single require line
    if (line.startsWith("require ") && !line.includes("(")) {
      const match = line.match(/require\s+([^\s]+)\s+([^\s]+)/);
      if (match) {
        dependencies[match[1]] = match[2];
      }
      continue;
    }

    // Parse dependencies within require block
    if (inRequireBlock && line !== "") {
      // Skip indirect dependencies unless specified otherwise
      if (line.includes("// indirect")) {
        continue;
      }

      const match = line.match(/([^\s]+)\s+([^\s]+)/);
      if (match) {
        dependencies[match[1]] = match[2];
      }
    }
  }

  return dependencies;
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

    if (!file.name.endsWith(".mod") && !file.name.endsWith("go.mod")) {
      return NextResponse.json(
        { error: "File must be a go.mod file" },
        { status: 400 }
      );
    }

    const contents = await file.text();

    if (!contents.trim()) {
      return NextResponse.json({ error: "Empty go.mod file" }, { status: 400 });
    }

    const allDeps = parseGoMod(contents);

    if (Object.keys(allDeps).length === 0) {
      return NextResponse.json(
        { error: "No dependencies found in go.mod" },
        { status: 400 }
      );
    }

    const entries = Object.entries(allDeps);
    const concurrency = 2;

    const results = await pMap(
      entries,
      async ([name, versionSpecifier]) => {
        if (typeof versionSpecifier !== "string") {
          console.log(`Skipping ${name}: version is not a string`);
          return null;
        }

        // Skip conditions for Go modules
        if (
          // Local and replace modules
          versionSpecifier.startsWith("./") ||
          versionSpecifier.startsWith("../") ||
          versionSpecifier.includes("file://") ||
          // Standard library (no dots in path usually means stdlib)
          !name.includes(".") ||
          // Invalid patterns
          versionSpecifier.trim() === "" ||
          versionSpecifier.length > 100 ||
          // Skip pseudo-versions (they're typically development versions)
          /v\d+\.\d+\.\d+-\d{14}-[a-f0-9]{12}/.test(versionSpecifier)
        ) {
          console.log(
            `Skipping ${name}: unsupported module pattern (${versionSpecifier})`
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
          // Get available versions from Go proxy
          const availableVersions = await getVersionsFromProxy(name);

          if (availableVersions.length === 0) {
            console.log(`Skipping ${name}: no versions found`);
            return null;
          }

          const latestVersion = getLatestVersion(availableVersions);
          const latestStable = getLatestStableVersion(availableVersions);

          if (!latestVersion) {
            console.log(`Skipping ${name}: no valid versions found`);
            return null;
          }

          // Try to get additional info from pkg.go.dev API
          let license: string | null = null;
          let lastUpdate: string | null = null;

          try {
            const pkgResponse = await fetchWithRetry(
              `https://api.pkg.go.dev/v1/${encodeURIComponent(name)}`
            );

            if (pkgResponse.ok) {
              const pkgInfo: PkgGoDevResponse = await pkgResponse.json();
              license = pkgInfo.license || null;
              lastUpdate = pkgInfo.published_at || null;
            }
          } catch (error) {
            console.log(`Could not fetch pkg.go.dev info for ${name}:`, error);
            // Continue without license/update info
          }

          // Use stable version for comparison if available and different from latest
          const versionToCompare =
            latestStable && latestStable !== latestVersion
              ? latestStable
              : latestVersion;

          const status = getDependencyStatus(
            versionInfo.cleaned,
            versionToCompare
          );

          const result: DependencyResult = {
            name,
            currentVersion: versionSpecifier,
            latestVersion,
            latestStable: latestStable || latestVersion,
            status,
            isPrerelease: isPrerelease(latestVersion),
            maintainersCount: undefined, // Not available for Go modules
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

    // Sort results: major updates first, then outdated, then current
    filteredResults.sort((a, b) => {
      const statusOrder = { major: 0, outdated: 1, current: 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];

      if (statusDiff !== 0) {
        return statusDiff;
      }

      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(filteredResults);
  } catch (error) {
    console.error("Error processing request:", error);

    return NextResponse.json(
      { error: "Failed to process go.mod file" },
      { status: 500 }
    );
  }
}
