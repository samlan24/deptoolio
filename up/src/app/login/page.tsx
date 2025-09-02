"use client";

import { createClient } from '../lib/supabase';
import { Github } from "lucide-react";

export default function LoginPage() {
  const supabase = createClient();

  const handleGitHubSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: 'read:user user:email repo'
      }
    });
  };

  return (
    <div className="flex min-h-screen pt-16 flex-col md:flex-row bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-gray-200">
      {/* Left side: sign in */}
      <div className="flex flex-col items-center justify-center w-full md:w-1/2 p-10">
        <h1 className="text-4xl font-mono font-bold mb-6 text-center text-green-400 drop-shadow-md">
          Welcome to &lt;DevSec&gt; Portal 🚀
        </h1>
        <p className="max-w-md text-center text-gray-400 mb-10 leading-relaxed font-mono">
          Ship safe, ship fast. Monitor dependencies and stay alert to vulnerabilities.<br />
          Crafted for developers obsessed with secure code.
        </p>
        <button
          onClick={handleGitHubSignIn}
          className="flex items-center gap-3 px-8 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-mono font-semibold transition-shadow shadow-lg shadow-green-500/50"
          aria-label="Sign in with GitHub"
        >
          <Github className="w-6 h-6" />
          Sign in with GitHub
        </button>
      </div>

      {/* Right side: terminal-style showcase */}
      <div className="hidden md:flex w-1/2 bg-black bg-opacity-90 p-10 rounded-l-lg shadow-lg font-mono">
        <pre className="text-green-400 text-sm leading-relaxed max-w-md overflow-auto">
          {`$ git clone https://github.com/yourorg/secure-dep-checker.git
$ cd secure-dep-checker
$ npm install secure-dep-checker -g
$ sdc scan
✔ All dependencies checked
✔ Vulnerabilities: 0
$ sdc deploy --safe
🚀 Ready for launch. Code like a pro.`}
        </pre>
      </div>
    </div>
  );
}
