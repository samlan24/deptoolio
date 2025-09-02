import Home from "./FileCheck";

export default async function FileCheck() {
  return (
    <main className="min-h-screen pt-20 max-w-4xl mx-auto pb-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">
          Dependency Checker
        </h1>
        <p className="text-gray-200 mb-8">
          Upload your dependency files to check for outdated packages
        </p>
      </header>

      <Home />

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-4">
          Why Updating Dependencies Matters
        </h2>
        <p className="text-gray-200 mb-4">
          Dependencies are the backbone of modern applications. Keeping them
          updated ensures your project remains <strong>secure</strong>,{" "}
          <strong>compatible</strong>, and <strong>performant</strong>. Outdated
          dependencies often introduce risks such as security vulnerabilities,
          deprecated APIs, or performance bottlenecks.
        </p>
        <ul className="list-disc list-inside text-gray-200 space-y-2">
          <li>
            <strong>Security:</strong> Patching vulnerabilities quickly reduces
            your project’s attack surface.
          </li>
          <li>
            <strong>Stability:</strong> Updated libraries often fix bugs and
            improve compatibility with modern runtimes.
          </li>
          <li>
            <strong>Performance:</strong> Many updates include optimizations
            that boost speed and efficiency.
          </li>
          <li>
            <strong>Developer Experience:</strong> Stay aligned with community
            standards and access the latest features.
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-4">
          How to Update Dependencies
        </h2>
        <p className="text-gray-200 mb-4">
          The easiest way to check for outdated packages is to upload your
          dependency files directly to this app. Supported files include:
        </p>
        <ul className="list-disc list-inside text-gray-200 space-y-1">
          <li>
            <code>package.json</code> (JavaScript / Node.js)
          </li>
          <li>
            <code>go.mod</code> (Go)
          </li>
          <li>
            <code>requirements.txt</code> (Python)
          </li>
          <li>
            <code>Pipfile</code> (Python Pipenv)
          </li>
          <li>
            <code>composer.json</code> (PHP)
          </li>
          <li>
            <code>cargo.toml</code> (Rust)
          </li>
          <li>
            <code>.csproj</code> (C# / .NET)
          </li>
        </ul>

        <p className="text-gray-200 mt-4">
          Once uploaded, the app will scan your dependencies and highlight which
          ones are outdated. Take note of the following best practices:
        </p>
        <ol className="list-decimal list-inside text-gray-200 space-y-2 mt-2">
          <li>
            <strong>Major updates:</strong> Be cautious. Major version changes
            may introduce breaking changes that affect your codebase.
          </li>
          <li>
            <strong>Minor and patch updates:</strong> These are generally safe
            to apply since they include bug fixes, improvements, and security
            patches.
          </li>
          <li>
            <strong>Test thoroughly:</strong> After updating, always run your
            tests and validate functionality before deploying to production.
          </li>
          <li>
            <strong>Rescan anytime:</strong> You can always re-upload your files
            to this app to check for new outdated dependencies as your project
            evolves.
          </li>
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-4">
          Best Practices for Dependency Management
        </h2>
        <ul className="list-disc list-inside text-gray-200 space-y-2">
          <li>
            Lock versions using <code>package-lock.json</code> or{" "}
            <code>Pipfile.lock</code> for consistency across environments.
          </li>
          <li>
            Audit dependencies regularly for vulnerabilities and licenses.
          </li>
          <li>Remove unused dependencies to reduce code bloat and risk.</li>
          <li>
            Document your update policy so your team knows how often to review
            packages.
          </li>
        </ul>
      </section>
    </main>
  );
}
