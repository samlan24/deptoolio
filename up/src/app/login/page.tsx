"use client"

import { createClient } from '../lib/supabase'
import { Github } from "lucide-react"
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - Pacgie",
  description: "Login to Pacgie to manage your projects and track dependencies.",
};

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
    <div className="flex min-h-screen pt-16 flex-col md:flex-row">
      {/* Left side */}
      <div className="flex flex-col items-center justify-center w-full md:w-1/2 bg-gray-900 text-white p-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-center">
          Welcome, Developer 🚀
        </h1>
        <p className="text-gray-300 mb-8 text-base md:text-lg text-center max-w-md">
          Manage your projects, track vulnerabilities, and stay ahead of updates.
          Built for devs who ship fast and secure.
        </p>
        <button
          onClick={handleGitHubSignIn}
          className="flex items-center gap-2 px-5 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition"
        >
          <Github className="w-5 h-5" />
          Sign in with GitHub
        </button>
      </div>

      {/* Right side */}
      <div className="hidden md:flex w-1/2 bg-gray-100 items-center justify-center p-8">
        <div className="max-w-sm">
          <pre className="bg-black text-green-400 text-sm p-4 rounded-lg shadow-lg">
{`> npm install secure-stack
✔ Dependencies up to date
✔ Ready to deploy`}
          </pre>
        </div>
      </div>
    </div>
  )
}
