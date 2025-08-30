import { NextRequest, NextResponse } from 'next/server';
import pMap from 'p-map';

interface PythonVersionSpec {
  name: string;
  operator: string;
  version: string;
  extras?: string[];
}

interface PythonDependencyResult {
  name: string;
  currentVersion: string;
  latestVersion: string;
  status: 'current' | 'outdated' | 'major';
  operator: string;
  extras?: string[];
}

interface PyPIPackageInfo {
  info: {
    version: string;
    name: string;
  };
  releases: Record<string, any>;
}

// Helper function to parse requirements.txt line
function parseRequirementLine(line: string): PythonVersionSpec | null {
  // Remove comments and whitespace
  const cleanLine = line.split('#')[0].trim();

  if (!cleanLine ||
      cleanLine.startsWith('-') || // Skip -r, -c, -e flags
      cleanLine.startsWith('http') || // Skip URLs
      cleanLine.startsWith('git+') || // Skip git dependencies
      cleanLine.includes('://')) { // Skip other URLs
    return null;
  }

  // Match package name with optional extras and version specifier
  // Examples: requests>=2.0.0, flask[async]==2.0.0, numpy~=1.21.0
  const match = cleanLine.match(/^([a-zA-Z0-9\-_\.]+)(\[([^\]]+)\])?([><=!~]+)(.+)$/);

  if (!match) {
    // Try matching just package name without version (like "requests")
    const nameMatch = cleanLine.match(/^([a-zA-Z0-9\-_\.]+)(\[([^\]]+)\])?$/);
    if (nameMatch) {
      return {
        name: nameMatch[1],
        operator: '>=',
        version: '0.0.0',
        extras: nameMatch[3] ? nameMatch[3].split(',').map(e => e.trim()) : undefined
      };
    }
    return null;
  }

  return {
    name: match[1],
    operator: match[4],
    version: match[5].trim(),
    extras: match[3] ? match[3].split(',').map(e => e.trim()) : undefined
  };
}

