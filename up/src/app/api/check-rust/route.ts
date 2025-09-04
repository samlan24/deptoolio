import { NextRequest, NextResponse } from "next/server";
import pMap from "p-map";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

interface CrateVersion {
  id: number;
  crate: string;
  num: string;
  dl_path: string;
  readme_path: string;
  updated_at: string;
  created_at: string;
  downloads: number;
  features: { [key: string]: string[] };
  yanked: boolean;
  license: string;
  links: {
    dependencies: string;
    version_downloads: string;
    authors: string;
  };
  crate_size?: number;
  published_by?: {
    id: number;
    login: string;
    name: string;
    avatar: string;
    url: string;
  };
}

interface CrateResponse {
  crate: {
    id: string;
    name: string;
    updated_at: string;
    versions: number[];
    keywords: string[];
    categories: string[];
    badges: any[];
    created_at: string;
    downloads: number;
    recent_downloads: number;
    max_version: string;
    newest_version: string;
    max_stable_version: string;
    description: string;
    homepage: string;
    documentation: string;
    repository: string;
    links: {
      version_downloads: string;
      versions: string;
      owners: string;
      owner_team: string;
      owner_user: string;
      reverse_dependencies: string;
    };
    exact_match: boolean;
  };
  versions: CrateVersion[];
  keywords: any[];
  categories: any[];
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

async function checkAndIncrementScanLimit(
  userId: string
): Promise<{
  allowed: boolean;
  error?: string;
  currentCount: number;
  limit: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_and_increment_scan_limit", {
    p_user_id: userId,
  });

  if (error) {
    console.error("Error checking scan limit:", error);
    return {
      allowed: false,
      error: "Database error",
      currentCount: 0,
      limit: 0,
    };
  }

  return {
    allowed: data.allowed,
    error: data.error,
    currentCount: data.current_count,
    limit: data.limit,
  };
}

// Helper function to parse Rust/Cargo version requirements
function parseVersionRange(versionSpec: string): VersionInfo | null {
  const rangeMatch = versionSpec.match(/^([~^>=<*]+)/);
  const rangeType = rangeMatch?.[0];
  let cleaned = versionSpec.replace(/^[~^>=<*]+/, "");

  // Handle wildcard versions like "1.*"
  if (cleaned.includes("*")) {
    cleaned = cleaned.replace(/\.\*$/, ".0");
  }

  // Basic validation for semantic version pattern
  if (!/^\d+(\.\d+)?(\.\d+)?/.test(cleaned)) {
    return null;
  }

  return {
    original: versionSpec,
    cleaned: cleaned,
    isRange: !!rangeType,
    rangeType,
  };
}

// Helper function to check if a version is prerelease
function isPrerelease(version: string): boolean {
  return /-(alpha|beta|rc|pre|dev|snapshot)/i.test(version);
}

// Helper function to compare semantic versions
function compareVersions(version1: string, version2: string): number {
  const v1 = version1
    .split(/[.-]/)
    .map((part) => (isNaN(Number(part)) ? part : Number(part)));
  const v2 = version2
    .split(/[.-]/)
    .map((part) => (isNaN(Number(part)) ? part : Number(part)));

  const maxLength = Math.max(v1.length, v2.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = v1[i] ?? 0;
    const part2 = v2[i] ?? 0;

    // Handle numeric comparison
    if (typeof part1 === "number" && typeof part2 === "number") {
      if (part1 !== part2) {
        return part1 - part2;
      }
    } else {
      // Handle string comparison for pre-release identifiers
      const str1 = String(part1);
      const str2 = String(part2);

      if (str1 !== str2) {
        // Pre-release ordering
        const order = { alpha: 1, beta: 2, rc: 3, pre: 4 };
        const order1 = order[str1.toLowerCase() as keyof typeof order] ?? 5;
        const order2 = order[str2.toLowerCase() as keyof typeof order] ?? 5;

        if (order1 !== order2) {
          return order1 - order2;
        }

        return str1.localeCompare(str2);
      }
    }
  }

  return 0;
}

