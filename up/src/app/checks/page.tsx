"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  FileText,
  Package,
  Code,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

interface DependencyStatus {
  name: string;
  currentVersion: string;
  latestVersion: string;
  status: "current" | "outdated" | "major";
  operator?: string;
  extras?: string[];
  lastCommitDate?: string | null;
  vulnerabilities?: { severity: string; title: string }[];
  maintainersCount?: number;
  lastUpdate?: string | null;
  license?: string | null;
}

// Update your FileType to include Rust
type FileType = "npm" | "python" | "go" | "php" | "rust" | "net" | "unknown";

export default function Home() {
  const [results, setResults] = useState<DependencyStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [detectedFileType, setDetectedFileType] = useState<FileType>("unknown");
  const [fileName, setFileName] = useState<string>("");
  const [vulnerabilityLoading, setVulnerabilityLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const supabase = createClient();

  // File type detection logic (same as before)
  const detectFileType = (filename: string): FileType => {
    const lowercaseName = filename.toLowerCase();

    if (lowercaseName.includes("package.json")) {
      return "npm";
    }

    if (
      lowercaseName.includes("requirements") ||
      lowercaseName.includes("pipfile") ||
      lowercaseName.includes("pyproject.toml")
    ) {
      return "python";
    }

    if (lowercaseName.includes("composer.json")) {
      return "php";
    }

    if (lowercaseName.includes("go.mod")) {
      return "go";
    }

    if (lowercaseName.includes("cargo.toml")) {
      return "rust";
    }
    if (lowercaseName.endsWith(".csproj")) {
      return "net";
    }

    return "unknown";
  };

  // Get appropriate API endpoint based on file type
  const getApiEndpoint = (fileType: FileType): string => {
    switch (fileType) {
      case "npm":
        return "/api/check-js";
      case "python":
        return "/api/check-python";
      case "go":
        return "/api/check-go";
      case "php":
        return "/api/check-php";
      case "rust":
        return "/api/check-rust";
      case "net":
        return "/api/check-net";
      default:
        return "";
    }
  };

  // Display info for file types (same as before)
  const getFileTypeInfo = (fileType: FileType) => {
    switch (fileType) {
      case "npm":
        return {
          icon: <Package className="w-5 h-5 text-green-600" />,
          label: "Node.js/npm",
          color: "text-green-600",
          bgColor: "bg-green-50",
        };
      case "python":
        return {
          icon: <Code className="w-5 h-5 text-blue-600" />,
          label: "Python",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
        };

      case "php":
        return {
          icon: <Package className="w-5 h-5 text-indigo-600" />,
          label: "PHP/Composer",
          color: "text-indigo-600",
          bgColor: "bg-indigo-50",
        };
      case "go":
        return {
          icon: <Package className="w-5 h-5 text-cyan-600" />,
          label: "Go/Modules",
          color: "text-cyan-600",
          bgColor: "bg-cyan-50",
        };
      case "rust":
        return {
          icon: <Package className="w-5 h-5 text-orange-700" />,
          label: "Rust/Modules",
          color: "text-orange-700",
          bgColor: "bg-orange-50",
        };

      case "net":
        return {
          icon: <Package className="w-5 h-5 text-blue-700" />,
          label: ".NET/NuGet Packages",
          color: "text-blue-700",
          bgColor: "bg-blue-50",
        };

      default:
        return {
          icon: <FileText className="w-5 h-5 text-gray-600" />,
          label: "Unknown",
          color: "text-gray-600",
          bgColor: "bg-gray-50",
        };
    }
  };

  // Handle file upload and version scan
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileType = detectFileType(file.name);
    setDetectedFileType(fileType);
    setFileName(file.name);
    setResults([]); // clear previous results

    if (fileType === "unknown") {
      alert(
        "Unsupported file type. Please upload package.json, requirements.txt, Pipfile, or pyproject.toml"
      );
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const endpoint = getApiEndpoint(fileType);
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
        setResults([]);
      } else {
        setResults(data);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Unexpected error uploading the file.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle separate vulnerability scan
  const handleVulnerabilityScan = async () => {
    if (results.length === 0) {
      alert("Please upload and scan dependencies first.");
      return;
    }
    setVulnerabilityLoading(true);

    const depsForScan: Record<string, string> = {};
    results.forEach((dep) => {
      depsForScan[dep.name] = dep.currentVersion;
    });

    try {
      // Update your vulnerability endpoint selection:
      const vulnEndpoint =
        detectedFileType === "python"
          ? "/api/check-py-vulnerabilities"
          : detectedFileType === "php"
          ? "/api/check-php-vulnerabilities"
          : detectedFileType === "rust"
          ? "/api/check-rust-vulnerabilities"
          : detectedFileType === "net"
          ? "/api/check-net-vulnerabilities"
          : "/api/check-js-vulnerabilities";

      const response = await fetch(vulnEndpoint, {
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

      // Handle different response formats for Python vs JavaScript
      if (detectedFileType === "python" && data.advisories) {
        // Python vulnerability format
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
      } else if (detectedFileType === "npm" && data.advisories) {
        // JavaScript vulnerability format
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
      } else if (detectedFileType === "php" && data.vulnerabilities) {
        // PHP vulnerability format
        for (const vuln of data.vulnerabilities) {
          const pkgName = vuln.packageName;
          if (!vulnsMap.has(pkgName)) {
            vulnsMap.set(pkgName, []);
          }
          vulnsMap.get(pkgName)!.push({
            severity: vuln.severity,
            title: vuln.title,
          });
        }
      } else if (detectedFileType === "rust" && data.vulnerabilities) {
        // Rust vulnerability format
        for (const vuln of data.vulnerabilities) {
          const pkgName = vuln.packageName;
          if (!vulnsMap.has(pkgName)) {
            vulnsMap.set(pkgName, []);
          }
          vulnsMap.get(pkgName)!.push({
            severity: vuln.severity,
            title: vuln.title,
          });
        }
      } else if (detectedFileType === "net" && data.vulnerabilities) {
        // Rust vulnerability format
        for (const vuln of data.vulnerabilities) {
          const pkgName = vuln.packageName;
          if (!vulnsMap.has(pkgName)) {
            vulnsMap.set(pkgName, []);
          }
          vulnsMap.get(pkgName)!.push({
            severity: vuln.severity,
            title: vuln.title,
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

  // get vulnerability scan button text
  const getVulnerabilityScanText = () => {
    if (vulnerabilityLoading) {
      return "Scanning Vulnerabilities...";
    }

    switch (detectedFileType) {
      case "python":
        return "Scan Python Vulnerabilities";
      case "npm":
        return "Scan JavaScript Vulnerabilities";

      case "php":
        return "Scan PHP Vulnerabilities";
      case "go":
        return "Vulnerability Scan Not Available";
      case "rust":
        return "Scan Rust Vulnerabilities";
      case "net":
        return "Scan .NET Vulnerabilities";
      default:
        return "Scan Vulnerabilities";
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

  const getLicenseColorClass = (license: string | null): string => {
    if (!license) return "bg-gray-300 text-gray-700";

    const normalized = license.toLowerCase();

    if (
      ["mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "isc"].some((l) =>
        normalized.includes(l)
      )
    ) {
      return "bg-green-100 text-green-800"; // permissive licenses - green
    }

    if (["mpl-2.0", "epl-2.0"].some((l) => normalized.includes(l))) {
      return "bg-yellow-100 text-yellow-800"; // moderate restrictions - yellow
    }

    if (
      ["gpl", "agpl", "lgpl", "cddl", "ecl-2.0"].some((l) =>
        normalized.includes(l)
      )
    ) {
      return "bg-red-100 text-red-800"; // strict licenses - red
    }

    // Default case
    return "bg-gray-300 text-gray-700"; // unknown or other licenses - gray
  };

  const fileTypeInfo = getFileTypeInfo(detectedFileType);
  const stats = getSummaryStats();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setAuthLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Dependency Checker
          </h1>
          <p className="text-gray-200 mb-8">
            Upload your dependency files to check for outdated packages
          </p>

          <div className="mb-6 flex flex-col items-center space-y-4">
            <label
              htmlFor="file-upload"
              className="relative cursor-pointer bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 px-8 py-6 hover:border-gray-400 transition-colors inline-block"
            >
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <span className="text-lg text-gray-700 font-medium">
                  Upload dependency file
                </span>
                <p className="text-sm text-gray-500 mt-2">
                  Supports: package.json, requirements.txt, Pipfile,
                  pyproject.toml
                </p>
              </div>
              <input
                id="file-upload"
                type="file"
                accept=".json,.txt,.toml,.mod,.csproj"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isLoading || vulnerabilityLoading || authLoading}
                aria-disabled={isLoading || vulnerabilityLoading || authLoading}
              />
            </label>
            {!authLoading && (
              <>
                {/* Divider */}
                <div className="flex items-center w-full max-w-md">
                  <div className="flex-grow border-t border-gray-300"></div>
                  <span className="mx-3 text-gray-500 text-sm">or</span>
                  <div className="flex-grow border-t border-gray-300"></div>
                </div>

                {/* Conditional buttons based on auth state */}
                {user ? (
                  /* Logged IN users - Show Dashboard access */
                  <div className="flex gap-3">
                    <Link href="/repo-scanner">
                      <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                        <Package className="w-5 h-5" />
                        Scan GitHub Repos
                      </button>
                    </Link>
                  </div>
                ) : (
                  /* Logged OUT users - Show connect options */
                  <div className="flex gap-3">
                    <Link href="/login">
                      <button className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-gray-800">
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.8.8.1-.7.4-1.1.7-1.4-2.5-.3-5.2-1.3-5.2-5.7 0-1.2.4-2.1 1-2.9-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 4.9 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.8 1 1.7 1 2.9 0 4.4-2.7 5.4-5.3 5.7.4.3.7.9.7 1.8v2.6c0 .3.2.7.8.6a11.5 11.5 0 0 0 7.9-10.9C23.5 5.65 18.35.5 12 .5z" />
                        </svg>
                        Connect GitHub
                      </button>
                    </Link>
                    <button
                      onClick={() =>
                        (window.location.href = "/api/auth/gitlab")
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M22.47 9.6l-1.3-4.1a1.05 1.05 0 0 0-2 0L17.5 9.6H6.5L4.8 5.5a1.05 1.05 0 0 0-2 0L1.47 9.6a1.07 1.07 0 0 0 .4 1.2L12 22.6l10.1-11.8c.3-.3.4-.8.3-1.2z" />
                      </svg>
                      Connect GitLab
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {fileName && detectedFileType !== "unknown" && (
            <div
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full ${fileTypeInfo.bgColor} mb-6`}
            >
              {fileTypeInfo.icon}
              <span className={`text-sm font-medium ${fileTypeInfo.color}`}>
                {fileTypeInfo.label} • {fileName}
              </span>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="mt-12 text-center" role="status" aria-live="polite">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Checking dependencies...</p>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="mt-4 text-right">
              <button
                onClick={handleVulnerabilityScan}
                disabled={vulnerabilityLoading || detectedFileType === "go"}
                title={
                  detectedFileType === "go"
                    ? "Go vulnerability scanning is not currently supported"
                    : ""
                }
                className={`px-4 py-2 text-white rounded transition-colors ${
                  detectedFileType === "go"
                    ? "bg-gray-400 cursor-not-allowed opacity-60"
                    : "bg-red-600 hover:bg-red-700 disabled:bg-red-300"
                }`}
              >
                {getVulnerabilityScanText()}
              </button>
            </div>

            <div className="mt-12">
              {/* Summary Stats */}
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

              <h2 className="text-xl font-semibold text-gray-200 mb-4">
                Dependency Analysis Results
              </h2>
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <ul className="divide-y divide-gray-200">
                  {results.map((dep, index) => (
                    <li key={index} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-3">
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

                            <p className="text-sm text-gray-700">
                              Your version: {dep.currentVersion} → Latest:{" "}
                              {dep.latestVersion}
                            </p>

                            {typeof dep.maintainersCount === "number" && (
                              <span className="text-xs text-gray-500 block">
                                Collaborators: {dep.maintainersCount}
                              </span>
                            )}
                            {dep.lastUpdate && (
                              <span className="text-xs text-gray-500 block">
                                Last Update:{" "}
                                {new Date(dep.lastUpdate).toLocaleDateString()}
                              </span>
                            )}
                            {dep.license && (
                              <span
                                className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-semibold ${getLicenseColorClass(
                                  dep.license
                                )}`}
                                title={`License: ${dep.license}`}
                              >
                                {dep.license}
                              </span>
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
                                        [
                                        {(
                                          vuln.severity || "unknown"
                                        ).toUpperCase()}
                                        ] {vuln.title}
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
                      • Review {stats.major} major update(s) carefully - they
                      may contain breaking changes
                    </li>
                  )}
                  {stats.outdated > 0 && (
                    <li>
                      • Consider updating {stats.outdated} minor/patch
                      version(s) for bug fixes and improvements
                    </li>
                  )}
                  {stats.current === stats.total && (
                    <li>• All dependencies are up to date! 🎉</li>
                  )}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
