"use client";

import { useState } from "react";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  FileText,
  Package,
  Code,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";

interface Repo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  updated_at: string;
  private: boolean;
}

interface PackageJsonFile {
  name: string;
  path: string;
  html_url: string;
}

interface DependencyStatus {
  name: string;
  currentVersion: string;
  latestVersion: string;
  latestStable: string;
  status: "current" | "outdated" | "major";
  isPrerelease: boolean;
  operator?: string;
  extras?: string[];
  lastCommitDate?: string | null;
  vulnerabilities?: { severity: string; title: string }[];
}

export default function RepoScanner() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [packageJsonFiles, setPackageJsonFiles] = useState<PackageJsonFile[]>(
    []
  );
  const [selectedFile, setSelectedFile] = useState<PackageJsonFile | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<DependencyStatus[]>([]);
  const [vulnerabilityLoading, setVulnerabilityLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchRepos = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/github/repos");
      if (!response.ok) throw new Error("Failed to fetch repositories");
      const data = await response.json();
      setRepos(data);
    } catch (err) {
      setError(
        "Failed to load repositories. Make sure you signed in with GitHub."
      );
    } finally {
      setLoading(false);
    }
  };

  const searchPackageJsonFiles = async () => {
    if (!selectedRepo) return;

    setSearching(true);
    setError("");
    setPackageJsonFiles([]);
    setSelectedFile(null);

    try {
      const [owner, repo] = selectedRepo.full_name.split("/");
      const response = await fetch(
        `/api/github/file?owner=${owner}&repo=${repo}`
      );

      if (!response.ok)
        throw new Error("Failed to search for package.json files");

      const data = await response.json();
      setPackageJsonFiles(data.files);

      if (data.files.length === 0) {
        setError("No package.json files found in this repository");
      }
    } catch (err) {
      setError("Failed to search for package.json files");
    } finally {
      setSearching(false);
    }
  };

  const scanPackageJson = async () => {
    if (!selectedRepo || !selectedFile) return;

    setScanning(true);
    setError("");
    setResults([]);

    try {
      const [owner, repo] = selectedRepo.full_name.split("/");

      // Fetch the specific package.json file
      const fileResponse = await fetch("/api/github/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          path: selectedFile.path,
        }),
      });

      if (!fileResponse.ok) {
        throw new Error("Failed to fetch package.json");
      }

      const { content } = await fileResponse.json();

      // Create a File object to send to your existing scan API
      const file = new File([content], "package.json", {
        type: "application/json",
      });
      const formData = new FormData();
      formData.append("file", file);

      // Use your existing scan API
      const scanResponse = await fetch("/api/check-js", {
        method: "POST",
        body: formData,
      });

      if (!scanResponse.ok) {
        throw new Error("Failed to scan dependencies");
      }

      const scanResults = await scanResponse.json();
      setResults(scanResults);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to scan package.json"
      );
    } finally {
      setScanning(false);
    }
  };

  // Handle separate vulnerability scan
  const handleVulnerabilityScan = async () => {
    if (results.length === 0) {
      alert("Please scan dependencies first.");
      return;
    }
    setVulnerabilityLoading(true);

    const depsForScan: Record<string, string> = {};
    results.forEach((dep) => {
      depsForScan[dep.name] = dep.currentVersion;
    });

    try {
      const response = await fetch("/api/check-js-vulnerabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencies: depsForScan }),
      });
      const data = await response.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
        return;
      }

      const vulnsMap = new Map<string, { severity: string; title: string }[]>();
      if (data.advisories) {
        for (const adv of Object.values<any>(data.advisories)) {
          const pkgName = adv.module_name;
          if (!vulnsMap.has(pkgName)) {
            vulnsMap.set(pkgName, []);
          }
          vulnsMap.get(pkgName)!.push({
            severity: adv.severity,
            title: adv.title,
          });
        }
      }

      const updatedResults = results.map((dep) => ({
        ...dep,
        vulnerabilities: vulnsMap.get(dep.name) || [],
      }));
      setResults(updatedResults);
    } catch (error) {
      console.error("Error fetching vulnerabilities:", error);
      alert("Failed to scan vulnerabilities.");
    } finally {
      setVulnerabilityLoading(false);
    }
  };

  // Status icon renderer
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "current":
        return (
          <CheckCircle
            className="w-5 h-5 text-green-500"
            aria-label="Current"
          />
        );
      case "outdated":
        return (
          <AlertCircle
            className="w-5 h-5 text-yellow-500"
            aria-label="Outdated"
          />
        );
      case "major":
        return (
          <XCircle
            className="w-5 h-5 text-red-500"
            aria-label="Major update needed"
          />
        );
      default:
        return null;
    }
  };

  // Summary statistics
  const getSummaryStats = () => {
    const total = results.length;
    const current = results.filter((r) => r.status === "current").length;
    const outdated = results.filter((r) => r.status === "outdated").length;
    const major = results.filter((r) => r.status === "major").length;

    return { total, current, outdated, major };
  };

  const stats = getSummaryStats();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 bg-gray-900 rounded-lg shadow-lg">
      {/* GitHub Repository Selection */}
      <div className="bg-white rounded-lg shadow p-6 text-black">
        <div className="text-center mb-6 bg">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Package className="w-8 h-8 text-green-400" />
            <h2 className="text-2xl font-bold">GitHub Repository Scanner</h2>
          </div>
          <p className="text-gray-800">
            Connect to your GitHub repositories and scan package.json files
          </p>
        </div>

        {!repos.length ? (
          <div className="text-center">
            <button
              onClick={fetchRepos}
              disabled={loading}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center space-x-2 justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Loading Repositories...</span>
                </div>
              ) : (
                "Load My Repositories"
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-white">
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Select Repository
              </label>
              <Select
                value={selectedRepo?.id ? String(selectedRepo.id) : ""}
                onValueChange={(value) => {
                  const repo = repos.find((r) => r.id === parseInt(value));
                  setSelectedRepo(repo || null);
                  setPackageJsonFiles([]);
                  setSelectedFile(null);
                  setResults([]);
                }}
              >
                <SelectTrigger className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg">
                  <SelectValue placeholder="Choose a repository..." />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((repo) => (
                    <SelectItem key={repo.id} value={String(repo.id)}>
                      {repo.name} {repo.private ? "(Private)" : "(Public)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRepo && (
              <div className="space-y-3">
                <button
                  onClick={searchPackageJsonFiles}
                  disabled={searching}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {searching ? "Searching..." : "Find package.json files"}
                </button>

                {packageJsonFiles.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">
                      Select package.json file
                    </label>
                    <Select
                      value={selectedFile?.path || ""}
                      onValueChange={(value) => {
                        const file = packageJsonFiles.find(
                          (f) => f.path === value
                        );
                        setSelectedFile(file || null);
                      }}
                    >
                      <SelectTrigger className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg">
                        <SelectValue placeholder="Choose a package.json file..." />
                      </SelectTrigger>
                      <SelectContent>
                        {packageJsonFiles.map((file) => (
                          <SelectItem key={file.path} value={file.path}>
                            {file.path}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedFile && (
                  <button
                    onClick={scanPackageJson}
                    disabled={scanning}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {scanning ? (
                      <div className="flex items-center space-x-2 justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Scanning Dependencies...</span>
                      </div>
                    ) : (
                      `Scan ${selectedFile.path}`
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-700 border border-red-600 rounded-lg text-red-200">
            <p>{error}</p>
          </div>
        )}
      </div>

      {/* Results Section */}
      {results.length > 0 && (
        <>
          <div className="text-right">
            <button
              onClick={handleVulnerabilityScan}
              disabled={vulnerabilityLoading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300"
            >
              {vulnerabilityLoading
                ? "Scanning Vulnerabilities..."
                : "Scan Vulnerabilities"}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.total}
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.current}
              </div>
              <div className="text-sm text-gray-600">Current</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {stats.outdated}
              </div>
              <div className="text-sm text-gray-600">Outdated</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.major}
              </div>
              <div className="text-sm text-gray-600">Major Updates</div>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Dependency Analysis Results
          </h2>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-gray-200">
              {results.map((dep, index) => (
                <li key={index} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(dep.status)}
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                          <span>{dep.name}</span>
                          {dep.extras && dep.extras.length > 0 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              [{dep.extras.join(", ")}]
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Your version: {dep.currentVersion} → Latest:{" "}
                          {dep.latestVersion}
                        </p>
                        {dep.lastCommitDate && (
                          <p className="text-xs text-gray-400 mt-1">
                            Last Commit:{" "}
                            {new Date(dep.lastCommitDate).toLocaleDateString()}
                          </p>
                        )}

                        {dep.vulnerabilities &&
                          dep.vulnerabilities.length > 0 && (
                            <div className="mt-1">
                              <span className="text-xs font-semibold text-red-600">
                                Vulnerabilities:
                              </span>
                              <ul className="text-xs text-red-500 list-disc list-inside">
                                {dep.vulnerabilities.map((vuln, i) => (
                                  <li key={i} title={vuln.title}>
                                    [{vuln.severity.toUpperCase()}] {vuln.title}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        dep.status === "current"
                          ? "bg-green-100 text-green-800"
                          : dep.status === "outdated"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {dep.status === "major" ? "Major Update" : dep.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Action suggestions */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Next Steps
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              {stats.major > 0 && (
                <li>
                  • Review {stats.major} major update(s) carefully - they may
                  contain breaking changes
                </li>
              )}
              {stats.outdated > 0 && (
                <li>
                  • Consider updating {stats.outdated} minor/patch version(s)
                  for bug fixes and improvements
                </li>
              )}
              {stats.current === stats.total && (
                <li>• All dependencies are up to date! 🎉</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
