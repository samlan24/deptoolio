import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import RepoScanner from "./RepoScanner";

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

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen pt-20 pb-6 max-w-7xl mx-auto px-6">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-2 text-white text-center">
          Repository Dependency Scanner
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Connect your GitHub account and scan repositories for outdated,
          unused, and vulnerable dependencies.
        </p>
      </div>

      <RepoScanner />

      <section className="mt-12 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-4">
          How Repository Scanning Works
        </h2>
        <p className="text-gray-200 mb-4">
          Instead of uploading files manually, you can connect your GitHub
          account and let the app scan your repositories automatically. We
          search for supported dependency files such as:
        </p>
        <ul className="list-disc list-inside text-gray-200 space-y-1">
          <li><code>package.json</code> (JavaScript / Node.js)</li>
          <li><code>go.mod</code> (Go)</li>
          <li><code>requirements.txt</code> (Python)</li>
          <li><code>Pipfile</code> (Python Pipenv)</li>
          <li><code>composer.json</code> (PHP)</li>
          <li><code>cargo.toml</code> (Rust)</li>
          <li><code>.csproj</code> (C# / .NET)</li>
        </ul>

        <p className="text-gray-200 mt-4">
          If your repository has multiple dependency files (for example a{" "}
          <code>package.json</code> for the frontend and a{" "}
          <code>requirements.txt</code> for the backend), you can choose which
          one to scan. The scanner will then check for outdated and unused
          dependencies and highlight potential issues.
        </p>
      </section>

      <section className="mt-12 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-4">
          Updating Dependencies from Repository Scans
        </h2>
        <ol className="list-decimal list-inside text-gray-200 space-y-2">
          <li>
            <strong>Review the results:</strong> Outdated packages are marked
            with their current and latest versions.
          </li>
          <li>
            <strong>Take caution with major updates:</strong> These may contain
            breaking changes and should be tested carefully.
          </li>
          <li>
            <strong>Apply minor and patch updates:</strong> These are generally
            safe and recommended, especially when they contain security fixes.
          </li>
          <li>
            <strong>Test before pushing:</strong> Always run your test suite or
            QA checks before committing updated dependencies back to your repo.
          </li>
          <li>
            <strong>Rescan anytime:</strong> Use the <em>Rescan</em> button to
            check your repositories again after making updates or changes.
          </li>
        </ol>
      </section>

      <section className="mt-12 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-4">
          Best Practices for Repository Dependency Management
        </h2>
        <ul className="list-disc list-inside text-gray-200 space-y-2">
          <li>
            Keep dependency files in version control so changes are tracked.
          </li>
          <li>
            Use lockfiles (<code>package-lock.json</code>,{" "}
            <code>Pipfile.lock</code>, etc.) to ensure reproducible builds.
          </li>
          <li>
            Create separate scans for frontend and backend when repos contain
            multiple apps.
          </li>
          <li>
            Regularly rescan repositories to catch newly outdated or vulnerable
            dependencies early.
          </li>
        </ul>
      </section>
    </div>
  );
}
