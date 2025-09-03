"use client";
import { useState, useEffect } from "react";
import { Clock, CreditCard, Settings, Trash2, RotateCcw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardClientProps {
  user: any;
}

interface ScanHistoryItem {
  id: string;
  repo_name: string;
  file_path: string;
  file_type: string;
  total_deps: number;
  outdated_count: number;
  major_count: number;
  scanned_at: string;
}

interface DailyScanCount {
  scan_date: string;
  scan_count: number;
}

function PastScansTab() {
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [dailyCounts, setDailyCounts] = useState<DailyScanCount[]>([]);
  const [loading, setLoading] = useState(true);

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
      const response = await fetch("/api/scan-counts"); // Remove the ?days=7 parameter
      const data = await response.json();
      setDailyCounts(data.dailyCounts || []);
    } catch (error) {
      console.error("Failed to fetch daily counts:", error);
    }
  };

  const deleteScan = async (scanId: string) => {
    try {
      await fetch(`/api/scan-history?id=${scanId}`, { method: "DELETE" });
      fetchScanHistory(); // Refresh the list
    } catch (error) {
      console.error("Failed to delete scan:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchScanHistory(), fetchDailyCounts()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const formatChartData = () => {
    // Create array for last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      const existingData = dailyCounts.find(
        (item) => item.scan_date.split("T")[0] === dateStr
      );

      last7Days.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        scans: existingData ? parseInt(existingData.scan_count.toString()) : 0,
      });
    }
    return last7Days;
  };
  const totalScans = dailyCounts.reduce(
    (sum, item) => sum + parseInt(item.scan_count.toString()),
    0
  );

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6 text-white">Past Scans</h2>
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400">Loading scan history...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-white">Past Scans</h2>

      {/* Total Scans Summary */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">
          Total Scans (Last 7 Days)
        </h3>
        <p className="text-3xl font-bold text-blue-400">{totalScans}</p>
      </div>

      {/* Daily Scan Chart */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Daily Scan Activity (Last 7 Days)
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatChartData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                allowDecimals={false}
                domain={[0, "dataMax"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1F2937",
                  border: "1px solid #374151",
                  color: "#F9FAFB",
                }}
              />
              <Bar dataKey="scans" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function BillingTab() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-white">Billing</h2>
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="mb-4">
          <p className="text-white font-medium">Current Plan: Free Tier</p>
          <p className="text-gray-400 text-sm">10 manual uploads per month</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}

function AccountTab({ user }: { user: any }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-white">Account Settings</h2>
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-white font-medium mb-2">Email</label>
            <p className="text-gray-400">{user?.email}</p>
          </div>
          <div>
            <label className="block text-white font-medium mb-2">
              Account Created
            </label>
            <p className="text-gray-400">
              {new Date(user?.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState("scans");

  const tabs = [
    { id: "scans", label: "Past Scans", icon: Clock },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "account", label: "Account", icon: Settings },
  ];

  return (
    <div className="flex gap-8">
      {/* Left Sidebar */}
      <div className="w-64 bg-gray-800 rounded-lg p-4 h-fit">
        <nav className="space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {activeTab === "scans" && <PastScansTab />}
        {activeTab === "billing" && <BillingTab />}
        {activeTab === "account" && <AccountTab user={user} />}
      </div>
    </div>
  );
}
