import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import DashboardClient from "./RepoScanner";
import { redirect } from "next/navigation";
import RepoScanner from "./RepoScanner";

async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen pt-20 max-w-7xl mx-auto px-6">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-3xl font-bold mb-2 text-white text-center">
          Repository Dependency Scanner
        </h1>
        <p className="text-gray-400 text-center">
          Scan your GitHub repositories for outdated dependencies
        </p>
      </div>

      <RepoScanner />
    </div>
  );
}
