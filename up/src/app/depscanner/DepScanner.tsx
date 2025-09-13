"use client";
import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  Folder,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../components/ui/select";
import { AsyncPaginate } from "react-select-async-paginate";
import type { GroupBase } from "react-select";

interface UnusedMissingResults {
  unusedDependencies: string[];
  missingDependencies: string[];
}

interface Repo {
  id: number;
  full_name: string;
  name: string;
  description: string;
  updated_at: string;
  private: boolean;
}

interface FolderItem {
  name: string;
  path: string;
}

export default function DepScanner() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  const [results, setResults] = useState<UnusedMissingResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
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
        setRepos(data.repos);
      } else {
        setRepos((prev) => [...prev, ...data.repos]);
      }
      setHasMore(data.repos.length === perPage);
      setPage(pageNumber);
    } catch (err) {
      setError("Failed to load repositories. Make sure you signed in with GitHub.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadFolders = async (repo: Repo) => {
    setSelectedRepo(repo);
    setSelectedFolder(null);
    setFolders([]);
    setResults(null);
    setError("");
    setLoadingFolders(true);
    try {
      const [owner, repoName] = repo.full_name.split("/");
      const response = await fetch(
        `/api/github/folders?owner=${owner}&repo=${repoName}&path=`
      );
      if (!response.ok) throw new Error("Failed to load folders");
      const data = await response.json();
      setFolders(data || []);
      if (data.length === 0) {
        setError("No folders found in this repository");
      }
    } catch (err) {
      setError("Failed to load folders from repository");
    } finally {
      setLoadingFolders(false);
    }
  };

  const loadRepoOptions = async (
    search: string,
    loadedOptions: import("react-select").OptionsOrGroups<Repo, GroupBase<Repo>>,
    additional?: { page: number }
  ): Promise<{
    options: Repo[];
    hasMore: boolean;
    additional: { page: number };
  }> => {
    const perPage = 10;
    const page = additional?.page ?? 1;
    const response = await fetch(
      `/api/github/repos?page=${page}&per_page=${perPage}`
    );
    if (!response.ok) throw new Error("Failed to fetch repositories");
    const data = await response.json();
    return {
      options: data.repos || [],
      hasMore: data.repos.length === perPage,
      additional: { page: page + 1 },
    };
  };

  const handleScan = async () => {
    if (!selectedRepo || !selectedFolder) {
      setError("Please select a repository and a folder");
      return;
    }
    setScanning(true);
    setResults(null);
    setError("");
    try {
      const [owner, repoName] = selectedRepo.full_name.split("/");
      const response = await fetch("/api/scan-unused-missing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo: repoName,
          path: selectedFolder.path,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Scan failed");
      }
      const data: UnusedMissingResults = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan dependencies");
    } finally {
      setScanning(false);
    }
  };

  const getSummaryStats = () => {
    if (!results) return { unused: 0, missing: 0, total: 0 };
    const unused = results.unusedDependencies.length;
    const missing = results.missingDependencies.length;
    const total = unused + missing;
    return { unused, missing, total };
  };

  const stats = getSummaryStats();

  return (
    <div className="min-h-screen pt-20 space-y-6">
      <div className="max-w-4xl mx-auto p-6 space-y-6 bg-gray-900 rounded-lg shadow-lg">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow p-6 text-black">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Search className="w-8 h-8 text-blue-400" />
              <h2 className="text-2xl font-bold">Dependency Usage Scanner</h2>
            </div>
            <p className="text-gray-800">
              Find unused and missing dependencies in your GitHub repositories
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
                <AsyncPaginate
                  value={selectedRepo}
                  loadOptions={loadRepoOptions}
                  getOptionLabel={(repo) => repo.name}
                  getOptionValue={(repo) => String(repo.id)}
                  additional={{ page: 1 }}
                  onChange={(repo) => {
                    if (repo) {
                      loadFolders(repo);
                    }
                  }}
                  placeholder="Choose a repository"
                  className="w-full bg-gray-700 text-black border border-gray-800 rounded-lg"
                />
              </div>
              {selectedRepo && (
                <div className="space-y-3">
                  {loadingFolders ? (
                    <div className="flex items-center space-x-2 text-gray-800">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      <span>Loading folders...</span>
                    </div>
                  ) : folders.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-2">
                        Select Folder to Scan
                      </label>
                      <Select
                        value={selectedFolder?.path || ""}
                        onValueChange={(value) => {
                          const folder = folders.find((f) => f.path === value);
                          if (folder) setSelectedFolder(folder);
                        }}
                      >
                        <SelectTrigger className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg">
                          <SelectValue placeholder="Choose a folder..." />
                        </SelectTrigger>
                        <SelectContent>
                          {folders.map((folder) => (
                            <SelectItem key={folder.path} value={folder.path}>
                              <div className="flex items-center space-x-2">
                                <Folder className="w-4 h-4" />
                                <span>{folder.path || "Root"}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {selectedFolder && (
                    <button
                      onClick={handleScan}
                      disabled={scanning}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {scanning ? (
                        <div className="flex items-center space-x-2 justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Scanning Dependencies...</span>
                        </div>
                      ) : (
                        `Scan ${selectedFolder.path || "Root"} Folder`
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
        {results && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Issues</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.unused}</div>
                <div className="text-sm text-gray-600">Unused</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.missing}</div>
                <div className="text-sm text-gray-600">Missing</div>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Dependency Analysis Results
            </h2>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              {/* Unused Dependencies */}
              {results.unusedDependencies.length > 0 && (
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                    Unused Dependencies ({results.unusedDependencies.length})
                  </h3>
                  <ul className="space-y-2">
                    {results.unusedDependencies.map((dep, index) => (
                      <li key={index} className="flex items-center space-x-3">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        <span className="text-gray-900">{dep}</span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Unused
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Dependencies */}
              {results.missingDependencies.length > 0 && (
                <div className="px-6 py-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    <XCircle className="w-5 h-5 text-red-500 mr-2" />
                    Missing Dependencies ({results.missingDependencies.length})
                  </h3>
                  <ul className="space-y-2">
                    {results.missingDependencies.map((dep, index) => (
                      <li key={index} className="flex items-center space-x-3">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-gray-900">{dep}</span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Missing
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* No issues found */}
              {results.unusedDependencies.length === 0 &&
                results.missingDependencies.length === 0 && (
                  <div className="px-6 py-8 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      All Dependencies Look Good!
                    </h3>
                    <p className="text-gray-600">
                      No unused or missing dependencies were found in this folder.
                    </p>
                  </div>
                )}
            </div>

            {/* Action suggestions */}
            {(results.unusedDependencies.length > 0 ||
              results.missingDependencies.length > 0) && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  Recommended Actions
                </h3>
                <ul className="text-sm text-blue-700 space-y-2">
                  {results.unusedDependencies.length > 0 && (
                    <li className="flex flex-col space-y-1">
                      <span> • Remove unused dependencies to reduce bundle size: </span>
                      <code className="bg-blue-100 text-blue-900 px-2 py-1 rounded text-xs ml-4">
                        npm uninstall {results.unusedDependencies.join(" ")}
                      </code>
                    </li>
                  )}
                  {results.missingDependencies.length > 0 && (
                    <li className="flex flex-col space-y-1">
                      <span>• Install missing dependencies:</span>
                      <code className="bg-blue-100 text-blue-900 px-2 py-1 rounded text-xs ml-4">
                        npm install {results.missingDependencies.join(" ")}
                      </code>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
