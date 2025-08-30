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

interface DependencyStatus {
  name: string;
  currentVersion: string;
  latestVersion: string;
  status: "current" | "outdated" | "major";
  operator?: string;
  extras?: string[];
  lastCommitDate?: string | null;
  vulnerabilities?: { severity: string; title: string }[];
}

type FileType = "npm" | "python" | "unknown";

export default function Home() {
  const [results, setResults] = useState<DependencyStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [detectedFileType, setDetectedFileType] = useState<FileType>("unknown");
  const [fileName, setFileName] = useState<string>("");
  const [vulnerabilityLoading, setVulnerabilityLoading] = useState(false);

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

    return "unknown";
  };

  // Get appropriate API endpoint based on file type
  const getApiEndpoint = (fileType: FileType): string => {
    switch (fileType) {
      case "npm":
        return "/api/check-js"; // version check only
      case "python":
        return "/api/check-python";
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

  const fileTypeInfo = getFileTypeInfo(detectedFileType);
  const stats = getSummaryStats();

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Dependency Tracker
          </h1>
          <p className="text-gray-600 mb-8">
            Upload your dependency files to check for outdated packages
          </p>

          <div className="mb-6">
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
                accept=".json,.txt,.toml"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isLoading || vulnerabilityLoading}
                aria-disabled={isLoading || vulnerabilityLoading}
              />
            </label>
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
                disabled={vulnerabilityLoading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300"
              >
                {vulnerabilityLoading
                  ? "Scanning Vulnerabilities..."
                  : "Scan Vulnerabilities"}
              </button>
            </div>

            <div className="mt-12">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.current}</div>
                  <div className="text-sm text-gray-600">Current</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{stats.outdated}</div>
                  <div className="text-sm text-gray-600">Outdated</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.major}</div>
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

                            {dep.vulnerabilities && dep.vulnerabilities.length > 0 && (
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
                <h3 className="text-sm font-medium text-blue-900 mb-2">Next Steps</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  {stats.major > 0 && (
                    <li>• Review {stats.major} major update(s) carefully - they may contain breaking changes</li>
                  )}
                  {stats.outdated > 0 && (
                    <li>• Consider updating {stats.outdated} minor/patch version(s) for bug fixes and improvements</li>
                  )}
                  {stats.current === stats.total && <li>• All dependencies are up to date! 🎉</li>}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
