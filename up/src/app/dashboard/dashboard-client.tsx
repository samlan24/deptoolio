'use client'
import { useState } from 'react'
import { Clock, CreditCard, Settings } from 'lucide-react'

interface DashboardClientProps {
  user: any
}

function PastScansTab() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-white">Past Scans</h2>
      <div className="bg-gray-800 rounded-lg p-6">
        <p className="text-gray-400">No scans found. Start by scanning your first repository.</p>
      </div>
    </div>
  )
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
  )
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
            <label className="block text-white font-medium mb-2">Account Created</label>
            <p className="text-gray-400">{new Date(user?.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState('scans')

  const tabs = [
    { id: 'scans', label: 'Past Scans', icon: Clock },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'account', label: 'Account', icon: Settings },
  ]

  return (
    <div className="flex gap-8">
      {/* Left Sidebar */}
      <div className="w-64 bg-gray-800 rounded-lg p-4 h-fit">
        <nav className="space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {activeTab === 'scans' && <PastScansTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'account' && <AccountTab user={user} />}
      </div>
    </div>
  )
}