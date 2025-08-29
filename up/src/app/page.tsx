'use client';

import { useState } from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface DependencyStatus {
  name: string;
  currentVersion: string;
  latestVersion: string;
  status: 'current' | 'outdated' | 'major';
}

export default function Home() {
  const [results, setResults] = useState<DependencyStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setResults([]); // Clear previous results on new upload
    setIsLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/check', {
        method: 'POST',
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
      console.error('Error uploading file:', error);
      alert('Unexpected error uploading the file.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'current':
        return <CheckCircle className="w-5 h-5 text-green-500" aria-label="Current" />;
      case 'outdated':
        return <AlertCircle className="w-5 h-5 text-yellow-500" aria-label="Outdated" />;
      case 'major':
        return <XCircle className="w-5 h-5 text-red-500" aria-label="Major update needed" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dependency Tracker</h1>
          <p className="text-gray-600 mb-8">
            Upload your <code>package.json</code> to check dependency status
          </p>

          <label
            htmlFor="file-upload"
            className="relative cursor-pointer bg-white rounded-lg shadow-sm border border-gray-300 px-6 py-4 hover:border-gray-400 transition-colors inline-block"
          >
            <span className="text-gray-700">Upload package.json</span>
            <input
              id="file-upload"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isLoading}
              aria-disabled={isLoading}
            />
          </label>
        </div>

        {isLoading && (
          <div className="mt-12 text-center" role="status" aria-live="polite">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Checking dependencies...</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Results</h2>
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <ul className="divide-y divide-gray-200">
                {results.map((dep, index) => (
                  <li key={index} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(dep.status)}
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{dep.name}</h3>
                          <p className="text-sm text-gray-500">
                            Your version: {dep.currentVersion} → Latest: {dep.latestVersion}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          dep.status === 'current'
                            ? 'bg-green-100 text-green-800'
                            : dep.status === 'outdated'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {dep.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
