import { NextRequest, NextResponse } from 'next/server';
import semver from 'semver';
import pMap from 'p-map';

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

    const contents = await file.text();
    const packageJson = JSON.parse(contents);

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const entries = Object.entries(allDeps);

    const concurrency = 10; // Limit concurrent requests to 10

    const results = await pMap(
      entries,
      async ([name, versionSpecifier]) => {
        if (typeof versionSpecifier !== 'string') {
          console.log(`Skipping ${name}: version is not a string`);
          return null;
        }

        if (
          versionSpecifier.startsWith('git+') ||
          versionSpecifier.startsWith('http') ||
          versionSpecifier.startsWith('file:') ||
          versionSpecifier.startsWith('npm:') ||
          versionSpecifier.includes('/')
        ) {
          console.log(`Skipping ${name}: non-version specifier (${versionSpecifier})`);
          return null;
        }

        const coercedVersion = semver.coerce(versionSpecifier);

        if (!coercedVersion) {
          console.log(`Skipping ${name}: cannot parse version from "${versionSpecifier}"`);
          return null;
        }

        const cleanVersionString = coercedVersion.version;

        try {
          const response = await fetch(`https://registry.npmjs.org/${name}`);

          if (response.status === 404) {
            console.log(`Skipping ${name}: package not found on npm`);
            return null;
          }

          if (!response.ok) {
            console.log(`Skipping ${name}: npm registry returned status ${response.status}`);
            return null;
          }

          const packageInfo = await response.json();
          const latestVersion = packageInfo['dist-tags']?.latest;

          if (!latestVersion) {
            console.log(`Skipping ${name}: no latest version found`);
            return null;
          }

          let status: 'current' | 'outdated' | 'major' = 'current';

          if (semver.lt(cleanVersionString, latestVersion)) {
            status = semver.major(cleanVersionString) < semver.major(latestVersion)
              ? 'major'
              : 'outdated';
          }

          return {
            name,
            currentVersion: versionSpecifier,
            latestVersion,
            status,
          };

        } catch (error) {
          console.error(`Error fetching data for ${name}:`, error);
          return null;
        }
      },
      { concurrency }
    );

    const filteredResults = results.filter(Boolean);

    // Sort results by severity: major, outdated, current
    filteredResults.sort((a, b) => {
      const order = { major: 0, outdated: 1, current: 2 };
      if (!a || !b) return 0;
      return order[a.status] - order[b.status];
    });

    return NextResponse.json(filteredResults);

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process package.json' },
      { status: 500 }
    );
  }
}
