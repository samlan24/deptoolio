import { NextRequest, NextResponse } from "next/server";
import pMap from "p-map";
import xml2js from "xml2js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

interface CsprojDependency {
  name: string;
  currentVersion: string;
}

interface NuGetPackageVersion {
  version: string;
  lastUpdated: string;
  license: string | null;
}

interface NuGetPackageOwner {
  username: string;
  url: string;
}

interface NuGetDependencyResult {
  name: string;
  currentVersion: string;
  latestVersion: string;
  status: "current" | "outdated" | "major";
  lastUpdate?: string | null;
  license?: string | null;
  maintainersCount?: number;
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

async function checkScanWithRateLimits(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_scan_with_rate_limits", {
    p_user_id: userId,
  });

  if (error) {
    console.error("Error checking scan limits:", error);
    return { allowed: false, error: "Database error" };
  }

  return data;
}

// Compare semantic versions: returns
// 0 if equal, >0 if v1 > v2, <0 if v1 < v2
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

// Determine dependency status based on version comparison
function getDependencyStatus(
  currentVersion: string,
  latestVersion: string
): "current" | "outdated" | "major" {
  if (compareVersions(currentVersion, latestVersion) >= 0) {
    return "current";
  }
  const currentMajor = parseInt(currentVersion.split(".")[0]) || 0;
  const latestMajor = parseInt(latestVersion.split(".")[0]) || 0;
  return currentMajor < latestMajor ? "major" : "outdated";
}

// Fetch NuGet package metadata from API v3
async function fetchNuGetPackageMetadata(packageId: string): Promise<{
  latestVersion: string;
  lastUpdate: string;
  license: string | null;
  owners: NuGetPackageOwner[];
} | null> {
  try {
    // Search service base URL for NuGet API v3
    const serviceIndexResponse = await fetch(
      "https://api.nuget.org/v3/index.json"
    );
    if (!serviceIndexResponse.ok) return null;
    const serviceIndex = await serviceIndexResponse.json();

    // Extract useful endpoints
    const packageBaseAddress = serviceIndex.resources.find(
      (r: any) => r["@type"] === "PackageBaseAddress/3.0.0"
    )?.["@id"];
    const registrationBaseUrl = serviceIndex.resources.find((r: any) =>
      r["@type"].startsWith("RegistrationsBaseUrl")
    )?.["@id"];
    const ownerEndpoint = `https://api.nuget.org/v3/registration5-gz-semver2/${packageId.toLowerCase()}/index.json`;

    if (!packageBaseAddress || !registrationBaseUrl) return null;

    // Fetch registration index (contains metadata for versions)
    const registrationResponse = await fetch(ownerEndpoint);
    if (!registrationResponse.ok) return null;
    const registrationData = await registrationResponse.json();

    // Find latest stable version info
    const pages = registrationData.items; // pages of versions
    let latest: { version: string; catalogEntry: any } | null = null;

    for (const page of pages) {
      for (const item of page.items) {
        const version = item.catalogEntry.version;
        const isPrerelease = /-/.test(version); // simple prerelease check by presence of hyphen
        if (!isPrerelease) {
          if (!latest || compareVersions(version, latest.version) > 0) {
            latest = { version, catalogEntry: item.catalogEntry };
          }
        }
      }
    }

    if (!latest) return null;

    // Owners are available in catalogEntry.authors or listed as authors;
    // Alternatively, NuGet.org webpage or API may expose owners but through different endpoints,
    // here we approximate by authors.
    const catalog = latest.catalogEntry;
    const lastUpdated = catalog.published;
    const license = catalog.licenseUrl || null;

    // Owners not available as separate entities in this API;
    // You could parse catalog.authors for basic owner names.
    const ownersArray = catalog.authors
      ? catalog.authors
          .split(",")
          .map((o: string) => ({ username: o.trim(), url: "" }))
      : [];

    return {
      latestVersion: latest.version,
      lastUpdate: lastUpdated,
      license,
      owners: ownersArray,
    };
  } catch (error) {
    console.error("Error fetching NuGet package metadata:", error);
    return null;
  }
}

// Parse .csproj XML to extract dependencies and current versions
async function parseCsproj(content: string): Promise<CsprojDependency[]> {
  const dependencies: CsprojDependency[] = [];
  try {
    const parser = new xml2js.Parser();
    const parsed = await parser.parseStringPromise(content);

    // .csproj structure: Project -> ItemGroup[] -> PackageReference[]
    if (parsed.Project && parsed.Project.ItemGroup) {
      for (const itemGroup of parsed.Project.ItemGroup) {
        if (itemGroup.PackageReference) {
          for (const pkgRef of itemGroup.PackageReference) {
            const attrs = pkgRef.$ || {};
            const name = attrs.Include || attrs.Update;
            const version =
              attrs.Version ||
              (typeof pkgRef.Version === "string"
                ? pkgRef.Version
                : pkgRef.Version?.[0]);
            if (name && version) {
              dependencies.push({ name, currentVersion: version });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error parsing .csproj file:", error);
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

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csproj")) {
      return NextResponse.json(
        { error: "File must be a .csproj file" },
        { status: 400 }
      );
    }

    const content = await file.text();
    const dependencies = await parseCsproj(content);

    if (dependencies.length === 0) {
      return NextResponse.json(
        { error: "No package references found in .csproj file" },
        { status: 400 }
      );
    }

    const concurrency = 4;
    const results = await pMap(
      dependencies,
      async (dep) => {
        const metadata = await fetchNuGetPackageMetadata(dep.name);
        if (!metadata) {
          console.log(`Skipping ${dep.name}: unable to fetch metadata`);
          return null;
        }

        const status = getDependencyStatus(
          dep.currentVersion,
          metadata.latestVersion
        );

        return {
          name: dep.name,
          currentVersion: dep.currentVersion,
          latestVersion: metadata.latestVersion,
          status,
          lastUpdate: metadata.lastUpdate,
          license: metadata.license,
          maintainersCount: metadata.owners ? metadata.owners.length : 0,
        } as NuGetDependencyResult;
      },
      { concurrency }
    );

    const filteredResults = results.filter((r) => r !== null);

    if (filteredResults.length === 0) {
      return NextResponse.json(
        { error: "No valid dependencies could be processed" },
        { status: 400 }
      );
    }

    filteredResults.sort((a, b) => {
      const order = { major: 0, outdated: 1, current: 2 };
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(filteredResults);
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to process .csproj file" },
      { status: 500 }
    );
  }
}
