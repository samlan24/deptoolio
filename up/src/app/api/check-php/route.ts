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

interface PackagistVersion {
  version: string;
  version_normalized: string;
  time?: string;
  license?: string[];
  authors?: Array<{ name: string; email?: string; homepage?: string }>;
  cleaned?: string;
}

interface PackagistResponse {
  package: {
    name: string;
    versions: { [key: string]: PackagistVersion };
  };
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


// Helper function to parse PHP version constraints
function parseVersionRange(versionSpec: string): VersionInfo | null {
  const rangeMatch = versionSpec.match(/^([\^~>=<]+)/);
  const rangeType = rangeMatch?.[0];
  const cleaned = versionSpec.replace(/^[\^~>=<]+/, "");

  // Remove common prefixes like 'v' and clean the version
  const cleanedVersion = cleaned.replace(/^v/, "");

  // Basic validation for semantic version pattern
  if (!/^\d+(\.\d+)?(\.\d+)?/.test(cleanedVersion)) {
    return null;
  }

  return {
    original: versionSpec,
    cleaned: cleanedVersion,
    isRange: !!rangeType,
    rangeType,
  };
}

// Helper function to check if a version is prerelease
function isPrerelease(version: string): boolean {
  return /-(alpha|beta|rc|dev|snapshot)/i.test(version);
}

// Helper function to compare PHP versions
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
      // Handle alpha, beta, rc, dev parts
      const order = { dev: 0, alpha: 1, beta: 2, rc: 3 };
      const order1 = order[part1.toLowerCase() as keyof typeof order] ?? 4;
      const order2 = order[part2.toLowerCase() as keyof typeof order] ?? 4;

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
  const match = version.match(/^v?(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Helper function to determine if current version satisfies constraint
function satisfiesConstraint(version: string, constraint: string): boolean {
  // Simple implementation for common constraints
  if (constraint.startsWith("^")) {
    const constraintVersion = constraint.slice(1);
    const currentMajor = getMajorVersion(version);
    const constraintMajor = getMajorVersion(constraintVersion);

    return (
      currentMajor === constraintMajor &&
      compareVersions(version, constraintVersion) >= 0
    );
  }

  if (constraint.startsWith("~")) {
    const constraintVersion = constraint.slice(1);
    const versionParts = version.split(".");
    const constraintParts = constraintVersion.split(".");

    // Same major and minor version
    return (
      versionParts[0] === constraintParts[0] &&
      versionParts[1] === constraintParts[1] &&
      compareVersions(version, constraintVersion) >= 0
    );
  }

  // Direct comparison for other cases
  return compareVersions(version, constraint.replace(/^[>=<]+/, "")) >= 0;
}

// Helper function to fetch with retry logic
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "php-dependency-tracker/1.0",
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
  latestVersion: string,
  versionSpec: string
): "current" | "outdated" | "major" {
  try {
    if (satisfiesConstraint(latestVersion, versionSpec)) {
      return "current";
    }
  } catch (error) {
    console.log(
      `Constraint satisfaction check failed for ${versionSpec}: ${error}`
    );
  }

  if (compareVersions(currentVersion, latestVersion) >= 0) {
    return "current";
  }

  const currentMajor = getMajorVersion(currentVersion);
  const latestMajor = getMajorVersion(latestVersion);

  return currentMajor < latestMajor ? "major" : "outdated";
}

// Helper function to get latest stable version
function getLatestStableVersion(versions: {
  [key: string]: PackagistVersion;
}): string {
  const stableVersions = Object.keys(versions)
    .filter((v) => !isPrerelease(v))
    .sort((a, b) => compareVersions(b, a)); // Sort descending

  return stableVersions[0] || "";
}

// Helper function to get latest version (including prereleases)
function getLatestVersion(versions: {
  [key: string]: PackagistVersion;
}): string {
  const allVersions = Object.keys(versions).sort((a, b) =>
    compareVersions(b, a)
  ); // Sort descending

  return allVersions[0] || "";
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

    if (!file.name.endsWith(".json") && !file.name.endsWith("composer.json")) {
      return NextResponse.json(
        { error: "File must be a composer.json file" },
        { status: 400 }
      );
    }

    const contents = await file.text();
    let composerJson;

    try {
      composerJson = JSON.parse(contents);
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 }
      );
    }

    if (!composerJson || typeof composerJson !== "object") {
      return NextResponse.json(
        { error: "Invalid composer.json structure" },
        { status: 400 }
      );
    }

    const allDeps = {
      ...composerJson.require,
      ...composerJson["require-dev"],
    };

    // Remove PHP itself and platform packages
    delete allDeps.php;
    Object.keys(allDeps).forEach((key) => {
      if (key.startsWith("ext-") || key.startsWith("lib-")) {
        delete allDeps[key];
      }
    });

    if (Object.keys(allDeps).length === 0) {
      return NextResponse.json(
        { error: "No dependencies found in composer.json" },
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

        // Enhanced skip conditions for Composer
        if (
          // Git and URL dependencies
          versionSpecifier.startsWith("git+") ||
          versionSpecifier.startsWith("http") ||
          versionSpecifier.startsWith("https") ||
          versionSpecifier.startsWith("file:") ||
          (versionSpecifier.includes("/") && !name.includes("/")) || // Skip if version has slash but package name doesn't
          // Development and branch references
          versionSpecifier.includes("dev-") ||
          versionSpecifier.includes("@dev") ||
          versionSpecifier.includes("@stable") ||
          versionSpecifier.includes("@alpha") ||
          versionSpecifier.includes("@beta") ||
          versionSpecifier.includes("@RC") ||
          // Wildcard patterns
          versionSpecifier.includes("*") ||
          versionSpecifier.includes("x") ||
          // Platform packages (should already be filtered but double-check)
          name.startsWith("ext-") ||
          name.startsWith("lib-") ||
          name === "php" ||
          // Empty or invalid
          versionSpecifier.trim() === "" ||
          versionSpecifier.length > 50
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
            `https://packagist.org/packages/${encodeURIComponent(name)}.json`
          );

          if (response.status === 404) {
            console.log(`Skipping ${name}: package not found on Packagist`);
            return null;
          }

          if (response.status === 429) {
            console.log(`Rate limited for ${name}, skipping`);
            return null;
          }

          if (!response.ok) {
            console.log(
              `Skipping ${name}: Packagist returned status ${response.status}`
            );
            return null;
          }

          const packageInfo: PackagistResponse = await response.json();

          if (!packageInfo?.package?.versions) {
            console.log(`Skipping ${name}: invalid package info received`);
            return null;
          }

          const versions = packageInfo.package.versions;
          const latestVersion = getLatestVersion(versions);
          const latestStable = getLatestStableVersion(versions);

          if (!latestVersion) {
            console.log(`Skipping ${name}: no versions found`);
            return null;
          }

          // Get metadata from the latest stable version (or latest if no stable)
          const versionForMetadata = latestStable || latestVersion;
          const packageVersionInfo = versions[versionForMetadata];

          const maintainersCount = Array.isArray(packageVersionInfo?.authors)
            ? packageVersionInfo.authors.length
            : 0;

          const license =
            Array.isArray(packageVersionInfo?.license) &&
            packageVersionInfo.license.length > 0
              ? packageVersionInfo.license.join(", ")
              : null;

          const lastUpdate = packageVersionInfo?.time || null;

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
            isPrerelease: isPrerelease(latestVersion),
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

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in uploaded file" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process composer.json" },
      { status: 500 }
    );
  }
}
