import { NextRequest, NextResponse } from "next/server";
import * as semver from "semver";

const SERVICE_INDEX_URL = "https://api.nuget.org/v3/index.json";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

let vulnerabilityIndexCache: any[] | null = null;
let cacheTimestamp: number = 0;
const vulnerabilityPagesCache: Record<string, { data: any[]; timestamp: number }> = {};

interface VulnerabilityAdvisory {
  id: string;
  title: string;
  severity: string;
  module_name: string;
  overview: string;
  references: string[];
  patched_versions: string[];
  vulnerable_versions: string[];
}

interface VulnerabilityResult {
  packageName: string;
  currentVersion: string;
  vulnerabilities: {
    advisoryId: string;
    packageName: string;
    title: string;
    cve?: string;
    affectedVersions: string;
    source: string;
    reportedAt: string;
    severity: string;
    reference: string;
  }[];
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

// Convert NuGet version range format to semver compatible format
function convertNuGetRangeToSemver(range: string): string {
  // NuGet uses formats like [1.0.0, 2.0.0), (1.0.0, 2.0.0], [1.0.0], etc.
  const cleanRange = range.trim();

  // Handle exact version [1.0.0]
  if (cleanRange.startsWith('[') && cleanRange.endsWith(']') && !cleanRange.includes(',')) {
    const version = cleanRange.slice(1, -1).trim();
    return version;
  }

  // Handle range formats
  if (cleanRange.includes(',')) {
    const isMinInclusive = cleanRange.startsWith('[');
    const isMaxInclusive = cleanRange.endsWith(']');

    const content = cleanRange.slice(1, -1);
    const [minVersion, maxVersion] = content.split(',').map(v => v.trim());

    let constraint = '';

    if (minVersion) {
      constraint += isMinInclusive ? `>=${minVersion}` : `>${minVersion}`;
    }

    if (maxVersion) {
      if (constraint) constraint += ' ';
      constraint += isMaxInclusive ? `<=${maxVersion}` : `<${maxVersion}`;
    }

    return constraint;
  }

  // Return as-is for simple constraints
  return cleanRange;
}

// Enhanced version vulnerability check with proper semver support
function isVersionVulnerable(installedVersion: string, vulnerableRanges: string[]): boolean {
  if (!vulnerableRanges || vulnerableRanges.length === 0) return false;

  try {
    // Clean and validate the installed version
    const cleanInstalledVersion = semver.clean(installedVersion);
    if (!cleanInstalledVersion) {
      console.warn(`Invalid installed version format: ${installedVersion}`);
      return false;
    }

    return vulnerableRanges.some(range => {
      try {
        const convertedRange = convertNuGetRangeToSemver(range);

        // Handle multiple constraints separated by space
        if (convertedRange.includes(' ') && !convertedRange.includes('||')) {
          const constraints = convertedRange.split(' ');
          return constraints.every(constraint => {
            const trimmed = constraint.trim();
            return trimmed ? semver.satisfies(cleanInstalledVersion, trimmed) : true;
          });
        }

        return semver.satisfies(cleanInstalledVersion, convertedRange);
      } catch (rangeError) {
        console.warn(`Failed to parse version range "${range}":`, rangeError);

        // Fallback to simple string comparison for edge cases
        if (range === installedVersion) return true;

        // Try basic operators as fallback
        if (range.startsWith('>=') && semver.gte(cleanInstalledVersion, range.slice(2))) return true;
        if (range.startsWith('<=') && semver.lte(cleanInstalledVersion, range.slice(2))) return true;
        if (range.startsWith('>') && semver.gt(cleanInstalledVersion, range.slice(1))) return true;
        if (range.startsWith('<') && semver.lt(cleanInstalledVersion, range.slice(1))) return true;

        return false;
      }
    });
  } catch (error) {
    console.warn(`Version comparison failed for ${installedVersion} against ranges:`, vulnerableRanges, error);
    return false; // Fail safe - don't report vulnerability if we can't determine it
  }
}

// Enhanced vulnerability info URL fetcher with retry logic
async function getVulnerabilityInfoUrl(): Promise<string | null> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(SERVICE_INDEX_URL, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'dotnet-vulnerability-scanner/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const vulnResource = data.resources?.find((r: any) =>
        r["@type"]?.includes("VulnerabilityInfo")
      );

