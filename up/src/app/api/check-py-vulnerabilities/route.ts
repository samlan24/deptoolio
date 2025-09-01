import { NextRequest, NextResponse } from "next/server";

interface PythonDependencies {
  [packageName: string]: string;
}

interface OSVVulnerability {
  id: string;
  summary: string;
  details: string;
  aliases: string[];
  modified: string;
  published: string;
  database_specific?: {
    severity?: string;
    cwe_ids?: string[];
  };
  ecosystem_specific?: {
    severity?: string;
  };
  affected: Array<{
    package: {
      name: string;
      ecosystem: string;
    };
    ranges: Array<{
      type: string;
      events: Array<{
        introduced?: string;
        fixed?: string;
      }>;
    }>;
    versions: string[];
  }>;
  references: Array<{
    type: string;
    url: string;
  }>;
  severity?: Array<{
    type: string;
    score: string;
  }>;
}

interface OSVQueryPayload {
  package: {
    name: string;
    ecosystem: "PyPI";
  };
  version?: string;
}

interface OSVResponse {
  vulns?: OSVVulnerability[];
}

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

interface VulnerabilityResponse {
  advisories: Record<string, VulnerabilityAdvisory>;
  metadata: {
    total_vulnerabilities: number;
    packages_scanned: number;
    vulnerable_packages: number;
    scan_timestamp: string;
  };
}

// Helper function to normalize Python version specifiers
function normalizeVersion(version: string): string {
  // Remove common Python version specifiers and get the actual version
  return version.replace(/^[~^>=<!=]+/, '').split(',')[0].trim();
}

// Helper function to determine severity level
function determineSeverity(vuln: OSVVulnerability): string {
  // Check database_specific severity first
  if (vuln.database_specific?.severity) {
    const severity = vuln.database_specific.severity.toLowerCase();
    if (['critical', 'high', 'moderate', 'medium', 'low'].includes(severity)) {
      return severity === 'medium' ? 'moderate' : severity;
    }
  }

  // Check ecosystem_specific severity
  if (vuln.ecosystem_specific?.severity) {
    const severity = vuln.ecosystem_specific.severity.toLowerCase();
    if (['critical', 'high', 'moderate', 'medium', 'low'].includes(severity)) {
      return severity === 'medium' ? 'moderate' : severity;
    }
  }

  // Check CVSS scores if available
  if (vuln.severity) {
    for (const severity of vuln.severity) {
      if (severity.type === 'CVSS_V3') {
        const score = parseFloat(severity.score);
        if (score >= 9.0) return 'critical';
        if (score >= 7.0) return 'high';
        if (score >= 4.0) return 'moderate';
        if (score > 0) return 'low';
      }
    }
  }

  // Try to infer from aliases or ID
  const vulnText = `${vuln.id} ${vuln.summary} ${vuln.aliases?.join(' ') || ''}`.toLowerCase();

  if (vulnText.includes('critical')) return 'critical';
  if (vulnText.includes('high')) return 'high';
  if (vulnText.includes('moderate') || vulnText.includes('medium')) return 'moderate';
  if (vulnText.includes('low')) return 'low';

  return 'moderate'; // Default to moderate for safety
}

// Helper function to extract affected versions
function extractAffectedVersions(vuln: OSVVulnerability): string[] {
  const affectedVersions: string[] = [];

  for (const affected of vuln.affected || []) {
    // Add explicit versions
    if (affected.versions) {
      affectedVersions.push(...affected.versions);
    }

    // Add version ranges
    for (const range of affected.ranges || []) {
      for (const event of range.events || []) {
        if (event.introduced && event.introduced !== '0') {
          affectedVersions.push(`>=${event.introduced}`);
        }
        if (event.fixed) {
          affectedVersions.push(`<${event.fixed}`);
        }
      }
    }
  }

  return [...new Set(affectedVersions)];
}

// Helper function to extract patched versions
function extractPatchedVersions(vuln: OSVVulnerability): string[] {
  const patchedVersions: string[] = [];

  for (const affected of vuln.affected || []) {
    for (const range of affected.ranges || []) {
      for (const event of range.events || []) {
        if (event.fixed) {
          patchedVersions.push(event.fixed);
        }
      }
    }
  }

  return [...new Set(patchedVersions)];
}

