# Deptoolio

Deptoolio is a lightweight Next.js tool for scanning and managing dependency health across projects. It helps developers find outdated, vulnerable, missing, and unused dependencies by either uploading dependency files or connecting a GitHub repository.

## Key features
- Scan uploaded dependency files (package.json, requirements.txt, Pipfile, go.mod, cargo.toml, composer.json, .csproj, etc.) for outdated packages and potential vulnerabilities.
- Connect your GitHub account to automatically scan repositories and specific folders for dependency issues.
- Detect unused and missing dependencies for JavaScript / TypeScript projects.
- Query external vulnerability databases (e.g., OSV for Rust) to surface known advisories.
- Summarize results with easy-to-read stats (total, current, outdated, major) and per-package details.
- Provide suggested next steps (install/uninstall commands, testing guidance) and visual cues for license risk.

## Supported ecosystems
- JavaScript / TypeScript (detailed unused/missing analysis)
- Python, Go, Rust, PHP, .NET (dependency checks and vulnerability lookups where implemented)

## How it works (brief)
- File upload mode: upload a dependency file → the app determines the ecosystem → runs checks and returns a report.
- Repository scan mode: authenticate with GitHub → choose a repo and folder → the server fetches dependency files and runs the appropriate checks → results are aggregated and displayed.

## Purpose
Deptoolio makes dependency maintenance approachable: keep projects secure, up-to-date, and lean by surfacing actionable dependency issues in a single place.

## License & Contributing
See the repository for contribution guidelines and license details (if provided).
