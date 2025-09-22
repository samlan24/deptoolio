// app/api/dependency-tree/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface DependencyTreeRequest {
  dependencies: string[];
  fileType: string;
}

interface PackageInfo {
  version?: string;
  description?: string;
  license?: string;
  maintainers?: number;
  dependencies?: string[];
}

interface TreeNode {
  name: string;
  type: "root" | "dependency";
  children: TreeNode[];
  depth?: number;
  size?: number;
  version?: string;
  description?: string;
  license?: string;
  maintainers?: number;
  fileType?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { dependencies, fileType }: DependencyTreeRequest = await request.json();

    if (!dependencies || dependencies.length === 0) {
      return NextResponse.json({ error: 'No dependencies provided' }, { status: 400 });
    }

    const dependencyTree = await buildDependencyTree(dependencies, fileType);

    return NextResponse.json(dependencyTree);
  } catch (error) {
    console.error('Error building dependency tree:', error);
    return NextResponse.json({ error: 'Failed to build dependency tree' }, { status: 500 });
  }
}

async function buildDependencyTree(rootDependencies: string[], fileType: string): Promise<TreeNode> {
  const tree: TreeNode = {
    name: "Your Project",
    type: "root",
    children: [],
    fileType
  };

  const processedPackages: Set<string> = new Set();
  const maxDepth = 3; // Limit depth to prevent infinite recursion

  // Process each root dependency
  for (const depName of rootDependencies.slice(0, 15)) { // Limit to first 15 for performance
    if (!processedPackages.has(depName)) {
      const childNode = await buildNodeWithDependencies(depName, fileType, processedPackages, 1, maxDepth);
      if (childNode) {
        tree.children.push(childNode);
      }
    }
  }

  return tree;
}

async function buildNodeWithDependencies(
  packageName: string,
  fileType: string,
  processedPackages: Set<string>,
  currentDepth: number,
  maxDepth: number
): Promise<TreeNode | null> {
  if (currentDepth > maxDepth || processedPackages.has(packageName)) {
    return null;
  }

  processedPackages.add(packageName);

  const node: TreeNode = {
    name: packageName,
    type: "dependency",
    children: [],
    depth: currentDepth,
    size: Math.max(5, 15 - currentDepth * 3) // Size decreases with depth
  };

  try {
    let packageInfo: PackageInfo;

    switch (fileType) {
      case 'npm':
        packageInfo = await fetchNpmPackageInfo(packageName);
        break;
      case 'python':
        packageInfo = await fetchPypiPackageInfo(packageName);
        break;
      case 'php':
        packageInfo = await fetchComposerPackageInfo(packageName);
        break;
      case 'rust':
        packageInfo = await fetchCargoPackageInfo(packageName);
        break;
      default:
        packageInfo = { dependencies: [] };
    }

    // Add metadata to node
    node.version = packageInfo.version;
    node.description = packageInfo.description;
    node.license = packageInfo.license;
    node.maintainers = packageInfo.maintainers;

    // Process dependencies (limit to top 8 for each package)
    const dependencies = packageInfo.dependencies?.slice(0, 8) || [];

    for (const depName of dependencies) {
      if (!processedPackages.has(depName) && currentDepth < maxDepth) {
        const childNode = await buildNodeWithDependencies(depName, fileType, processedPackages, currentDepth + 1, maxDepth);
        if (childNode) {
          node.children.push(childNode);
        }
      }
    }

  } catch (error) {
    if (error instanceof Error) {
      console.warn(`Failed to fetch info for ${packageName}:`, error.message);
    } else {
      console.warn(`Failed to fetch info for ${packageName}:`, error);
    }
  }

  return node;
}

async function fetchNpmPackageInfo(packageName: string): Promise<PackageInfo> {
  const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch npm package: ${packageName}`);
  }

  const data: any = await response.json();

  return {
    version: data.version,
    description: data.description,
    license: data.license,
    maintainers: data.maintainers?.length || 0,
    dependencies: Object.keys(data.dependencies || {})
  };
}

async function fetchPypiPackageInfo(packageName: string): Promise<PackageInfo> {
  const response = await fetch(`https://pypi.org/pypi/${packageName}/json`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PyPI package: ${packageName}`);
  }

  const data = await response.json();
  const info = data.info;

  return {
    version: info.version,
    description: info.summary,
    license: info.license,
    maintainers: info.maintainer_email ? 1 : 0,
    dependencies: info.requires_dist?.map((req: string) => req.split(' ')[0]).slice(0, 10) || []
  };
}

async function fetchComposerPackageInfo(packageName: string): Promise<PackageInfo> {
  const response = await fetch(`https://repo.packagist.org/p/${packageName}.json`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Composer package: ${packageName}`);
  }

  const data = await response.json();
  const packages = data.packages[packageName];
  const latestVersion = Object.keys(packages)[0];
  const packageInfo = packages[latestVersion];

  return {
    version: packageInfo.version,
    description: packageInfo.description,
    license: packageInfo.license?.[0],
    maintainers: packageInfo.authors?.length || 0,
    dependencies: Object.keys(packageInfo.require || {}).filter(dep => !dep.startsWith('php'))
  };
}

async function fetchCargoPackageInfo(packageName: string): Promise<PackageInfo> {
  const response = await fetch(`https://crates.io/api/v1/crates/${packageName}`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Cargo package: ${packageName}`);
  }

  const data = await response.json();
  const crateInfo = data.crate;

  // Fetch dependencies from versions endpoint
  const versionsResponse = await fetch(`https://crates.io/api/v1/crates/${packageName}/${crateInfo.newest_version}/dependencies`);
  const versionsData = versionsResponse.ok ? await versionsResponse.json() : { dependencies: [] };

  return {
    version: crateInfo.newest_version,
    description: crateInfo.description,
    license: crateInfo.license,
    maintainers: 1, // Crates.io doesn't provide maintainer count easily
    dependencies: versionsData.dependencies?.map((dep: { crate_id: string }) => dep.crate_id).slice(0, 10) || []
  };
}