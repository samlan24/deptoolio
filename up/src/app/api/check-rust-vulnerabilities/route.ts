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

interface OSVVulnerability {
  id: string;
  published: string;
  modified: string;
  aliases?: string[];
  summary: string;
  affected?: Array<{
    package: {
      name: string;
      ecosystem: string;
    };
    versions?: string[];
    ranges?: Array<{
      type: string;
      events: Array<{
        introduced?: string;
        fixed?: string;
        last_affected?: string;
      }>;
    }>;
  }>;
  references?: Array<{ type: string; url: string }>;
  database_specific?: { severity?: string };
  severity?: Array<{ type: string; score: string }>;
}

interface OSVQueryRequest {
  package: {
    name: string;
    ecosystem: string;
  };
  version?: string;
}

interface OSVQueryResponse {
  vulns: OSVVulnerability[];
}

// Parses and cleans version (removes leading operators like ~, ^, >= etc)
function parseVersionConstraint(constraint: string): string {
  return constraint.replace(/^[~^>=<*]+/, "");
}

// Compares semantic versions (simple numeric part wise)
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a !== b) return a - b;
  }
  return 0;
}

// Checks if a version is within vulnerable affected versions/ranges
function isVersionAffected(
  currentVersion: string,
  affected?: OSVVulnerability["affected"]
): boolean {
  if (!affected || affected.length === 0) return false;
  const cleanVersion = parseVersionConstraint(currentVersion);

  for (const affectedItem of affected) {
    if (affectedItem.package.ecosystem !== "crates.io") continue;

    if (affectedItem.versions?.includes(cleanVersion)) {
      return true;
    }

    if (affectedItem.ranges) {
      for (const range of affectedItem.ranges) {
        if (range.type === "SEMVER" || range.type === "ECOSYSTEM") {
          for (const event of range.events) {
            if (event.introduced && event.fixed) {
              if (
                compareVersions(cleanVersion, event.introduced) >= 0 &&
                compareVersions(cleanVersion, event.fixed) < 0
              ) {
                return true;
              }
            } else if (event.introduced && !event.fixed) {
              if (compareVersions(cleanVersion, event.introduced) >= 0) {
                return true;
              }
            } else if (event.last_affected) {
              if (compareVersions(cleanVersion, event.last_affected) <= 0) {
                return true;
              }
            }
          }
        }
      }
    }
  }
  return false;
}

// Determine severity based on OSV fields and CVSS scores with fallback keywords
function getSeverityLevel(vuln: OSVVulnerability): string {
  if (vuln.database_specific?.severity) {
    const s = vuln.database_specific.severity.toLowerCase();
    if (s.includes("critical")) return "critical";
    if (s.includes("high")) return "high";
    if (s.includes("medium") || s.includes("moderate")) return "moderate";
    if (s.includes("low")) return "low";
  }

  if (vuln.severity?.length) {
    for (const s of vuln.severity) {
      if (s.type === "CVSS_V3") {
        const score = parseFloat(s.score);
        if (score >= 9) return "critical";
        if (score >= 7) return "high";
        if (score >= 4) return "moderate";
        if (score > 0) return "low";
      }
    }
  }

  const summary = vuln.summary?.toLowerCase() || "";
  if (
    summary.includes("critical") ||
    summary.includes("rce") ||
    summary.includes("code execution")
  )
    return "critical";
  if (
    summary.includes("high") ||
    summary.includes("privilege") ||
    summary.includes("bypass")
  )
    return "high";
  if (
    summary.includes("medium") ||
    summary.includes("moderate") ||
    summary.includes("disclosure")
  )
    return "moderate";

  return "info";
}

// Extract CVE from aliases if any
function getCVE(aliases?: string[]): string | undefined {
  if (!aliases) return undefined;
  return aliases.find((alias) => alias.startsWith("CVE-"));
}

// Formats affected versions/ranges for readable output
function formatAffectedVersions(
  affected?: OSVVulnerability["affected"]
): string {
  if (!affected || affected.length === 0) return "Unknown";

  let ranges: string[] = [];
  for (const item of affected) {
    if (item.package.ecosystem !== "crates.io") continue;

    if (item.versions && item.versions.length > 0) {
      ranges.push(item.versions.join(", "));
    }
    if (item.ranges) {
      for (const range of item.ranges) {
        for (const event of range.events) {
          if (event.introduced && event.fixed) {
            ranges.push(`${event.introduced} - ${event.fixed}`);
          } else if (event.introduced) {
            ranges.push(`>= ${event.introduced}`);
          } else if (event.last_affected) {
            ranges.push(`<= ${event.last_affected}`);
          }
        }
      }
    }
  }
  return ranges.length > 0 ? ranges.join(", ") : "Unknown";
}

// Fetch with retry logic for robustness
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (i === retries) throw error;
      await new Promise((res) => setTimeout(res, 2 ** i * 1000));
    }
  }
  throw new Error("Max retries reached");
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
    if (Object.keys(dependencies).length === 0) {
      return NextResponse.json(
        { error: "No dependencies found" },
        { status: 400 }
      );
    }

    const entries = Object.entries(dependencies);
    const concurrency = 3;

    const results = await pMap(
      entries,
      async ([packageName, version]) => {
        const cleanVersion = parseVersionConstraint(version as string);
        const osvQuery: OSVQueryRequest = {
          package: {
            name: packageName,
            ecosystem: "crates.io",
          },
          version: cleanVersion,
        };

        const response = await fetchWithRetry("https://api.osv.dev/v1/query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "rust-vulnerability-scanner/1.0",
          },
          body: JSON.stringify(osvQuery),
        });

        if (!response.ok) {
          console.error(
            `Failed to fetch vulnerabilities for ${packageName}: ${response.status}`
          );
          return {
            packageName,
            currentVersion: version as string,
            vulnerabilities: [],
            isVulnerable: false,
          };
        }

        const osvData: OSVQueryResponse = await response.json();

        if (!osvData.vulns || osvData.vulns.length === 0) {
          return {
            packageName,
            currentVersion: version as string,
            vulnerabilities: [],
            isVulnerable: false,
          };
        }

        const relevantVulns = osvData.vulns.filter((vuln) =>
          isVersionAffected(cleanVersion, vuln.affected)
        );

        const vulnerabilities = relevantVulns.map((vuln) => ({
          advisoryId: vuln.id,
          packageName,
          title: vuln.summary || "Security Advisory",
          cve: getCVE(vuln.aliases),
          affectedVersions: formatAffectedVersions(vuln.affected),
          source: "OSV/RustSec",
          reportedAt: vuln.published || new Date().toISOString(),
          severity: getSeverityLevel(vuln),
          reference:
            vuln.references?.[0]?.url ||
            `https://osv.dev/vulnerability/${vuln.id}`,
        }));

        const order = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 };

        const highestSeverity = vulnerabilities.reduce((highest, vuln) => {
          const severity = (vuln.severity ?? "info") as keyof typeof order;
          return order[severity] > order[highest as keyof typeof order]
            ? severity
            : highest;
        }, "info");

        return {
          packageName,
          currentVersion: version as string,
          vulnerabilities,
          isVulnerable: vulnerabilities.length > 0,
          highestSeverity,
        };
      },
      { concurrency }
    );

    const vulnerableResults = results.filter((r) => r.isVulnerable);

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
      vulnerabilities: vulnerableResults,
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error in Rust vulnerability scan:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
