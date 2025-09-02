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
  typeInfo: {
    icon: React.ReactNode;
    label: string;
  };
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
  maintainersCount?: number;
  lastUpdate?: string | null;
  license?: string | null;
}

type FileType = "npm" | "python" | "go" | "php" | "rust" | "net" | "unknown";

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
  const [detectedFileType, setDetectedFileType] = useState<FileType>("unknown");
  const [vulnerabilityLoading, setVulnerabilityLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileType, setFileType] = useState<
    "javascript" | "python" | "go" | "php" | "rust" | "net"
  >("javascript");
  const [page, setPage] = useState(1);
  const perPage = 10; // or any number you want
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchRepos = async (pageNumber = 1) => {
    setLoading(pageNumber === 1);
    setLoadingMore(pageNumber > 1);
    setError("");

    try {
      const response = await fetch(
        `/api/github/repos?page=${pageNumber}&per_page=${perPage}`
      );
      if (!response.ok) throw new Error("Failed to fetch repositories");
      const data = await response.json();
      if (pageNumber === 1) {
        setRepos(data.repos); // assuming API returns { repos: [] }
      } else {
        setRepos((prev) => [...prev, ...data.repos]);
      }
      setHasMore(data.repos.length === perPage);
      setPage(pageNumber);
    } catch (err) {
      setError(
        "Failed to load repositories. Make sure you signed in with GitHub."
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const searchDependencyFiles = async () => {
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
        throw new Error("Failed to search for dependency files");

      const data = await response.json();

      // Filter files based on selected file type
      const filteredFiles = data.files.filter((file: any) => {
        if (fileType === "javascript") {
          return file.name.toLowerCase().includes("package.json");
        } else {
          return (
            file.name.toLowerCase().includes("requirements") ||
            file.name.toLowerCase().includes("pipfile") ||
            file.name.toLowerCase().includes("pyproject.toml") ||
            file.name.toLowerCase().includes("go.mod") ||
            file.name.toLowerCase().includes("composer.json") ||
            file.name.toLowerCase().includes("cargo.toml") ||
            file.name.toLowerCase().endsWith(".csproj")
          );
        }
      });

      setPackageJsonFiles(filteredFiles);

      if (filteredFiles.length === 0) {
        setError(`No ${fileType} dependency files found in this repository`);
      }
    } catch (err) {
      setError("Failed to search for dependency files");
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

      // Fetch the specific file
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
        throw new Error(`Failed to fetch ${selectedFile.path}`);
      }

      const { content } = await fileResponse.json();

      // Detect file type automatically
      const detectedType = detectFileType(selectedFile.path);
      setDetectedFileType(detectedType);

      if (detectedType === "unknown") {
        throw new Error("Unsupported file type detected");
      }

      // Create file and use appropriate endpoint
      const file = new File(
        [content],
        selectedFile.path.split("/").pop() || "dependency-file",
        {
          type: detectedType === "npm" ? "application/json" : "text/plain",
        }
      );

      const formData = new FormData();
      formData.append("file", file);

      const endpoint = getApiEndpoint(detectedType);
      const scanResponse = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!scanResponse.ok) {
        throw new Error("Failed to scan dependencies");
      }

      const scanResults = await scanResponse.json();

      if (scanResults.error) {
        throw new Error(scanResults.error);
      }

      setResults(scanResults);
      saveScanToHistory(selectedRepo, selectedFile, scanResults);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to scan dependencies"
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
        // JavaScript vulnerability format (your existing logic)
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
        data.vulnerabilities.forEach((vuln: any) => {
          const pkgName = vuln.packageName;
          if (!vulnsMap.has(pkgName)) {
            vulnsMap.set(pkgName, []);
          }
          vulnsMap.get(pkgName)!.push({
            severity: vuln.severity,
            title: vuln.title,
          });
        });
      } else if (detectedFileType === "rust" && data.vulnerabilities) {
        // Rust vulnerability format
        data.vulnerabilities.forEach((vuln: any) => {
          const pkgName = vuln.packageName;
          if (!vulnsMap.has(pkgName)) {
            vulnsMap.set(pkgName, []);
          }
          vulnsMap.get(pkgName)!.push({
            severity: vuln.severity,
            title: vuln.title,
          });
        });
      } else if (detectedFileType === "net" && data.audit) {
        // .NET vulnerability format
        data.audit.forEach((vuln: any) => {
          const pkgName = vuln.packageName;
          if (!vulnsMap.has(pkgName)) {
            vulnsMap.set(pkgName, []);
          }
          vulnsMap.get(pkgName)!.push({
            severity: vuln.severity,
            title: vuln.title,
          });
        });
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

  // Add this helper function to your component:
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

  const stats = getSummaryStats();

  // Scan history - optional, can be expanded later
  const [scanHistory, setScanHistory] = useState<
    Array<{
      id: string;
      repo_name: string;
      file_path: string;
      file_type: string;
      total_deps: number;
      outdated_count: number;
      major_count: number;
      scanned_at: string;
    }>
  >([]);

  // Load from localStorage on component mount
  // Load from API on component mount
  useEffect(() => {
    fetchScanHistory();
  }, []);

  const saveScanToHistory = async (
    repo: Repo,
    file: PackageJsonFile,
    scanResults: DependencyStatus[]
  ) => {
    const currentStats = {
      total: scanResults.length,
      current: scanResults.filter((r) => r.status === "current").length,
      outdated: scanResults.filter((r) => r.status === "outdated").length,
      major: scanResults.filter((r) => r.status === "major").length,
    };

    try {
      await fetch("/api/scan-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_name: repo.name,
          file_path: file.path,
          file_type: fileType,
          total_deps: currentStats.total,
          outdated_count: currentStats.outdated,
          major_count: currentStats.major,
        }),
      });

      // Refresh scan history after saving
      fetchScanHistory();
    } catch (error) {
      console.error("Failed to save scan history:", error);
    }
  };

  // Function to delete a scan from history
  const deleteScanFromHistory = async (scanId: string) => {
    try {
      await fetch(`/api/scan-history?id=${scanId}`, { method: "DELETE" });
      fetchScanHistory(); // Refresh the list
    } catch (error) {
      console.error("Failed to delete scan:", error);
    }
  };

  const handleRescan = async (scan: any) => {
    // First ensure repos are loaded
    if (repos.length === 0) {
      await fetchRepos();
    }

    const repo = repos.find((r) => r.name === scan.repo_name); // ← Changed
    if (!repo) {
      setError(`Repository "${scan.repo_name}" not found`);
      return;
    }

    setSelectedRepo(repo);
    setError("");
    setSearching(true);

    try {
      const [owner, repoName] = repo.full_name.split("/");
      const response = await fetch(
        `/api/github/file?owner=${owner}&repo=${repoName}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch repository files");
      }

      const data = await response.json();
      setPackageJsonFiles(data.files);

      const targetFile = data.files.find(
        (f: PackageJsonFile) => f.path === scan.file_path // ← Changed
      );

      if (targetFile) {
        setSelectedFile(targetFile);
        // Set the file type to match the scan
        setFileType(
          scan.file_type as
            | "javascript"
            | "python"
            | "go"
            | "php"
            | "rust"
            | "net"
        );

        // Auto-scan after setting file with a longer delay
        setTimeout(() => {
          if (selectedRepo && selectedFile) {
            // Double-check state is set
            scanPackageJson();
          }
        }, 500);
      } else {
        setError(`File "${scan.file_path}" not found in repository`);
      }
    } catch (err) {
      setError("Failed to rescan repository");
      console.error("Rescan error:", err);
    } finally {
      setSearching(false);
    }
  };

  const fetchScanHistory = async () => {
    try {
      const response = await fetch("/api/scan-history");
      const data = await response.json();
      setScanHistory(data.scans || []);
    } catch (error) {
      console.error("Failed to fetch scan history:", error);
    }
  };

  const fetchDailyCounts = async () => {
    try {
      const response = await fetch("/api/scan-counts");
      const data = await response.json();
      return data.dailyCounts || [];
    } catch (error) {
      console.error("Failed to fetch daily counts:", error);
      return [];
    }
  };

  // File type detection logic (same as file upload version)
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

  // Display info for file types
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

  //getting depedency files
  const searchAllDependencyFiles = async () => {
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
        throw new Error("Failed to search for dependency files");

      const data = await response.json();

      // Auto-detect and categorize all files
      const categorizedFiles = data.files
        .map((file: any) => ({
          ...file,
          detectedType: detectFileType(file.name),
          typeInfo: getFileTypeInfo(detectFileType(file.name)),
        }))
        .filter((file: any) => file.detectedType !== "unknown");

      setPackageJsonFiles(categorizedFiles);

      if (categorizedFiles.length === 0) {
        setError("No supported dependency files found in this repository");
      }
    } catch (err) {
      setError("Failed to search for dependency files");
    } finally {
      setSearching(false);
    }
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

  return (
    <div className="min-h-screen pt-20 space-y-6">
      <div className="max-w-4xl mx-auto p-6 space-y-6 bg-gray-900 rounded-lg shadow-lg">
        {/* GitHub Repository Selection */}
        <div className="bg-white rounded-lg shadow p-6 text-black">
          <div className="text-center mb-6 bg">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Package className="w-8 h-8 text-green-400" />
              <h2 className="text-2xl font-bold">GitHub Repository Scanner</h2>
            </div>
            <p className="text-gray-800">
              Connect to your GitHub repositories and scan package files
            </p>
          </div>

          {!repos.length ? (
            <div className="text-center">
              <button
                onClick={() => fetchRepos()}
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
                    setFileType("javascript");
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
              {hasMore && (
                <button
                  onClick={() => fetchRepos(page + 1)}
                  disabled={loadingMore}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingMore ? "Loading more..." : "Load More Repositories"}
                </button>
              )}

              {selectedRepo && (
                <div className="space-y-3">
                  <button
                    onClick={searchAllDependencyFiles}
                    disabled={searching}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {searching
                      ? "Scanning Repository..."
                      : "Find All Dependency Files"}
                  </button>

                  {packageJsonFiles.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-2">
                        Found {packageJsonFiles.length} dependency file(s) -
                        Select one to scan:
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
                          <SelectValue placeholder="Choose a dependency file..." />
                        </SelectTrigger>
                        <SelectContent>
                          {packageJsonFiles.map((file) => (
                            <SelectItem key={file.path} value={file.path}>
                              <div className="flex items-center space-x-2">
                                {file.typeInfo.icon}
                                <span>{file.typeInfo.label}</span>
                                <span className="text-gray-400">•</span>
                                <span>{file.path}</span>
                              </div>
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
          {/* Recent Scans - Only show if there are any */}
          {selectedFile && detectedFileType !== "unknown" && (
            <div className="mb-4 text-center">
              <div
                className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full ${
                  getFileTypeInfo(detectedFileType).bgColor
                }`}
              >
                {getFileTypeInfo(detectedFileType).icon}
                <span
                  className={`text-sm font-medium ${
                    getFileTypeInfo(detectedFileType).color
                  }`}
                >
                  {getFileTypeInfo(detectedFileType).label} •{" "}
                  {selectedFile.path}
                </span>
              </div>
            </div>
          )}
          {scanHistory.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Recent Scans
              </h3>
              <div className="space-y-2">
                {scanHistory.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-gray-900">
                        {scan.repo_name}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        {scan.file_path}
                      </span>
                      <div className="text-xs text-gray-400">
                        {new Date(scan.scanned_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-600">
                        {scan.total_deps} deps
                      </span>
                      {scan.outdated_count > 0 && (
                        <span className="text-sm text-yellow-600">
                          {scan.outdated_count} outdated
                        </span>
                      )}
                      {scan.major_count > 0 && (
                        <span className="text-sm text-red-600">
                          {scan.major_count} major
                        </span>
                      )}
                      <button
                        onClick={() => handleRescan(scan)}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Rescan
                      </button>
                      <button
                        onClick={() => deleteScanFromHistory(scan.id)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <>
            <div className="text-right">
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

                          <p className="text-sm text-gray-800">
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
                                      [{vuln.severity.toUpperCase()}]{" "}
                                      {vuln.title}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-start px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
    </div>
  );
}
