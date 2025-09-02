import { NextRequest, NextResponse } from "next/server";
import pMap from "p-map";

interface SecurityAdvisory {
  advisoryId: string;
  packageName: string;
  title: string;
  cve?: string;
  affectedVersions: string;
  source: string;
  reportedAt: string;
  severity?: string;
  reference: string;
}

interface PackagistSecurityResponse {
  advisories: {
    [packageName: string]: Array<{
      advisoryId: string;
      packageName: string;
      title: string;
      cve: string | null;
      affectedVersions: string;
      source: string;
      reportedAt: string;
      severity?: string;
      reference: string;
    }>;
  };
}

interface VulnerabilityResult {
  packageName: string;
  currentVersion: string;
  vulnerabilities: SecurityAdvisory[];
  isVulnerable: boolean;
  highestSeverity?: string;
}

interface VulnerabilityReport {
  summary: {
    total: number;
    vulnerable: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
  };
  vulnerabilities: VulnerabilityResult[];
}

// Helper function to parse PHP version constraints
function parseVersionConstraint(constraint: string): string {
  // Remove common prefixes and clean up
  return constraint.replace(/^[\^~>=<]+/, "").replace(/^v/, "");
}

// Helper function to check if a version satisfies a constraint
function satisfiesConstraint(version: string, constraint: string): boolean {
  // This is a simplified version check
  // In production, you might want to use a proper semver library for PHP
  const cleanVersion = version.replace(/^v/, "");
  const cleanConstraint = constraint
    .replace(/^[\^~>=<]+/, "")
    .replace(/^v/, "");

  // For now, do a simple string comparison
  // This would need to be more sophisticated for production use
  try {
    const versionParts = cleanVersion.split(".").map(Number);
    const constraintParts = cleanConstraint.split(".").map(Number);

    // Simple major.minor.patch comparison
    for (
      let i = 0;
      i < Math.max(versionParts.length, constraintParts.length);
      i++
    ) {
      const vPart = versionParts[i] || 0;
      const cPart = constraintParts[i] || 0;

      if (vPart !== cPart) {
        return vPart >= cPart;
      }
    }

    return true;
  } catch {
    // Fallback to string comparison if parsing fails
    return cleanVersion === cleanConstraint;
  }
}

// Helper function to determine severity level
function getSeverityLevel(severity?: string): string {
  if (!severity) return "info";

  const sev = severity.toLowerCase();
  if (sev.includes("critical")) return "critical";
  if (sev.includes("high")) return "high";
  if (sev.includes("medium") || sev.includes("moderate")) return "moderate";
  if (sev.includes("low")) return "low";

  return "info";
}

// Helper function to fetch with retry logic
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "php-vulnerability-scanner/1.0",
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