// Helper function to parse Pipfile content
function parsePipfile(content: string): PythonVersionSpec[] {
  const dependencies: PythonVersionSpec[] = [];

  try {
    // Simple TOML parsing for Pipfile - in production, use a proper TOML parser
    const lines = content.split('\n');
    let inPackagesSection = false;
    let inDevPackagesSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '[packages]') {
        inPackagesSection = true;
        inDevPackagesSection = false;
        continue;
      }

      if (trimmed === '[dev-packages]') {
        inPackagesSection = true; // Include dev dependencies
        inDevPackagesSection = true;
        continue;
      }

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        inPackagesSection = false;
        inDevPackagesSection = false;
        continue;
      }

      if (inPackagesSection && trimmed.includes('=')) {
        // Parse lines like: requests = ">=2.0.0" or numpy = "*"
        const match = trimmed.match(/^([a-zA-Z0-9\-_\.]+)\s*=\s*"([^"]+)"/);
        if (match) {
          const packageName = match[1];
          const versionSpec = match[2];

          if (versionSpec === '*') {
            dependencies.push({
              name: packageName,
              operator: '>=',
              version: '0.0.0'
            });
          } else {
            // Parse version specifiers like ">=2.0.0", "~=2.0.0"
            const versionMatch = versionSpec.match(/^([><=!~]+)(.+)$/);
            if (versionMatch) {
              dependencies.push({
                name: packageName,
                operator: versionMatch[1],
                version: versionMatch[2]
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing Pipfile:', error);
  }

  return dependencies;
}

// Helper function to parse pyproject.toml content
function parsePyprojectToml(content: string): PythonVersionSpec[] {
  const dependencies: PythonVersionSpec[] = [];

  try {
    // Simple parsing for pyproject.toml - in production, use a proper TOML parser
    const lines = content.split('\n');
    let inDependenciesSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.includes('[tool.poetry.dependencies]') ||
          trimmed.includes('[project]') ||
          trimmed.includes('dependencies = [')) {
        inDependenciesSection = true;
        continue;
      }

      if (trimmed.startsWith('[') && !trimmed.includes('dependencies')) {
        inDependenciesSection = false;
        continue;
      }

      if (inDependenciesSection && trimmed.includes('=')) {
        // Parse lines like: requests = "^2.0.0" or "numpy>=1.21.0"
        let match = trimmed.match(/^([a-zA-Z0-9\-_\.]+)\s*=\s*"([^"]+)"/);

        if (!match) {
          // Try parsing array format: "requests>=2.0.0",
          match = trimmed.match(/"([a-zA-Z0-9\-_\.]+)([><=!~^]+)([^"]+)"/);
          if (match) {
            dependencies.push({
              name: match[1],
              operator: match[2].replace('^', '>='), // Convert poetry ^ to >=
              version: match[3]
            });
          }
        } else {
          const packageName = match[1];
          const versionSpec = match[2];

          if (packageName === 'python') continue; // Skip python version requirement

          // Handle poetry version specifiers
          const versionMatch = versionSpec.match(/^([\^~><=!]+)(.+)$/);
          if (versionMatch) {
            let operator = versionMatch[1];
            // Convert poetry ^ to >= for simplicity
            if (operator === '^') operator = '>=';

            dependencies.push({
              name: packageName,
              operator: operator,
              version: versionMatch[2]
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error parsing pyproject.toml:', error);
  }

  return dependencies;
}

// Helper function to compare Python versions
function comparePythonVersions(current: string, latest: string, operator: string): 'current' | 'outdated' | 'major' {
  // Simple version comparison - in production, use a proper Python version parser
  const parseVersion = (v: string) => {
    const parts = v.split('.').map(n => parseInt(n) || 0);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
  };

  const currentVer = parseVersion(current);
  const latestVer = parseVersion(latest);

  // Check if current satisfies the requirement based on operator
  let satisfiesRequirement = false;

  switch (operator) {
    case '==':
      satisfiesRequirement = current === latest;
      break;
    case '>=':
      satisfiesRequirement = (currentVer.major > latestVer.major) ||
                           (currentVer.major === latestVer.major && currentVer.minor > latestVer.minor) ||
                           (currentVer.major === latestVer.major && currentVer.minor === latestVer.minor && currentVer.patch >= latestVer.patch);
      break;
    case '>':
      satisfiesRequirement = (currentVer.major > latestVer.major) ||
                           (currentVer.major === latestVer.major && currentVer.minor > latestVer.minor) ||
                           (currentVer.major === latestVer.major && currentVer.minor === latestVer.minor && currentVer.patch > latestVer.patch);
      break;
    case '~=':
      // Compatible release - same major.minor, patch can be higher
      satisfiesRequirement = currentVer.major === latestVer.major &&
                           currentVer.minor === latestVer.minor &&
                           currentVer.patch >= latestVer.patch;
      break;
    default:
      satisfiesRequirement = false;
  }

  if (satisfiesRequirement && currentVer.major === latestVer.major &&
      currentVer.minor === latestVer.minor && currentVer.patch === latestVer.patch) {
    return 'current';
  }

  // Compare with latest available version
  if (latestVer.major > currentVer.major) {
    return 'major';
  }

  if (latestVer.major === currentVer.major && latestVer.minor > currentVer.minor) {
    return 'outdated';
  }

  if (latestVer.major === currentVer.major && latestVer.minor === currentVer.minor && latestVer.patch > currentVer.patch) {
    return 'outdated';
  }

  return 'current';
}

// Helper function to fetch with retry logic
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'dependency-tracker/1.0',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed for ${url}:`, error);
      if (i === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries reached');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();

    if (!fileName.includes('requirements') &&
        !fileName.includes('pipfile') &&
        !fileName.includes('pyproject.toml')) {
      return NextResponse.json(
        { error: 'File must be a Python dependency file (requirements.txt, Pipfile, or pyproject.toml)' },
        { status: 400 }
      );
    }

    const contents = await file.text();
    let dependencies: PythonVersionSpec[] = [];

    // Parse based on file type
    if (fileName.includes('requirements')) {
      dependencies = contents
        .split('\n')
        .map(parseRequirementLine)
        .filter((dep): dep is PythonVersionSpec => dep !== null);
    } else if (fileName.includes('pipfile')) {
      dependencies = parsePipfile(contents);
    } else if (fileName.includes('pyproject.toml')) {
      dependencies = parsePyprojectToml(contents);
    }

    if (dependencies.length === 0) {
      return NextResponse.json(
        { error: 'No valid dependencies found in the file' },
        { status: 400 }
      );
    }

    const concurrency = 8;

    const results = await pMap(
      dependencies,
      async (dep) => {
        try {
          const response = await fetchWithRetry(`https://pypi.org/pypi/${encodeURIComponent(dep.name)}/json`);

          if (response.status === 404) {
            console.log(`Skipping ${dep.name}: package not found on PyPI`);
            return null;
          }

          if (response.status === 429) {
            console.log(`Rate limited for ${dep.name}, skipping`);
            return null;
          }

          if (!response.ok) {
            console.log(`Skipping ${dep.name}: PyPI returned status ${response.status}`);
            return null;
          }

          const packageInfo: PyPIPackageInfo = await response.json();
          const latestVersion = packageInfo.info.version;

          if (!latestVersion) {
            console.log(`Skipping ${dep.name}: no version information found`);
            return null;
          }

          const status = comparePythonVersions(dep.version, latestVersion, dep.operator);

          const result: PythonDependencyResult = {
            name: dep.name,
            currentVersion: `${dep.operator}${dep.version}`,
            latestVersion,
            status,
            operator: dep.operator,
            extras: dep.extras
          };

          return result;

        } catch (error) {
          console.error(`Error fetching data for ${dep.name}:`, error);
          return null;
        }
      },
      { concurrency }
    );

    const filteredResults = results.filter((result): result is PythonDependencyResult => result !== null);

    if (filteredResults.length === 0) {
      return NextResponse.json(
        { error: 'No valid dependencies could be processed' },
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
    console.error('Error processing request:', error);

    return NextResponse.json(
      { error: 'Failed to process Python dependency file' },
      { status: 500 }
    );
  }
}