// Helper function to get major version number
function getMajorVersion(version: string): number {
  const match = version.match(/^(\d+)/);
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
          "User-Agent": "rust-dependency-tracker/1.0",
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

// Helper function to get latest stable version
function getLatestStableVersion(versions: CrateVersion[]): string {
  const stableVersions = versions
    .filter((v) => !v.yanked && !isPrerelease(v.num))
    .sort((a, b) => compareVersions(b.num, a.num)); // Sort descending

  return stableVersions[0]?.num || "";
}

// Helper function to get latest version (including prereleases)
function getLatestVersion(versions: CrateVersion[]): string {
  const allVersions = versions
    .filter((v) => !v.yanked)
    .sort((a, b) => compareVersions(b.num, a.num)); // Sort descending

  return allVersions[0]?.num || "";
}

// Parse Cargo.toml file content
function parseCargoToml(content: string): Record<string, string> {
  const dependencies: Record<string, string> = {};
  const lines = content.split("\n");
  let currentSection = "";
  let inDependenciesSection = false;
  let inDevDependenciesSection = false;

  for (let line of lines) {
    line = line.trim();

    // Skip comments and empty lines
    if (line.startsWith("#") || line === "") {
      continue;
    }

    // Check for section headers
    if (line.match(/^\[.*\]$/)) {
      currentSection = line.toLowerCase();
      inDependenciesSection = currentSection === "[dependencies]";
      inDevDependenciesSection =
        currentSection === "[dev-dependencies]" ||
        currentSection === "[build-dependencies]";
      continue;
    }

    // Parse dependencies in [dependencies] section
    if (inDependenciesSection || inDevDependenciesSection) {
      // Handle simple version format: name = "version"
      const simpleMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"$/);
      if (simpleMatch) {
        dependencies[simpleMatch[1]] = simpleMatch[2];
        continue;
      }

      // Handle table format: name = { version = "version", ... }
      const tableMatch = line.match(
        /^([a-zA-Z0-9_-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)".*\}$/
      );
      if (tableMatch) {
        dependencies[tableMatch[1]] = tableMatch[2];
        continue;
      }

      // Handle multi-line table format start
      const tableStartMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*\{/);
      if (tableStartMatch && line.includes("version")) {
        const versionMatch = line.match(/version\s*=\s*"([^"]+)"/);
        if (versionMatch) {
          dependencies[tableStartMatch[1]] = versionMatch[2];
        }
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

    const limitResult = await checkAndIncrementScanLimit(user.id);
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error:
            limitResult.error ||
            `Monthly scan limit exceeded. You have used ${limitResult.currentCount}/${limitResult.limit} scans this month.`,
          limitExceeded: true,
          currentCount: limitResult.currentCount,
          limit: limitResult.limit,
        },
        { status: 429 }
      );
    }
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!file.name.endsWith(".toml") && !file.name.endsWith("Cargo.toml")) {
      return NextResponse.json(
        { error: "File must be a Cargo.toml file" },
        { status: 400 }
      );
    }

    const contents = await file.text();

    if (!contents.trim()) {
      return NextResponse.json(
        { error: "Empty Cargo.toml file" },
        { status: 400 }
      );
    }

    const allDeps = parseCargoToml(contents);

    if (Object.keys(allDeps).length === 0) {
      return NextResponse.json(
        { error: "No dependencies found in Cargo.toml" },
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

        // Skip conditions for Rust crates
        if (
          // Git dependencies
          versionSpecifier.includes("git") ||
          versionSpecifier.includes("path") ||
          versionSpecifier.includes("branch") ||
          versionSpecifier.includes("tag") ||
          versionSpecifier.includes("rev") ||
          // Invalid patterns
          versionSpecifier.trim() === "" ||
          versionSpecifier.length > 50
        ) {
          console.log(
            `Skipping ${name}: unsupported dependency pattern (${versionSpecifier})`
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
          // Fetch crate info from crates.io API
          const response = await fetchWithRetry(
            `https://crates.io/api/v1/crates/${encodeURIComponent(name)}`
          );

          if (response.status === 404) {
            console.log(`Skipping ${name}: crate not found on crates.io`);
            return null;
          }

          if (response.status === 429) {
            console.log(`Rate limited for ${name}, skipping`);
            return null;
          }

          if (!response.ok) {
            console.log(
              `Skipping ${name}: crates.io returned status ${response.status}`
            );
            return null;
          }

          const crateInfo: CrateResponse = await response.json();

          if (!crateInfo?.versions || crateInfo.versions.length === 0) {
            console.log(`Skipping ${name}: no versions found`);
            return null;
          }

          const latestVersion = getLatestVersion(crateInfo.versions);
          const latestStable = getLatestStableVersion(crateInfo.versions);

          if (!latestVersion) {
            console.log(`Skipping ${name}: no valid versions found`);
            return null;
          }

          // Get metadata from the latest stable version (or latest if no stable)
          const versionForMetadata = latestStable || latestVersion;
          const versionData = crateInfo.versions.find(
            (v) => v.num === versionForMetadata
          );

          const license = versionData?.license || null;
          const lastUpdate = versionData?.updated_at || null;

          // For maintainers count, we could fetch owners, but let's keep it simple and set to null
          const maintainersCount = null;

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
            maintainersCount: undefined,
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
      { error: "Failed to process Cargo.toml file" },
      { status: 500 }
    );
  }
}