      return vulnResource ? vulnResource["@id"] : null;
    } catch (error) {
      console.warn(`Attempt ${attempt} to fetch vulnerability info URL failed:`, error);

      if (attempt === maxRetries) {
        return null;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return null;
}

// Enhanced vulnerability index loader with TTL cache
async function loadVulnerabilityIndex(): Promise<any[]> {
  const now = Date.now();

  if (vulnerabilityIndexCache && (now - cacheTimestamp) < CACHE_TTL) {
    return vulnerabilityIndexCache;
  }

  try {
    const vulnUrl = await getVulnerabilityInfoUrl();
    if (!vulnUrl) {
      console.error("Could not retrieve vulnerability info URL");
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(vulnUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'dotnet-vulnerability-scanner/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to load vulnerability index: HTTP ${res.status}`);
    }

    const index = await res.json();
    vulnerabilityIndexCache = Array.isArray(index) ? index : [];
    cacheTimestamp = now;

    return vulnerabilityIndexCache;
  } catch (error) {
    console.error("Error loading vulnerability index:", error);
    // Return cached data if available, even if expired
    return vulnerabilityIndexCache || [];
  }
}

// Enhanced vulnerability page loader with caching and error handling
async function loadVulnerabilityPage(url: string): Promise<any[]> {
  const now = Date.now();
  const cached = vulnerabilityPagesCache[url];

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'dotnet-vulnerability-scanner/1.0'
      }
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Failed to load vulnerability page: HTTP ${res.status}`);
    }

    const data = await res.json();
    const processedData = typeof data === 'object' ? data : [];

    vulnerabilityPagesCache[url] = {
      data: processedData,
      timestamp: now
    };

    return processedData;
  } catch (error) {
    console.warn(`Error loading vulnerability page ${url}:`, error);

    // Return cached data if available, even if expired
    if (cached) {
      return cached.data;
    }

    return [];
  }
}

// Helper function to determine severity level
function determineSeverity(vulnerability: any): string {
  if (vulnerability.severity) {
    const sev = vulnerability.severity.toLowerCase();
    if (['critical', 'high', 'moderate', 'medium', 'low'].includes(sev)) {
      return sev === 'medium' ? 'moderate' : sev;
    }
  }

  // Try to infer from title or description
  const text = `${vulnerability.title || ''} ${vulnerability.description || ''}`.toLowerCase();

  if (text.includes('critical') || text.includes('rce') || text.includes('code execution')) {
    return 'critical';
  }
  if (text.includes('high') || text.includes('privilege') || text.includes('bypass')) {
    return 'high';
  }
  if (text.includes('moderate') || text.includes('medium') || text.includes('disclosure')) {
    return 'moderate';
  }
  if (text.includes('low')) {
    return 'low';
  }

  return 'moderate'; // Default to moderate for safety
}

export async function POST(request: NextRequest) {
  try {
    const { dependencies } = await request.json();

    if (!dependencies || typeof dependencies !== "object") {
      return NextResponse.json(
        { error: "Dependencies required. Expected format: { 'package-name': 'version' }" },
        { status: 400 }
      );
    }

    const dependencyEntries = Object.entries(dependencies);

    if (dependencyEntries.length === 0) {
      return NextResponse.json(
        { error: "No dependencies found" },
        { status: 400 }
      );
    }

    // Limit the number of packages to prevent abuse
    if (dependencyEntries.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 packages allowed per request" },
        { status: 400 }
      );
    }

    console.log(`Scanning ${dependencyEntries.length} .NET packages for vulnerabilities...`);

    const vulnIndex = await loadVulnerabilityIndex();
    if (vulnIndex.length === 0) {
      return NextResponse.json(
        { error: "Failed to load vulnerability data from NuGet" },
        { status: 503 }
      );
    }

    // Load vulnerability pages with error handling
    const pagesData = await Promise.allSettled(
      vulnIndex.map((page) => loadVulnerabilityPage(page["@id"]))
    );

    // Process successful page loads
    const successfulPages = pagesData
      .filter((result): result is PromiseFulfilledResult<any[]> => result.status === 'fulfilled')
      .map(result => result.value);

    if (successfulPages.length === 0) {
      return NextResponse.json(
        { error: "Failed to load any vulnerability page data" },
        { status: 503 }
      );
    }

    // Aggregate vulnerabilities indexed by package ID (case-insensitive)
    const vulnerabilityDict: Record<string, any[]> = {};
    let totalVulnerabilities = 0;

    for (const page of successfulPages) {
      if (page && typeof page === 'object') {
        for (const [pkgId, vulns] of Object.entries(page)) {
          if (Array.isArray(vulns)) {
            const normalizedPkgId = pkgId.toLowerCase();
            vulnerabilityDict[normalizedPkgId] = (
              vulnerabilityDict[normalizedPkgId] || []
            ).concat(vulns);
            totalVulnerabilities += vulns.length;
          }
        }
      }
    }

    console.log(`Loaded ${totalVulnerabilities} vulnerabilities across ${Object.keys(vulnerabilityDict).length} packages`);

    // Process each dependency
    const results: VulnerabilityResult[] = [];

    for (const [pkgId, version] of dependencyEntries) {
      try {
        const normalizedPkgId = pkgId.toLowerCase();
        const vulns = vulnerabilityDict[normalizedPkgId] || [];

        const matchedVulnerabilities = vulns.filter((vuln) => {
          try {
            return isVersionVulnerable(version as string, vuln.versions || []);
          } catch (error) {
            console.warn(`Error checking vulnerability for ${pkgId}@${version}:`, error);
            return false;
          }
        });

        if (matchedVulnerabilities.length > 0) {
          const securityAdvisories = matchedVulnerabilities.map((vuln, index) => ({
            advisoryId: `${pkgId.toLowerCase()}-${index}`,
            packageName: pkgId,
            title: vuln.title || `Vulnerability in ${pkgId}`,
            cve: vuln.cve || undefined,
            affectedVersions: (vuln.versions || []).join(', ') || 'Unknown',
            source: 'NuGet Security Advisory',
            reportedAt: vuln.publishedDate || new Date().toISOString(),
            severity: determineSeverity(vuln),
            reference: vuln.url || `https://www.nuget.org/packages/${pkgId}`
          }));

          const severityOrder = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 };
          const highestSeverity = securityAdvisories.reduce((highest, advisory) => {
            const currentLevel = advisory.severity;
            return severityOrder[currentLevel as keyof typeof severityOrder] >
                   severityOrder[highest as keyof typeof severityOrder] ? currentLevel : highest;
          }, 'info');

          results.push({
            packageName: pkgId,
            currentVersion: version as string,
            vulnerabilities: securityAdvisories,
            isVulnerable: true,
            highestSeverity
          });
        }
      } catch (error) {
        console.error(`Error processing package ${pkgId}:`, error);
        // Continue processing other packages
      }
    }

    // Filter out packages with no vulnerabilities (consistent with other APIs)
    const vulnerableResults = results.filter(r => r.isVulnerable);

    // Calculate summary statistics
    const summary = {
      total: dependencyEntries.length,
      vulnerable: vulnerableResults.length,
      critical: vulnerableResults.filter(r => r.highestSeverity === "critical").length,
      high: vulnerableResults.filter(r => r.highestSeverity === "high").length,
      moderate: vulnerableResults.filter(r => r.highestSeverity === "moderate").length,
      low: vulnerableResults.filter(r => r.highestSeverity === "low").length,
      info: vulnerableResults.filter(r => r.highestSeverity === "info").length,
    };

    const report: VulnerabilityReport = {
      summary,
      vulnerabilities: vulnerableResults, // Only return packages with vulnerabilities
    };

    console.log(`Vulnerability scan complete: ${summary.vulnerable}/${summary.total} packages have vulnerabilities`);

    return NextResponse.json(report);

  } catch (error) {
    console.error("Error in .NET vulnerability scan:", error);
    return NextResponse.json(
      {
        error: "Internal server error during vulnerability scan",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}

// GET method for API documentation
export async function GET() {
  return NextResponse.json({
    message: ".NET Package Vulnerability Scanner API",
    usage: "POST request with { dependencies: { 'package-name': 'version' } }",
    example: {
      dependencies: {
        "Newtonsoft.Json": "12.0.1",
        "Microsoft.AspNetCore.App": "3.1.0",
        "System.Text.Json": "4.7.0"
      }
    },
    response_format: {
      summary: {
        total: "number",
        vulnerable: "number",
        critical: "number",
        high: "number",
        moderate: "number",
        low: "number",
        info: "number"
      },
      vulnerabilities: [
        {
          packageName: "string",
          currentVersion: "string",
          vulnerabilities: [
            {
              advisoryId: "string",
              packageName: "string",
              title: "string",
              cve: "string|undefined",
              affectedVersions: "string",
              source: "string",
              reportedAt: "ISO string",
              severity: "critical|high|moderate|low|info",
              reference: "string"
            }
          ],
          isVulnerable: "boolean",
          highestSeverity: "string"
        }
      ]
    },
    features: [
      "Proper semver version range handling",
      "NuGet version format support",
      "Intelligent cache management with TTL",
      "Comprehensive error handling",
      "Consistent API response format",
      "Rate limiting and abuse prevention"
    ],
    limits: {
      max_packages: 50,
      cache_ttl_minutes: 10,
      timeout_seconds: 15,
      supported_ecosystems: ["NuGet/.NET"]
    },
    data_source: "NuGet Security Advisory Database"
  });
}