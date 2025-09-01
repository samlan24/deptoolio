'use client'

import { createClient } from '../lib/supabase'
import {
  Package,
} from "lucide-react";

export default function LoginPage() {
  const supabase = createClient()

  const handleGitHubSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${location.origin}/dashboard`,
        scopes: 'read:user user:email repo'
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <button
        onClick={handleGitHubSignIn}
        className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
      >
        <Package className="w-5 h-5" />
        Sign in with GitHub
      </button>
    </div>
  )
}