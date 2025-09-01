import { NextRequest, NextResponse } from "next/server";
import pMap from "p-map";

interface JavaVersionSpec {
  groupId: string;
  artifactId: string;
  version: string;
  scope?: string;
  classifier?: string;
}

interface JavaDependencyResult {
  name: string;
  currentVersion: string;
  latestVersion: string;
  status: "current" | "outdated" | "major";
  groupId: string;
  artifactId: string;
  scope?: string;
  lastUpdate?: string | null;
  maintainersCount?: number;
}

interface MavenSearchResponse {
  response: {
    numFound: number;
    docs: Array<{
      id: string;
      g: string; // groupId
      a: string; // artifactId
      latestVersion: string;
      repositoryId: string;
      p: string; // packaging
      timestamp: number;
      versionCount: number;
    }>;
  };
}

interface MavenVersionResponse {
  response: {
    numFound: number;
    docs: Array<{
      id: string;
      g: string;
      a: string;
      v: string; // version
      timestamp: number;
      p: string;
    }>;
  };
}

// Helper function to parse Maven pom.xml dependencies
function parsePomXml(content: string): JavaVersionSpec[] {
  const dependencies: JavaVersionSpec[] = [];

  try {
    // Simple XML parsing - in production, use a proper XML parser
    // Look for <dependency> blocks within <dependencies>
    const dependencyRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
    let match;

    while ((match = dependencyRegex.exec(content)) !== null) {
      const dependencyBlock = match[1];

      const groupIdMatch = dependencyBlock.match(/<groupId>(.*?)<\/groupId>/);
      const artifactIdMatch = dependencyBlock.match(/<artifactId>(.*?)<\/artifactId>/);
      const versionMatch = dependencyBlock.match(/<version>(.*?)<\/version>/);
      const scopeMatch = dependencyBlock.match(/<scope>(.*?)<\/scope>/);
      const classifierMatch = dependencyBlock.match(/<classifier>(.*?)<\/classifier>/);

      if (groupIdMatch && artifactIdMatch && versionMatch) {
        const groupId = groupIdMatch[1].trim();
        const artifactId = artifactIdMatch[1].trim();
        let version = versionMatch[1].trim();

        // Skip property placeholders like ${project.version}
        if (version.includes('${')) {
          continue;
        }

        // Handle version ranges - take the minimum version
        if (version.includes('[') || version.includes('(')) {
          const rangeMatch = version.match(/[\[\(]([^,\]\)]+)/);
          if (rangeMatch) {
            version = rangeMatch[1];
          } else {
            continue; // Skip if we can't parse the range
          }
        }

        dependencies.push({
          groupId,
          artifactId,
          version,
          scope: scopeMatch ? scopeMatch[1].trim() : undefined,
          classifier: classifierMatch ? classifierMatch[1].trim() : undefined,
        });
      }
    }
  } catch (error) {
    console.error("Error parsing pom.xml:", error);
  }

  return dependencies;
}

