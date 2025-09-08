"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, CreditCard, Settings } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
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

interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  scan_limit: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
  lemon_squeezy_id?: string;
  status?: string;
}

interface PastScansTabProps {
  subscription: Subscription | null;
  monthlyUsage: number;
  loading: boolean;
}

function PastScansTab({
  subscription,
  monthlyUsage,
  loading,
}: PastScansTabProps) {
  const [dailyCounts, setDailyCounts] = useState<DailyScanCount[]>([]);

  const fetchDailyCounts = async () => {
    try {
      const response = await fetch("/api/scan-counts");
      const data = await response.json();
      setDailyCounts(data.dailyCounts || []);
    } catch (error) {
      console.error("Failed to fetch daily counts:", error);
    }
  };

  useEffect(() => {
    fetchDailyCounts();
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

      {/* Monthly Usage Summary */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-2">Monthly Usage</h3>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold text-blue-400">{monthlyUsage}</p>
          <p className="text-xl text-gray-400">
            / {subscription?.scan_limit ?? 10}
          </p>
        </div>
        <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              monthlyUsage >= (subscription?.scan_limit ?? 10)
                ? "bg-red-500"
                : monthlyUsage >= (subscription?.scan_limit ?? 10) * 0.8
                ? "bg-yellow-500"
                : "bg-blue-500"
            }`}
            style={{
              width: `${
                Math.min(
                  (monthlyUsage / (subscription?.scan_limit ?? 10)) * 100,
                  100
                ) ?? 0
              }%`,
            }}
          ></div>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          {(subscription?.scan_limit ?? 10) - monthlyUsage} scans remaining this
          month
        </p>
      </div>

      {/* Daily Scan Activity Chart */}
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

interface BillingTabProps {
  subscription: Subscription | null;
  monthlyUsage: number;
  loading: boolean;
}

function BillingTab({ subscription, loading }: BillingTabProps) {
  const handleSubscriptionAction = async (actionType: string) => {
    try {
      // Get fresh session client-side
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Please log in to manage your subscription");
        return;
      }

      const response = await fetch("/api/customer-portal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        alert(`API Error: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Portal error:", error);
      alert("Unable to open subscription portal");
    }
  };
  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6 text-white">Billing</h2>
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-400">Loading billing information...</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6 text-white">Billing</h2>
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-white font-medium">No active subscription</p>
          <Link href="/upgrade">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mt-4">
              Upgrade to Pro
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const { plan, scan_limit, status, period_end } = subscription;
  const periodEndDate = new Date(period_end);
  const now = new Date();
  const hasActiveAccess =
    status === "active" ||
    (status === "cancelled" && now <= periodEndDate) ||
    status === "past_due";

  // Status display logic
  const getStatusDisplay = () => {
    switch (status) {
      case "active":
        return { text: "Active", color: "text-green-400" };
      case "cancelled":
        return {
          text: "Cancelled (Active until period end)",
          color: "text-yellow-400",
        };
      case "past_due":
        return {
          text: "Payment Failed - Please Update",
          color: "text-red-400",
        };
      case "expired":
        return { text: "Expired", color: "text-red-400" };
      default:
        return { text: status ?? "Unknown", color: "text-gray-400" };
    }
  };

  const statusDisplay = getStatusDisplay();

  // Button logic
  const renderActionButton = () => {
    if (status === "cancelled") {
      return (
        <div className="space-y-2">
          <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded text-sm">
            Your subscription is cancelled but remains active until{" "}
            {periodEndDate.toLocaleDateString()}
          </div>
          <button
            onClick={() => handleSubscriptionAction("resume")}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm"
          >
            Resume Subscription
          </button>
        </div>
      );
    }

    if (status === "past_due") {
      return (
        <button
          onClick={() => handleSubscriptionAction("update-payment")}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        >
          Update Payment Method
        </button>
      );
    }

    if (status === "expired" || !hasActiveAccess) {
      return (
        <Link href="/upgrade">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Reactivate Subscription
          </button>
        </Link>
      );
    }

    if (plan === "free") {
      return (
        <Link href="/upgrade">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Upgrade to Pro
          </button>
        </Link>
      );
    }
    // Pro and active
    return (
      <div className="space-y-2">
        <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded text-sm">
          You're on the Pro plan - enjoy unlimited features!
        </div>
        <button
          onClick={() => handleSubscriptionAction("manage")}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
        >
          Manage Subscription
        </button>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-white">Billing</h2>
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="mb-6">
          <p className="text-white font-medium">
            Current Plan: {plan.charAt(0).toUpperCase() + plan.slice(1)}
          </p>
          <p className="text-gray-400 text-sm">{scan_limit} scans per month</p>
          <p className={`text-sm ${statusDisplay.color}`}>
            Status: {statusDisplay.text}
          </p>
          <p className="text-gray-400 text-sm">
            Current period ends: {periodEndDate.toLocaleDateString()}
          </p>

          {/* Days remaining indicator */}
          {hasActiveAccess && (
            <p className="text-gray-400 text-sm">
              {Math.max(
                0,
                Math.ceil(
                  (periodEndDate.getTime() - now.getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              )}{" "}
              days remaining
            </p>
          )}
        </div>

        {renderActionButton()}
      </div>
    </div>
  );
}

function AccountTab({ user, subscription }: { user: any; subscription: Subscription | null }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Please log in to delete your account");
        return;
      }

      const response = await fetch("/api/delete-account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        await supabase.auth.signOut();
        window.location.href = "/";
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || "Failed to delete account"}`);
      }
    } catch (error) {
      console.error("Delete account error:", error);
      alert("Unable to delete account");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const canDeleteAccount = () => {
    if (!subscription) return true;

    const now = new Date();
    const periodEnd = new Date(subscription.period_end);

    // Can delete if subscription is expired or not active
    return subscription.status === 'expired' ||
           (subscription.status === 'cancelled' && now > periodEnd) ||
           subscription.plan === 'free';
  };

  const handleSubscriptionAction = async (actionType: string) => {
    try {
      // Get fresh session client-side
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Please log in to manage your subscription");
        return;
      }

      const response = await fetch("/api/customer-portal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        alert(`API Error: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Portal error:", error);
      alert("Unable to open subscription portal");
    }
  };

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

        {/* Delete Account Section */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <h3 className="text-lg font-semibold text-red-400 mb-4">Danger Zone</h3>

          {!canDeleteAccount() ? (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <p className="text-red-300 mb-3">
                You must cancel your subscription before deleting your account.
              </p>
              <button
                onClick={() => handleSubscriptionAction("manage")}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
              >
                Manage Subscription
              </button>
            </div>
          ) : (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <p className="text-red-300 mb-3">
                This will permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
              >
                Delete Account
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Confirm Account Deletion</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete your account? This action is permanent and cannot be undone.
              All your data will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState("scans");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  useEffect(() => {
    const fetchSubscriptionAndUsage = async () => {
      try {
        setLoadingSubscription(true);
        const subResponse = await fetch("/api/subscription");
        const subData = await subResponse.json();
        setSubscription(subData.subscription ?? null);

        const usageResponse = await fetch("/api/monthly-usage");
        const usageData = await usageResponse.json();
        setMonthlyUsage(usageData.monthlyTotal ?? 0);

        setLoadingSubscription(false);
      } catch (error) {
        console.error("Failed to fetch subscription data:", error);
        setLoadingSubscription(false);
      }
    };
    fetchSubscriptionAndUsage();
  }, [user?.id]);

  useEffect(() => {
    const initializeAuth = async () => {
      // Force a session refresh on component mount
      try {
        await supabase.auth.refreshSession();
      } catch (error) {
        console.error("Failed to refresh session on mount:", error);
      }
    };

    initializeAuth();
  });

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
        {activeTab === "scans" && (
          <PastScansTab
            subscription={subscription}
            monthlyUsage={monthlyUsage}
            loading={loadingSubscription}
          />
        )}
        {activeTab === "billing" && (
          <BillingTab
            subscription={subscription}
            monthlyUsage={monthlyUsage}
            loading={loadingSubscription}
          />
        )}
        {activeTab === "account" && <AccountTab user={user} subscription={subscription} />}
      </div>
    </div>
  );
}
