import { NextRequest, NextResponse } from "next/server";

const SERVICE_INDEX_URL = "https://api.nuget.org/v3/index.json";

let vulnerabilityIndexCache: any[] | null = null;
const vulnerabilityPagesCache: Record<string, any[]> = {};

function compareVersions(v1: string, v2: string): number {
  const parse = (v: string) => v.split(".").map((x) => parseInt(x));
  const a = parse(v1);
  const b = parse(v2);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const n1 = a[i] ?? 0;
    const n2 = b[i] ?? 0;
    if (n1 !== n2) return n1 - n2;
  }
  return 0;
}

// Minimal semver range check (supports simple operators)
function semverSatisfies(version: string, range: string): boolean {
  if (range === version) return true;
  if (range.startsWith(">=")) {
    return compareVersions(version, range.slice(2)) >= 0;
  }
  if (range.startsWith("<=")) {
    return compareVersions(version, range.slice(2)) <= 0;
  }
  if (range.startsWith(">")) {
    return compareVersions(version, range.slice(1)) > 0;
  }
  if (range.startsWith("<")) {
    return compareVersions(version, range.slice(1)) < 0;
  }
  return range === version;
}

async function getVulnerabilityInfoUrl(): Promise<string | null> {
  const res = await fetch(SERVICE_INDEX_URL);
  if (!res.ok) return null;
  const data = await res.json();
  const vulnResource = data.resources.find((r: any) =>
    r["@type"].startsWith("VulnerabilityInfo")
  );
  return vulnResource ? vulnResource["@id"] : null;
}

async function loadVulnerabilityIndex(): Promise<any[]> {
  if (vulnerabilityIndexCache) return vulnerabilityIndexCache;
  const vulnUrl = await getVulnerabilityInfoUrl();
  if (!vulnUrl) return [];
  const res = await fetch(vulnUrl);
  if (!res.ok) return [];
  const index = await res.json();
  vulnerabilityIndexCache = index;
  return index;
}

async function loadVulnerabilityPage(url: string): Promise<any[]> {
  if (vulnerabilityPagesCache[url]) return vulnerabilityPagesCache[url];
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  vulnerabilityPagesCache[url] = data;
  return data;
}

// Checks if installed version is vulnerable by testing against all vulnerable ranges
function isVersionVulnerable(
  installedVersion: string,
  vulnerableRanges: string[]
): boolean {
  for (const range of vulnerableRanges) {
    if (semverSatisfies(installedVersion, range)) return true;
  }
  return false;
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

    const vulnIndex = await loadVulnerabilityIndex();
    if (vulnIndex.length === 0) {
      return NextResponse.json(
        { error: "Failed to load vulnerability data" },
        { status: 500 }
      );
    }

    // Load all vulnerability pages
    const pagesData = await Promise.all(
      vulnIndex.map((page) => loadVulnerabilityPage(page["@id"]))
    );

    // Aggregate vulnerabilities indexed by package ID lowercase
    const vulnerabilityDict: Record<string, any[]> = {};
    for (const page of pagesData) {
      for (const [pkgId, vulns] of Object.entries(page)) {
        vulnerabilityDict[pkgId.toLowerCase()] = (
          vulnerabilityDict[pkgId.toLowerCase()] || []
        ).concat(vulns as any[]);
      }
    }

    // Generate audit report
    const auditReport: Record<string, any> = {};
    for (const [pkgId, version] of Object.entries(dependencies)) {
      const vulns = vulnerabilityDict[pkgId.toLowerCase()] || [];
      const matched = vulns.filter((vuln) =>
        isVersionVulnerable(version as string, vuln.versions)
      );
      auditReport[pkgId] = {
        version,
        vulnerabilities: matched,
      };
    }

    return NextResponse.json({ audit: auditReport });
  } catch (error) {
    console.error("Error scanning vulnerabilities:", error);
    return NextResponse.json(
      { error: "Internal server error during vulnerability scan" },
      { status: 500 }
    );
  }
}