// Helper function to parse Gradle build files
function parseBuildGradle(content: string): JavaVersionSpec[] {
  const dependencies: JavaVersionSpec[] = [];

  try {
    // Look for dependency declarations in various formats
    const lines = content.split('\n');
    let inDependenciesBlock = false;
    let braceCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Track dependencies block
      if (trimmed.startsWith('dependencies') && trimmed.includes('{')) {
        inDependenciesBlock = true;
        braceCount = (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length;
        continue;
      }

      if (inDependenciesBlock) {
        braceCount += (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length;

        if (braceCount <= 0) {
          inDependenciesBlock = false;
          continue;
        }

        // Parse dependency lines
        // Format: implementation 'group:artifact:version'
        // Format: implementation group: 'group', name: 'artifact', version: 'version'

        // String notation: implementation 'group:artifact:version'
        const stringMatch = trimmed.match(/(?:implementation|compile|api|testImplementation|runtimeOnly)\s+['"](.*?)['"]/) ||
                           trimmed.match(/(?:implementation|compile|api|testImplementation|runtimeOnly)\s*\(\s*['"](.*?)['"]\s*\)/);

        if (stringMatch) {
          const parts = stringMatch[1].split(':');
          if (parts.length >= 3) {
            dependencies.push({
              groupId: parts[0],
              artifactId: parts[1],
              version: parts[2],
              scope: trimmed.includes('test') ? 'test' : 'compile',
            });
          }
          continue;
        }

        // Map notation: implementation group: 'group', name: 'artifact', version: 'version'
        if (trimmed.includes('group:') && trimmed.includes('name:') && trimmed.includes('version:')) {
          const groupMatch = trimmed.match(/group:\s*['"](.*?)['"]/);
          const nameMatch = trimmed.match(/name:\s*['"](.*?)['"]/);
          const versionMatch = trimmed.match(/version:\s*['"](.*?)['"]/);

          if (groupMatch && nameMatch && versionMatch) {
            dependencies.push({
              groupId: groupMatch[1],
              artifactId: nameMatch[1],
              version: versionMatch[1],
              scope: trimmed.includes('test') ? 'test' : 'compile',
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error parsing build.gradle:", error);
  }

  return dependencies;
}

// Helper function to compare Java versions (semantic versioning)
function compareJavaVersions(current: string, latest: string): "current" | "outdated" | "major" {
  const parseVersion = (v: string) => {
    // Handle common Java version patterns
    const cleanVersion = v.replace(/[^\d.]/g, '');
    const parts = cleanVersion.split('.').map(n => parseInt(n) || 0);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  };

  const currentVer = parseVersion(current);
  const latestVer = parseVersion(latest);

  if (
    currentVer.major === latestVer.major &&
    currentVer.minor === latestVer.minor &&
    currentVer.patch === latestVer.patch
  ) {
    return "current";
  }

  if (latestVer.major > currentVer.major) {
    return "major";
  }

  if (
    latestVer.major === currentVer.major &&
    (latestVer.minor > currentVer.minor ||
     (latestVer.minor === currentVer.minor && latestVer.patch > currentVer.patch))
  ) {
    return "outdated";
  }

  return "current";
}

// Helper function to fetch with retry logic
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "dependency-tracker/1.0",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed for ${url}:`, error);
      if (i === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries reached");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();

    if (
      !fileName.includes("pom.xml") &&
      !fileName.includes("build.gradle") &&
      !fileName.includes("build.gradle.kts")
    ) {
      return NextResponse.json(
        {
          error: "File must be a Java dependency file (pom.xml, build.gradle, or build.gradle.kts)",
        },
        { status: 400 }
      );
    }

    const contents = await file.text();
    let dependencies: JavaVersionSpec[] = [];

    // Parse based on file type
    if (fileName.includes("pom.xml")) {
      dependencies = parsePomXml(contents);
    } else if (fileName.includes("build.gradle")) {
      dependencies = parseBuildGradle(contents);
    }

    if (dependencies.length === 0) {
      return NextResponse.json(
        { error: "No valid dependencies found in the file" },
        { status: 400 }
      );
    }

    const concurrency = 2; // Maven Central can handle more concurrent requests

    const results = await pMap(
      dependencies,
      async (dep) => {
        try {
          // Search for the artifact to get latest version and metadata
          const searchUrl = `https://search.maven.org/solrsearch/select?q=g:"${encodeURIComponent(dep.groupId)}"+AND+a:"${encodeURIComponent(dep.artifactId)}"&rows=1&wt=json`;

          const response = await fetchWithRetry(searchUrl);

          if (!response.ok) {
            console.log(`Skipping ${dep.groupId}:${dep.artifactId}: Maven Central returned status ${response.status}`);
            return null;
          }

          const searchResult: MavenSearchResponse = await response.json();

          if (searchResult.response.numFound === 0) {
            console.log(`Skipping ${dep.groupId}:${dep.artifactId}: not found on Maven Central`);
            return null;
          }

          const artifact = searchResult.response.docs[0];
          const latestVersion = artifact.latestVersion;

          // Get version-specific information for timestamp
          const versionUrl = `https://search.maven.org/solrsearch/select?q=g:"${encodeURIComponent(dep.groupId)}"+AND+a:"${encodeURIComponent(dep.artifactId)}"+AND+v:"${encodeURIComponent(latestVersion)}"&rows=1&wt=json`;

          let lastUpdate: string | null = null;
          let maintainersCount = 0;

          try {
            const versionResponse = await fetchWithRetry(versionUrl);
            if (versionResponse.ok) {
              const versionResult: MavenVersionResponse = await versionResponse.json();
              if (versionResult.response.numFound > 0) {
                const versionDoc = versionResult.response.docs[0];
                lastUpdate = new Date(versionDoc.timestamp).toISOString();
              }
            }
          } catch (error) {
            console.warn(`Could not fetch version details for ${dep.groupId}:${dep.artifactId}`);
          }

          // Estimate maintainers count based on organization
          // This is a rough estimate since Maven Central doesn't expose maintainer info easily
          if (dep.groupId.includes('org.apache') || dep.groupId.includes('com.google')) {
            maintainersCount = 10; // Large organizations
          } else if (dep.groupId.includes('org.springframework') || dep.groupId.includes('com.fasterxml')) {
            maintainersCount = 5; // Medium organizations
          } else if (dep.groupId.split('.').length >= 3) {
            maintainersCount = 3; // Corporate packages
          } else {
            maintainersCount = 1; // Individual/small projects
          }

          const status = compareJavaVersions(dep.version, latestVersion);

          const result: JavaDependencyResult = {
            name: `${dep.groupId}:${dep.artifactId}`,
            currentVersion: dep.version,
            latestVersion,
            status,
            groupId: dep.groupId,
            artifactId: dep.artifactId,
            scope: dep.scope,
            lastUpdate,
            maintainersCount,
          };

          return result;
        } catch (error) {
          console.error(`Error fetching data for ${dep.groupId}:${dep.artifactId}:`, error);
          return null;
        }
      },
      { concurrency }
    );

    const filteredResults = results.filter(
      (result): result is JavaDependencyResult => result !== null
    );

    if (filteredResults.length === 0) {
      return NextResponse.json(
        { error: "No valid dependencies could be processed" },
        { status: 400 }
      );
    }

    // Sort by status (major, outdated, current) then alphabetically
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
      { error: "Failed to process Java dependency file" },
      { status: 500 }
    );
  }
}