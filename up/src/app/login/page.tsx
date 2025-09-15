"use client"

import { createClient } from '../lib/supabase'
import { Github, Search, Shield, Zap } from "lucide-react"

export default function LoginPage() {
  const supabase = createClient()

  const handleGitHubSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: 'read:user user:email repo'
      }
    })
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Main content */}
      <div className="flex flex-col items-center justify-center w-full lg:w-3/5 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-8 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),transparent)]"></div>

        <div className="relative z-10 max-w-md w-full text-center">
          {/* Logo/Icon */}
          <div className="flex justify-center mb-8">
            <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
              <Search className="w-12 h-12 text-blue-400" />
            </div>
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Clean Your Dependencies
          </h1>

          <p className="text-gray-300 mb-8 text-lg leading-relaxed">
            Automatically scan your repositories for unused and missing dependencies.
            Keep your projects lean, secure, and up-to-date.
          </p>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 gap-4 mb-10 text-left">
            <div className="flex items-center gap-3 text-gray-300">
              <Shield className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span>Scan both public and private repositories</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Zap className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <span>Instant analysis with actionable insights</span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Github className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <span>Seamless GitHub integration</span>
            </div>
          </div>

          <button
            onClick={handleGitHubSignIn}
            className="group flex items-center justify-center gap-3 w-full px-8 py-4 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
          >
            <Github className="w-5 h-5 group-hover:rotate-12 transition-transform duration-200" />
            Continue with GitHub
          </button>

          <p className="text-gray-400 text-sm mt-4">
            Free to start • No credit card required
          </p>
        </div>
      </div>

      {/* Right side - Code preview */}
      <div className="hidden lg:flex w-2/5 bg-gray-50 items-center justify-center p-8 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100"></div>

        <div className="relative z-10 max-w-md w-full">
          <div className="bg-gray-900 rounded-lg shadow-2xl overflow-hidden border border-gray-700">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-400 text-sm ml-2">dependency-scan</span>
            </div>

            {/* Terminal content */}
            <div className="p-4 font-mono text-sm">
              <div className="text-gray-400 mb-2">$ deptoolio scan</div>
              <div className="text-blue-400 mb-1">🔍 Analyzing dependencies...</div>
              <div className="text-green-400 mb-1">✓ Found 8 unused packages</div>
              <div className="text-yellow-400 mb-1">⚠ 2 missing dependencies detected</div>
              <div className="text-gray-300 mb-3">📦 Bundle size reducible by 2.3MB</div>

              <div className="text-gray-400 mb-1">Recommendations:</div>
              <div className="text-red-300 text-xs">• Remove: lodash, moment</div>
              <div className="text-green-300 text-xs">• Install: @types/node</div>

              <div className="mt-3 text-gray-400">
                <span className="animate-pulse">▋</span>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm font-medium">
              Real-time dependency analysis
            </p>
            <p className="text-gray-500 text-xs mt-1">
              See exactly what's slowing down your projects
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}