// Query OSV database for a specific package
async function queryOSVForPackage(packageName: string, version?: string): Promise<OSVResponse> {
  const payload: OSVQueryPayload = {
    package: {
      name: packageName,
      ecosystem: "PyPI"
    }
  };

  if (version) {
    payload.version = normalizeVersion(version);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Python-Package-Vulnerability-Scanner/1.0"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`OSV API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { dependencies } = await request.json() as { dependencies: PythonDependencies };

    if (!dependencies || typeof dependencies !== "object") {
      return NextResponse.json({
        error: "Dependencies required. Expected format: { 'package-name': 'version' }"
      }, { status: 400 });
    }

    const packageEntries = Object.entries(dependencies);

    if (packageEntries.length === 0) {
      return NextResponse.json({
        error: "At least one dependency is required"
      }, { status: 400 });
    }

    // Limit the number of packages to prevent abuse
    if (packageEntries.length > 50) {
      return NextResponse.json({
        error: "Maximum 50 packages allowed per request"
      }, { status: 400 });
    }

    const advisories: Record<string, VulnerabilityAdvisory> = {};
    let advisoryCounter = 0;

    // Process packages in parallel with concurrency limit
    const concurrency = 5; // Reduced to be respectful to OSV API
    const batchSize = Math.ceil(packageEntries.length / concurrency);

    for (let i = 0; i < packageEntries.length; i += batchSize) {
      const batch = packageEntries.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async ([packageName, version]) => {
          try {
            const osvResponse = await queryOSVForPackage(packageName, version);

            if (osvResponse.vulns && osvResponse.vulns.length > 0) {
              for (const vuln of osvResponse.vulns) {
                const advisoryId = `advisory_${advisoryCounter++}`;
                const severity = determineSeverity(vuln);

                advisories[advisoryId] = {
                  id: vuln.id,
                  title: vuln.summary || `Vulnerability in ${packageName}`,
                  severity,
                  module_name: packageName,
                  overview: vuln.details || vuln.summary || "No description available",
                  references: vuln.references?.map(ref => ref.url) || [],
                  patched_versions: extractPatchedVersions(vuln),
                  vulnerable_versions: extractAffectedVersions(vuln)
                };
              }
            }
          } catch (error) {
            console.error(`Error processing package ${packageName}:`, error);
            // Continue processing other packages even if one fails
          }
        })
      );

      // Small delay between batches to be respectful to the API
      if (i + batchSize < packageEntries.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const vulnerablePackages = new Set(
      Object.values(advisories).map(adv => adv.module_name)
    ).size;

    const response: VulnerabilityResponse = {
      advisories,
      metadata: {
        total_vulnerabilities: Object.keys(advisories).length,
        packages_scanned: packageEntries.length,
        vulnerable_packages: vulnerablePackages,
        scan_timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Error in Python package vulnerability scan:", error);
    return NextResponse.json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error occurred"
    }, { status: 500 });
  }
}

// GET method for API documentation
export async function GET() {
  return NextResponse.json({
    message: "Python Package Vulnerability Scanner API",
    usage: "POST request with { dependencies: { 'package-name': 'version' } }",
    example: {
      dependencies: {
        "requests": "2.25.1",
        "django": "3.1.0",
        "flask": "1.1.0"
      }
    },
    response_format: {
      advisories: {
        "advisory_id": {
          id: "string",
          title: "string",
          severity: "critical|high|moderate|low",
          module_name: "string",
          overview: "string",
          references: ["string"],
          patched_versions: ["string"],
          vulnerable_versions: ["string"]
        }
      },
      metadata: {
        total_vulnerabilities: "number",
        packages_scanned: "number",
        vulnerable_packages: "number",
        scan_timestamp: "ISO string"
      }
    },
    limits: {
      max_packages: 50,
      supported_ecosystems: ["PyPI"],
      timeout: "15 seconds per request"
    },
    data_source: "OSV (Open Source Vulnerabilities) Database"
  });
}