// Helper function to check if a package version is affected by an advisory
function isVersionAffected(
  currentVersion: string,
  affectedVersions: string
): boolean {
  try {
    // This is a simplified implementation
    // In production, you'd want to use a proper PHP version constraint parser

    // Handle common patterns like ">=1.0,<2.0" or "^1.0"
    if (affectedVersions.includes(",")) {
      // Multiple constraints (e.g., ">=1.0,<2.0")
      const constraints = affectedVersions.split(",");
      return constraints.every((constraint) => {
        const trimmed = constraint.trim();
        if (trimmed.startsWith(">=")) {
          const version = trimmed.replace(">=", "").trim();
          return satisfiesConstraint(currentVersion, ">=" + version);
        }
        if (trimmed.startsWith("<")) {
          const version = trimmed.replace("<", "").trim();
          return !satisfiesConstraint(currentVersion, ">=" + version);
        }
        return satisfiesConstraint(currentVersion, trimmed);
      });
    } else {
      // Single constraint
      return satisfiesConstraint(currentVersion, affectedVersions);
    }
  } catch (error) {
    console.log(`Error checking version constraint: ${error}`);
    // If we can't parse the constraint, assume it's affected to be safe
    return true;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { dependencies } = await request.json();

    if (!dependencies || typeof dependencies !== "object") {
      return NextResponse.json(
        { error: "Dependencies required" },
        { status: 400 }
      );
    }

    // Filter out platform packages and invalid dependencies
    const validDependencies = Object.fromEntries(
      Object.entries(dependencies).filter(([name, version]) => {
        return (
          typeof version === "string" &&
          !name.startsWith("ext-") &&
          !name.startsWith("lib-") &&
          name !== "php" &&
          name.includes("/") // Composer packages have vendor/package format
        );
      })
    );

    if (Object.keys(validDependencies).length === 0) {
      return NextResponse.json(
        { error: "No valid dependencies found" },
        { status: 400 }
      );
    }

    const entries = Object.entries(validDependencies);
    const concurrency = 3; // Can be slightly higher since we're making fewer requests

    // Fetch security advisories for each package
    const results = await pMap(
      entries,
      async ([packageName, version]) => {
        try {
          const cleanVersion = parseVersionConstraint(version as string);

          // Try the Packagist security advisory API first
          const response = await fetchWithRetry(
            `https://packagist.org/api/security-advisories/${encodeURIComponent(
              packageName
            )}.json`
          );

          if (response.status === 404) {
            // No advisories found for this package (which is good!)
            return {
              packageName,
              currentVersion: version as string,
              vulnerabilities: [],
              isVulnerable: false,
            };
          }

          if (!response.ok) {
            console.log(
              `Failed to fetch advisories for ${packageName}: ${response.status}`
            );
            return {
              packageName,
              currentVersion: version as string,
              vulnerabilities: [],
              isVulnerable: false,
            };
          }

          const advisoryData = await response.json();

          // The response structure might vary, so let's handle it flexibly
          let advisories: any[] = [];

          if (Array.isArray(advisoryData)) {
            advisories = advisoryData;
          } else if (
            advisoryData.advisories &&
            Array.isArray(advisoryData.advisories)
          ) {
            advisories = advisoryData.advisories;
          } else if (typeof advisoryData === "object") {
            // Sometimes the response is an object with the package name as key
            const packageKey = Object.keys(advisoryData).find(
              (key) => key === packageName
            );
            if (packageKey && Array.isArray(advisoryData[packageKey])) {
              advisories = advisoryData[packageKey];
            }
          }

          // Filter advisories that affect the current version
          const relevantVulnerabilities: SecurityAdvisory[] = advisories
            .filter((advisory: any) => {
              if (!advisory.affectedVersions) return false;
              return isVersionAffected(cleanVersion, advisory.affectedVersions);
            })
            .map((advisory: any) => ({
              advisoryId:
                advisory.advisoryId || advisory.id || `ADV-${Date.now()}`,
              packageName: packageName,
              title: advisory.title || "Security Advisory",
              cve: advisory.cve || undefined,
              affectedVersions: advisory.affectedVersions || "",
              source: advisory.source || "Packagist",
              reportedAt:
                advisory.reportedAt ||
                advisory.publishedAt ||
                new Date().toISOString(),
              severity: advisory.severity,
              reference:
                advisory.reference ||
                advisory.link ||
                `https://packagist.org/packages/${packageName}`,
            }));

          const highestSeverity =
            relevantVulnerabilities.length > 0
              ? relevantVulnerabilities.reduce((highest, vuln) => {
                  const currentLevel = getSeverityLevel(vuln.severity);
                  const highestLevel = getSeverityLevel(highest);

                  const severityOrder = {
                    critical: 4,
                    high: 3,
                    moderate: 2,
                    low: 1,
                    info: 0,
                  };

                  return severityOrder[
                    currentLevel as keyof typeof severityOrder
                  ] > severityOrder[highestLevel as keyof typeof severityOrder]
                    ? currentLevel
                    : highest;
                }, "info")
              : undefined;

          return {
            packageName,
            currentVersion: version as string,
            vulnerabilities: relevantVulnerabilities,
            isVulnerable: relevantVulnerabilities.length > 0,
            highestSeverity,
          };
        } catch (error) {
          console.error(
            `Error checking vulnerabilities for ${packageName}:`,
            error
          );
          return {
            packageName,
            currentVersion: version as string,
            vulnerabilities: [],
            isVulnerable: false,
          };
        }
      },
      { concurrency }
    );

    // Calculate summary statistics
    // Filter out packages with no vulnerabilities to match Python behavior
    const vulnerableResults = results.filter((r) => r.isVulnerable);

    // Calculate summary statistics
    const summary = {
      total: results.length,
      vulnerable: vulnerableResults.length,
      critical: vulnerableResults.filter(
        (r) => r.highestSeverity === "critical"
      ).length,
      high: vulnerableResults.filter((r) => r.highestSeverity === "high")
        .length,
      moderate: vulnerableResults.filter(
        (r) => r.highestSeverity === "moderate"
      ).length,
      low: vulnerableResults.filter((r) => r.highestSeverity === "low").length,
      info: vulnerableResults.filter((r) => r.highestSeverity === "info")
        .length,
    };

    const report: VulnerabilityReport = {
      summary,
      vulnerabilities: vulnerableResults, // Only return vulnerable packages
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error in PHP vulnerability scan:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
