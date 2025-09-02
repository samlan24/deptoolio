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
  details?: string;
  affected?: Array<{
    package: {
      name: string;
      ecosystem: string;
    };
    ranges?: Array<{
      type: string;
      events: Array<{
        introduced?: string;
        fixed?: string;
        last_affected?: string;
      }>;
    }>;
    versions?: string[];
    ecosystem_specific?: any;
    database_specific?: any;
  }>;
  references?: Array<{
    type: string;
    url: string;
  }>;
  database_specific?: {
    severity?: string;
    cvss?: any;
  };
  severity?: Array<{
    type: string;
    score: string;
  }>;
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

// Helper function to parse Rust version
function parseVersionConstraint(constraint: string): string {
  return constraint.replace(/^[~^>=<*]+/, "");
}

// Helper function to determine severity level
function getSeverityLevel(vuln: OSVVulnerability): string {
  // Check database-specific severity first
  if (vuln.database_specific?.severity) {
    const dbSeverity = vuln.database_specific.severity.toLowerCase();
    if (dbSeverity.includes("critical")) return "critical";
    if (dbSeverity.includes("high")) return "high";
    if (dbSeverity.includes("medium") || dbSeverity.includes("moderate")) return "moderate";
    if (dbSeverity.includes("low")) return "low";
  }

  // Check CVSS score from severity array
  if (vuln.severity && vuln.severity.length > 0) {
    for (const sev of vuln.severity) {
      if (sev.type === "CVSS_V3") {
        const score = parseFloat(sev.score);
        if (score >= 9.0) return "critical";
        if (score >= 7.0) return "high";
        if (score >= 4.0) return "moderate";
        if (score >= 0.1) return "low";
      }
    }
  }

  // Fallback based on summary keywords
  const summary = vuln.summary?.toLowerCase() || "";
  if (summary.includes("critical") || summary.includes("rce") || summary.includes("code execution")) {
    return "critical";
  }
  if (summary.includes("high") || summary.includes("privilege") || summary.includes("bypass")) {
    return "high";
  }
  if (summary.includes("medium") || summary.includes("moderate") || summary.includes("disclosure")) {
    return "moderate";
  }

  return "info";
}

// Helper function to check if version is affected by vulnerability
function isVersionAffected(currentVersion: string, affected: OSVVulnerability["affected"]): boolean {
  if (!affected || affected.length === 0) return false;

  const cleanVersion = parseVersionConstraint(currentVersion);

  for (const affectedItem of affected) {
    // Skip if not a Rust crate
    if (affectedItem.package.ecosystem !== "crates.io") continue;

    // Check specific versions list
    if (affectedItem.versions && affectedItem.versions.includes(cleanVersion)) {
      return true;
    }

    // Check ranges
    if (affectedItem.ranges) {
      for (const range of affectedItem.ranges) {
        if (range.type === "SEMVER" || range.type === "ECOSYSTEM") {
          for (const event of range.events) {
            // Simplified version range checking
            // In production, you'd want to use a proper semver library
            if (event.introduced && event.fixed) {
              if (compareVersions(cleanVersion, event.introduced) >= 0 &&
                  compareVersions(cleanVersion, event.fixed) < 0) {
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

// Helper function to compare versions (simplified)
function compareVersions(version1: string, version2: string): number {
  const v1 = version1.split('.').map(Number);
  const v2 = version2.split('.').map(Number);

  const maxLength = Math.max(v1.length, v2.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = v1[i] || 0;
    const part2 = v2[i] || 0;

    if (part1 !== part2) {
      return part1 - part2;
    }
  }

  return 0;
}

// Helper function to fetch with retry logic
async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
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
      console.log(`Attempt ${i + 1} failed for ${url}:`, error);
      if (i === retries) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, i))
      );
    }
  }
  throw new Error("Max retries reached");
}

// Helper function to get CVE from aliases
function getCVE(aliases?: string[]): string | undefined {
  if (!aliases) return undefined;
  return aliases.find(alias => alias.startsWith("CVE-"));
}

// Helper function to format affected versions
function formatAffectedVersions(affected?: OSVVulnerability["affected"]): string {
  if (!affected || affected.length === 0) return "Unknown";

  const ranges: string[] = [];

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

export async function POST(request: NextRequest) {
  try {
    const { dependencies } = await request.json();

    if (!dependencies || typeof dependencies !== "object") {
      return NextResponse.json({ error: "Dependencies required" }, { status: 400 });
    }

    if (Object.keys(dependencies).length === 0) {
      return NextResponse.json({ error: "No dependencies found" }, { status: 400 });
    }

    const entries = Object.entries(dependencies);
    const concurrency = 3; // OSV.dev can handle moderate concurrency

    // Query OSV.dev for each dependency
    const results = await pMap(
      entries,
      async ([packageName, version]) => {
        try {
          const cleanVersion = parseVersionConstraint(version as string);

          // Query OSV.dev API for vulnerabilities
          const osvQuery: OSVQueryRequest = {
            package: {
              name: packageName,
              ecosystem: "crates.io"
            }
          };

          const response = await fetchWithRetry(
            "https://api.osv.dev/v1/query",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "User-Agent": "rust-vulnerability-scanner/1.0"
              },
              body: JSON.stringify(osvQuery)
            }
          );

          if (!response.ok) {
            console.log(`Failed to query OSV for ${packageName}: ${response.status}`);
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

          // Filter vulnerabilities that affect the current version
          const relevantVulnerabilities: SecurityAdvisory[] = osvData.vulns
            .filter((vuln: OSVVulnerability) => {
              return isVersionAffected(cleanVersion, vuln.affected);
            })
            .map((vuln: OSVVulnerability) => ({
              advisoryId: vuln.id,
              packageName: packageName,
              title: vuln.summary || "Security Advisory",
              cve: getCVE(vuln.aliases),
              affectedVersions: formatAffectedVersions(vuln.affected),
              source: "OSV/RustSec",
              reportedAt: vuln.published || new Date().toISOString(),
              severity: getSeverityLevel(vuln),
              reference: vuln.references?.[0]?.url || `https://osv.dev/vulnerability/${vuln.id}`,
            }));

          const highestSeverity = relevantVulnerabilities.length > 0
            ? relevantVulnerabilities.reduce((highest, vuln) => {
                const currentLevel = vuln.severity || "info";
                const highestLevel = highest;

                const severityOrder = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 };

                return severityOrder[currentLevel as keyof typeof severityOrder] >
                       severityOrder[highestLevel as keyof typeof severityOrder] ? currentLevel : highest;
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
          console.error(`Error checking vulnerabilities for ${packageName}:`, error);
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
    const summary = {
      total: results.length,
      vulnerable: results.filter(r => r.isVulnerable).length,
      critical: results.filter(r => r.highestSeverity === "critical").length,
      high: results.filter(r => r.highestSeverity === "high").length,
      moderate: results.filter(r => r.highestSeverity === "moderate").length,
      low: results.filter(r => r.highestSeverity === "low").length,
      info: results.filter(r => r.highestSeverity === "info").length,
    };

    const report: VulnerabilityReport = {
      summary,
      vulnerabilities: results,
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error in Rust vulnerability scan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}